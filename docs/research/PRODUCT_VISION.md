# Follio — Product Vision

_Written 2026-07-07. The through-line for the whole platform, so features stay coherent._

## The thesis

Follio is **not a signals service**. The club rules encode the product philosophy:
"Bez sygnałów kup/sprzedaj", "Liczy się proces, nie pozowanie na geniusza",
max 33 people under real names. The value is **decision quality** for a small,
serious group — helping them *see the present more clearly* and *be honest about
their past decisions*. AI is the leverage, not an oracle.

Every project in the follio.io portfolio (aviation stress scenarios, bottle-deposit
calculators, solar payback dashboards, ThesisTracker, the trading HUD) is the same
shape: a tool for seeing reality clearly and being accountable. The trading platform
is the flagship expression.

## Three pillars

**1. SEE — situational awareness** (mostly built)
- Sector analysis: 12 sectors + briefs (`/research/[sector]`)
- Equity reports: company analysis (`/research/[sector]/[slug]`) — 2 of 60 generated
- Crypto Macro Pulse: Coinglass derivatives (`CryptoMacroPulse`, `/api/crypto-pulse`)
- AI Trading HUD: the `/app` dashboard (BiasGrid, RadarScore, ICT signals)

**2. DECIDE + LOG — accountability** (new ground)
- **Trade screenshot analysis** — upload a screenshot of a trade, get a verdict on
  DECISION QUALITY (not outcome, not a signal). The flagship new feature.
- ThesisTracker / Trading Journal / Decision Log (from the portfolio) — the
  persistence layer under the screenshot analysis (future).

**3. LEARN — content / community** (barely started, 1 blog post)
- Blog with company analysis + linked YouTube videos
- Club (Patron) app

The three connect into one chain: sectors give context (see) → trade analysis
grades the decision in that context (log) → blog+YT teaches the reasoning (learn).

## The moat on "analiza zagrania"

A generic "ChatGPT, analyze my chart" has no context. Follio's trade analyzer is
wired into **Follio's own research engine**: a BTC trade pulls live Coinglass
funding/OI/ETF context; an equity trade pulls the report + sector brief + analyst
drift. That enrichment is what nobody copies with one prompt.

Critically: "good trade" ≠ "made money". The scorecard grades **process** (thesis
clarity, risk definition, R:R, HTF alignment, execution discipline) and flags
outcome **separately**. A winning trade can be a bad process; a losing trade can be
a good one. This is the "proces, nie pozowanie" rule made literal.

## Decisions locked (2026-07-07)

- **Trade analysis: crypto first** — wired into Coinglass context + the ICT dashboard.
- **Blog + YouTube: manual** — `youtube_id` in MDX frontmatter, we render the embed.
- **Everything in this app** — follio.io == the `crypto-dashboard` Next.js codebase.

## Build order

1. Trade screenshot analysis (crypto-first) — `/app/trade-review`  ← in progress
2. Blog + YT embed (fastest value; pillar 3 is nearly empty)
3. Finish research: batch equity reports + Coinglass into crypto-infra reports
4. ThesisTracker / Journal as the persistence layer under #1

Uses **Claude Opus 4.8** (`claude-opus-4-8`) vision via `@anthropic-ai/sdk` in the
Next.js layer (crypto context already lives in TS — no Python roundtrip).

See `NEXT_STEPS.md` for the earlier research-pipeline backlog.
