# Opportunity Engine — design (v1)

_Written 2026-07-08. Inspired by the SoSoValue teardown: they built an information
system; our edge is a **decision layer** that ends in an execution CTA. This is the
main feature of the next phase._

## What it is

A once-daily, ranked set of **watch cards** — "what deserves your attention today
and why" — for the coins the cockpit already covers (BTC, ETH, SOL, XRP). Each
card ends in the existing `ExchangeCTA` (cheapest-venue deep link), which is the
affiliate conversion point.

**Not** buy/sell signals. `PRODUCT_VISION.md` locks "bez sygnałów kup/sprzedaj",
and the affiliate posture (MiCA/KNF) makes trade recommendations a liability.
The card says *"conditions X, Y, Z are unusual, historically this configuration
resolves violently; risks A, B"* — the user decides direction and whether to act.
This is exactly the "Co powinienem dzisiaj obserwować?" framing from the
SoSoValue analysis, and it is the honest version of "Top 5 Long / Top 5 Short".

## Why it converts (business logic)

The chain: **attention → context → execution venue**.

1. Card surfaces a concrete, dated market condition (attention).
2. "Why" bullets + risk bullets give the decision context nobody gets from a raw
   funding number (context — the anti-SoSoValue move).
3. If the user decides to act, the card's CTA routes to the cheapest venue via
   `lib/affiliate.ts` ranking → PostHog `affiliate_click` (execution).

A dashboard informs; a card with a score, reasons, risks and one button is a
funnel step.

## Data inputs — all already ingested, zero new vendors

| Input | Source (exists today) |
|---|---|
| Funding (per-coin, aggregate, cross-exchange dispersion) | `frontend/src/lib/coinglass.ts` via `/api/crypto-pulse` |
| OI level + 1h/4h/24h deltas, OI vs market cap | same |
| Liquidations 1h/4h/24h, long/short split | same |
| Long/short positioning (global vs top accounts) | same |
| ETF flows (daily, 24h aggregate) | same |
| Pre-computed `deviations[]` (kind, severity, direction) | same — this is the backbone |
| RADAR bias (1D/1W), SNIPER confluence (BTC) | engine `calculations/radar.py`, `calculations/sniper.py` |
| Binance↔Hyperliquid funding spread | `frontend/src/lib/velo.ts` |

## Scoring — deterministic first, LLM narrates

Two-stage, mirroring the cockpit-digest pattern (deterministic fallback + Claude
on top):

**Stage 1 — attention score (pure code, no LLM).** Per coin, sum weighted
contributions from the `deviations[]` already computed in `coinglass.ts`
(severity: alert=3, watch=1.5, info=0.5) plus RADAR/SNIPER modifiers for BTC.
Normalize to 0–100. Deterministic → testable, explainable, free.

**Stage 2 — narration (Claude, same key/model as digest).** Given the coin's
snapshot + its deviation list + score, produce:
- `headline` (one line, desk-note tone — reuse `DIGEST_SYSTEM_PROMPT` style)
- `why[]` (3–5 bullets, each anchored to a number from the snapshot)
- `risks[]` (1–3 bullets: opposing datapoints, upcoming macro events once the
  macro calendar exists, "this can resolve either way" honesty)

Claude never invents the score and never says long/short — the system prompt
forbids directional recommendations, same guardrail as the digest.

## Card schema

```json
{
  "symbol": "SOL",
  "score": 78,
  "direction_pressure": "bullish",   // from deviations[] majority, display-only
  "headline": "Funding reset while OI holds — positioning washed out",
  "why": [
    "Funding flipped to -0.004% after 9 days positive",
    "OI down only 2% during the flush — leverage stayed",
    "Top-trader L/S at 1.8 vs global 1.1 — divergence widening"
  ],
  "risks": [
    "24h liquidations still elevated ($120M) — chop risk",
    "ETF flows negative 3 days running"
  ],
  "generated_at": "2026-07-08T07:00:00Z",
  "date": "2026-07-08"
}
```

`direction_pressure` is a description of the data (which way deviations lean),
not advice; UI renders it as the same colored dot used in `DeviationBanner`.

## Pipeline & persistence

- New `engine/services/opportunity_engine.py`, same shape as
  `cockpit_digest.py`: fetch `/api/crypto-pulse` (single source of truth),
  score per coin, narrate via Claude, persist.
- Persist all cards for the day to `opportunity_cards_latest.json` next to
  `trading.db` (same pattern as `cockpit_digest_latest.json`; move both into a
  DB table later if we want history/backtesting of the scores — v2).
- Scheduler: run in the same daily job right after the digest
  (`scheduler._run_cockpit_digest`) so both read one snapshot cadence.
- API: `GET /api/opportunities/latest` → `{available, date, cards[]}` (public,
  same as `/api/digest/latest`).

## Frontend (v1)

- Section on `/cockpit` under the `AiRead` strip: "Today's watch" — cards sorted
  by score, top 3 expanded, rest collapsed.
- Card layout: symbol + score chip + direction dot → headline → why/risks
  bullets → `ExchangeCTA` for that symbol (already symbol-aware).
- Server component, `revalidate: 300`, hide when stale >48h — identical policy
  to `AiRead`.
- v2: standalone `/opportunities` page with its own metadata → becomes an SEO
  surface ("SOL funding reset analysis — 2026-07-08") and the digest/X post can
  link to it instead of bare `/cockpit`.

## Compliance guardrails (hard requirements)

1. No "long/short/buy/sell" wording anywhere in generated text — enforced in
   the system prompt AND a post-generation regex check with fallback to
   deterministic card text (belt and suspenders, like the digest CTA check).
2. `AffiliateDisclosure` renders adjacent to the card list (component exists).
3. Each card footer: "Data snapshot, not investment advice." — static string,
   not LLM output.

## Metrics of success

- PostHog: `opportunity_card_expand`, `affiliate_click` with `source:
  opportunity_card` property → conversion vs. clicks from the plain cockpit CTA.
- If cards don't out-convert the baseline cockpit CTA within ~4 weeks, the
  feature is narration overhead and we kill or reshape it.

## Build order

1. `opportunity_engine.py` (score + narrate + persist) + endpoint — mirrors
   digest, ~1 session.
2. Cockpit section UI + PostHog events — ~1 session.
3. (later) `/opportunities` SEO page, score history table, macro-calendar risk
   injection, equities cards (needs a different data path — Finnhub, reports).

## Open questions

- Coin universe: stay with the 4 cockpit coins, or widen Coinglass pull? Wider
  universe = more interesting cards but more API surface; suggest staying at 4
  until conversion is proven.
- Should the daily X/Telegram digest embed the top card? (Probably yes — it
  gives the post a hook and a deep link; do it once `/opportunities` exists.)
