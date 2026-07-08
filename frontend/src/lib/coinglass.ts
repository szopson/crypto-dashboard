/**
 * Server-only Coinglass v4 client.
 *
 * Aggregates derivatives + ETF + liquidation data into a single "Crypto Macro
 * Pulse" snapshot consumed by the /api/crypto-pulse route.
 *
 * The API key (COINGLASS_API_KEY) MUST never reach the client; this module is
 * marked server-only and may only be imported from API routes or server
 * components. The widget component fetches the assembled snapshot from
 * /api/crypto-pulse instead of calling Coinglass directly.
 */
import "server-only";

const BASE = "https://open-api-v4.coinglass.com";

/**
 * Resolve the Coinglass API key tolerantly. Prod stores it in engine/.env under
 * a non-standard name (`coinglass`), so we also scan any env var whose name
 * contains "coinglass" and whose value looks like a 32-hex key. Server-only.
 */
export function resolveCoinglassKey(): string | undefined {
  const direct = process.env.COINGLASS_API_KEY?.trim();
  if (direct) return direct;
  for (const [k, v] of Object.entries(process.env)) {
    if (/coinglass/i.test(k) && v && /^[a-f0-9]{32}$/i.test(v.trim())) return v.trim();
  }
  return undefined;
}

interface CoinMarket {
  symbol: string;
  current_price: number;
  market_cap_usd: number;
  open_interest_usd: number;
  open_interest_market_cap_ratio: number;
  avg_funding_rate_by_oi: number;
  avg_funding_rate_by_vol: number;
  price_change_percent_1h: number;
  price_change_percent_4h: number;
  price_change_percent_24h: number;
  open_interest_change_percent_1h: number;
  open_interest_change_percent_4h: number;
  open_interest_change_percent_24h: number;
  long_short_ratio_1h: number;
  long_short_ratio_4h: number;
  long_short_ratio_24h: number;
  liquidation_usd_1h: number;
  liquidation_usd_4h: number;
  liquidation_usd_24h: number;
  long_liquidation_usd_24h: number;
  short_liquidation_usd_24h: number;
}

interface ETFFlowDay {
  timestamp: number;
  flow_usd: number;
  price_usd: number;
  etf_flows?: { etf_ticker: string; flow_usd: number }[];
}

interface LongShortPoint {
  time: number;
  global_account_long_percent?: number;
  global_account_short_percent?: number;
  global_account_long_short_ratio?: number;
  top_account_long_percent?: number;
  top_account_short_percent?: number;
  top_account_long_short_ratio?: number;
}

/**
 * A structured, typed deviation — the cockpit renders these as highlighted
 * "something is off" cards rather than raw numbers. `signals` (string[]) is
 * kept for the legacy widget and the daily digest; `deviations` is the machine
 * readable version the Derivatives Cockpit consumes.
 */
export type DeviationKind =
  | "funding_hot"
  | "funding_cold"
  | "funding_flip"
  | "funding_dispersion"
  | "oi_spike"
  | "oi_drop_price_up"
  | "oi_up_price_down"
  | "liq_cluster"
  | "ls_extreme"
  | "positioning_divergence"
  | "etf_inflow"
  | "etf_outflow";

export interface Deviation {
  kind: DeviationKind;
  severity: "info" | "watch" | "alert";
  symbol: string; // "BTC" | "ETH" | "SOL" | "MKT"
  headline: string; // terse, e.g. "Funding flipped negative"
  detail: string; // one line of context
  direction: "bullish" | "bearish" | "neutral";
}

export interface CockpitCoin {
  symbol: string;
  price: number;
  funding_rate_oi: number; // %
  oi_usd: number;
  oi_change_1h_pct: number;
  oi_change_4h_pct: number;
  oi_change_24h_pct: number;
  long_short_1h: number;
  long_short_4h: number;
  long_short_24h: number;
  price_change_1h_pct: number;
  price_change_4h_pct: number;
  price_change_24h_pct: number;
  liquidation_1h_usd: number;
  liquidation_4h_usd: number;
  liquidation_24h_usd: number;
  long_liq_24h_usd: number;
  short_liq_24h_usd: number;
}

export interface CryptoPulseSnapshot {
  generated_at: string;
  coins: CockpitCoin[];
  funding_aggregate: {
    btc_avg_pct: number | null;
    eth_avg_pct: number | null;
    btc_exchanges: { exchange: string; rate_pct: number }[];
    // Cross-exchange dispersion (max − min) from the exchange list above.
    // A wide spread flags venue divergence (institutional vs retail venue),
    // the same signal Velo surfaces more granularly — added there later.
    btc_spread_pct: number | null;
    btc_max: { exchange: string; rate_pct: number } | null;
    btc_min: { exchange: string; rate_pct: number } | null;
  };
  etf: {
    btc_24h_flow_usd: number | null;
    btc_7d_flow_usd: number | null;
    btc_last_timestamp: number | null;
    breakdown_24h: { ticker: string; flow_usd: number }[];
  };
  positioning: {
    retail_long_pct: number | null;
    top_trader_long_pct: number | null;
    divergence_pct: number | null; // top_trader - retail
  };
  signals: string[]; // human-readable interpretation tags (legacy widget + digest)
  deviations: Deviation[]; // structured, cockpit-consumed
  source: "coinglass.v4";
}

async function cgGet<T = unknown>(path: string): Promise<T | null> {
  const key = resolveCoinglassKey();
  if (!key) return null;
  try {
    // NOTE: must be ISR-compatible. `cache: "no-store"` makes Next throw a
    // "Dynamic server usage" bailout during static/ISR rendering of the
    // consumers (route + /cockpit page, both `revalidate = 60`) — and the
    // catch below would swallow it, caching an all-zero snapshot. A
    // revalidate-tagged fetch caches the data itself for 60s instead.
    const res = await fetch(`${BASE}${path}`, {
      headers: { "CG-API-KEY": key },
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { code?: number | string; msg?: string; data?: T };
    // Coinglass v4 returns code as a string ("0") not a number — accept both.
    if (j.code != null && String(j.code) !== "0") return null;
    return j.data ?? null;
  } catch {
    return null;
  }
}

function pickCoin(markets: CoinMarket[] | null, symbol: string): CoinMarket | undefined {
  return markets?.find((m) => m.symbol === symbol);
}

export async function fetchCryptoPulse(): Promise<CryptoPulseSnapshot> {
  const symbols = ["BTC", "ETH", "SOL"];

  const [markets, btcFunding, etfFlows, retailLS, topLS] = await Promise.all([
    cgGet<CoinMarket[]>("/api/futures/coins-markets"),
    cgGet<
      {
        symbol: string;
        stablecoin_margin_list?: { exchange: string; funding_rate: number }[];
      }[]
    >("/api/futures/funding-rate/exchange-list?symbol=BTC"),
    cgGet<ETFFlowDay[]>("/api/etf/bitcoin/flow-history?asset=BTC"),
    cgGet<LongShortPoint[]>(
      "/api/futures/global-long-short-account-ratio/history?exchange=Binance&symbol=BTCUSDT&interval=1h&limit=4",
    ),
    cgGet<LongShortPoint[]>(
      "/api/futures/top-long-short-account-ratio/history?exchange=Binance&symbol=BTCUSDT&interval=1h&limit=4",
    ),
  ]);

  const coins: CockpitCoin[] = symbols.map((sym) => {
    const m = pickCoin(markets, sym);
    return {
      symbol: sym,
      price: m?.current_price ?? 0,
      funding_rate_oi: m?.avg_funding_rate_by_oi ?? 0,
      oi_usd: m?.open_interest_usd ?? 0,
      oi_change_1h_pct: m?.open_interest_change_percent_1h ?? 0,
      oi_change_4h_pct: m?.open_interest_change_percent_4h ?? 0,
      oi_change_24h_pct: m?.open_interest_change_percent_24h ?? 0,
      long_short_1h: m?.long_short_ratio_1h ?? 0,
      long_short_4h: m?.long_short_ratio_4h ?? 0,
      long_short_24h: m?.long_short_ratio_24h ?? 0,
      price_change_1h_pct: m?.price_change_percent_1h ?? 0,
      price_change_4h_pct: m?.price_change_percent_4h ?? 0,
      price_change_24h_pct: m?.price_change_percent_24h ?? 0,
      liquidation_1h_usd: m?.liquidation_usd_1h ?? 0,
      liquidation_4h_usd: m?.liquidation_usd_4h ?? 0,
      liquidation_24h_usd: m?.liquidation_usd_24h ?? 0,
      long_liq_24h_usd: m?.long_liquidation_usd_24h ?? 0,
      short_liq_24h_usd: m?.short_liquidation_usd_24h ?? 0,
    };
  });

  // BTC funding aggregate across exchanges
  const btcExchanges = (btcFunding ?? [])
    .find((r) => r.symbol === "BTC")
    ?.stablecoin_margin_list?.slice(0, 8)
    .map((e) => ({ exchange: e.exchange, rate_pct: e.funding_rate })) ?? [];
  const btcAvg = btcExchanges.length
    ? btcExchanges.reduce((s, e) => s + e.rate_pct, 0) / btcExchanges.length
    : null;
  const ethCoin = pickCoin(markets, "ETH");
  const ethAvg = ethCoin?.avg_funding_rate_by_oi ?? null;

  // Cross-exchange funding dispersion: which venue is richest/cheapest and by
  // how much. Wide spread = venue divergence worth an execution edge.
  const sortedFunding = btcExchanges.slice().sort((a, b) => a.rate_pct - b.rate_pct);
  const btcMin = sortedFunding[0] ?? null;
  const btcMax = sortedFunding[sortedFunding.length - 1] ?? null;
  const btcSpread =
    btcMin && btcMax ? btcMax.rate_pct - btcMin.rate_pct : null;

  // ETF flows: 24h + 7d sum
  const flowsSorted = (etfFlows ?? []).slice().sort((a, b) => b.timestamp - a.timestamp);
  const last = flowsSorted[0];
  const last7 = flowsSorted.slice(0, 7);
  const btc24h = last?.flow_usd ?? null;
  const btc7d = last7.length ? last7.reduce((s, d) => s + (d.flow_usd ?? 0), 0) : null;
  const breakdown = (last?.etf_flows ?? []).slice(0, 10).map((e) => ({
    ticker: e.etf_ticker,
    flow_usd: e.flow_usd,
  }));

  // Positioning: latest retail vs top trader
  const retail = retailLS?.[retailLS.length - 1];
  const top = topLS?.[topLS.length - 1];
  const retailLong = retail?.global_account_long_percent ?? null;
  const topLong = top?.top_account_long_percent ?? null;
  const divergence = retailLong != null && topLong != null ? topLong - retailLong : null;

  // Heuristic signals. Coinglass returns funding rates as percent-per-8h
  // (e.g. 0.01 means 0.01% per 8h ≈ 11% APR). Thresholds chosen accordingly.
  const signals: string[] = [];
  if (btcAvg != null && btcAvg > 0.03) signals.push(`BTC funding hot (${btcAvg.toFixed(4)}%/8h) — contrarian short bias`);
  else if (btcAvg != null && btcAvg > 0.015) signals.push(`BTC funding elevated (${btcAvg.toFixed(4)}%/8h)`);
  if (btcAvg != null && btcAvg < -0.005) signals.push(`BTC funding negative (${btcAvg.toFixed(4)}%/8h) — contrarian long bias`);
  if (btc24h != null && btc24h > 200_000_000) signals.push(`Strong ETF inflow 24h ($${(btc24h / 1e6).toFixed(0)}M) — institutional bid`);
  if (btc24h != null && btc24h < -100_000_000) signals.push(`Net ETF outflow 24h ($${(btc24h / 1e6).toFixed(0)}M) — institutional risk-off`);
  if (btc7d != null && btc7d < -500_000_000) signals.push(`7d ETF cumulative outflow $${(btc7d / 1e6).toFixed(0)}M — sustained institutional selling`);
  if (btc7d != null && btc7d > 1_000_000_000) signals.push(`7d ETF cumulative inflow $${(btc7d / 1e6).toFixed(0)}M — sustained institutional buying`);
  if (divergence != null && divergence < -8) signals.push("Top traders less long than retail — distribution risk");
  if (divergence != null && divergence > 8) signals.push("Top traders more long than retail — accumulation");
  const btcCoin = pickCoin(markets, "BTC");
  if (btcCoin?.open_interest_change_percent_24h && btcCoin.open_interest_change_percent_24h < -3 && btcCoin.price_change_percent_24h && btcCoin.price_change_percent_24h > 0) {
    signals.push("OI dropping while price rises — short squeeze ending");
  }
  if (btcCoin?.open_interest_change_percent_24h && btcCoin.open_interest_change_percent_24h > 5 && btcCoin.price_change_percent_24h && btcCoin.price_change_percent_24h < 0) {
    signals.push("OI rising while price falls — leveraged shorts adding, squeeze risk");
  }

  const deviations = buildDeviations({
    coins,
    btcAvg,
    btcSpread,
    btcMax,
    btcMin,
    btc24h,
    btc7d,
    divergence,
  });

  return {
    generated_at: new Date().toISOString(),
    coins,
    funding_aggregate: {
      btc_avg_pct: btcAvg,
      eth_avg_pct: ethAvg,
      btc_exchanges: btcExchanges,
      btc_spread_pct: btcSpread,
      btc_max: btcMax,
      btc_min: btcMin,
    },
    etf: {
      btc_24h_flow_usd: btc24h,
      btc_7d_flow_usd: btc7d,
      btc_last_timestamp: last?.timestamp ?? null,
      breakdown_24h: breakdown,
    },
    positioning: {
      retail_long_pct: retailLong,
      top_trader_long_pct: topLong,
      divergence_pct: divergence,
    },
    signals,
    deviations,
    source: "coinglass.v4",
  };
}

/**
 * Turn raw derivatives numbers into a small set of typed deviations. Thresholds
 * mirror the string-signal heuristics but are structured so the cockpit can
 * rank, colour and (Phase 2) attach an execution CTA to each. Funding rates are
 * percent-per-8h (Coinglass convention).
 */
function buildDeviations(x: {
  coins: CockpitCoin[];
  btcAvg: number | null;
  btcSpread: number | null;
  btcMax: { exchange: string; rate_pct: number } | null;
  btcMin: { exchange: string; rate_pct: number } | null;
  btc24h: number | null;
  btc7d: number | null;
  divergence: number | null;
}): Deviation[] {
  const out: Deviation[] = [];
  const { btcAvg, btcSpread, btcMax, btcMin, btc24h, btc7d, divergence } = x;

  // Funding regime
  if (btcAvg != null) {
    if (btcAvg > 0.03)
      out.push({
        kind: "funding_hot",
        severity: "alert",
        symbol: "BTC",
        headline: "Funding overheated",
        detail: `Avg ${btcAvg.toFixed(4)}%/8h — crowded longs, contrarian short bias`,
        direction: "bearish",
      });
    else if (btcAvg > 0.015)
      out.push({
        kind: "funding_hot",
        severity: "watch",
        symbol: "BTC",
        headline: "Funding elevated",
        detail: `Avg ${btcAvg.toFixed(4)}%/8h — longs paying up`,
        direction: "bearish",
      });
    if (btcAvg < -0.005)
      out.push({
        kind: "funding_cold",
        severity: "alert",
        symbol: "BTC",
        headline: "Funding negative",
        detail: `Avg ${btcAvg.toFixed(4)}%/8h — shorts paying, contrarian long bias`,
        direction: "bullish",
      });
  }

  // Cross-exchange funding dispersion
  if (btcSpread != null && btcMax && btcMin && btcSpread > 0.01)
    out.push({
      kind: "funding_dispersion",
      severity: btcSpread > 0.03 ? "alert" : "watch",
      symbol: "BTC",
      headline: "Funding split across venues",
      detail: `${btcMax.exchange} ${btcMax.rate_pct.toFixed(4)}% vs ${btcMin.exchange} ${btcMin.rate_pct.toFixed(4)}% (Δ ${btcSpread.toFixed(4)}%/8h)`,
      direction: "neutral",
    });

  // Per-coin OI / price structure + liquidation clusters
  for (const c of x.coins) {
    if (c.oi_change_24h_pct < -3 && c.price_change_24h_pct > 0)
      out.push({
        kind: "oi_drop_price_up",
        severity: "watch",
        symbol: c.symbol,
        headline: "OI falling as price rises",
        detail: `OI ${c.oi_change_24h_pct.toFixed(1)}% / price +${c.price_change_24h_pct.toFixed(1)}% — short squeeze cooling`,
        direction: "neutral",
      });
    if (c.oi_change_24h_pct > 5 && c.price_change_24h_pct < 0)
      out.push({
        kind: "oi_up_price_down",
        severity: "alert",
        symbol: c.symbol,
        headline: "OI rising as price falls",
        detail: `OI +${c.oi_change_24h_pct.toFixed(1)}% / price ${c.price_change_24h_pct.toFixed(1)}% — leveraged shorts adding, squeeze risk`,
        direction: "bullish",
      });
    if (c.oi_change_1h_pct > 4)
      out.push({
        kind: "oi_spike",
        severity: "watch",
        symbol: c.symbol,
        headline: "OI spiking (1h)",
        detail: `+${c.oi_change_1h_pct.toFixed(1)}% in 1h — fresh leverage entering`,
        direction: "neutral",
      });
    // Liquidation cluster: last 1h is a large fraction of the 24h total.
    if (c.liquidation_1h_usd > 25_000_000 && c.liquidation_1h_usd > 0.25 * (c.liquidation_24h_usd || 1))
      out.push({
        kind: "liq_cluster",
        severity: "alert",
        symbol: c.symbol,
        headline: "Liquidation cluster (1h)",
        detail: `$${(c.liquidation_1h_usd / 1e6).toFixed(0)}M in 1h — cascade in progress`,
        direction: "neutral",
      });
  }

  // Positioning divergence: top traders vs retail
  if (divergence != null) {
    if (divergence < -8)
      out.push({
        kind: "positioning_divergence",
        severity: "watch",
        symbol: "BTC",
        headline: "Top traders less long than retail",
        detail: `Δ ${divergence.toFixed(1)}pp — distribution risk`,
        direction: "bearish",
      });
    if (divergence > 8)
      out.push({
        kind: "positioning_divergence",
        severity: "watch",
        symbol: "BTC",
        headline: "Top traders more long than retail",
        detail: `Δ +${divergence.toFixed(1)}pp — accumulation`,
        direction: "bullish",
      });
  }

  // ETF flows
  if (btc24h != null && btc24h > 200_000_000)
    out.push({
      kind: "etf_inflow",
      severity: "info",
      symbol: "BTC",
      headline: "Strong ETF inflow (24h)",
      detail: `$${(btc24h / 1e6).toFixed(0)}M — institutional bid`,
      direction: "bullish",
    });
  if (btc24h != null && btc24h < -100_000_000)
    out.push({
      kind: "etf_outflow",
      severity: "watch",
      symbol: "BTC",
      headline: "ETF outflow (24h)",
      detail: `$${(btc24h / 1e6).toFixed(0)}M — institutional risk-off`,
      direction: "bearish",
    });
  if (btc7d != null && btc7d < -500_000_000)
    out.push({
      kind: "etf_outflow",
      severity: "alert",
      symbol: "BTC",
      headline: "Sustained ETF outflow (7d)",
      detail: `$${(btc7d / 1e6).toFixed(0)}M cumulative — institutions selling`,
      direction: "bearish",
    });

  // Rank alert > watch > info so the cockpit shows the loudest first.
  const rank = { alert: 0, watch: 1, info: 2 } as const;
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}
