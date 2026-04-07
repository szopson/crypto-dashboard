import { getDb } from '@/lib/db/migrate';

export interface RadarResult {
  symbol: string;
  timeframe: string;
  trend: number;     // -1 bearish, 0 neutral, 1 bullish
  momentum: number;  // -1 oversold, 0 neutral, 1 overbought
  volume_z: number;  // z-score of current volume vs 20-period avg
  structure: number; // -1 lower lows, 0 ranging, 1 higher highs
  bias: number;      // -1 to 1 composite of trend + momentum
  score: number;     // 0-100 directional conviction
  updatedAt: number; // epoch ms
}

interface Candle {
  open_time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ---- Technical indicator helpers ----

function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const result: number[] = [];
  let prev = values[0];
  for (const v of values) {
    const e = v * k + prev * (1 - k);
    result.push(e);
    prev = e;
  }
  return result;
}

function rsi(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const delta = closes[i] - closes[i - 1];
    if (delta > 0) gains += delta;
    else losses += Math.abs(delta);
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const delta = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(delta, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-delta, 0)) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stddev(arr: number[]): number {
  const m = mean(arr);
  const variance = arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

// ---- Metric computers ----

function computeTrend(candles: Candle[]): number {
  const closes = candles.map((c) => c.close);
  if (closes.length < 200) return 0;
  const ema20 = ema(closes, 20).at(-1)!;
  const ema50 = ema(closes, 50).at(-1)!;
  const ema200 = ema(closes, 200).at(-1)!;
  const price = closes.at(-1)!;
  const bullish = price > ema20 && ema20 > ema50 && ema50 > ema200;
  const bearish = price < ema20 && ema20 < ema50 && ema50 < ema200;
  return bullish ? 1 : bearish ? -1 : 0;
}

function computeMomentum(candles: Candle[]): number {
  const closes = candles.map((c) => c.close);
  const r = rsi(closes);
  if (r > 70) return 1;
  if (r < 30) return -1;
  return 0;
}

function computeVolumeZ(candles: Candle[]): number {
  const vols = candles.map((c) => c.volume);
  const recent = vols.slice(-20);
  if (recent.length < 2) return 0;
  const m = mean(recent.slice(0, -1));
  const s = stddev(recent.slice(0, -1));
  if (s === 0) return 0;
  return (recent.at(-1)! - m) / s;
}

function computeStructure(candles: Candle[]): number {
  const window = candles.slice(-20);
  if (window.length < 4) return 0;
  const highs = window.map((c) => c.high);
  const lows = window.map((c) => c.low);
  const mid = Math.floor(window.length / 2);
  const higherHighs = highs.at(-1)! > highs[mid] && highs[mid] > highs[0];
  const lowerLows = lows.at(-1)! < lows[mid] && lows[mid] < lows[0];
  return higherHighs ? 1 : lowerLows ? -1 : 0;
}

// ---- Main compute function ----

export async function computeRadar(
  symbol: string,
  timeframe: string
): Promise<RadarResult> {
  const db = getDb();
  const candles = db
    .prepare(
      'SELECT open_time, open, high, low, close, volume FROM candles WHERE symbol = ? AND timeframe = ? ORDER BY open_time ASC LIMIT 300'
    )
    .all(symbol, timeframe) as Candle[];

  if (candles.length === 0) {
    throw new Error(`No candles found for ${symbol} ${timeframe}`);
  }

  const trend = computeTrend(candles);
  const momentum = computeMomentum(candles);
  const volume_z = computeVolumeZ(candles);
  const structure = computeStructure(candles);
  const bias = trend * 0.5 + momentum * 0.5;
  // score: map bias (-1..1) to 0..100, then scale by structure confirmation
  const rawScore = (bias + 1) / 2 * 100;
  const score = Math.round(Math.max(0, Math.min(100, rawScore)));

  const now = Date.now();

  // Persist to radar_scores
  db.prepare(`
    INSERT INTO radar_scores (symbol, timeframe, timestamp, trend, momentum, volume_z, structure, bias, score)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(symbol, timeframe, timestamp) DO UPDATE SET
      trend     = excluded.trend,
      momentum  = excluded.momentum,
      volume_z  = excluded.volume_z,
      structure = excluded.structure,
      bias      = excluded.bias,
      score     = excluded.score
  `).run(symbol, timeframe, now, trend, momentum, volume_z, structure, bias, score);

  return { symbol, timeframe, trend, momentum, volume_z, structure, bias, score, updatedAt: now };
}
