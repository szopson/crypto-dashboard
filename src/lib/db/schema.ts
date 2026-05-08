// Database schema definitions for Trading Command Center
// Uses better-sqlite3 for local SQLite storage

export const CREATE_CANDLES = `
  CREATE TABLE IF NOT EXISTS candles (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol      TEXT    NOT NULL,
    timeframe   TEXT    NOT NULL,
    open_time   INTEGER NOT NULL,
    open        REAL    NOT NULL,
    high        REAL    NOT NULL,
    low         REAL    NOT NULL,
    close       REAL    NOT NULL,
    volume      REAL    NOT NULL,
    UNIQUE(symbol, timeframe, open_time)
  )
`;

export const CREATE_CANDLES_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_candles_symbol_tf_time
  ON candles(symbol, timeframe, open_time DESC)
`;

export const CREATE_RADAR_SCORES = `
  CREATE TABLE IF NOT EXISTS radar_scores (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol      TEXT    NOT NULL,
    timeframe   TEXT    NOT NULL,
    timestamp   INTEGER NOT NULL,
    trend       REAL    NOT NULL,
    momentum    REAL    NOT NULL,
    volume_z    REAL    NOT NULL,
    structure   REAL    NOT NULL,
    bias        REAL    NOT NULL,
    score       REAL    NOT NULL,
    UNIQUE(symbol, timeframe, timestamp)
  )
`;

export const CREATE_RADAR_SCORES_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_radar_scores_symbol_tf_time
  ON radar_scores(symbol, timeframe, timestamp DESC)
`;

export const CREATE_TRADE_JOURNAL = `
  CREATE TABLE IF NOT EXISTS trade_journal (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol      TEXT    NOT NULL,
    side        TEXT    NOT NULL CHECK(side IN ('long', 'short')),
    entry_price REAL    NOT NULL,
    exit_price  REAL,
    size        REAL    NOT NULL,
    pnl         REAL,
    notes       TEXT,
    timestamp   INTEGER NOT NULL DEFAULT (unixepoch())
  )
`;

export const CREATE_SESSIONS = `
  CREATE TABLE IF NOT EXISTS sessions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    date        TEXT    NOT NULL UNIQUE,
    pnl         REAL    NOT NULL DEFAULT 0,
    trades      INTEGER NOT NULL DEFAULT 0,
    win_rate    REAL,
    notes       TEXT,
    created_at  INTEGER NOT NULL DEFAULT (unixepoch())
  )
`;

export const CREATE_SETUPS = `
  CREATE TABLE IF NOT EXISTS setups (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol          TEXT    NOT NULL,
    direction       TEXT    NOT NULL CHECK(direction IN ('long', 'short')),
    entry_zone_low  REAL    NOT NULL,
    entry_zone_high REAL    NOT NULL,
    target          REAL,
    invalidation    REAL,
    confluence_score INTEGER NOT NULL DEFAULT 0,
    reasoning       TEXT,
    status          TEXT    NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'triggered', 'invalidated')),
    created_at      INTEGER NOT NULL DEFAULT (unixepoch())
  )
`;

export const CREATE_SENTIMENT = `
  CREATE TABLE IF NOT EXISTS sentiment (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    date         TEXT    NOT NULL UNIQUE,
    fng_value    INTEGER NOT NULL,
    fng_label    TEXT    NOT NULL,
    bias_modifier INTEGER NOT NULL DEFAULT 0,
    raw_data     TEXT,
    created_at   INTEGER NOT NULL DEFAULT (unixepoch())
  )
`;

export const CREATE_EVENTS = `
  CREATE TABLE IF NOT EXISTS events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol      TEXT    NOT NULL,
    timeframe   TEXT,
    event_type  TEXT    NOT NULL,
    description TEXT    NOT NULL,
    price       REAL,
    created_at  INTEGER NOT NULL DEFAULT (unixepoch())
  )
`;

export const CREATE_TRADE_JOURNAL_V2 = `
  CREATE TABLE IF NOT EXISTS trades (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol       TEXT    NOT NULL,
    direction    TEXT    NOT NULL CHECK(direction IN ('long', 'short')),
    entry_price  REAL    NOT NULL,
    exit_price   REAL,
    size         REAL    NOT NULL DEFAULT 1,
    stop_loss    REAL,
    take_profit  REAL,
    pnl          REAL,
    risk         REAL,
    r_multiple   REAL,
    setup_type   TEXT,
    notes        TEXT,
    status       TEXT    NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'closed', 'pending')),
    source       TEXT    NOT NULL DEFAULT 'manual',
    created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
    closed_at    INTEGER
  )
`;

export const CREATE_BRIEFINGS = `
  CREATE TABLE IF NOT EXISTS briefings (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    date        TEXT    NOT NULL UNIQUE,
    content     TEXT    NOT NULL,
    created_at  INTEGER NOT NULL DEFAULT (unixepoch())
  )
`;

// ---------------------------------------------------------------------------
// Blueprint tables (All In Pro → BTC Pattern Recognition)
// ---------------------------------------------------------------------------

// Pattern Engine output — every ConfluenceScorer.compute() snapshot lands here.
// raw_metrics is JSON-encoded TEXT (Velo + SMC breakdown).
export const CREATE_PATTERN_HISTORY = `
  CREATE TABLE IF NOT EXISTS pattern_history (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    ticker       TEXT    NOT NULL,
    pattern_type TEXT,
    confidence   REAL,
    smc_score    REAL,
    velo_score   REAL,
    final_score  REAL,
    bias         TEXT,
    raw_metrics  TEXT,
    detected_at  INTEGER NOT NULL DEFAULT (unixepoch())
  )
`;

export const CREATE_PATTERN_HISTORY_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_pattern_history_ticker_time
  ON pattern_history(ticker, detected_at DESC)
`;

// Strategies — user-defined containers grouping trades of the same class.
// pattern_filter is JSON-encoded TEXT (e.g. {"velo_pattern":["E","A"],"min_score":50}).
export const CREATE_STRATEGIES = `
  CREATE TABLE IF NOT EXISTS strategies (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    name             TEXT    NOT NULL UNIQUE,
    description      TEXT,
    archetype        TEXT    CHECK(archetype IN ('SCALP','SWING','POSITION','DEGEN')),
    default_rr       REAL,
    default_risk_pct REAL,
    default_session  TEXT,
    pattern_filter   TEXT,
    is_active        INTEGER NOT NULL DEFAULT 1,
    created_at       INTEGER NOT NULL DEFAULT (unixepoch())
  )
`;

// Watchlist — single-user MVP, no user_id (add when auth lands).
export const CREATE_WATCHLIST = `
  CREATE TABLE IF NOT EXISTS watchlist (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    ticker    TEXT    NOT NULL UNIQUE,
    position  INTEGER NOT NULL DEFAULT 0,
    added_at  INTEGER NOT NULL DEFAULT (unixepoch())
  )
`;

// Trade partial closes — multi-row per trade (TP1/TP2/TP3).
export const CREATE_TRADE_PARTIAL_CLOSES = `
  CREATE TABLE IF NOT EXISTS trade_partial_closes (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    trade_id        INTEGER NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
    closed_at       INTEGER NOT NULL DEFAULT (unixepoch()),
    pct_closed      REAL    NOT NULL,
    exit_price      REAL    NOT NULL,
    realized_pnl    REAL    NOT NULL,
    commission_paid REAL
  )
`;

export const CREATE_TRADE_PARTIAL_CLOSES_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_trade_partial_closes_trade
  ON trade_partial_closes(trade_id, closed_at DESC)
`;

// Journal entries — daily / per-trade markdown notes with mood tracking.
// tags is JSON-encoded TEXT array.
export const CREATE_JOURNAL_ENTRIES = `
  CREATE TABLE IF NOT EXISTS journal_entries (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    trade_id    INTEGER REFERENCES trades(id),
    title       TEXT,
    content_md  TEXT    NOT NULL,
    mood        INTEGER CHECK(mood BETWEEN 1 AND 5),
    tags        TEXT,
    entry_date  TEXT    NOT NULL DEFAULT (date('now')),
    created_at  INTEGER NOT NULL DEFAULT (unixepoch())
  )
`;

export const CREATE_JOURNAL_ENTRIES_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_journal_entries_date
  ON journal_entries(entry_date DESC)
`;

// Alert subscriptions — per-channel toggle + optional ticker_filter (JSON array).
export const CREATE_ALERT_SUBSCRIPTIONS = `
  CREATE TABLE IF NOT EXISTS alert_subscriptions (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    channel       TEXT    NOT NULL UNIQUE,
    enabled       INTEGER NOT NULL DEFAULT 1,
    ticker_filter TEXT,
    min_severity  TEXT    CHECK(min_severity IN ('LOW','MEDIUM','HIGH','VERY_HIGH')),
    created_at    INTEGER NOT NULL DEFAULT (unixepoch())
  )
`;

// Alerts — pending queue consumed by Telegram dispatcher.
// payload is JSON-encoded TEXT.
export const CREATE_ALERTS = `
  CREATE TABLE IF NOT EXISTS alerts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    channel     TEXT    NOT NULL,
    ticker      TEXT,
    severity    TEXT    CHECK(severity IN ('LOW','MEDIUM','HIGH','VERY_HIGH')),
    payload     TEXT    NOT NULL,
    created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
    sent_at     INTEGER
  )
`;

// Partial index — dispatcher only scans pending rows.
export const CREATE_ALERTS_PENDING_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_alerts_pending
  ON alerts(created_at)
  WHERE sent_at IS NULL
`;

// Macro snapshots — Dashboard top bar cache.
// sparkline_7d is JSON array of values.
export const CREATE_MACRO_SNAPSHOTS = `
  CREATE TABLE IF NOT EXISTS macro_snapshots (
    symbol         TEXT PRIMARY KEY,
    last_value     REAL NOT NULL,
    change_24h_pct REAL,
    sparkline_7d   TEXT,
    updated_at     INTEGER NOT NULL DEFAULT (unixepoch())
  )
`;
