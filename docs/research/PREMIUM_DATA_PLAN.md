# Premium Data Acquisition Plan

**Status:** MVP runs on free tier (yfinance + Claude API). This document captures the planned upgrade ladder for when reports need to graduate from "good enough" to "indistinguishable from sell-side institutional research."

**Last updated:** 2026-05-19

---

## Free-tier baseline (current)

| Source | What we use it for | Cost |
|---|---|---|
| yfinance (Yahoo Finance) | Fundamentals, prices, ratios, insider tx, institutional holders, news, recommendations | $0 |
| Claude API (Sonnet 4.5) | 11-section synthesis + sector briefs + blog drafts | ~$0.10 / report |
| SEC EDGAR (planned) | 10-K/Q filings deep-dive | $0 |
| FRED API (planned) | Macro indicators | $0 |
| EIA (planned) | Energy/uranium/oil data | $0 |
| Google Trends (planned) | Demand momentum signals | $0 |

**Capacity at $0 data:** unlimited reports (only constrained by Claude API spend, ~$6 per 60-report batch).

---

## Upgrade ladder

Each tier maps to specific report sections it improves. Add cumulatively, validate impact before next tier.

### Tier 1 — `$108/mc` (recommended first upgrade)

The smallest spend that makes reports look unambiguously professional.

| Source | Cost | Adds |
|---|---|---|
| **FMP Premium** | $69/mc | Earnings call transcripts, DCF models, peer comp API, 5-year analyst estimate history, insider transactions with deltas |
| **Polygon Stocks Starter** | $29/mc | Real-time US prices, options flow, dark pool indicator |
| **Quiver Premium** | $10/mc | Congress trades (Pelosi tracker), lobbying spend, government contracts, patents, social sentiment |

**Report sections impacted:**
- **QoQ Changes** → exact numbers with prior-period comparisons (no more "n/a" gaps)
- **Business & Strategy** → can quote management directly from earnings calls
- **Peers** → no more LLM-guessed peer metrics; real comp tables
- **Ownership & Insider Activity** → dark-pool ratio (the COIN PDF signature metric we currently show as "n/a")
- **Technical Analysis** → options-flow context (unusual call/put activity)

**New section unlock:** "Government & Insider Edge" — Pelosi trades, lobbying spend, gov contracts. Pure SEO/viral bait; competitors do not have this.

**ROI threshold:** Justified once we hit ~50 paying subscribers at €19/mc or ~10 paying subscribers at €99/mc Pro tier.

---

### Tier 2 — `+$100/mc` (cumulative $208/mc)

Adds news intelligence and social signals.

| Source | Cost | Adds |
|---|---|---|
| **Finnhub Premium** | $50/mc | Real-time news with sentiment scoring, EPS surprises history, recommendations changes |
| **Apify scrapers** | ~$50/mc usage | X/Twitter posts, Reddit r/wallstreetbets + r/stocks, LinkedIn headcount trends, Glassdoor reviews, job postings |

**Report sections impacted:**
- **News context** → headline cluster analysis instead of raw list
- **Catalysts** → date validation from actual filings/calendars
- **Risk** → social-sentiment divergence signals (price up, retail euphoric = contrarian short)

**New sections unlocked:**
- "Social Pulse" — what fintwit + r/wsb think, when sentiment diverged from price
- "Hiring Velocity" — LinkedIn headcount delta is a leading indicator of growth/cuts; almost no consumer-facing analysis platform shows this
- "Glassdoor Delta" — review score trend signals culture/operations health

**Defensible moat layer:** these cross-section signals (headcount drop + insider sells + multiple compression all in one place) are what separate "AI slop" from "this analyst sees connections."

---

### Tier 3 — `+$75/mc` (cumulative $283/mc)

Macro precision.

| Source | Cost | Adds |
|---|---|---|
| **TradingEconomics** | $75/mc | Macro indicators per country, commodity prices, central-bank tracker |

**Report sections impacted:**
- **Macro Context** → no more LLM-guessed Fed dot plot; real numbers
- **Sector Briefs** → uranium price, oil price, copper price feeds directly into thesis
- **Rate Sensitivity** → uplift estimates anchored to real yield curve shifts

---

### Tier 4 — `+$250+/mc` (cumulative $530+/mc)

Add only if SaaS coverage becomes priority.

| Source | Cost | Adds |
|---|---|---|
| **SimilarWeb API** | $250+/mc | Web traffic per domain, app rankings, audience demographics |
| **FMP Ultimate** (delta) | +$60/mc | Intraday financials, historical filings archive |

**Use case:** SaaS / consumer-internet coverage where web/app metrics are leading indicators (e.g., HUBS, NET, ROKU, SHOP, ABNB).

**Skip if** coverage stays equities/commodities-focused (semis, uranium, defense, biotech). Not worth $250+/mc for those.

---

## What NOT to buy

These are tempting but not justified for a retail-facing platform:

| Source | Why skip |
|---|---|
| Bloomberg Terminal | $24k/year. Designed for institutional sales desks, not retail. |
| AlphaSense | $1-3k/mc. Document search + transcripts. Overlaps with FMP Premium at 10x the cost. |
| S&P Capital IQ | $1k+/mc. Heavy institutional, locked-in licensing, no API. |
| Refinitiv Eikon | $1.5k+/mc. Same constraint as Bloomberg. |

Rule of thumb: if a single seat costs more than what 100 paying users pay you, it's not the right tier yet.

---

## Decision triggers

Suggested milestones for graduating tiers:

| Tier | Trigger |
|---|---|
| Tier 1 ($108/mc) | First validation: 10+ paying subs OR 1000+ newsletter signups (free SEO traction confirmed) |
| Tier 2 ($208/mc) | Tier 1 producing measurably better engagement on reports (longer dwell time, more shares) |
| Tier 3 ($283/mc) | Macro/sector content becoming a meaningful traffic driver vs single-stock reports |
| Tier 4 ($530+/mc) | SaaS coverage explicitly requested by paying users or driving most newsletter subs |

---

## Implementation notes

Each new data source slots into `engine/report/equity/data_sources/`. Pattern matches the existing `yfinance_source.py`:

1. Add `<source>_source.py` with `fetch_all(ticker)` returning a dict
2. Wire into `generator.py` `_gather_data()` (parallel fetch with asyncio.gather)
3. Surface relevant fields to the AI synthesis prompt in `ai_synthesis.py`
4. (Optional) Add new MDX components for new sections

The 11-section schema is **stable**. New data sources enrich existing sections by default — only Tier 1+2 unlock genuinely new sections worth dedicated components.
