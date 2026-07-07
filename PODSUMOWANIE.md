# Podsumowanie projektu — stan i kierunek

> Dokument roboczy do konsultacji. Stan na: **2026-07-07**
> Aktywna gałąź: `feature/research-reports` (odbita od `main`, jeszcze niescommitowana)

---

## 1. TL;DR — gdzie jesteśmy

Projekt zaczął jako **Trading Command Center (TCC)** — platforma do tradingu BTC (silniki RADAR / MAP / SNIPER, patrz `plan.md`). W praktyce **rozrósł się w szerszą platformę analityczno-researchową** i obecnie łączy trzy równoległe wątki:

1. **Crypto trading dashboard** (oryginalny rdzeń — BiasGrid, RADAR, sygnały, alerty)
2. **Follio Research** — automatyczny generator instytucjonalnej jakości raportów o spółkach giełdowych (equity) + briefy sektorowe + blog makro
3. **Warstwa go-to-market** — landing z waitlistą, wysyłka raportu AAVE w mailu powitalnym, oraz osobny `outreach-system` (cold outreach B2B pod NexOperandi)

Landing komunikuje obecnie markę **"Trading Command Center"** i zbiera **waitlistę** (produkt przed launchem).

---

## 2. Co już mamy (zbudowane)

### 2.1 Rdzeń crypto (TCC)
- Dashboard `/app` z BiasGrid, RADAR score, kontekstem symbolu (`SymbolContext`)
- Silnik Python (FastAPI) z kalkulacjami, wykrywaniem stref, confluence scoring
- Serwisy: alerty, backtest, sentiment, telegram, scheduler, LLM
- Integracje danych: DefiLlama, Dune, GitHub, (CCXT w planie)
- Widget **CryptoMacroPulse** — snapshot derywatów krypto (OI, funding, L/S, likwidacje, przepływy ETF) zasilany przez Coinglass v4, cache 60 s (`/api/crypto-pulse`)

### 2.2 Follio Research (equity) — najświeższy wątek
- Pipeline `engine/report/equity/` generujący **11-sekcyjne raporty MDX** (yfinance + Finnhub)
- Seed: **12 sektorów × 5 tickerów = 60 spółek**; wygenerowane end-to-end: **2 raporty** (NVDA, RKLB)
- **12 briefów sektorowych** jako MDX (ai-infrastructure, semiconductors, nuclear-smr, quantum, robotics, defense, pharma-biotech, energy-storage, china-tech, ai-pure-play, …)
- **Blog makro** — pierwszy wpis: „AI capex cycle — where are we"
- Routing Next.js: `/research`, `/research/[sector]`, `/research/[sector]/[slug]`, `/blog`, `/blog/[slug]`
- `ReportComponents.tsx` — 15 komponentów wizualnych do raportów
- Integracja **Finnhub** (premium): historia zaskoczeń EPS, dryf rekomendacji analityków, okno newsów 60 dni, insider tx (SEC Form 4)
- **4 klucze API zwalidowane**: Alpha Vantage, Finnhub premium, Coinglass v4, Velo (Velodata)

### 2.3 Warstwa produktowa / GTM
- Landing z **waitlistą** + licznik zapisów; deployment przez Docker na VPS (Traefik), auto-deploy przez GitHub Actions
- Analityka **PostHog**
- Mail powitalny (Resend) z **darmowym raportem AAVE** (PDF generowany przez Playwright/Chromium)
- Baza: **Supabase / PostgreSQL** (asyncpg, pooler)
- Autentykacja: `/auth/login`, `/signup`, `/callback` (Supabase)
- `outreach-system/` — osobny playbook cold outreach B2B (NexOperandi: automatyzacja lead→spotkanie, target real estate)

### 2.4 W toku / niedokończone (loose ends)
- **Paper trading** — half-built, niescommitowane, zepsute importy:
  - `frontend/src/app/app/paper-trading/page.tsx` (`paperTradingApi` nie jest eksportowane)
  - `engine/api/paper_trading.py`, `engine/services/paper_trading.py`, `engine/data/alpaca_client.py`
  - Obecnie omijane podczas buildów → **decyzja: dokończyć albo usunąć**
- **Wealth** — moduł `/app/wealth` + `engine/services/wealth/` (portfolio chat, price service) — status do potwierdzenia
- Gałąź `feature/research-reports` **niescommitowana** — trzeba zdecydować: jeden commit czy podział logiczny (engine / frontend / content)

---

## 3. Do czego zmierzamy (kierunek)

### 3.1 Follio Research — priorytety (wg `docs/research/NEXT_STEPS.md`)
1. **Coinglass → raporty equity crypto-infra** (COIN, MARA, MSTR, RIOT, HOOD): wzbogacić sekcję Macro Context o OI BTC, przepływy ETF, reżim funding. *(~2–3 h)*
2. **Velo (Velodata)** — spread funding między giełdami (Binance ↔ Hyperliquid), głębokość perp, basis. *(odłożone do walidacji Coinglass)*
3. **CryptoMacroPulse na `/app`** — osadzić widget nad BiasGrid dla traderów. *(~30 min)*
4. **Alpha Vantage** — backup fundamentów + wskaźniki makro (Fed Funds, CPI, GDP, rentowności). *(~1–2 h)*
5. **Batch 58 pozostałych raportów** — ~$6 LLM + ~2 h; dopiero **po akceptacji** NVDA/RKLB i zmianach z pkt 1–4.
6. **Refresh briefów sektorowych** — po wygenerowaniu pełnego batcha, by odnosiły się do realnych danych.

### 3.2 Ladder danych premium (wg `PREMIUM_DATA_PLAN.md`)
Cel: raporty **nieodróżnialne od sell-side institutional research**. Wchodzenie warstwami, walidacja ROI przed kolejnym tierem:
- **Baseline (teraz):** yfinance + Claude (~$0.10/raport) — nielimitowane
- **Tier 1 (~$108/mc):** FMP Premium + Polygon + Quiver → transkrypty earnings calls, DCF, peer comp, dark pool, trejdy Kongresu (Pelosi tracker) → *ROI przy ~50 sub. €19/mc lub ~10 sub. €99/mc*
- **Tier 2 (+$100/mc):** Finnhub + Apify (X/Reddit/LinkedIn/Glassdoor) → „Social Pulse", „Hiring Velocity" — warstwa fosy (moat)
- **Tier 3 (+$75/mc):** TradingEconomics — precyzja makro

### 3.3 Model biznesowy (sygnały z kodu)
- **Waitlist-first launch** + lead magnet (darmowy raport AAVE)
- Subskrypcja: sugerowane progi **€19/mc** (Standard) i **€99/mc** (Pro)
- Równolegle: **outreach B2B** (NexOperandi, €750 setup + €250/mc)

---

## 4. Kluczowe napięcia do rozstrzygnięcia (do konsultacji)

1. **Tożsamość produktu** — TCC (crypto trading) vs Follio (research equity) vs NexOperandi (usługa B2B). Trzy marki/kierunki w jednym repo. **Który jest głównym produktem, a który wspiera?**
2. **Paper trading & Wealth** — dokończyć czy wyciąć? Ciążą jako niescommitowany, zepsuty kod.
3. **Higiena gałęzi** — `feature/research-reports` puchnie; warto scommitować/podzielić zanim urośnie dalej.
4. **Kolejność wydania** — najpierw dopieścić 2 raporty i odpalić batch 60, czy najpierw domknąć rdzeń crypto dashboard?
5. **Wydatek na dane** — kiedy wejść w Tier 1 ($108/mc)? Zależne od pierwszych płacących.

---

## 5. Stack (skrót)
- **Frontend:** Next.js (App Router), MDX (`next-mdx-remote/rsc`), Supabase auth
- **Backend:** FastAPI (Python), APScheduler, reportlab/Playwright (PDF)
- **Dane:** yfinance, Finnhub, Coinglass v4, Velo, Alpha Vantage, DefiLlama, Dune
- **AI:** Claude API (Sonnet) — synteza raportów, briefy, drafty blogowe
- **Infra:** Docker + Traefik na VPS, GitHub Actions auto-deploy, PostgreSQL/Supabase, PostHog, Resend

---

*Źródła: `plan.md`, `docs/research/NEXT_STEPS.md`, `docs/research/PREMIUM_DATA_PLAN.md`, `outreach-system/PLAYBOOK.md`, struktura `engine/` i `frontend/src/`.*
