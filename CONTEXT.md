# CONTEXT.md — Domain vocabulary for crypto-dashboard

Shared language for humans and agents working in this repo. Keep entries short;
update this file whenever a new domain term enters the codebase or an existing
one changes meaning.

## What this is

**Follio** (follio.io) is an **affiliate acquisition machine**, not a
trading/research platform per se. The current build is a **derivatives
cockpit** — a wedge product for crypto perp traders that funnels them to
exchanges via affiliate links. Three parallel threads live in this repo:

1. **Crypto cockpit** — live derivatives context, AI trade setups, alerts.
2. **Follio equity research** — LLM-generated equity reports and sector briefs.
3. **NexOperandi** (`/outreach-system`) — separate B2B outreach service (€750
   setup + €250/mo); shares the repo, not the product.

## Architecture at a glance

| Part | Stack | Path |
|---|---|---|
| Frontend | Next.js 16, React 19, Tailwind 4, MDX | `/frontend` |
| Engine | FastAPI, Python 3.11 (`python:3.11-slim` in both Dockerfiles), APScheduler, SQLAlchemy | `/engine` |
| Database | Supabase/Postgres (auth, user data) + local SQLite `trading.db` (engine state) | `/supabase/migrations` |
| Deploy | Docker Compose + Traefik on VPS; auto-deploy from `main` via GitHub Actions → **follio.io** | `/deploy` |

No SSH to prod from dev machines — prod operations go through
`workflow_dispatch`. Secrets live in `engine/.env` on the VPS.

## Domain vocabulary

### Trading core

| Term | Meaning | Where |
|---|---|---|
| **RADAR** | Macro-bias score 0–6 per timeframe from BBWP, Gaussian Channel, WVF, funding. Classifies `ACCUMULATE` (5–6), `NEUTRAL` (3–4), `SELL_THE_RALLY` (0–2). | `engine/calculations/radar.py`, `frontend/src/components/RadarScore.tsx` |
| **SNIPER** | Engine-side confluence scoring (0–5): RADAR alignment + MTF bias + zone proximity + structure quality. One best setup per tick (anti-spam). Internal name only — surfaced in the UI as the **Confluence Check**; its `signal`/`recommendation`/`position_size_pct` fields are deliberately NOT rendered (MiCA). | `engine/calculations/sniper.py` |
| **Confluence Check** | The /app UI reframe of SNIPER output: conditions checklist (met/partial/not met binned on the engine's discrete point tiers), "Levels in play" (zone, SS invalidation, R-multiple levels as market description) and a **RiskSizer** (qty/notional/margin from the user's own account size + risk %; linear USDT-perps only). No signals, no directional language. | `frontend/src/components/ConfluenceCheck.tsx`, `frontend/src/components/RiskSizer.tsx` |
| **BiasGrid** | Multi-timeframe structural bias display (1H…1M): BULLISH/BEARISH/NEUTRAL per frame with Secondary Swing levels. | `frontend/src/components/BiasGrid.tsx` |
| **Secondary Swing (SS)** | Swing level used for stop-loss placement and bias-flip detection, tracked per timeframe. | `engine/calculations/structure.py` |
| **Confluence** | The 0–5 SNIPER score itself; ranks setup quality. | `engine/calculations/sniper.py` |
| **Tick** | One evaluation cycle of the alert engine; at most one best setup is alerted per tick. | `engine/services/alerts.py` |
| **Dedup / cooldown** | Cross-tick alert suppression: already-alerted setup IDs are skipped, plus a 1-hour same-direction cooldown. State persisted to `data/alert_state.json` so deploys/restarts don't re-fire. | `engine/services/alerts.py` |
| **Liquidation clusters** | Estimated liquidation price levels for Hyperliquid perps, modeled from 1h candles + leverage tiers with age decay (estimate, not exchange data). | `frontend/src/lib/hyperliquid.ts` |

### Derivatives metrics

| Term | Meaning |
|---|---|
| **Funding (rate)** | Perp borrowing cost; positive = longs pay shorts. `funding 7d percentile` = how extreme current funding is vs 7-day history. |
| **OI / OI delta** | Open interest (total open notional) and its change over 1h/4h/24h; spikes signal momentum or exhaustion. |
| **L/S ratio** | Long/short positioning; top-trader vs global divergence signals institutional shifts. |
| **ETF flows** | Spot BTC/ETH ETF net inflows (daily + 7d cumulative) as institutional demand proxy. |

### Product surfaces

| Term | Meaning | Where |
|---|---|---|
| **Cockpit** | Main dashboard page (`/cockpit`): AI Trade Setup panel, opportunity cards, digest. Replaces the older `/app` route. | `frontend/src/app/cockpit/` |
| **AI Trade Setup** | Claude-generated structured perp setup (entry zone, stop, targets, R:R, confluence) from a live Hyperliquid snapshot. Quota: 10 generations + 30 chat messages per user per day. | `frontend/src/lib/setup-engine.ts` |
| **Opportunity cards** | Daily ranked watch cards per coin: deterministic 0–100 attention score + Claude narration (headline/why/risks). **Never directional recommendations** — they end in an exchange CTA. | `engine/services/opportunity_engine.py` |
| **Cockpit digest** | Once-daily deviations snapshot for X/Telegram, drafted to admin Telegram for review before posting. | `engine/services/cockpit_digest.py` |
| **Trade review** | Upload a trade screenshot → Claude vision scores **decision quality (process), not outcome** (0–100 scorecard), persisted per user. Auth-gated: 5 reviews per user per day (quota kind `trade_review`). | `frontend/src/lib/trade-review.ts`, `supabase/migrations/0001_trade_reviews.sql` |
| **AI Insights / meta-review** | Claude (Sonnet) synthesis over the user's last N (3/5/10) or last-7-days saved scorecards: went well/wrong, recurring patterns, progress vs previous insight, **process-level** strategy adjustments. Never directional (prompt rules + deterministic output scan). 2/day (quota kind `insight`), persisted. | `frontend/src/lib/trade-insights.ts`, `frontend/src/app/api/trade-review/insights/route.ts`, `supabase/migrations/0004_trade_review_insights.sql` |
| **SymbolContext** | React context for multi-symbol support (BTC, ETH, SOL, XRP, …). | `frontend/src/contexts/SymbolContext.tsx` |

### Monetization

| Term | Meaning | Where |
|---|---|---|
| **Affiliate link** | Deep link to an exchange perp market with embedded referral code, built by `buildAffiliateLink()`. | `frontend/src/lib/affiliate.ts` |
| **Exchange registry** | `EXCHANGES[]` — single source of truth for venue fees, rebates, attribution and region restrictions; venues ranked by real net cost to the user. Region gating **fails closed**: ranking requires an explicit region decision (`string \| null`), and unknown region hides every venue with restrictions. Region signal: server-side GeoIP (`GET /api/region`, GeoLite2 + geoipupdate sidecar, engine `api/region.py`) with browser-timezone fallback (`lib/region.ts`); risk reduction, not enforcement (VPNs bypass it). `restricted_regions` in engine config must stay in sync with the registry. GeoLite2 data by MaxMind. | `frontend/src/config/exchanges.ts`, `frontend/src/lib/affiliate.ts`, `frontend/src/lib/region.ts`, `engine/api/region.py` |
| **Rebate** | Fee share returned to the user via referral (`rebatePct`, 0..1). |  |
| **ExchangeCTA** | CTA component that deep-links the cheapest venue for the user. | `frontend/src/components/cockpit/ExchangeCTA.tsx` |
| **MiCA / KNF** | EU/PL regulatory constraints on crypto promotion — affiliate copy and venue availability need legal sign-off. | header notes in `exchanges.ts` |
| **Waitlist** | Landing page email capture (Supabase + Resend); lead magnet = free AAVE equity report PDF. | `frontend/src/components/WaitlistForm.tsx`, `engine/api/waitlist.py` |
| **Utility portfolio** | `/portfolio` — Jakub's personal "Altcoin Utility Season Portfolio" published as a transparency signpost. Percentages of the altcoin sleeve ONLY (never absolute sizes/entries), three risk tiers (Utility Core / Frontier / Moonshots), hard not-investment-advice banner. Data lives in a static config with the MiCA rules in its header. | `frontend/src/config/utility-portfolio.ts`, `frontend/src/app/portfolio/page.tsx` |

### Research (Follio)

| Term | Meaning | Where |
|---|---|---|
| **Equity report** | 11-section MDX analysis of one ticker (yfinance + Finnhub + Claude); 60 tickers seeded across 12 sectors. | `engine/report/equity/generator.py` |
| **Sector brief** | MDX overview page per sector in the 12-sector taxonomy. | `engine/report/equity/sector_brief.py` |
| **Crypto-infra sector** | 5 tickers (COIN, MARA, MSTR, RIOT, HOOD) whose reports are enriched with Coinglass BTC macro context (**CryptoMacroPulse**). | `engine/report/equity/sectors.py`, `engine/report/equity/coinglass_source.py` |

## Data models (one-liners)

- Supabase: `trade_reviews` (per-user scorecards, RLS), `trade_review_insights` (per-user meta-reviews, RLS, immutable), `ai_setup_usage` (daily quota counters — generations, chat_messages, trade_reviews, insights; pk user_id+day).
- Engine ORM: `BiasRecord` (bias snapshots), `RadarSnapshot`, `Trade` (journal), `TradingViewAlert` (incoming webhooks).

## External integrations

- **Hyperliquid** — keyless public API: live perp snapshot, funding, OI, candles, liquidation-cluster inputs (`frontend/src/lib/hyperliquid.ts`).
- **Coinglass v4** — premium key; derivatives aggregator: funding, OI, L/S, liquidations, ETF flows (`frontend/src/lib/coinglass.ts`).
- **Finnhub** (premium) + **yfinance** (free) — equity data for reports.
- **Claude API** — setups, reports, digests, card narration (`engine/services/llm.py`).
- **Telegram** — alerts + admin draft review (`engine/services/telegram.py`).
- **Supabase** — Google OAuth, user tables; **Resend** — transactional email; **PostHog** — analytics (`affiliate_click`, etc.).

## Conventions

- Commits: `feat|fix|chore|perf|ci(domain): description` — e.g. `fix(alerts): stop SNIPER alert spam — one best setup per tick`.
- Python snake_case; React components PascalCase; Supabase tables snake_case plural; RLS policies `{table}_{action}_{scope}`.
- Frontend-safe env vars are `NEXT_PUBLIC_*`; engine config via Pydantic Settings in `engine/config.py` (`extra="ignore"`).
- No CI test suite — verification = code review + running the affected service.

## Known debt / gotchas

- **Wealth module** (portfolio chat) — status unclear.
- Two unrelated `trading.db` SQLite files exist; engine state may move to a named volume or DB table.
- Prod domain is **follio.io** — `tradingcommandcenter.com` references are legacy.
