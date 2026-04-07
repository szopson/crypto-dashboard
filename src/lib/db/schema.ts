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

export const CREATE_BRIEFINGS = `
  CREATE TABLE IF NOT EXISTS briefings (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    date        TEXT    NOT NULL UNIQUE,
    content     TEXT    NOT NULL,
    created_at  INTEGER NOT NULL DEFAULT (unixepoch())
  )
`;
