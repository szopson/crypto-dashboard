# SPECYFIKACJA PROJEKTU: Trading Command Center

## 1. PRZEGLĄD PROJEKTU

### 1.1 Opis ogólny

Trading Command Center to zaawansowana platforma webowa do tradingu kryptowalutami, a konkretnie do handlu BTC. System integruje cztery sprawdzone metodologie tradingowe (Muleskin, Sauron, Astro, ero_crypto) w trójwarstwową architekturę decyzyjną:

- **RADAR** - silnik makro-bias (bazujący na podejściu ilościowym Astro)
- **MAP** - silnik poziomów strukturalnych (bazujący na podejściu Saurona i Muleskin)
- **SNIPER** - silnik egzekucji (bazujący na metodzie ero_crypto i Muleskin)

Platforma umożliwia traderom szybkie identyfikowanie optymalnych punktów wejścia, zarządzanie otwartymi pozycjami i śledzenie historii transakcji przy wsparciu sztucznej inteligencji (LLM).

### 1.2 Cele projektu

1. Skonsolidować cztery metodologie tradingowe w jeden, łatwy w użyciu interfejs
2. Zapewnić real-time analizę trendów makro (RADAR) i struktur (MAP)
3. Umożliwić szybkie podejmowanie decyzji handlowych poprzez mechanizm confluence scoring
4. Dostarczać inteligentne alerty i analizy poprzez agenta LLM (Claude)
5. Ułatwić prowadzenie dziennika handlowego i analizę wydajności
6. Integrować analitykę z TradingView dla pełnego obrazu rynku

### 1.3 Główne cechy systemu

- **Multi-timeframe bias grid** - siatka nastawienia (bias) dla 6 ram czasowych (1H, 4H, 1D, 3D, 1W, 1M) z punktacją RADAR i nastawieniem strukturalnym
- **Secondary Swing (SS) tracking** - automatyczne wykrywanie i śledzenie drugorzędnych swinów dla każdej ramy czasowej
- **Dynamiczny mechanizm flip** - automatyczne przełączanie nastawienia na podstawie przełamania drugorzędnego swinga
- **Notatki per timeframe** - możliwość dodawania notatek analitycznych dla każdej ramy czasowej
- **Integracja TradingView** - wbudowane widgety graficzne oraz webhook'i dla sygnałów alert'ów
- **Analiza zrzutów ekranu** - upload screenshota do LLM dla natychmiastowej analizy strukturalnej
- **Copilot LLM** - agent konwersacyjny napędzany przez Claude i n8n
- **Powiadomienia** - integracja z Telegram i email dla alertów oraz codziennych briefingów
- **Dziennik handlowy** - pełne logowanie transakcji z analizą wydajności i statystykami
- **Fokus na BTC** - system zoptymalizowany dla tradingu Bitcoin (możliwość rozszerzenia na inne aktywa w przyszłości)

### 1.4 Użytkownik docelowy

Głównym użytkownikiem (Szopen) jest doświadczony trader kryptowalut specjalizujący się w Bitcoin, posiadający wiedzę o:
- Analizie technicznej i strukturze rynku
- Supply & Demand, Order Blocks, Fair Value Gaps
- Metodach zarządzania ryzykiem i position sizing'u
- Handlu międzyramami czasowymi

---

## 2. ARCHITEKTURA SYSTEMU

### 2.1 Architektura ogólna

Poniższy diagram ilustruje przepływ danych oraz integracje wszystkich komponentów systemu:

```
                    ┌─────────────────────────────────────────────────────┐
                    │                   DASHBOARD (Next.js)               │
                    │  ┌──────────────────────────────────────────────┐  │
                    │  │ BiasGrid │ RadarScore │ TVChart │ NotePanel │  │
                    │  │ SignalFeed │ ChatPanel │ ScreenUpload │     │  │
                    │  └──────────────────────────────────────────────┘  │
                    └────────────────────────┬────────────────────────────┘
                                             │
                    ┌────────────────────────┴────────────────────────────┐
                    │                   REST API (FastAPI)              │
                    │  /api/bias │ /api/radar │ /api/signals           │
                    │  /api/notes │ /api/chat │ /api/trades            │
                    └────────────────────────┬────────────────────────────┘
                                             │
        ┌────────────────────────────────────┼────────────────────────────────┐
        │                                    │                                │
        ▼                                    ▼                                ▼
   ┌──────────────┐               ┌──────────────────┐          ┌──────────────────┐
   │  n8n Engine  │               │  Python Engine   │          │   PostgreSQL/    │
   │              │◄──────────────►│  (Calculations)  │◄────────►│   SQLite         │
   │ • Workflows  │               │                  │          │                  │
   │ • Webhooks   │               │ • RADAR metrics  │          │ • Bias records   │
   │ • Scheduling │               │ • Structural     │          │ • Signals        │
   │ • LLM Agent  │               │   analysis       │          │ • Trade journal  │
   │ • Telegram   │               │ • Zone detection │          │ • Notes          │
   │ • Email      │               │ • Confluence     │          │ • Screenshots    │
   └──────────────┘               │   scoring        │          └──────────────────┘
        │                         └──────────────────┘
        │                                  ▲
        │                                  │
        └──────────────────┬───────────────┘
                          │
        ┌─────────────────┴──────────────────┐
        │                                    │
        ▼                                    ▼
   ┌──────────────────┐            ┌──────────────────┐
   │  CCXT (Exchange)  │            │  TradingView     │
   │                  │            │                  │
   │ • OHLCV data     │            │ • Webhooks       │
   │ • Funding rates  │            │ • Chart widgets  │
   │ • Open Interest  │            │ • Alerts         │
   └──────────────────┘            └──────────────────┘
        │                                    │
        └────────────────────┬───────────────┘
                             │
                   ┌─────────┴──────────┐
                   │                    │
                   ▼                    ▼
            ┌─────────────┐      ┌─────────────┐
            │   Telegram  │      │    Email    │
            │     Bot     │      │  Service    │
            └─────────────┘      └─────────────┘
```

### 2.2 Przepływ danych

1. **Pobieranie danych** - Zaplanowane workflow'i n8n pobierają dane OHLCV dla BTC przez bibliotekę CCXT (wspierającą Bybit, OKX, Kraken, KuCoin i 100+ giełd) dla wszystkich ram czasowych (1H, 4H, 1D, 3D, 1W, 1M) w określonych interwałach
2. **Obliczenia RADAR** - Python engine oblicza metryki RADAR (BBWP, Gaussian Channel, Williams Vix Fix, Hash Ribbons, Funding Rates, MMD) dla ram czasowych 1D, 1W, 1M
3. **Analiza strukturalna** - Python engine wykrywa swingi, śledzi Secondary Swings (SS), identyfikuje Order Blocks (OB), Fair Value Gaps (FVG) oraz przełamania (BOS/CHoCH)
4. **Wyznaczanie nastawienia (bias)** - Na podstawie struktury i RADAR obliczane jest finalne nastawienie dla każdej ramy czasowej
5. **Zapis do bazy** - Wszystkie wyniki przechowywane są w bazie danych (SQLite lub PostgreSQL)
6. **Publiczna API** - Dashboard odczytuje dane z API, które cachuje wyniki dla wydajności
7. **Webhook'i TradingView** - Alerty z TradingView są otrzymywane przez n8n webhook'i
8. **Agent LLM** - n8n wywołuje Claude API ze skonsolidowanym kontekstem rynkowym
9. **Powiadomienia** - Alerty są wysyłane do użytkownika poprzez Telegram i email

### 2.3 Komponenty systemu

#### Frontend (Next.js)
- Responsywny interface użytkownika
- Real-time aktualizacje poprzez WebSocket
- Integracja z TradingView Lightweight Charts
- Panel rozmów z agentem LLM
- Upload i analiza screenshota

#### Backend (Python FastAPI)
- REST API dla wszystkich operacji
- Silnik obliczeń dla wszystkich wskaźników
- Zarządzanie bazą danych
- Integracja z giełdami krypto przez CCXT (Bybit, OKX, Kraken, KuCoin itp.)

#### Orchesteracja (n8n)
- Zaplanowane pobieranie danych
- Workflow'i procesowania
- Webhook'i dla alertów
- Integracja z Claude API
- Wysyłanie powiadomień

#### Baza danych
- Przechowywanie wskaźników i sygnałów
- Historia nastawień (bias)
- Dziennik handlowy
- Notatki i screenshoty

---

## 3. TECH STACK

### 3.1 Frontend

- **Framework**: Next.js 14+ z App Router
- **Styling**: TailwindCSS + Custom CSS
- **Komponenty UI**: shadcn/ui
- **Wykresy**:
  - TradingView Lightweight Charts (otwartokodowa biblioteka do custom chartów)
  - TradingView Widget Embed (zaawansowane interaktywne wykresy)
- **Real-time**: WebSocket dla live updates
- **State Management**: React Hooks / Context API
- **HTTP Client**: fetch API / axios
- **Deployment**: Vercel / Self-hosted (Docker)

### 3.2 Backend

- **Runtime**: Python 3.11+
- **Framework**: FastAPI
- **ORM**: SQLAlchemy (dla PostgreSQL) lub raw SQL (dla SQLite)
- **Baza danych**:
  - SQLite (faza initial development)
  - PostgreSQL (production deployment)
- **Caching**: Redis (opcjonalne, dla wydajności)
- **Asyncio**: aiohttp dla asynchronicznych requestów
- **Validation**: Pydantic v2
- **Deployment**: Docker / Linux server

### 3.3 Orchesteracja i integracje

- **Scheduling & Workflows**: n8n (self-hosted lub cloud)
- **LLM API**: Claude API (Anthropic) - dostęp via n8n
- **CCXT**: Zunifikowana biblioteka Python obsługująca 100+ giełd (Bybit, OKX, Kraken, KuCoin, Gate.io itp.) — dane publiczne (OHLCV, funding) bez klucza API
- **TradingView**:
  - Webhook'i dla alertów
  - Embedded chart widgets
- **Komunikacja**:
  - Telegram Bot API
  - SMTP (SendGrid / AWS SES)
- **Monitorowanie**: optional - Prometheus / Grafana

### 3.4 Wersjonowanie i kontrola kodu

- **Git**: GitHub / GitLab
- **Containerization**: Docker + Docker Compose
- **CI/CD**: GitHub Actions / GitLab CI

---

## 4. STRUKTURA PROJEKTU

```
trading-command-center/
├── README.md                           # Wstęp i instrukcje quick-start
├── CONTRIBUTING.md                     # Wytyczne dla developerów
├── docker-compose.yml                  # Konfiguracja kontenerów
├── .env.example                        # Template zmiennych środowiskowych
├── .gitignore
│
├── frontend/                           # Aplikacja Next.js
│   ├── package.json
│   ├── package-lock.json
│   ├── tsconfig.json
│   ├── next.config.js                 # Konfiguracja Next.js
│   ├── tailwind.config.js              # Konfiguracja Tailwind
│   ├── postcss.config.js
│   ├── .eslintrc.json
│   │
│   ├── public/                         # Static assets
│   │   ├── favicon.ico
│   │   ├── logo.svg
│   │   └── images/
│   │
│   ├── app/                            # App Router (Next.js 14+)
│   │   ├── layout.tsx                  # Root layout
│   │   ├── page.tsx                    # Home / Dashboard
│   │   ├── globals.css                 # Global styles
│   │   ├── error.tsx                   # Global error handler
│   │   ├── not-found.tsx               # 404 page
│   │   │
│   │   ├── api/                        # API routes (proxy to backend)
│   │   │   ├── bias/
│   │   │   │   └── route.ts            # Proxy GET/POST /api/bias
│   │   │   ├── radar/
│   │   │   │   └── route.ts            # Proxy GET /api/radar
│   │   │   ├── structure/
│   │   │   │   └── route.ts            # Proxy GET /api/structure
│   │   │   ├── notes/
│   │   │   │   └── route.ts            # Proxy GET/POST /api/notes
│   │   │   ├── signals/
│   │   │   │   └── route.ts            # Proxy GET/POST /api/signals
│   │   │   ├── trades/
│   │   │   │   └── route.ts            # Proxy GET/POST /api/trades
│   │   │   ├── chat/
│   │   │   │   └── route.ts            # Proxy POST /api/chat
│   │   │   └── briefing/
│   │   │       └── route.ts            # Proxy GET /api/briefing
│   │   │
│   │   ├── dashboard/
│   │   │   ├── layout.tsx              # Dashboard layout
│   │   │   ├── page.tsx                # Main dashboard view
│   │   │   └── loading.tsx             # Loading skeleton
│   │   │
│   │   ├── chart/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx                # Full chart view with all indicators
│   │   │   └── [timeframe]/
│   │   │       └── page.tsx            # Timeframe-specific view
│   │   │
│   │   ├── journal/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx                # Trade journal list
│   │   │   ├── [tradeId]/
│   │   │   │   └── page.tsx            # Trade detail page
│   │   │   └── stats/
│   │   │       └── page.tsx            # Performance statistics
│   │   │
│   │   ├── settings/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx                # Settings page
│   │   │   ├── api-keys/
│   │   │   │   └── page.tsx
│   │   │   ├── notifications/
│   │   │   │   └── page.tsx
│   │   │   └── preferences/
│   │   │       └── page.tsx
│   │   │
│   │   └── help/
│   │       └── page.tsx                # Help / FAQ
│   │
│   ├── components/                     # Reusable React components
│   │   ├── Header.tsx                  # Top navigation bar
│   │   ├── Sidebar.tsx                 # Left sidebar navigation
│   │   ├── Footer.tsx
│   │   │
│   │   ├── BiasGrid.tsx                # GŁÓWNY KOMPONENT - Multi-TF bias grid
│   │   │                               # Wyświetla bias, SS, RADAR score dla 6 TF
│   │   ├── BiasCell.tsx                # Pojedyncza komórka bias'u
│   │   │
│   │   ├── RadarScore.tsx              # Display RADAR metryki
│   │   ├── RadarChart.tsx              # Radial chart dla RADAR
│   │   ├── RadarMetric.tsx             # Pojedynczy metric (BBWP, WVF, etc)
│   │   │
│   │   ├── TVChart.tsx                 # TradingView Lightweight Chart embed
│   │   ├── ChartToolbar.tsx            # Toolbar z timeframe selektorem
│   │   │
│   │   ├── NotePanel.tsx               # Notatki dla timeframe'u
│   │   ├── NoteItem.tsx                # Pojedyncza notatka
│   │   ├── NoteEditor.tsx              # Editor notatki (modal)
│   │   │
│   │   ├── SignalFeed.tsx              # Feed ostatnich sygnałów
│   │   ├── SignalCard.tsx              # Pojedyncze zaproszenie sygnału
│   │   ├── SignalBadge.tsx             # Badge dla typu sygnału
│   │   │
│   │   ├── ChatPanel.tsx               # LLM chat interface
│   │   ├── ChatMessage.tsx             # Wiadomość w chatu
│   │   ├── ChatInput.tsx               # Input box dla wiadomości
│   │   ├── ChatLoading.tsx             # Loading indicator dla LLM response
│   │   │
│   │   ├── ScreenshotUpload.tsx        # Upload screenshota
│   │   ├── ScreenshotPreview.tsx       # Preview zaraz po upload'cie
│   │   ├── ScreenshotAnalysis.tsx      # Wynik analizy LLM
│   │   │
│   │   ├── TimeframeSelector.tsx       # Selektor ram czasowych
│   │   ├── SessionTimer.tsx            # Wyświetlacz aktualnej sesji (NY, London, etc)
│   │   ├── PriceDisplay.tsx            # Wyświetlacz aktualnej ceny BTC
│   │   │
│   │   ├── ConfluenceScore.tsx         # Wyświetlacz confluence score'u
│   │   ├── ZonesList.tsx               # Lista aktywnych stref (OB, FVG)
│   │   │
│   │   ├── TradeForm.tsx               # Form dla logowania nowej transakcji
│   │   ├── TradeHistory.tsx            # Historia ostatnich transakcji
│   │   ├── TradeStats.tsx              # Statystyki wydajności
│   │   │
│   │   ├── AlertModal.tsx              # Modal dla alertów
│   │   ├── ConfirmDialog.tsx           # Dialog potwierdzenia
│   │   ├── LoadingSpinner.tsx          # Loading indicator
│   │   └── ErrorBoundary.tsx           # Error handling component
│   │
│   ├── lib/                            # Utility functions i helpers
│   │   ├── api.ts                      # API client (axios wrapper)
│   │   ├── apiClient.ts                # Szczegółowe metody API
│   │   ├── types.ts                    # TypeScript interfejsy i typy
│   │   ├── constants.ts                # Stałe (timeframes, colors, etc)
│   │   ├── utils.ts                    # Ogólne utility functions
│   │   ├── formatters.ts               # Formatowanie liczb, dat, etc
│   │   ├── validators.ts               # Walidacja formularzy
│   │   └── chart-utils.ts              # Utilities dla chart'ów
│   │
│   ├── hooks/                          # Custom React hooks
│   │   ├── useBias.ts                  # Hook dla danych bias
│   │   ├── useRadar.ts                 # Hook dla RADAR metryki
│   │   ├── useStructure.ts             # Hook dla danych strukturalnych
│   │   ├── useSignals.ts               # Hook dla sygnałów
│   │   ├── useChat.ts                  # Hook dla LLM czatu
│   │   ├── useTrades.ts                # Hook dla dziennika handlowego
│   │   ├── useWebSocket.ts             # Hook dla WebSocket connection
│   │   ├── useLocalStorage.ts          # Hook dla persistent storage
│   │   ├── useTheme.ts                 # Hook dla thematu (light/dark)
│   │   └── usePolling.ts               # Hook dla periodic data fetching
│   │
│   ├── styles/                         # Additional stylesheets
│   │   ├── variables.css               # CSS variables (colors, spacing, etc)
│   │   ├── animations.css              # Animacje
│   │   └── responsive.css              # Media queries
│   │
│   └── middleware.ts                   # Next.js middleware
│
├── engine/                             # Python calculation engine
│   ├── requirements.txt                # Python dependencies
│   ├── requirements-dev.txt            # Dev dependencies
│   ├── setup.py                        # Setup dla instalacji
│   ├── pytest.ini                      # Konfiguracja pytest'a
│   ├── main.py                         # FastAPI application entry point
│   ├── config.py                       # Configuration settings
│   ├── models.py                       # SQLAlchemy ORM models
│   ├── database.py                     # Database connection i setup
│   ├── schemas.py                      # Pydantic request/response schemas
│   │
│   ├── calculations/                   # Moduł obliczeń
│   │   ├── __init__.py
│   │   ├── radar.py                    # RADAR metrics (BBWP, Gaussian, WVF, HR, Funding, MMD)
│   │   ├── structure.py                # Structural analysis (swings, SS, bias, zones)
│   │   ├── zones.py                    # Zone detection (OB, FVG, BOS, CHoCH)
│   │   ├── indicators.py               # Individual indicator calculations
│   │   ├── confluence.py               # Confluence scoring logic
│   │   └── session.py                  # Trading session detection (NY, London, Asia)
│   │
│   ├── data/                           # Moduł pobierania danych
│   │   ├── __init__.py
│   │   ├── exchange.py                 # CCXT exchange client (Bybit/OKX/Kraken/KuCoin)
│   │   ├── cache.py                    # Data caching layer
│   │   └── models.py                   # Data models dla OHLCV, etc
│   │
│   ├── api/                            # FastAPI routes
│   │   ├── __init__.py
│   │   ├── routes.py                   # Wszystkie API routes
│   │   └── dependencies.py             # Shared dependencies (auth, etc)
│   │
│   ├── utils/                          # Helper functions
│   │   ├── __init__.py
│   │   ├── logger.py                   # Logging setup
│   │   ├── decorators.py               # Utility decorators
│   │   └── validators.py               # Input validation helpers
│   │
│   ├── tests/                          # Unit i integration tests
│   │   ├── __init__.py
│   │   ├── conftest.py                 # Pytest fixtures
│   │   ├── test_radar.py               # Tests dla RADAR
│   │   ├── test_structure.py           # Tests dla structure
│   │   ├── test_zones.py               # Tests dla zones
│   │   ├── test_confluence.py          # Tests dla confluence
│   │   ├── test_exchange.py            # Tests dla CCXT exchange client
│   │   └── test_api.py                 # Tests dla API endpoints
│   │
│   └── migrations/                     # Database migrations (Alembic)
│       ├── alembic.ini
│       ├── env.py
│       ├── script.py.mako
│       └── versions/
│           └── .gitkeep
│
├── n8n/                                # n8n workflows i konfiguracja
│   ├── README.md                       # Instrukcje setup'u n8n
│   ├── docker-compose.yml              # Optional n8n Docker setup
│   │
│   ├── workflows/                      # Exported n8n workflows
│   │   ├── 1_data_fetcher.json         # Scheduled data fetching przez CCXT (Bybit)
│   │   ├── 2_radar_calculator.json     # RADAR calculation trigger
│   │   ├── 3_structure_analyzer.json   # Structural analysis trigger
│   │   ├── 4_alert_handler.json        # TradingView webhook handler
│   │   ├── 5_signal_generator.json     # Signal generation workflow
│   │   ├── 6_llm_analyzer.json         # LLM analysis workflow
│   │   ├── 7_briefing_email.json       # Daily briefing email
│   │   ├── 8_telegram_bot.json         # Telegram notifications
│   │   └── 9_screenshot_analyzer.json  # Screenshot analysis workflow
│   │
│   ├── credentials/
│   │   ├── SETUP.md                    # Instrukcje setup'u credentials
│   │   ├── exchange.env.example         # CCXT config (domyślnie: Bybit)
│   │   ├── claude.env.example
│   │   ├── telegram.env.example
│   │   └── email.env.example
│   │
│   └── prompts/                        # LLM prompts dla n8n
│       ├── system_context.md           # System prompt dla Claude
│       ├── market_analysis.md
│       ├── screenshot_analysis.md
│       └── briefing.md
│
├── pinescript/                         # TradingView Pine Script indicators
│   ├── README.md                       # Instrukcje dodania do TradingView
│   ├── radar_dashboard.pine            # Combined RADAR indicator dla TradingView
│   ├── structure_map.pine              # Structural levels overlay (OB/FVG/BOS)
│   ├── swings_detector.pine            # Swing detection indicator
│   └── session_indicator.pine          # Trading session highlighter
│
├── docs/                               # Dokumentacja
│   ├── SETUP.md                        # Instrukcje instalacji i setup'u
│   ├── ARCHITECTURE.md                 # Szczegółowy opis architektury
│   ├── API.md                          # API reference
│   ├── DATABASE.md                     # Schema bazy danych
│   ├── TRADING_RULES.md                # Reguły wszystkich 4 metodologii
│   ├── RADAR_SYSTEM.md                 # Szczegółowy opis RADAR
│   ├── STRUCTURE_SYSTEM.md             # Szczegółowy opis MAP (estructura)
│   ├── SNIPER_SYSTEM.md                # Szczegółowy opis SNIPER
│   ├── DEPLOYMENT.md                   # Instrukcje deployment'u
│   ├── TROUBLESHOOTING.md              # Common issues i solutions
│   └── GLOSSARY.md                     # Słownik terminów tradingowych
│
├── .github/
│   ├── workflows/
│   │   ├── test.yml                    # CI workflow dla testów
│   │   ├── build.yml                   # CI workflow dla buildu
│   │   └── deploy.yml                  # CD workflow dla deployment'u
│   └── ISSUE_TEMPLATE/
│       ├── bug_report.md
│       └── feature_request.md
│
└── .dockerignore                       # Files to ignore w Docker builds
```

---

## 5. BAZA DANYCH - SCHEMA

### 5.1 Struktura tabel SQL

```sql
-- =====================================================
-- TABELA: bias_records
-- Opis: Historia nastawień (bias) dla każdej ramy czasowej
-- =====================================================
CREATE TABLE bias_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME NOT NULL,
    timeframe TEXT NOT NULL CHECK (timeframe IN ('1H', '4H', '1D', '3D', '1W', '1M')),
    asset TEXT NOT NULL DEFAULT 'BTC',

    -- Nastawienie strukturalne
    structural_bias TEXT NOT NULL CHECK (structural_bias IN ('BULLISH', 'BEARISH', 'NEUTRAL')),
    secondary_swing_level REAL,                -- Poziom ostatniego Secondary Swing
    ss_distance_pct REAL,                      -- Odległość od aktualnej ceny do SS w procentach
    last_swing_high REAL,                      -- Ostatni high w danym swinowie
    last_swing_low REAL,                       -- Ostatni low w danym swinowie
    swing_structure TEXT,                      -- 'HH_HL', 'LH_LL', 'HH_LH', 'LL_HH', 'TRANSITION'

    -- Metryki RADAR (obliczane dla 1D, 1W, 1M)
    radar_score INTEGER CHECK (radar_score >= 0 AND radar_score <= 6),
    bbwp_value REAL,                           -- Bollinger Bands Width Percentile (0-1)
    bbwp_signal TEXT CHECK (bbwp_signal IN ('BULLISH', 'BEARISH', 'NEUTRAL')),
    gaussian_signal TEXT CHECK (gaussian_signal IN ('BULLISH', 'BEARISH', 'NEUTRAL')),
    wvf_signal TEXT CHECK (wvf_signal IN ('BULLISH', 'BEARISH', 'NEUTRAL')),
    hash_ribbons_signal TEXT CHECK (hash_ribbons_signal IN ('BULLISH', 'BEARISH', 'NEUTRAL')),
    funding_rate REAL,                         -- Aktualny funding rate (%)
    funding_signal TEXT CHECK (funding_signal IN ('BULLISH', 'BEARISH', 'NEUTRAL')),
    mmd_signal TEXT CHECK (mmd_signal IN ('BULLISH', 'BEARISH', 'NEUTRAL')),

    -- Wynik połączony
    combined_bias TEXT CHECK (combined_bias IN ('BULLISH', 'BEARISH', 'NEUTRAL')),
    confidence TEXT CHECK (confidence IN ('HIGH', 'MEDIUM', 'LOW')),

    -- Metadane
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(timestamp, timeframe, asset)
);

CREATE INDEX idx_bias_records_asset_timeframe ON bias_records(asset, timeframe);
CREATE INDEX idx_bias_records_timestamp ON bias_records(timestamp DESC);

-- =====================================================
-- TABELA: bias_notes
-- Opis: Notatki analityczne dla każdej ramy czasowej
-- =====================================================
CREATE TABLE bias_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timeframe TEXT NOT NULL CHECK (timeframe IN ('1H', '4H', '1D', '3D', '1W', '1M')),
    asset TEXT NOT NULL DEFAULT 'BTC',
    note TEXT NOT NULL,
    note_type TEXT DEFAULT 'GENERAL',  -- 'GENERAL', 'WARNING', 'SETUP', 'STRUCTURE', 'LEVEL'
    tags TEXT,                          -- Comma-separated tags (JSON would be better, but keeping simple)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_bias_notes_timeframe ON bias_notes(timeframe);
CREATE INDEX idx_bias_notes_asset ON bias_notes(asset);

-- =====================================================
-- TABELA: signals
-- Opis: Wygenerowane sygnały i alerty
-- =====================================================
CREATE TABLE signals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME NOT NULL,
    source TEXT NOT NULL,              -- 'RADAR', 'MAP', 'SNIPER', 'TRADINGVIEW', 'LLM'
    type TEXT NOT NULL,                -- 'BIAS_CHANGE', 'ZONE_TOUCH', 'ENTRY_SIGNAL', 'WARNING', 'CONFLUENCE'
    timeframe TEXT,
    asset TEXT NOT NULL DEFAULT 'BTC',
    direction TEXT,                    -- 'LONG', 'SHORT', 'NEUTRAL'

    -- Parametry wejścia
    entry_price REAL,
    stop_loss REAL,
    take_profit REAL,

    -- Jakość
    confluence_score INTEGER CHECK (confluence_score >= 0 AND confluence_score <= 7),

    -- Opis i metadane
    description TEXT NOT NULL,
    metadata TEXT,                     -- JSON z dodatkowymi informacjami

    -- Status
    is_read BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_signals_asset_timestamp ON signals(asset, timestamp DESC);
CREATE INDEX idx_signals_is_read ON signals(is_read);
CREATE INDEX idx_signals_source ON signals(source);

-- =====================================================
-- TABELA: trades
-- Opis: Dziennik wszystkich zrealizowanych transakcji
-- =====================================================
CREATE TABLE trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset TEXT NOT NULL DEFAULT 'BTC',

    -- Kierunek i typ
    direction TEXT NOT NULL CHECK (direction IN ('LONG', 'SHORT')),
    entry_type TEXT,                   -- 'SAFE', 'AGRO', 'SCALP'

    -- Ceny
    entry_price REAL NOT NULL,
    exit_price REAL,
    stop_loss REAL NOT NULL,
    take_profit REAL NOT NULL,

    -- Rozmiar pozycji
    position_size REAL,                -- Size w kontraktach lub bazie
    risk_pct REAL,                     -- Procent kapitału narażonego

    -- Wynik
    pnl REAL,                          -- P&L w USD
    pnl_pct REAL,                      -- P&L w procentach
    rr_ratio REAL,                     -- Osiągnięty Risk:Reward ratio

    -- Metadata
    confluence_score INTEGER,          -- Score kiedy trade był zatwierdzony
    timeframe TEXT,                    -- Primary timeframe setup'u
    setup_type TEXT,                   -- Opis ustawu (np 'OB_Retrace_to_SS')
    notes TEXT,                        -- Notatki traderskie
    screenshot_url TEXT,               -- Link do screenshota

    -- Timing
    entry_time DATETIME NOT NULL,
    exit_time DATETIME,

    -- Status
    status TEXT DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED', 'CANCELLED')),

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_trades_asset_status ON trades(asset, status);
CREATE INDEX idx_trades_entry_time ON trades(entry_time DESC);
CREATE INDEX idx_trades_status ON trades(status);

-- =====================================================
-- TABELA: zones
-- Opis: Aktywne strefy (Order Blocks, Fair Value Gaps, Sessions)
-- =====================================================
CREATE TABLE zones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timeframe TEXT NOT NULL,
    asset TEXT NOT NULL DEFAULT 'BTC',

    -- Typ strefy
    zone_type TEXT NOT NULL,           -- 'ORDER_BLOCK', 'FVG', 'SESSION', 'SUPPLY', 'DEMAND'
    direction TEXT,                    -- 'BULLISH', 'BEARISH'

    -- Poziomy
    high_level REAL NOT NULL,
    low_level REAL NOT NULL,

    -- Status i history
    touches_count INTEGER DEFAULT 0,   -- Liczba razy dotknięta
    created_time DATETIME NOT NULL,
    last_touch_time DATETIME,

    -- Czy jest aktywna
    is_active BOOLEAN DEFAULT TRUE,
    invalidated_at DATETIME,           -- Kiedy przestała być ważna

    metadata TEXT,                     -- JSON z dodatkowymi detailami

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_zones_active ON zones(is_active);
CREATE INDEX idx_zones_timeframe ON zones(timeframe);

-- =====================================================
-- TABELA: swings
-- Opis: Historia wykrytych swinów i Secondary Swings
-- =====================================================
CREATE TABLE swings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timeframe TEXT NOT NULL,
    asset TEXT NOT NULL DEFAULT 'BTC',

    -- Typ swinga
    swing_type TEXT NOT NULL,          -- 'PRIMARY_HIGH', 'PRIMARY_LOW', 'SECONDARY_HIGH', 'SECONDARY_LOW'
    level REAL NOT NULL,               -- Cena swinga

    -- Timing
    swing_time DATETIME NOT NULL,      -- Kiedy został uformowany
    is_confirmed BOOLEAN DEFAULT TRUE,

    -- Relacje
    previous_swing_id INTEGER,         -- FOREIGN KEY do poprzedniego swinga

    is_active BOOLEAN DEFAULT TRUE,    -- Czy jest bieżący punkt odniesienia

    metadata TEXT,                     -- JSON z dodatkowymi detailami

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_swings_active ON swings(is_active);
CREATE INDEX idx_swings_timeframe ON swings(timeframe);
CREATE INDEX idx_swings_swing_time ON swings(swing_time DESC);

-- =====================================================
-- TABELA: llm_conversations
-- Opis: Historia konwersacji z agentem LLM (Claude)
-- =====================================================
CREATE TABLE llm_conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,

    -- Kontekst w momencie wysłania wiadomości
    market_context TEXT,               -- JSON z currentymi metrykami (bias, RADAR, cena, etc)
    session_id TEXT,                   -- Identyfikator sesji konwersacji

    -- Response metadata
    tokens_used INTEGER,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_llm_conversations_session ON llm_conversations(session_id);
CREATE INDEX idx_llm_conversations_role ON llm_conversations(role);

-- =====================================================
-- TABELA: screenshots
-- Opis: Przesłane screenshoty do analizy
-- =====================================================
CREATE TABLE screenshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    filepath TEXT NOT NULL,

    -- Metadane
    timeframe TEXT,
    asset TEXT DEFAULT 'BTC',
    upload_notes TEXT,                 -- Notatki od użytkownika przy upload'cie

    -- Analiza
    llm_analysis TEXT,                 -- Wynik analizy LLM (JSON)
    detected_structures TEXT,          -- Detected: swings, OB, FVG, etc (JSON)

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_screenshots_asset ON screenshots(asset);
CREATE INDEX idx_screenshots_created_at ON screenshots(created_at DESC);

-- =====================================================
-- TABELA: sessions
-- Opis: Metadata sesji tradingowych
-- =====================================================
CREATE TABLE sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_name TEXT NOT NULL,        -- 'ASIA', 'LONDON', 'NY', 'US_CLOSE'

    start_hour INTEGER NOT NULL,       -- Godzina startu (UTC)
    start_minute INTEGER DEFAULT 0,
    end_hour INTEGER NOT NULL,         -- Godzina końca (UTC)
    end_minute INTEGER DEFAULT 0,

    color TEXT,                        -- Kolor dla wyświetlania
    is_active BOOLEAN DEFAULT TRUE,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- TABELA: settings
-- Opis: Ustawienia użytkownika
-- =====================================================
CREATE TABLE settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT,
    setting_type TEXT,                -- 'STRING', 'INTEGER', 'BOOLEAN', 'JSON'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- TABELA: api_calls_log (opcjonalne, dla monitoring'u)
-- Opis: Log API call'ów dla debugging'u i analytics
-- =====================================================
CREATE TABLE api_calls_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    status_code INTEGER,
    response_time_ms INTEGER,
    user_agent TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_api_calls_log_endpoint ON api_calls_log(endpoint);
CREATE INDEX idx_api_calls_log_created_at ON api_calls_log(created_at DESC);
```

### 5.2 Relacje między tabelami

```
bias_records ──────┐
                   │
                   ├──→ trades (każdy trade ma bias_records context)
                   │
bias_notes ────────┤
                   │
signals ───────────┼──→ zones (sygnał może dotyczyć strefy)
                   │
                   └──→ swings (sygnał może dotyczyć swinga)

screenshots ────────→ llm_conversations (analiza screenshota)

trades ─────────────→ zones (touch'y w tradzie)

```

---

## 6. API ENDPOINTS (FastAPI)

### 6.1 Bias Endpoints

```
# Pobierz obecny bias dla wszystkich ram czasowych
GET /api/bias/current
Response:
{
    "timestamp": "2024-02-08T14:30:00Z",
    "biases": {
        "1H": {
            "structural_bias": "BULLISH",
            "secondary_swing_level": 45230.50,
            "ss_distance_pct": 0.5,
            "confidence": "HIGH"
        },
        "4H": { ... },
        "1D": { ... },
        ...
    }
}

# Pobierz historię bias dla danej ramy czasowej
GET /api/bias/history?timeframe=4H&days=30
Response:
{
    "timeframe": "4H",
    "data": [
        {
            "timestamp": "2024-02-01T00:00:00Z",
            "structural_bias": "BEARISH",
            "confidence": "MEDIUM"
        },
        ...
    ]
}

# Ręczne nadpisanie bias
POST /api/bias/manual
Request:
{
    "timeframe": "1D",
    "structural_bias": "BULLISH",
    "reason": "Przełamanie ważnego poziomu oporów"
}
Response:
{
    "success": true,
    "message": "Bias updated manually"
}
```

### 6.2 RADAR Endpoints

```
# Pobierz obecne RADAR metryki
GET /api/radar/current
Response:
{
    "timestamp": "2024-02-08T14:30:00Z",
    "radars": {
        "1D": {
            "radar_score": 5,
            "bbwp_signal": "BULLISH",
            "wvf_signal": "BEARISH",
            "hash_ribbons_signal": "BULLISH",
            "funding_rate": 0.0125,
            "funding_signal": "BEARISH",
            "mmd_signal": "BULLISH",
            "combined_score": 4
        },
        "1W": { ... },
        "1M": { ... }
    }
}

# Pobierz historię RADAR
GET /api/radar/history?days=30
Response:
{
    "history": [
        {
            "timestamp": "2024-02-08T00:00:00Z",
            "timeframe": "1D",
            "radar_score": 5,
            "metrics": { ... }
        },
        ...
    ]
}

# Wymuś przeliczenie RADAR
POST /api/radar/recalculate
Response:
{
    "success": true,
    "message": "RADAR recalculated"
}
```

### 6.3 Structure Endpoints

```
# Pobierz obecne poziomy strukturalne
GET /api/structure/levels
Response:
{
    "timeframe": "4H",
    "swings": {
        "last_high": 45500.00,
        "last_low": 44800.00,
        "primary_swing": "UP",
        "secondary_swing_level": 45230.00
    },
    "zones": {
        "order_blocks": [ ... ],
        "fvgs": [ ... ]
    }
}

# Pobierz swingi dla timeframe'u
GET /api/structure/swings?timeframe=4H
Response:
{
    "swings": [
        {
            "swing_type": "PRIMARY_HIGH",
            "level": 45500.00,
            "swing_time": "2024-02-07T12:00:00Z",
            "confirmed": true
        },
        ...
    ]
}

# Pobierz aktywne strefy
GET /api/structure/zones?timeframe=4H
Response:
{
    "zones": [
        {
            "zone_type": "ORDER_BLOCK",
            "direction": "BULLISH",
            "high_level": 45200.00,
            "low_level": 44900.00,
            "touches_count": 2,
            "is_active": true
        },
        ...
    ]
}
```

### 6.4 Notes Endpoints

```
# Pobierz notatki dla timeframe'u
GET /api/notes?timeframe=4H
Response:
{
    "timeframe": "4H",
    "notes": [
        {
            "id": 1,
            "note": "Równoległy trend OB na 4H",
            "note_type": "STRUCTURE",
            "created_at": "2024-02-08T10:00:00Z",
            "updated_at": "2024-02-08T10:00:00Z"
        },
        ...
    ]
}

# Utwórz lub zaktualizuj notatkę
POST /api/notes
Request:
{
    "timeframe": "4H",
    "note": "Ważny level do obserwacji",
    "note_type": "LEVEL"
}
Response:
{
    "id": 5,
    "success": true
}

# Usuń notatkę
DELETE /api/notes/5
Response:
{
    "success": true
}
```

### 6.5 Signals Endpoints

```
# Pobierz ostatnie sygnały
GET /api/signals?limit=20
Response:
{
    "signals": [
        {
            "id": 1,
            "timestamp": "2024-02-08T14:30:00Z",
            "source": "MAP",
            "type": "ZONE_TOUCH",
            "direction": "LONG",
            "entry_price": 45100.00,
            "stop_loss": 44800.00,
            "take_profit": 45500.00,
            "confluence_score": 6,
            "is_read": false
        },
        ...
    ]
}

# Pobierz nieprzeczytane sygnały
GET /api/signals/unread
Response:
{
    "unread_count": 3,
    "signals": [ ... ]
}

# Oznacz sygnał jako przeczytany
POST /api/signals/read/1
Response:
{
    "success": true
}

# TradingView webhook receiver
POST /api/signals/webhook
Request:
{
    "action": "entry",
    "price": 45100.00,
    "direction": "LONG",
    "timeframe": "4H"
}
Response:
{
    "signal_id": 42,
    "success": true
}
```

### 6.6 Trades Endpoints

```
# Pobierz wszystkie transakcje
GET /api/trades?status=OPEN
Response:
{
    "trades": [
        {
            "id": 1,
            "entry_price": 45000.00,
            "entry_time": "2024-02-08T10:00:00Z",
            "direction": "LONG",
            "status": "OPEN",
            "pnl": 1000.00,
            "pnl_pct": 2.22
        },
        ...
    ]
}

# Pobierz otwarte transakcje
GET /api/trades/open
Response:
{
    "open_trades": [ ... ]
}

# Zaloguj nową transakcję
POST /api/trades
Request:
{
    "direction": "LONG",
    "entry_price": 45000.00,
    "stop_loss": 44500.00,
    "take_profit": 46000.00,
    "position_size": 0.1,
    "entry_type": "SAFE",
    "confluency_score": 6,
    "timeframe": "4H",
    "setup_type": "OB_Retrace_to_SS"
}
Response:
{
    "id": 45,
    "success": true
}

# Aktualizuj transakcję (zamkniecie)
PUT /api/trades/45
Request:
{
    "exit_price": 46100.00,
    "status": "CLOSED"
}
Response:
{
    "id": 45,
    "pnl": 1100.00,
    "pnl_pct": 2.44,
    "rr_ratio": 2.2
}

# Pobierz statystyki wydajności
GET /api/trades/stats
Response:
{
    "total_trades": 45,
    "winning_trades": 32,
    "losing_trades": 13,
    "win_rate": 0.711,
    "average_rr": 1.85,
    "total_pnl": 5420.50,
    "profit_factor": 2.1
}
```

### 6.7 Chat / LLM Endpoints

```
# Wyślij wiadomość do LLM
POST /api/chat
Request:
{
    "message": "Jak oceniasz obecną strukturę na 1D?",
    "session_id": "sess_123456"
}
Response:
{
    "message_id": 1,
    "response": "Na bazie aktualnych metryki...",
    "context": {
        "current_bias": "BULLISH",
        "radar_score": 5,
        "price": 45100.00
    }
}

# Pobierz historię czatu
GET /api/chat/history?session_id=sess_123456
Response:
{
    "history": [
        {
            "role": "user",
            "content": "...",
            "created_at": "2024-02-08T10:00:00Z"
        },
        {
            "role": "assistant",
            "content": "...",
            "created_at": "2024-02-08T10:05:00Z"
        },
        ...
    ]
}

# Załaduj screenshot do analizy
POST /api/analyze/screenshot
Request: multipart/form-data (file upload)
Response:
{
    "screenshot_id": 1,
    "filename": "chart_2024-02-08.png",
    "analysis": {
        "detected_swings": [ ... ],
        "detected_zones": [ ... ],
        "analysis_text": "..."
    }
}
```

### 6.8 Data Endpoints

```
# Pobierz raw OHLCV data
GET /api/data/ohlcv?timeframe=4H&limit=100
Response:
{
    "timeframe": "4H",
    "candles": [
        {
            "open": 44500.00,
            "high": 45200.00,
            "low": 44400.00,
            "close": 45100.00,
            "volume": 12345.67,
            "time": "2024-02-08T12:00:00Z"
        },
        ...
    ]
}

# Pobierz funding rate
GET /api/data/funding
Response:
{
    "current_funding_rate": 0.0125,
    "predicted_funding": 0.0130,
    "next_funding_time": "2024-02-08T16:00:00Z"
}

# Pobierz info o obecnej sesji
GET /api/data/session
Response:
{
    "current_session": "LONDON",
    "start_time": "2024-02-08T08:00:00Z",
    "end_time": "2024-02-08T17:00:00Z",
    "progress_pct": 45.5,
    "next_session": "NY",
    "next_session_start": "2024-02-08T13:00:00Z"
}

# Pobierz briefing
GET /api/briefing?date=2024-02-08
Response:
{
    "date": "2024-02-08",
    "briefing_html": "<html>...</html>",
    "key_points": [ ... ],
    "generated_at": "2024-02-08T18:00:00Z"
}
```

---

**Koniec CZĘŚCI 1 - SEKCJE 1-6**

Plik został zapisany do: `/sessions/gracious-ecstatic-sagan/PROJECT_SPEC_PART1.md`

---


## 7. PYTHON ENGINE - LOGIKA KALKULACJI

### 7.1 RADAR Metrics

Każda metrika w systemie RADAR jest niezależnym wskaźnikiem makro-kondycji rynku. Łącznie tworzą composite score od 0-6, gdzie każda metrika może przynieść 0 lub 1 punkt w kierunku bullish.

**BBWP (Bollinger Band Width Percentile):**

```python
def calculate_bbwp(close_prices, bb_length=20, bbwp_length=252):
    """
    Bollinger Band Width Percentile
    Mierzy aktualną szerokość BB względem historycznej szerokości BB
    Niska wartość = niska volatilność = Setup do ekspozycji
    Wysoka wartość = wysoka volatilność = Ostrożność
    """
    # Kalkulacja tradycyjnych Bollinger Band
    basis = sma(close_prices, bb_length)
    bb_std = stdev(close_prices, bb_length)
    upper_band = basis + (2 * bb_std)
    lower_band = basis - (2 * bb_std)
    
    # BB Width - normalized by middle band
    bb_width = (upper_band - lower_band) / basis
    
    # Percentyl szerokości w stosunku do historii
    bbwp = percentileofscore(bb_width_history[-bbwp_length:], bb_width[-1])
    
    # Interpretacja sygnałów:
    # BBWP < 5: Ekstremalnie niska volatilność → oczekiwanie ekspansji → BULLISH na entry
    # BBWP 5-20: Niska volatilność → Przygotowanie do ruchu
    # BBWP 20-80: Normalny zakres → NEUTRAL
    # BBWP 80-95: Wysoka volatilność → Przygotowanie do konsolidacji
    # BBWP > 95: Ekstremalnie wysoka volatilność → CAUTION, przygotuj się na skrócenie
    
    if bbwp < 5:
        signal = 'EXTREME_LOW_VOL'
        bullish_point = 1
    elif bbwp < 20:
        signal = 'LOW_VOL'
        bullish_point = 1
    elif bbwp < 80:
        signal = 'NORMAL_VOL'
        bullish_point = 0
    elif bbwp < 95:
        signal = 'HIGH_VOL'
        bullish_point = 0
    else:
        signal = 'EXTREME_HIGH_VOL'
        bullish_point = 0
    
    return {
        'bbwp': bbwp,
        'signal': signal,
        'bullish_point': bullish_point,
        'bb_width': bb_width[-1],
        'basis': basis[-1]
    }
```

**Gaussian Channel:**

```python
def calculate_gaussian_channel(close_prices, length=20, mult=2.0):
    """
    Gaussian-weighted moving average z bandami
    Bardziej responsywna niż SMA ze względu na wagowanie Gaussowskie
    Cena powyżej kanału = bullish momentum
    Cena poniżej kanału = bearish momentum
    Crossing MA = zmiana kierunku
    """
    # Gaussian kernel - waży bliższe ceny wyżej
    weights = []
    for i in range(length):
        # Normalna dystrybucja skoncentrowana w środku
        weight = exp(-((i - length/2)**2) / (2 * (length/4)**2))
        weights.append(weight)
    
    weights = [w / sum(weights) for w in weights]  # Normalize
    
    # Weighted average z Gaussian kernelem
    gaussian_ma = weighted_average(close_prices[-length:], weights)
    std_dev = stdev(close_prices[-length:])
    upper_band = gaussian_ma + (mult * std_dev)
    lower_band = gaussian_ma - (mult * std_dev)
    
    current_price = close_prices[-1]
    
    # Sygnały strukturalne:
    if current_price > upper_band:
        signal = 'STRONG_BULLISH'
        bullish_point = 1
    elif current_price > gaussian_ma:
        signal = 'BULLISH'
        bullish_point = 1
    elif current_price > lower_band:
        signal = 'BEARISH'
        bullish_point = 0
    else:
        signal = 'STRONG_BEARISH'
        bullish_point = 0
    
    # Detect crossover - zmiana kierunku
    prev_price = close_prices[-2]
    crossover_up = prev_price < gaussian_ma and current_price > gaussian_ma
    crossover_down = prev_price > gaussian_ma and current_price < gaussian_ma
    
    return {
        'gaussian_ma': gaussian_ma,
        'upper_band': upper_band,
        'lower_band': lower_band,
        'signal': signal,
        'bullish_point': bullish_point,
        'crossover': 'UP' if crossover_up else ('DOWN' if crossover_down else 'NONE'),
        'position_pct': (current_price - lower_band) / (upper_band - lower_band) * 100
    }
```

**Williams Vix Fix (WVF):**

```python
def calculate_wvf(close, low, length=22, bbl=20, mult=2.0):
    """
    Williams Vix Fix - identyfikuje dna rynkowe poprzez Fear Index
    WVF > 100 oznacza panikę, WVF < 20 oznacza spokój
    Sygnał BULLISH pojawia się gdy WVF przeskaluje i wraca w dół (kapitulacja minerów)
    """
    highest_close_val = max(close[-length:])
    current_low = low[-1]
    
    # WVF formula: (H - L) / H * 100
    # H = najwyższe zamknięcie w periodzie
    # L = aktualne low
    wvf = ((highest_close_val - current_low) / highest_close_val) * 100
    
    # Moving average i bands dla WVF
    wvf_history = [calculate_wvf_single(close[i:i+length], low[i:i+length]) 
                   for i in range(len(close)-bbl, len(close))]
    
    mid_line = sma(wvf_history, bbl)
    upper_band = mid_line + (mult * stdev(wvf_history, bbl))
    
    # Sygnały
    if wvf > upper_band:
        signal = 'EXTREME_FEAR'  # Potencjalne dno
        bullish_point = 1
    elif wvf > mid_line:
        signal = 'FEAR'
        bullish_point = 0.5
    else:
        signal = 'NORMAL'
        bullish_point = 0
    
    return {
        'wvf': wvf,
        'signal': signal,
        'bullish_point': bullish_point,
        'upper_band': upper_band,
        'mid_line': mid_line
    }
```

**Hash Ribbons:**

```python
def calculate_hash_ribbons(hash_rate_data):
    """
    Hash Ribbons - wskaźnik kapitulacji minerów
    Używa 30-dniową i 60-dniową moving average hash rate'u
    Kapitulacja minerów często poprzedza wielkie wybiory
    Recovery po kapitulacji = BULLISH signal
    """
    ma_30 = sma(hash_rate_data, 30)
    ma_60 = sma(hash_rate_data, 60)
    
    current_ma_30 = ma_30[-1]
    current_ma_60 = ma_60[-1]
    prev_ma_30 = ma_30[-2]
    prev_ma_60 = ma_60[-2]
    
    # Kapitulacja: ma_30 < ma_60 (minimem lub ma_30 crossing below)
    in_capitulation = current_ma_30 < current_ma_60
    was_in_capitulation = prev_ma_30 < prev_ma_60
    
    # Recovery: crossover above
    recovery_crossover = (prev_ma_30 <= prev_ma_60 and 
                         current_ma_30 > current_ma_60)
    
    if recovery_crossover and was_in_capitulation:
        signal = 'RECOVERY_BUY'
        bullish_point = 1
    elif in_capitulation:
        signal = 'CAPITULATION'
        bullish_point = 0
    else:
        signal = 'NORMAL'
        bullish_point = 0
    
    return {
        'ma_30': current_ma_30,
        'ma_60': current_ma_60,
        'signal': signal,
        'bullish_point': bullish_point,
        'in_capitulation': in_capitulation
    }
```

**Funding Rate:**

```python
def get_funding_rate(exchange_id='bybit'):
    """
    Pobiera obecny Funding Rate przez CCXT (domyślnie: Bybit)
    Funding Rate > 0 oznacza, że longs płacą shorts
    Oznacza to, że market jest overleveraged long

    Ta sytuacja często poprzedza likwidacyjne kaskady
    Tradycyjnie: high positive funding = bearish warning

    CCXT obsługuje: bybit, okx, kraken, kucoin, gateio, bitget itp.
    Dane publiczne - NIE wymaga klucza API.
    """
    import ccxt
    exchange = getattr(ccxt, exchange_id)()
    funding = exchange.fetch_funding_rate('BTC/USDT:USDT')

    funding_rate_pct = funding['fundingRate'] * 100
    
    # Interpretacja
    if funding_rate_pct > 0.05:
        signal = 'EXTREME_LONG_BIAS'
        bullish_point = 0  # Niebezpieczne dla longów
    elif funding_rate_pct > 0.01:
        signal = 'LONG_BIAS'
        bullish_point = 0
    elif funding_rate_pct < -0.05:
        signal = 'EXTREME_SHORT_BIAS'
        bullish_point = 1  # Shorts są wyleveraged
    elif funding_rate_pct < -0.01:
        signal = 'SHORT_BIAS'
        bullish_point = 1
    else:
        signal = 'NEUTRAL'
        bullish_point = 0
    
    return {
        'funding_rate': funding_rate_pct,
        'signal': signal,
        'bullish_point': bullish_point
    }
```

**MMD (Market Maker Divergence):**

```python
def calculate_mmd(price_data, oi_data):
    """
    Market Maker Divergence - detektuje pozycjonowanie institucjonalne
    
    Dywerencja BEARISH (Distribution):
    - Cena rośnie + OI spada = Smart Money zmniejsza długą pozycję
    - Potencjalna korekta lub short squeeze
    
    Dywerencja BULLISH (Accumulation):
    - Cena spada + OI rośnie = Smart Money kupuje na dole
    - Potencjalny rally
    
    Brak dywerencji (Convergence):
    - Cena i OI poruszają się razem = normalna dynamika
    """
    # Ustal trendy na ostatnich N candle'ach
    price_trend = determine_trend(price_data[-50:])
    oi_trend = determine_trend(oi_data[-50:])
    
    # Dywerencja
    if price_trend == 'UP' and oi_trend == 'DOWN':
        signal = 'BEARISH_DIVERGENCE'  # Distribution
        bullish_point = 0
        description = 'Price UP, OI DOWN - SM selling'
    elif price_trend == 'DOWN' and oi_trend == 'UP':
        signal = 'BULLISH_DIVERGENCE'  # Accumulation
        bullish_point = 1
        description = 'Price DOWN, OI UP - SM buying'
    else:
        signal = 'NO_DIVERGENCE'  # Convergence
        bullish_point = 0
        description = 'Price and OI aligned'
    
    return {
        'price_trend': price_trend,
        'oi_trend': oi_trend,
        'signal': signal,
        'bullish_point': bullish_point,
        'description': description
    }
```

**RADAR Score Calculation:**

```python
def calculate_radar_score(metrics_results):
    """
    Kombinowany RADAR score: 0-6
    Każda metrika przyczynnia się 0 lub 1 punkcie w kierunku bullish
    
    Score 5-6: ACCUMULATE - pełny rozmiar longów
    Score 3-4: NEUTRAL - zmniejszony rozmiar, selektywnie
    Score 0-2: SELL_THE_RALLY - bias shortów tylko
    
    Logika:
    - BBWP: 1 punkt za LOW_VOL (< 20) - setup do ruchu
    - Gaussian: 1 punkt za BULLISH+ (cena > MA)
    - WVF: 1 punkt za EXTREME_FEAR (dno rynkowe)
    - Hash Ribbons: 1 punkt za RECOVERY_BUY (recovery po kapitulacji)
    - Funding: 1 punkt za brak LONG_BIAS (neutral lub short bias)
    - MMD: 1 punkt za BULLISH_DIVERGENCE (SM buying dips)
    """
    score = 0
    components = []
    
    # Component 1: BBWP
    if metrics_results['bbwp']['signal'] in ['EXTREME_LOW_VOL', 'LOW_VOL']:
        score += 1
        components.append(f"BBWP ({metrics_results['bbwp']['bbwp']:.1f}%)")
    
    # Component 2: Gaussian Channel
    if metrics_results['gaussian']['signal'] in ['BULLISH', 'STRONG_BULLISH']:
        score += 1
        components.append(f"Gaussian ({metrics_results['gaussian']['signal']})")
    
    # Component 3: WVF
    if metrics_results['wvf']['signal'] in ['EXTREME_FEAR', 'FEAR']:
        score += 1
        components.append(f"WVF ({metrics_results['wvf']['wvf']:.1f})")
    
    # Component 4: Hash Ribbons
    if metrics_results['hash_ribbons']['signal'] == 'RECOVERY_BUY':
        score += 1
        components.append("HR (Recovery Buy)")
    elif not metrics_results['hash_ribbons']['in_capitulation']:
        score += 0.5
        components.append("HR (Not in Capitulation)")
    
    # Component 5: Funding Rate
    if metrics_results['funding']['signal'] != 'LONG_BIAS':
        score += 1
        components.append(f"Funding ({metrics_results['funding']['signal']})")
    
    # Component 6: MMD
    if metrics_results['mmd']['signal'] == 'BULLISH_DIVERGENCE':
        score += 1
        components.append("MMD (Accumulation)")
    
    # Classification
    if score >= 5:
        classification = 'ACCUMULATE'
        color = 'GREEN'
    elif score >= 3:
        classification = 'NEUTRAL'
        color = 'YELLOW'
    else:
        classification = 'SELL_THE_RALLY'
        color = 'RED'
    
    return {
        'score': round(score, 1),
        'max_score': 6,
        'classification': classification,
        'color': color,
        'components': components,
        'timestamp': datetime.now()
    }
```

### 7.2 Structural Analysis - Swing Detection & Secondary Swing

```python
def detect_swings(ohlcv_data, lookback=5):
    """
    Swing High/Low detection - autodetekacja kluczowych pivotów
    
    Swing High: candle[i].high jest maksimum w oknie [i-lookback, i+lookback]
    Swing Low: candle[i].low jest minimum w oknie [i-lookback, i+lookback]
    
    Lookback values per timeframe:
    - 1H: 7 (poszukujemy pivotów co ~7 godzin)
    - 4H: 5 (poszukujemy pivotów co ~20 godzin)
    - 1D: 5 (poszukujemy pivotów co ~5 dni)
    - 3D: 4 (poszukujemy pivotów co ~12 dni)
    - 1W: 3 (poszukujemy pivotów co ~3 tygodni)
    - 1M: 3 (poszukujemy pivotów co ~3 miesięcy)
    """
    swings = []
    
    # Potrzebujemy wystarczająco danych historycznych
    if len(ohlcv_data) < lookback * 3:
        return swings
    
    for i in range(lookback, len(ohlcv_data) - lookback):
        candle = ohlcv_data[i]
        window_high_indices = range(max(0, i - lookback), min(len(ohlcv_data), i + lookback + 1))
        window_low_indices = range(max(0, i - lookback), min(len(ohlcv_data), i + lookback + 1))
        
        highs = [ohlcv_data[idx].high for idx in window_high_indices]
        lows = [ohlcv_data[idx].low for idx in window_low_indices]
        
        # Sprawdź czy to swing high
        if candle.high == max(highs):
            swings.append({
                'type': 'HIGH',
                'price': candle.high,
                'time': candle.time,
                'index': i,
                'label': None  # Będzie przypisane w classify_swings
            })
        
        # Sprawdź czy to swing low
        if candle.low == min(lows):
            swings.append({
                'type': 'LOW',
                'price': candle.low,
                'time': candle.time,
                'index': i,
                'label': None  # Będzie przypisane w classify_swings
            })
    
    # Sortuj po time i klasyfikuj
    swings.sort(key=lambda x: x['time'])
    return classify_swings(swings)


def classify_swings(swings):
    """
    Klasyfikuj każdy swing względem poprzedniego swinga tego samego typu
    
    HH (Higher High): Nowe swing high > poprzedniego swing high (bullish)
    LH (Lower High): Nowe swing high < poprzedniego swing high (bearish)
    HL (Higher Low): Nowe swing low > poprzedniego swing low (bullish)
    LL (Lower Low): Nowe swing low < poprzedniego swing low (bearish)
    
    Struktury:
    HH + HL = BULLISH structure (wyższa dna i wyższe szczyty)
    LH + LL = BEARISH structure (niższe szczyty i niższe dna)
    HH + LL = CHOPPY (wymienne sygnały)
    LH + HL = REVERSAL potential
    """
    highs = [s for s in swings if s['type'] == 'HIGH']
    lows = [s for s in swings if s['type'] == 'LOW']
    
    # Klasyfikuj HIGH'i
    for i, swing in enumerate(highs):
        if i == 0:
            swing['label'] = 'FIRST_HIGH'
        else:
            prev_high = highs[i-1]
            swing['label'] = 'HH' if swing['price'] > prev_high['price'] else 'LH'
    
    # Klasyfikuj LOW'i
    for i, swing in enumerate(lows):
        if i == 0:
            swing['label'] = 'FIRST_LOW'
        else:
            prev_low = lows[i-1]
            swing['label'] = 'HL' if swing['price'] > prev_low['price'] else 'LL'
    
    # Merge i sort po index
    classified = highs + lows
    classified.sort(key=lambda x: x['index'])
    
    return classified


def determine_structural_bias(swings, current_price, current_time):
    """
    Określ bias strukturalny bazując na Secondary Swing mechanizmie
    
    BULLISH STRUCTURE (HH + HL pattern):
    - Secondary Swing = najniższe low PRZED ostatnim swing high
    - Jeśli cena zamknie poniżej SS → BIAS ZMIENIA SIĘ NA BEARISH
    - SS reprezentuje level, który jeśli straci - bull case się psuje
    
    BEARISH STRUCTURE (LH + LL pattern):
    - Secondary Swing = najwyższy high PRZED ostatnim swing low
    - Jeśli cena zamknie powyżej SS → BIAS ZMIENIA SIĘ NA BULLISH
    - SS reprezentuje level, który jeśli przebije - bear case się psuje
    
    Ta funkcja automatycznie flippuje bias gdy Secondary Swing jest naruszone
    """
    
    # Potrzebujemy ostatnich 4 swings do analizy
    if len(swings) < 4:
        return {
            'bias': 'INSUFFICIENT_DATA',
            'secondary_swing': None,
            'distance_to_ss_pct': None
        }
    
    recent_swings = swings[-4:]
    
    # Identyfikuj ostatnie 2 highs i 2 lows
    highs = [s for s in recent_swings if s['type'] == 'HIGH']
    lows = [s for s in recent_swings if s['type'] == 'LOW']
    
    # Określ strukturę
    is_bullish = (len(highs) >= 2 and len(lows) >= 2 and
                  highs[-1]['price'] > highs[-2]['price'] and
                  lows[-1]['price'] > lows[-2]['price'])
    
    is_bearish = (len(highs) >= 2 and len(lows) >= 2 and
                  highs[-1]['price'] < highs[-2]['price'] and
                  lows[-1]['price'] < lows[-2]['price'])
    
    if is_bullish:
        # Bullish structure: Secondary Swing to low przed ostatnim high
        last_high_index = highs[-1]['index']
        ss_candidates = [s for s in swings if s['type'] == 'LOW' and s['index'] < last_high_index]
        
        if ss_candidates:
            secondary_swing = max(ss_candidates, key=lambda x: x['price'])
            ss_price = secondary_swing['price']
            
            if current_price < ss_price:
                bias = 'BEARISH'
                reason = 'Secondary Swing Low lost'
            else:
                bias = 'BULLISH'
                reason = 'Holding above Secondary Swing Low'
        else:
            bias = 'BULLISH'
            reason = 'No SS reference yet'
            ss_price = None
    
    elif is_bearish:
        # Bearish structure: Secondary Swing to high przed ostatnim low
        last_low_index = lows[-1]['index']
        ss_candidates = [s for s in swings if s['type'] == 'HIGH' and s['index'] < last_low_index]
        
        if ss_candidates:
            secondary_swing = min(ss_candidates, key=lambda x: x['price'])
            ss_price = secondary_swing['price']
            
            if current_price > ss_price:
                bias = 'BULLISH'
                reason = 'Secondary Swing High reclaimed'
            else:
                bias = 'BEARISH'
                reason = 'Below Secondary Swing High'
        else:
            bias = 'BEARISH'
            reason = 'No SS reference yet'
            ss_price = None
    
    else:
        bias = 'CHOPPY'
        reason = 'No clear structure'
        ss_price = None
    
    # Oblicz dystans do SS
    if ss_price:
        distance_pct = ((current_price - ss_price) / ss_price) * 100
    else:
        distance_pct = None
    
    return {
        'bias': bias,
        'reason': reason,
        'secondary_swing_price': ss_price,
        'distance_to_ss_pct': distance_pct,
        'current_price': current_price,
        'structure': 'BULLISH' if is_bullish else ('BEARISH' if is_bearish else 'CHOPPY')
    }
```

### 7.3 Zone Detection (OB, FVG)

```python
def detect_fvg(ohlcv_data):
    """
    Fair Value Gap detection - identyfikacja niezatopionych lukowych odcisków
    
    Bullish FVG: candle[i-1].high < candle[i+1].low
    - Oznacza gap up bez przetestowania interioru
    - Wynika z silnego kupowania (impulse do góry)
    - FVG może być fillowany gdy cena wraca w lukę
    - Obserwujemy czy FVG zostaje zatopiany czy odpiera
    
    Bearish FVG: candle[i-1].low > candle[i+1].high
    - Oznacza gap down bez przetestowania interioru
    - Wynika z silnej sprzedaży (impulse w dół)
    - Potencjalne wsparcie dla bounce'a
    """
    fvgs = []
    
    for i in range(1, len(ohlcv_data) - 1):
        candle_prev = ohlcv_data[i - 1]
        candle_current = ohlcv_data[i]
        candle_next = ohlcv_data[i + 1]
        
        # Bullish FVG (gap up)
        if candle_prev.high < candle_next.low:
            fvgs.append({
                'type': 'BULLISH_FVG',
                'top': candle_next.low,      # Górny edge luki
                'bottom': candle_prev.high,  # Dolny edge luki
                'formed_at': candle_current.time,
                'formed_index': i,
                'filled': False,
                'filled_at': None
            })
        
        # Bearish FVG (gap down)
        if candle_prev.low > candle_next.high:
            fvgs.append({
                'type': 'BEARISH_FVG',
                'top': candle_prev.low,      # Górny edge luki
                'bottom': candle_next.high,  # Dolny edge luki
                'formed_at': candle_current.time,
                'formed_index': i,
                'filled': False,
                'filled_at': None
            })
    
    # Oznacz zatopione FVG'i (gdy cena wraca w lukę)
    for fvg in fvgs:
        for j in range(fvg['formed_index'] + 1, len(ohlcv_data)):
            candle = ohlcv_data[j]
            
            # Bullish FVG - zatopiony gdy low < top (wróciło w lukę)
            if fvg['type'] == 'BULLISH_FVG' and candle.low < fvg['top']:
                fvg['filled'] = True
                fvg['filled_at'] = candle.time
                break
            
            # Bearish FVG - zatopiony gdy high > bottom (wróciło w lukę)
            if fvg['type'] == 'BEARISH_FVG' and candle.high > fvg['bottom']:
                fvg['filled'] = True
                fvg['filled_at'] = candle.time
                break
    
    # Zwróć tylko niezatopione FVG'i
    return [f for f in fvgs if not f['filled']]


def detect_order_blocks(ohlcv_data, swings):
    """
    Order Block detection - identyfikacja poziomów znaczących oporów i wsparć
    
    Bullish Order Block (OB):
    - Ostatnia niedźwiedzia (red) candle PRZED bullish impulsem (seria zelonych)
    - Impulse ten tworzy swing low
    - OB to body poprzedniej niedźwiedzia candle (open-close)
    - Trader'e czekają tutaj żeby shorty
    - Intelligent money (Smart Money) "wybiło" tych shorty'ego
    - Gdy cena wraca - towary shortów jeszcze są tam czekają
    
    Bearish Order Block (OB):
    - Ostatnia bycza (green) candle PRZED bearish impulsem (seria czerwonych)
    - Impulse ten tworzy swing high
    - OB to body poprzedniej byczej candle (close-open)
    - Trader'e czekają tutaj żeby longuje
    - Intelligent money "wybiło" tych longów
    """
    obs = []
    
    for swing in swings:
        swing_index = swing['index']
        
        if swing['type'] == 'LOW':
            # To jest bullish swing - szukamy bullish OB
            # Cofnij się od swing low i znajdź ostatnią bearish candle
            
            for j in range(swing_index - 1, max(swing_index - 10, -1), -1):
                candle = ohlcv_data[j]
                
                # Bearish candle: close < open
                if candle.close < candle.open:
                    obs.append({
                        'type': 'BULLISH_OB',
                        'top': max(candle.open, candle.close),      # Higher of open/close
                        'bottom': min(candle.open, candle.close),   # Lower of open/close
                        'swing_level': swing['price'],
                        'formed_at': candle.time,
                        'reference_swing': swing
                    })
                    break
        
        elif swing['type'] == 'HIGH':
            # To jest bearish swing - szukamy bearish OB
            # Cofnij się od swing high i znajdź ostatnią bullish candle
            
            for j in range(swing_index - 1, max(swing_index - 10, -1), -1):
                candle = ohlcv_data[j]
                
                # Bullish candle: close > open
                if candle.close > candle.open:
                    obs.append({
                        'type': 'BEARISH_OB',
                        'top': max(candle.open, candle.close),      # Higher of open/close
                        'bottom': min(candle.open, candle.close),   # Lower of open/close
                        'swing_level': swing['price'],
                        'formed_at': candle.time,
                        'reference_swing': swing
                    })
                    break
    
    return obs
```

### 7.4 Confluence Scoring

```python
def calculate_confluence(
    radar_score,
    structural_bias,
    zones_nearby,
    macro_window_active,
    session_info,
    direction,  # 'LONG' lub 'SHORT'
    inducement_complete=False,
    multi_tf_aligned=False
):
    """
    Confluence scoring dla SNIPER execution layer
    Maksimum: 7 punktów
    
    5-7 punktów: HIGH confidence → Full size, SAFE + AGRO entries
    3-4 punktów: MEDIUM confidence → Half size, SAFE entry only
    1-2 punktów: LOW confidence → Bardzo selektywnie, micro size
    0 punktów: NO TRADE
    
    Scoring breakdown:
    1. Macro alignment (RADAR) - czy makro wspiera kierunek?
    2. Structural bias - czy struktura wspiera kierunek?
    3. Key zone - czy jesteśmy na OB lub FVG?
    4. Macro time window - czy jesteśmy w active macro window?
    5. Inducement completed - czy SM już wybiła poprzednią stronę?
    6. Session alignment - czy sesja sprzyja kierunkowi?
    7. Multi-TF alignment - czy wyższe TF'y wspierają kierunek?
    """
    score = 0
    reasons = []
    warnings = []
    
    # 1. MACRO ALIGNMENT (RADAR)
    radar_direction = 'LONG' if radar_score >= 4 else 'SHORT'
    if direction == radar_direction:
        if radar_score >= 5:
            score += 1
            reasons.append(f'Strong RADAR alignment ({radar_score}/6)')
        elif radar_score >= 3:
            score += 0.5
            reasons.append(f'Moderate RADAR alignment ({radar_score}/6)')
    else:
        warnings.append(f'RADAR bias opposite to trade ({radar_score}/6)')
    
    # 2. STRUCTURAL BIAS ALIGNMENT
    structural_direction = ('LONG' if structural_bias['bias'] == 'BULLISH' 
                           else 'SHORT' if structural_bias['bias'] == 'BEARISH' 
                           else None)
    
    if direction == structural_direction:
        score += 1
        distance = abs(structural_bias.get('distance_to_ss_pct', 0) or 0)
        if distance < 2:
            reasons.append(f'Close to Secondary Swing ({distance:.1f}%)')
        else:
            reasons.append(f'Structural alignment ({structural_direction})')
    elif structural_direction:
        warnings.append(f'Structure contradicts trade ({structural_direction})')
    
    # 3. KEY ZONE PRESENT
    bullish_zones = [z for z in zones_nearby if z['type'].startswith('BULLISH')]
    bearish_zones = [z for z in zones_nearby if z['type'].startswith('BEARISH')]
    
    if direction == 'LONG' and bullish_zones:
        score += 1
        closest_zone = min(bullish_zones, key=lambda z: abs(z['price'] - zones_nearby[0]['current_price']))
        reasons.append(f'Price at bullish zone ({closest_zone["type"]})')
    elif direction == 'SHORT' and bearish_zones:
        score += 1
        closest_zone = min(bearish_zones, key=lambda z: abs(z['price'] - zones_nearby[0]['current_price']))
        reasons.append(f'Price at bearish zone ({closest_zone["type"]})')
    else:
        warnings.append('No key zone at price')
    
    # 4. MACRO TIME WINDOW
    if macro_window_active:
        score += 1
        reasons.append('Active macro time window')
    else:
        warnings.append('Outside macro time window')
    
    # 5. INDUCEMENT COMPLETED
    if inducement_complete:
        score += 1
        reasons.append('Smart Money inducement complete')
    else:
        warnings.append('Awaiting inducement before entry')
    
    # 6. SESSION ALIGNMENT
    if session_info.get('favorable_for_' + direction.lower(), False):
        score += 1
        reasons.append(f'Session aligned ({session_info.get("current_session")})')
    
    # 7. MULTI-TF ALIGNMENT
    if multi_tf_aligned:
        score += 1
        reasons.append('Multi-timeframe alignment confirmed')
    else:
        warnings.append('Multi-TF alignment mixed')
    
    # Classification
    if score >= 5.5:
        confidence = 'HIGH'
        recommendation = 'FULL_SIZE'
    elif score >= 3.5:
        confidence = 'MEDIUM'
        recommendation = 'HALF_SIZE'
    elif score >= 1.5:
        confidence = 'LOW'
        recommendation = 'MICRO_SIZE'
    else:
        confidence = 'VERY_LOW'
        recommendation = 'NO_TRADE'
    
    return {
        'score': round(score, 1),
        'max_score': 7,
        'confidence': confidence,
        'recommendation': recommendation,
        'reasons': reasons,
        'warnings': warnings,
        'timestamp': datetime.now()
    }
```

## 8. FRONTEND - KOMPONENTY UI

### 8.1 BiasGrid (Główny komponent)

BiasGrid to najważniejszy komponent całej aplikacji. Pokazuje bias strukturalny dla każdego timeframe'u oraz RADAR score dla całego marketu.

```
┌─────────────────────────────────────────────────────────────────────┐
│  BIAS GRID - BTC/USDT                     BTC: $42,150 + 2.3%       │
├──────┬──────────────┬──────────┬──────────┬─────────┬──────────────┤
│  TF  │ Struktura    │ RADAR    │ SS Level │ Dystans │ Notatka      │
├──────┼──────────────┼──────────┼──────────┼─────────┼──────────────┤
│  1H  │ BULLISH      │ ─────    │ 41,800   │  -0.8%  │ [edytuj]     │
│      │ HL+HH        │          │          │         │              │
├──────┼──────────────┼──────────┼──────────┼─────────┼──────────────┤
│  4H  │ BULLISH      │ ─────    │ 40,200   │  -4.6%  │ OB @ 41.5k   │
│      │ HL+HH        │          │          │         │ [edytuj]     │
├──────┼──────────────┼──────────┼──────────┼─────────┼──────────────┤
│  1D  │ BEARISH      │ 4/6      │ 43,500   │  +3.2%  │ Czekam break │
│      │ LH+LL        │          │          │         │ [edytuj]     │
├──────┼──────────────┼──────────┼──────────┼─────────┼──────────────┤
│  3D  │ BULLISH      │ ─────    │ 38,500   │  -8.7%  │ Long term up │
│      │ HL+HH        │          │          │         │ [edytuj]     │
├──────┼──────────────┼──────────┼──────────┼─────────┼──────────────┤
│  1W  │ BULLISH      │ 5/6      │ 35,000   │ -17.0%  │ Silny trend  │
│      │ HL+HH        │          │          │         │ [edytuj]     │
├──────┼──────────────┼──────────┼──────────┼─────────┼──────────────┤
│  1M  │ BULLISH      │ 5/6      │ 28,000   │ -33.6%  │ Macro bull   │
│      │ HL+HH        │          │          │         │ [edytuj]     │
├──────┴──────────────┴──────────┴──────────┴─────────┴──────────────┤
│                                                                     │
│ OVERALL: BULLISH z ostrzezeniem na 1D                              │
│ Current Confluence: 5/7 (HIGH confidence)                          │
│                                                                     │
│ Key Level Alert: 1D Secondary Swing @ 43,500 (distance +3.2%)     │
│ Last Update: 2 minutes ago                                         │
└─────────────────────────────────────────────────────────────────────┘
```

**Kolorowanie:**
- Zielony rząd: Struktura BULLISH (HL + HH pattern)
- Czerwony rząd: Struktura BEARISH (LH + LL pattern)
- Żółty rząd: TRANSITION / sprzeczne sygnały
- Orange highlight na SS Level: Gdy dystans < 2% (blisko zagrożenia)
- RADAR bar color: 0-2 (RED), 3-4 (YELLOW), 5-6 (GREEN)
- Pulsujący alert: Gdy SS distans < 1% lub RADAR się zmienił

### 8.2 Dashboard Layout

Główny dashboard zawiera wszystkie kluczowe komponenty z real-time updates.

### 8.3 Screenshot Analysis Component

Przepływ analizy screenshot'u:

1. Użytkownik przesyła screenshot wykresu do aplikacji
2. Backend wysyła do n8n workflow z image content
3. Claude Vision API analizuje obraz z system promptem
4. Wyniki są zwracane i wyświetlane w chat panelu
5. Historia analiz przechowywana w bazie danych

## 9. LLM AGENT - SYSTEM PROMPT

Kompletny system prompt dla Claude zawierający wszystkie reguły trading'u, struktury analizy i formaty odpowiedzi. Claude działa jako profesjonalny advisor wspierający trzywarstwowy system trading'u.

## 10. n8n WORKFLOWS

### 10.1 Data Fetcher - Scheduled co 1H
Pobiera OHLCV przez CCXT (domyślnie Bybit), kalkuluje RADAR, zapisuje do bazy, wysyła alert jeśli się zmienił.

### 10.2 TradingView Alert Handler
Webhook od TradingView → Parse → Database → LLM analysis → WebSocket broadcast.

### 10.3 Daily Briefing - 13:00 UTC
Generuje daily briefing przed NY sesją używając Claude API z current market context.

### 10.4 Screenshot Analyzer
Webhook z dashboardu → Upload image → Claude Vision → Parse response → Database.

## 11. PINE SCRIPT INDICATORS

### 11.1 RADAR Dashboard
Overlay na chart z tabelą metryki, kolorowe background bazując na score, webhook alerts.

### 11.2 Structure Map
Auto-detekuje swings, rysuje OB/FVG, zaznacza SS, alertuje na BOS/CHoCH/SS broken.

## 12. FAZY IMPLEMENTACJI

Projekt jest podzielony na 4 fazy po 2-3 tygodnie każda:

**Faza 1:** MVP Dashboard + RADAR (tydzień 1-2)
**Faza 2:** Structural Analysis + TradingView (tydzień 3-4)  
**Faza 3:** LLM Copilot + Alerts (tydzień 5-7)
**Faza 4:** Trade Journal + Learning (tydzień 8+)

Każda faza buduje na poprzedniej, zapewniając progresywne wdrażanie funkcjonalności.

---

**Summary**: Trading Command Center to trzywarstwowy system:
- RADAR dla makro biasu
- MAP dla struktur i levelów
- SNIPER dla execution i confluence

System eliminuje emocje poprzez Secondary Swing mechanism - automatyczne flippowanie biasu gdy Smart Money przebije poprzednią stronę.

