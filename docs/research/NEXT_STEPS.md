# Follio Research — Next Steps

Paused at 2026-05-19. Pick this up next session.

## Where we left off

**Done in this iteration:**
- `engine/report/equity/` pipeline (yfinance + finnhub) generating 11-section MDX reports
- 12 sectors × 5 tickers seed list (60 tickers); 2 reports generated end-to-end (NVDA, RKLB)
- All 12 sector briefs generated as MDX
- `/research`, `/research/[sector]`, `/research/[sector]/[slug]` Next.js routes
- `/blog` route + first macro post (AI capex cycle commentary)
- `frontend/src/components/research/ReportComponents.tsx` — 15 visual components
- Finnhub integration (Faza A): EPS surprises history, analyst recommendations drift, 60-day news window, SEC Form 4 insider tx with codes
- Coinglass integration (Faza B): live crypto derivatives snapshot
  - `frontend/src/lib/coinglass.ts` server-only client
  - `/api/crypto-pulse` route with 60s cache
  - `CryptoMacroPulse` widget on `/research` home
  - Aggregates: per-coin price/OI/funding/L/S/liquidations, BTC funding cross-exchange avg, ETF 24h+7d flow, retail vs top trader positioning, heuristic signals
- All 4 user-supplied API keys validated: Alpha Vantage, Finnhub (premium), Coinglass v4, Velo (Velodata)

**Branch:** `feature/research-reports` (off `main`, not committed yet)

## Open work, in priority order

### 1. Coinglass into crypto-infra equity reports (high priority)
For tickers `COIN`, `MARA`, `MSTR`, `RIOT`, `HOOD` (sector `crypto-infra` — not in current seed list, would need to add or repurpose existing reports), enrich the Macro Context section with:
- BTC OI level + 24h delta
- BTC ETF cumulative flows (1m, 3m)
- Funding regime context
- Crypto market cap / dominance

**Implementation:**
- Create `engine/report/equity/coinglass_source.py` (Python equivalent of the TS lib)
- Wire into `generator.py` _conditionally_ (only when ticker matches crypto-infra list)
- Add field to AI synthesis prompt under a new `crypto_market_context` key
- Add MDX component `CryptoMarketContext` (compact stat strip)

Estimated effort: 2-3h. Cost per run: negligible (API + LLM tokens).

### 2. Velo (Velodata) integration (medium priority)
Velo overlaps with Coinglass but offers cross-exchange granularity Coinglass doesn't surface directly. Best use cases:
- Funding spread between exchanges (e.g. Binance vs Hyperliquid) — institutional vs retail venue divergence
- Per-product perp depth, basis
- Returns CSV; needs streaming/parsing layer

**Implementation:**
- `frontend/src/lib/velo.ts` (server-only) for live data
- Aggregate into `/api/crypto-pulse` snapshot as additional fields
- New widget section: "Funding spread Binance↔Hyperliquid" (1h, 24h)

Defer until Coinglass-only signal proves insufficient.

### 3. CryptoMacroPulse on `/app` dashboard (medium priority)
Same component, embedded above the existing BiasGrid on `/app`. Gives crypto traders the institutional/derivatives macro frame alongside their TA signals.

**Implementation:** import + render. Since `/app` is client-rendered, fetch via `/api/crypto-pulse` with SWR or 60s `setInterval`. Watch out for the `SymbolContext` provider already there.

Estimated effort: 30 min.

### 4. Alpha Vantage backup + macro indicators (low priority)
Two distinct uses:
- **Backup fundamentals**: when yfinance returns "n/a" for a field (rare but happens), Alpha Vantage often has it
- **Macro indicators**: Federal Funds Rate, CPI, GDP, Treasury yields — feed into the equity report's Macro Context and the macro blog posts

**Implementation:**
- `engine/report/equity/alpha_vantage_source.py`
- Tag-team with yfinance: yfinance primary, Alpha Vantage fallback
- New optional sector brief input: FRED-style macro snapshot

Estimated effort: 1-2h.

### 5. Batch-generate remaining 58 reports (low priority, blocked on review)
58 reports × ~$0.10 + ~2min each = ~$6 LLM cost + 2h walltime due to Claude rate limits. Should only run after we're happy with the 2 we have (NVDA, RKLB) and any pipeline changes from items 1-4 above land.

Command:
```bash
source engine/venv/bin/activate
set -a && source engine/.env && set +a
python -m engine.report.equity.cli --all --out frontend/content/reports
```

### 6. Sector briefs refresh (eventually)
12 briefs were generated when only 2 sector reports existed (NVDA, RKLB). After batch-generation, regenerate briefs so they reference actual ticker data:
```bash
python -m engine.report.equity.cli --brief all --out frontend/content/reports --briefs-out frontend/content/sector_briefs
```

### 7. Premium data tier upgrade
See `docs/research/PREMIUM_DATA_PLAN.md`. Current effective stack value (Finnhub premium + Coinglass v4 + Alpha Vantage + Velo) is already ~$200-400/mc-equivalent — strong starting position.

## Loose ends to clean up

- `frontend/src/app/app/paper-trading/page.tsx` — untracked, has broken imports (`paperTradingApi` not exported from `@/lib/api`). Either finish or delete. Currently I rename it to `/tmp/_pt` during builds.
- `engine/api/paper_trading.py`, `engine/services/paper_trading.py`, `engine/data/alpaca_client.py` — also untracked, same paper-trading half-built feature.
- Branch not committed. Once next session starts, decide whether to consolidate into a single commit + PR for the research feature, or break into logical commits (engine, frontend, content seed).

## Architecture reminders

- All MDX visual props are passed as **plain HTML attribute strings** (JSON encoded, `&quot;`-escaped). Components decode via `parseProp()` / `parseNum()`. Do NOT use `{`...`}` JSX expressions in the Python MDX renderer — `next-mdx-remote/rsc` does not reliably evaluate them.
- All narrative markdown text from the LLM passes through `_md_escape()` to convert literal `<` (e.g. `<15%`) to `&lt;` so MDX doesn't parse them as JSX tags.
- The `engine/report/__init__.py` uses lazy `__getattr__` so the equity subpackage can import without pulling in the crypto generator's runtime deps (FastAPI, ccxt, etc.).
- `engine/config.py` has `extra = "ignore"` in `Settings.Config` to tolerate unknown env vars.
- Three pages have `suppressHydrationWarning` on the MDX content wrapper to absorb Phantom/MetaMask DOM injection.
