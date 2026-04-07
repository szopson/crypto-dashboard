// eslint-disable-next-line @typescript-eslint/no-require-imports
const ccxt = require('ccxt');
import { getDb } from '@/lib/db/migrate';

const EXCHANGE_ID: string = process.env.CCXT_EXCHANGE ?? 'binance';
const DEFAULT_SYMBOLS = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'];
const SUPPORTED_TIMEFRAMES = ['15m', '1h', '4h', '1d'];

// Milliseconds per timeframe — used for freshness checks
const TF_MS: Record<string, number> = {
  '15m': 15 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '4h': 4 * 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _exchange: any = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getExchange(): any {
  if (_exchange) return _exchange;
  const ExchangeClass = ccxt[EXCHANGE_ID];
  _exchange = new ExchangeClass({
    enableRateLimit: true,
    apiKey: process.env.CCXT_API_KEY,
    secret: process.env.CCXT_API_SECRET,
  });
  return _exchange;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchOHLCVWithRetry(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  exchange: any,
  symbol: string,
  timeframe: string,
  limit = 200,
  retries = 3
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[]> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await exchange.fetchOHLCV(symbol, timeframe, undefined, limit);
    } catch (err) {
      if (attempt === retries - 1) throw err;
      const backoff = 1000 * Math.pow(2, attempt);
      await sleep(backoff);
    }
  }
  return [];
}

function isFresh(lastOpenTime: number | undefined, timeframe: string): boolean {
  if (lastOpenTime == null) return false;
  const tfMs = TF_MS[timeframe] ?? TF_MS['1h'];
  return Date.now() - lastOpenTime < tfMs;
}

export async function fetchAndStore(
  symbol: string,
  timeframe: string
): Promise<void> {
  if (!SUPPORTED_TIMEFRAMES.includes(timeframe)) {
    throw new Error(`Unsupported timeframe: ${timeframe}`);
  }

  const db = getDb();

  // Freshness check — skip if last candle is recent enough
  const latest = db
    .prepare(
      'SELECT open_time FROM candles WHERE symbol = ? AND timeframe = ? ORDER BY open_time DESC LIMIT 1'
    )
    .get(symbol, timeframe) as { open_time: number } | undefined;

  if (isFresh(latest?.open_time, timeframe)) {
    return;
  }

  const exchange = getExchange();
  const ohlcv = await fetchOHLCVWithRetry(exchange, symbol, timeframe);

  const upsert = db.prepare(`
    INSERT INTO candles (symbol, timeframe, open_time, open, high, low, close, volume)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(symbol, timeframe, open_time) DO UPDATE SET
      open   = excluded.open,
      high   = excluded.high,
      low    = excluded.low,
      close  = excluded.close,
      volume = excluded.volume
  `);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const insertMany = db.transaction((rows: any[]) => {
    for (const [openTime, open, high, low, close, volume] of rows) {
      upsert.run(symbol, timeframe, openTime, open, high, low, close, volume ?? 0);
    }
  });

  insertMany(ohlcv);
}

export async function fetchAllSymbols(timeframe = '1h'): Promise<void> {
  const symbols = process.env.CCXT_SYMBOLS
    ? process.env.CCXT_SYMBOLS.split(',').map((s) => s.trim())
    : DEFAULT_SYMBOLS;

  for (const symbol of symbols) {
    await fetchAndStore(symbol, timeframe);
  }
}
