---
name: setup
description: Generate a structured perp trade setup (TrueNorth-style) for a coin on Hyperliquid — live price, funding, OI, estimated liquidation clusters, and a decision-ready plan. Use when the user types /setup [COIN], asks for a trade setup, derivatives read, funding/OI check, or liquidation map analysis. Default coin is BTC.
---

# /setup — Hyperliquid perp setup generator

Produce a structured, decision-ready trade setup from live Hyperliquid data. No freeform chat — always the exact output format below.

## Step 1 — Fetch data

Run (COIN from the argument, default BTC; uppercase it):

```bash
node .claude/skills/setup/fetch.mjs BTC
```

The JSON contains: price block (mark, VWAP24h, 7d high/low, 24h change), derivatives block (hourly funding % + 7d percentile, OI in USD, OI 24h delta when history exists, 24h volume), estimated liquidation clusters above/below price, last 48×1h and 14d×4h candles, and the previous snapshot from the last run.

**Liq clusters are ESTIMATES** (volume-weighted entries × leverage tiers scaled to OI, not exchange-reported). Always mark them "est." in output. Treat relative sizes and locations as meaningful, absolute dollar figures as indicative.

## Step 2 — Derive signals

Tag each with bias **Bearish / Neutral / Bullish** (or **Elevated** for OI level):

- **Price vs VWAP24h**: below and trending down = Bearish; above and holding = Bullish.
- **Funding**: percentile ≥75 = crowded longs (contrarian bearish fuel); ≤25 or negative hours >0 = shorts paying / capitulation watch; flat at the 0.00125%/h floor = Neutral ("no squeeze premium").
- **OI**: near 7d-context highs with price falling = trapped longs (bearish); OI bleeding on a bounce = weak conviction.
- **Liq imbalance**: sum est. long-liq vs short-liq notional within the reported clusters; ratio and which side is heavier. Heavier long-liq below = downside magnet, and vice versa.
- **Structure** from candles: last swing high/low, where the volume spikes happened (distribution vs absorption), which liq zones sit inside the recent range.

## Step 3 — Output format (exact)

```
**TL;DR:** <Bias> — <one-sentence structural read naming the critical zone>.
**Price:** $X (1h HL perp) — <one-line trend context>.
**Watch:** <the single reclaim/breakdown level pair that flips the read>.

| Signal | Value | Read | Bias |
|---|---|---|---|
| Price (1h HL) | $X | vs VWAP, trend | ... |
| OI | $X.XB | context + 24h delta (or "first run — no delta yet") | ... |
| Funding (1h) | +0.00XX% | 7d percentile, crowding read | ... |
| Liq imbalance (est.) | ratio | $XM long-liq vs $XM short-liq nearby | ... |

**Key catalysts** — 2-3 bullets: the decisive candles/volume events and what funding/OI imply.

**Story** — short paragraph: how price got here, where the liq magnets sit, what triggers a cascade or squeeze.

**Key levels**

| Level | Type | Note |
|---|---|---|
| $X–$X | Short-liq zone (est. $XM) | reclaim = squeeze trigger toward ... |
| $X | Spot | ... |
| $X–$X | Long-liq zone (est. $XM) | line in the sand; break = cascade toward ... |

**Bottom line:** the actionable verdict — long/short/no-trade, the exact entry condition (flush + reversal confirmation, or reclaim + volume), invalidation, and target. If nothing is clean, say "no clean setup" and state what to wait for.

**Next steps**
- **Derivatives**: what funding/OI change to monitor and what it would mean.
- **Technical**: the level whose reclaim/loss flips the bias.
- **Setup**: the precise conditional trade to evaluate next.
```

## Monitoring / re-checks

When the user later asks to re-check ("derivatives", "any change?", "funding?"), rerun the fetch and **diff against `previousSnapshot`**: report only what changed (funding flip, OI delta, price vs the key levels you gave). If nothing material changed, say so in 2-3 lines and restate the trigger being waited for — do not regenerate the full setup unless price crossed a key level or the user asks for a fresh one.

Snapshots accumulate in `.claude/skills/setup/state/<COIN>.jsonl`, enabling real OI 24h deltas once history exists.
