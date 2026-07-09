/**
 * Server-only Hyperliquid public-API client for the AI Trade Setup feature.
 *
 * Fetches perp state (mark/oracle price, hourly funding + 7d history, open
 * interest, 1h/4h candles) from the keyless https://api.hyperliquid.xyz/info
 * endpoint and derives the prompt-ready signals: 24h VWAP, funding 7d
 * percentile, and an ESTIMATED liquidation-cluster map.
 *
 * Liq clusters are estimates, not exchange-reported: Hyperliquid exposes no
 * aggregate liquidation map, so we assume positions opened at each 1h candle's
 * typical price across common leverage tiers, weight by traded notional with
 * an age decay, and scale to current open interest. Locations are meaningful;
 * absolute dollar sizes are indicative. Everything downstream must label them
 * "est." (the `method` field carries this caveat into the prompt).
 *
 * Ported from the reference implementation in .claude/skills/setup/fetch.mjs.
 * v1 deliberately omits the cross-run OI delta the script kept in a state
 * file: the container FS is wiped on deploy, and Coinglass already supplies
 * authoritative open_interest_change_percent_{1h,4h,24h} for the prompt.
 */
import "server-only";

import type { SetupCoin } from "@/lib/setup-schema";

const API = "https://api.hyperliquid.xyz/info";
const HOUR = 3_600_000;

interface HlAssetCtx {
  funding: string;
  openInterest: string;
  prevDayPx: string;
  dayNtlVlm: string;
  oraclePx: string;
  markPx: string;
  midPx: string;
}

interface HlMeta {
  universe: { name: string; maxLeverage: number; isDelisted?: boolean }[];
}

interface HlCandle {
  t: number; // open time ms
  o: string;
  h: string;
  l: string;
  c: string;
  v: string; // base volume
}

interface HlFundingPoint {
  fundingRate: string;
  time: number;
}

export interface CompactCandle {
  t: string; // ISO minute, e.g. "2026-07-09T08:00"
  o: number;
  h: number;
  l: number;
  c: number;
  volUsd: number;
}

export interface LiqCluster {
  priceLow: number;
  priceHigh: number;
  estNotionalUsd: number;
}

export interface HlSnapshot {
  coin: SetupCoin;
  fetchedAt: string;
  price: {
    mark: number;
    oracle: number;
    mid: number;
    prevDayPx: number;
    change24hPct: number;
    vwap24h: number | null;
    high7d: number;
    low7d: number;
  };
  derivatives: {
    fundingHourlyPct: number;
    fundingAnnualizedPct: number;
    funding7dPercentile: number | null;
    fundingAvg7dHourlyPct: number | null;
    negativeFundingHoursLast7d: number;
    openInterestCoins: number;
    openInterestUsd: number;
    volume24hUsd: number;
    maxLeverage: number;
  };
  liqClusters: {
    method: string;
    longLiqBelowPrice: LiqCluster[];
    shortLiqAbovePrice: LiqCluster[];
  };
  candles1hLast48: CompactCandle[];
  candles4hLast14d: CompactCandle[];
}

async function info<T>(body: Record<string, unknown>): Promise<T> {
  // `no-store` is safe here: this module is only imported by force-dynamic
  // POST route handlers, never by ISR pages — the "Dynamic server usage"
  // bailout documented in coinglass.ts does not apply.
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Hyperliquid API ${res.status} for ${String(body.type)}`);
  return (await res.json()) as T;
}

function buildSnapshot(
  coin: SetupCoin,
  now: number,
  metaAndCtxs: [HlMeta, HlAssetCtx[]],
  candles1h: HlCandle[],
  candles4h: HlCandle[],
  fundingHist: HlFundingPoint[],
): HlSnapshot {
  const [meta, ctxs] = metaAndCtxs;
  const idx = meta.universe.findIndex((u) => u.name === coin);
  if (idx < 0) throw new Error(`Coin not on Hyperliquid: ${coin}`);
  const ctx = ctxs[idx];
  const maxLeverage = meta.universe[idx].maxLeverage;

  const mark = +ctx.markPx;
  const oiCoins = +ctx.openInterest;
  const oiUsd = oiCoins * mark;
  const prevDayPx = +ctx.prevDayPx;
  const fundingHourly = +ctx.funding; // fraction per hour

  // Funding stats over 7d. Midpoint rank so a flat series (HL clamps at the
  // floor rate for long stretches) reads ~50, not 0.
  const rates = fundingHist.map((f) => +f.fundingRate);
  const below = rates.filter((r) => r < fundingHourly).length;
  const equal = rates.filter((r) => r === fundingHourly).length;
  const funding7dPercentile = rates.length
    ? Math.round(((below + equal / 2) / rates.length) * 100)
    : null;
  const fundingAvg7d = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : null;
  const negativeFundingHoursLast7d = rates.filter((r) => r < 0).length;

  // 24h VWAP from 1h candles.
  const last24 = candles1h.slice(-24);
  const vwapNum = last24.reduce((a, c) => a + +c.v * ((+c.h + +c.l + +c.c) / 3), 0);
  const vwapDen = last24.reduce((a, c) => a + +c.v, 0);
  const vwap24h = vwapDen ? vwapNum / vwapDen : null;

  // Estimated liquidation clusters: for each 1h candle in the last 7d assume
  // positions opened at typical price across leverage tiers, liq at
  // entry*(1 ∓ 1/L), weight by traded notional decayed by age (~4-day
  // half-life-ish — older entries are more likely already closed), then scale
  // each side to its share of current OI notional.
  const tiers = [
    { lev: 5, w: 0.3 },
    { lev: 10, w: 0.35 },
    { lev: 20, w: 0.25 },
    { lev: Math.min(40, maxLeverage), w: 0.1 },
  ];
  const bin = mark > 10_000 ? 250 : mark > 100 ? mark * 0.004 : mark * 0.005;
  const longBins = new Map<number, number>();
  const shortBins = new Map<number, number>();
  for (const c of candles1h) {
    const entry = (+c.h + +c.l + +c.c) / 3;
    const ageH = (now - c.t) / HOUR;
    const w = +c.v * entry * Math.exp(-ageH / 96);
    for (const { lev, w: tw } of tiers) {
      const liqLong = entry * (1 - 1 / lev);
      const liqShort = entry * (1 + 1 / lev);
      if (liqLong < mark) {
        const k = Math.round(liqLong / bin) * bin;
        longBins.set(k, (longBins.get(k) ?? 0) + w * tw);
      }
      if (liqShort > mark) {
        const k = Math.round(liqShort / bin) * bin;
        shortBins.set(k, (shortBins.get(k) ?? 0) + w * tw);
      }
    }
  }
  const topClusters = (bins: Map<number, number>, sideTotalUsd: number, n = 6): LiqCluster[] => {
    // Clusters beyond ~12% of mark are stale/low-leverage noise, not
    // actionable magnets.
    const raw = [...bins.entries()].filter(([px]) => Math.abs(px - mark) / mark <= 0.12);
    const total = raw.reduce((a, [, v]) => a + v, 0) || 1;
    return raw
      .map(([px, v]) => ({ price: px, estUsd: (v / total) * sideTotalUsd }))
      .sort((a, b) => b.estUsd - a.estUsd)
      .slice(0, n)
      .sort((a, b) => b.price - a.price)
      .map((c) => ({
        priceLow: c.price - bin / 2,
        priceHigh: c.price + bin / 2,
        estNotionalUsd: Math.round(c.estUsd),
      }));
  };
  // Perp OI itself is symmetric; split by funding sign as a crowding proxy.
  const longShare =
    fundingHourly >= 0 ? 0.5 + Math.min(0.2, (funding7dPercentile ?? 50) / 500) : 0.4;

  const compact = (c: HlCandle): CompactCandle => ({
    t: new Date(c.t).toISOString().slice(0, 16),
    o: +c.o,
    h: +c.h,
    l: +c.l,
    c: +c.c,
    volUsd: Math.round(+c.v * ((+c.h + +c.l) / 2)),
  });

  return {
    coin,
    fetchedAt: new Date(now).toISOString(),
    price: {
      mark,
      oracle: +ctx.oraclePx,
      mid: +ctx.midPx,
      prevDayPx,
      change24hPct: +(((mark - prevDayPx) / prevDayPx) * 100).toFixed(2),
      vwap24h: vwap24h != null ? +vwap24h.toFixed(1) : null,
      high7d: Math.max(...candles1h.map((c) => +c.h)),
      low7d: Math.min(...candles1h.map((c) => +c.l)),
    },
    derivatives: {
      fundingHourlyPct: +(fundingHourly * 100).toFixed(5),
      fundingAnnualizedPct: +(fundingHourly * 24 * 365 * 100).toFixed(1),
      funding7dPercentile,
      fundingAvg7dHourlyPct: fundingAvg7d != null ? +(fundingAvg7d * 100).toFixed(5) : null,
      negativeFundingHoursLast7d,
      openInterestCoins: +oiCoins.toFixed(1),
      openInterestUsd: Math.round(oiUsd),
      volume24hUsd: Math.round(+ctx.dayNtlVlm),
      maxLeverage,
    },
    liqClusters: {
      method:
        "ESTIMATE: volume-weighted entries x leverage tiers, scaled to current OI — not exchange-reported",
      longLiqBelowPrice: topClusters(longBins, oiUsd * longShare),
      shortLiqAbovePrice: topClusters(shortBins, oiUsd * (1 - longShare)),
    },
    candles1hLast48: candles1h.slice(-48).map(compact),
    candles4hLast14d: candles4h.map(compact),
  };
}

// One upstream burst per coin per TTL per server process, deduped across
// concurrent requests — same pattern as fundingMemo in coinglass.ts. Failed
// fetches are not memoized so the next request retries immediately.
const SNAPSHOT_TTL_MS = 60_000;
const snapshotMemo = new Map<SetupCoin, { at: number; promise: Promise<HlSnapshot> }>();

export function fetchHyperliquidSnapshot(coin: SetupCoin): Promise<HlSnapshot> {
  const now = Date.now();
  const memo = snapshotMemo.get(coin);
  if (memo && now - memo.at < SNAPSHOT_TTL_MS) return memo.promise;

  const promise = Promise.all([
    info<[HlMeta, HlAssetCtx[]]>({ type: "metaAndAssetCtxs" }),
    info<HlCandle[]>({
      type: "candleSnapshot",
      req: { coin, interval: "1h", startTime: now - 168 * HOUR, endTime: now },
    }),
    info<HlCandle[]>({
      type: "candleSnapshot",
      req: { coin, interval: "4h", startTime: now - 14 * 24 * HOUR, endTime: now },
    }),
    info<HlFundingPoint[]>({ type: "fundingHistory", coin, startTime: now - 168 * HOUR }),
  ]).then(
    ([metaAndCtxs, candles1h, candles4h, fundingHist]) =>
      buildSnapshot(coin, now, metaAndCtxs, candles1h, candles4h, fundingHist),
    (err) => {
      snapshotMemo.delete(coin);
      throw err;
    },
  );

  snapshotMemo.set(coin, { at: now, promise });
  return promise;
}

/**
 * Compact snapshot for chat follow-ups: derivatives block + top clusters,
 * no candle arrays (~1.5K tokens instead of ~6K).
 */
export async function fetchCompactSnapshot(coin: SetupCoin) {
  const s = await fetchHyperliquidSnapshot(coin);
  return {
    coin: s.coin,
    fetchedAt: s.fetchedAt,
    price: s.price,
    derivatives: s.derivatives,
    liqClusters: {
      method: s.liqClusters.method,
      longLiqBelowPrice: s.liqClusters.longLiqBelowPrice.slice(0, 3),
      shortLiqAbovePrice: s.liqClusters.shortLiqAbovePrice.slice(0, 3),
    },
  };
}
