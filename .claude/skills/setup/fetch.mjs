#!/usr/bin/env node
// Fetches Hyperliquid perp data for a coin and prints a JSON snapshot:
// price/VWAP, funding + 7d percentile, OI (+ delta vs previous runs),
// 1h/4h candle summaries, and an ESTIMATED liquidation-cluster map.
//
// Liq clusters are estimates: Hyperliquid exposes no aggregate liq map, so we
// assume positions opened at each candle's typical price across leverage
// tiers, weight by traded notional, and scale to current open interest.
//
// Usage: node fetch.mjs [COIN]   (default BTC)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const COIN = (process.argv[2] || 'BTC').toUpperCase();
const API = 'https://api.hyperliquid.xyz/info';
const HOUR = 3600_000;
const NOW = Date.now();

const STATE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'state');
const STATE_FILE = path.join(STATE_DIR, `${COIN}.jsonl`);

async function info(body) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HL API ${res.status} for ${body.type}`);
  return res.json();
}

const [metaAndCtxs, candles1h, candles4h, fundingHist] = await Promise.all([
  info({ type: 'metaAndAssetCtxs' }),
  info({ type: 'candleSnapshot', req: { coin: COIN, interval: '1h', startTime: NOW - 168 * HOUR, endTime: NOW } }),
  info({ type: 'candleSnapshot', req: { coin: COIN, interval: '4h', startTime: NOW - 14 * 24 * HOUR, endTime: NOW } }),
  info({ type: 'fundingHistory', coin: COIN, startTime: NOW - 168 * HOUR }),
]);

const [meta, ctxs] = metaAndCtxs;
const idx = meta.universe.findIndex((u) => u.name === COIN);
if (idx < 0) {
  console.error(`Unknown coin on Hyperliquid: ${COIN}`);
  process.exit(1);
}
const ctx = ctxs[idx];
const maxLeverage = meta.universe[idx].maxLeverage;

const mark = +ctx.markPx;
const oiCoins = +ctx.openInterest;
const oiUsd = oiCoins * mark;
const prevDayPx = +ctx.prevDayPx;
const fundingHourly = +ctx.funding; // fraction per hour, e.g. 0.0000125 = 0.00125%/h

// --- funding stats over 7d ---
const rates = fundingHist.map((f) => +f.fundingRate);
// midpoint rank so a flat series (HL clamps at the floor rate) reads ~50, not 0
const below = rates.filter((r) => r < fundingHourly).length;
const equal = rates.filter((r) => r === fundingHourly).length;
const fundingPercentile7d = rates.length ? Math.round(((below + equal / 2) / rates.length) * 100) : null;
const fundingAvg7d = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : null;
const negativeHours7d = rates.filter((r) => r < 0).length;

// --- 24h VWAP from 1h candles ---
const last24 = candles1h.slice(-24);
const vwapNum = last24.reduce((a, c) => a + +c.v * ((+c.h + +c.l + +c.c) / 3), 0);
const vwapDen = last24.reduce((a, c) => a + +c.v, 0);
const vwap24h = vwapDen ? vwapNum / vwapDen : null;

// --- estimated liquidation clusters ---
// For each 1h candle in the last 7d: assume positions opened at typical price,
// spread across leverage tiers, liq at entry*(1 -/+ 1/L). Weight by traded
// notional decayed by age (older entries more likely already closed), then
// scale each side so its total equals half of current OI notional.
const TIERS = [
  { lev: 5, w: 0.3 },
  { lev: 10, w: 0.35 },
  { lev: 20, w: 0.25 },
  { lev: Math.min(40, maxLeverage), w: 0.1 },
];
const BIN = mark > 10_000 ? 250 : mark > 100 ? mark * 0.004 : mark * 0.005;
const longBins = new Map();
const shortBins = new Map();
for (const c of candles1h) {
  const entry = (+c.h + +c.l + +c.c) / 3;
  const ageH = (NOW - c.t) / HOUR;
  const w = +c.v * entry * Math.exp(-ageH / 96); // ~4-day half-life-ish decay
  for (const { lev, w: tw } of TIERS) {
    const liqLong = entry * (1 - 1 / lev);
    const liqShort = entry * (1 + 1 / lev);
    if (liqLong < mark) {
      const k = Math.round(liqLong / BIN) * BIN;
      longBins.set(k, (longBins.get(k) || 0) + w * tw);
    }
    if (liqShort > mark) {
      const k = Math.round(liqShort / BIN) * BIN;
      shortBins.set(k, (shortBins.get(k) || 0) + w * tw);
    }
  }
}
function topClusters(bins, sideTotalUsd, n = 6) {
  // clusters beyond ~12% of mark are stale/low-leverage noise, not actionable magnets
  const raw = [...bins.entries()].filter(([px]) => Math.abs(px - mark) / mark <= 0.12);
  const total = raw.reduce((a, [, v]) => a + v, 0) || 1;
  return raw
    .map(([px, v]) => ({ price: px, estUsd: (v / total) * sideTotalUsd }))
    .sort((a, b) => b.estUsd - a.estUsd)
    .slice(0, n)
    .sort((a, b) => b.price - a.price)
    .map((c) => ({ priceLow: c.price - BIN / 2, priceHigh: c.price + BIN / 2, estNotionalUsd: Math.round(c.estUsd) }));
}
// Split OI between sides by funding sign as a crowding proxy (perp OI itself is symmetric).
const longShare = fundingHourly >= 0 ? 0.5 + Math.min(0.2, fundingPercentile7d / 500) : 0.4;
const liqClusters = {
  method: 'ESTIMATE: volume-weighted entries x leverage tiers, scaled to current OI — not exchange-reported',
  longLiqBelowPrice: topClusters(longBins, oiUsd * longShare),
  shortLiqAbovePrice: topClusters(shortBins, oiUsd * (1 - longShare)),
};

// --- OI delta from previous snapshots (state file) ---
let oiChange24hUsd = null;
let lastSnapshot = null;
try {
  const lines = fs.readFileSync(STATE_FILE, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  lastSnapshot = lines[lines.length - 1] || null;
  const dayAgo = lines.filter((s) => s.t <= NOW - 24 * HOUR).pop() || lines[0];
  if (dayAgo && NOW - dayAgo.t > 6 * HOUR) oiChange24hUsd = Math.round(oiUsd - dayAgo.oiUsd);
} catch { /* first run */ }
fs.mkdirSync(STATE_DIR, { recursive: true });
fs.appendFileSync(STATE_FILE, JSON.stringify({ t: NOW, mark, oiUsd: Math.round(oiUsd), fundingHourly }) + '\n');

const compactCandle = (c) => ({
  t: new Date(c.t).toISOString().slice(0, 16),
  o: +c.o, h: +c.h, l: +c.l, c: +c.c,
  volUsd: Math.round(+c.v * ((+c.h + +c.l) / 2)),
});

console.log(JSON.stringify({
  coin: COIN,
  fetchedAt: new Date(NOW).toISOString(),
  price: {
    mark, oracle: +ctx.oraclePx, mid: +ctx.midPx,
    prevDayPx, change24hPct: +(((mark - prevDayPx) / prevDayPx) * 100).toFixed(2),
    vwap24h: vwap24h && +vwap24h.toFixed(1),
    high7d: Math.max(...candles1h.map((c) => +c.h)),
    low7d: Math.min(...candles1h.map((c) => +c.l)),
  },
  derivatives: {
    fundingHourlyPct: +(fundingHourly * 100).toFixed(5),
    fundingAnnualizedPct: +(fundingHourly * 24 * 365 * 100).toFixed(1),
    funding7dPercentile: fundingPercentile7d,
    fundingAvg7dHourlyPct: fundingAvg7d != null ? +(fundingAvg7d * 100).toFixed(5) : null,
    negativeFundingHoursLast7d: negativeHours7d,
    openInterestCoins: +oiCoins.toFixed(1),
    openInterestUsd: Math.round(oiUsd),
    oiChange24hUsd,
    volume24hUsd: Math.round(+ctx.dayNtlVlm),
    maxLeverage,
  },
  liqClusters,
  candles1hLast48: candles1h.slice(-48).map(compactCandle),
  candles4hLast14d: candles4h.map(compactCandle),
  previousSnapshot: lastSnapshot,
}, null, 1));
