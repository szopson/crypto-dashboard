export interface Candle {
  open_time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type SwingType = 'HH' | 'HL' | 'LH' | 'LL';

export interface SwingPoint {
  timestamp: number;
  price: number;
  kind: 'high' | 'low';
  type: SwingType;
  index: number;
}

export function detectSwings(candles: Candle[], strength = 3): SwingPoint[] {
  const swings: { timestamp: number; price: number; kind: 'high' | 'low'; index: number }[] = [];

  for (let i = strength; i < candles.length - strength; i++) {
    const candle = candles[i];
    let isSwingHigh = true;
    let isSwingLow = true;

    for (let j = i - strength; j <= i + strength; j++) {
      if (j === i) continue;
      if (candles[j].high >= candle.high) isSwingHigh = false;
      if (candles[j].low <= candle.low) isSwingLow = false;
    }

    if (isSwingHigh) {
      swings.push({ timestamp: candle.open_time, price: candle.high, kind: 'high', index: i });
    }
    if (isSwingLow) {
      swings.push({ timestamp: candle.open_time, price: candle.low, kind: 'low', index: i });
    }
  }

  // Sort by timestamp
  swings.sort((a, b) => a.timestamp - b.timestamp);

  // Label HH/HL/LH/LL by comparing to previous swing of same kind
  const result: SwingPoint[] = [];
  let lastHigh: number | null = null;
  let lastLow: number | null = null;

  for (const s of swings) {
    if (s.kind === 'high') {
      const type: SwingType = lastHigh === null ? 'HH' : s.price > lastHigh ? 'HH' : 'LH';
      result.push({ ...s, type });
      lastHigh = s.price;
    } else {
      const type: SwingType = lastLow === null ? 'HL' : s.price > lastLow ? 'HL' : 'LL';
      result.push({ ...s, type });
      lastLow = s.price;
    }
  }

  return result;
}

// ---- STRUCT-003: Multi-timeframe confluence ----

export interface ConfluenceResult {
  symbol: string;
  confluenceScore: number; // -3 to +3
  description: string;
  timeframes: Record<string, 'bullish' | 'bearish' | 'neutral'>;
}

function swingBias(swings: SwingPoint[]): 'bullish' | 'bearish' | 'neutral' {
  if (swings.length < 2) return 'neutral';
  const recents = swings.slice(-6);
  const highs = recents.filter((s) => s.kind === 'high');
  const lows = recents.filter((s) => s.kind === 'low');
  const hhCount = highs.filter((s) => s.type === 'HH').length;
  const lhCount = highs.filter((s) => s.type === 'LH').length;
  const hlCount = lows.filter((s) => s.type === 'HL').length;
  const llCount = lows.filter((s) => s.type === 'LL').length;
  const bullScore = hhCount + hlCount;
  const bearScore = lhCount + llCount;
  if (bullScore > bearScore) return 'bullish';
  if (bearScore > bullScore) return 'bearish';
  return 'neutral';
}

export function computeConfluence(
  candlesByTf: Record<string, Candle[]>
): Omit<ConfluenceResult, 'symbol'> {
  const TIMEFRAMES = ['15m', '1h', '4h'];
  let score = 0;
  const timeframes: Record<string, 'bullish' | 'bearish' | 'neutral'> = {};

  for (const tf of TIMEFRAMES) {
    const candles = candlesByTf[tf];
    if (!candles || candles.length < 10) {
      timeframes[tf] = 'neutral';
      continue;
    }
    const swings = detectSwings(candles);
    const bias = swingBias(swings);
    timeframes[tf] = bias;
    if (bias === 'bullish') score += 1;
    if (bias === 'bearish') score -= 1;
  }

  const description =
    score === 3
      ? 'Full bullish confluence across all timeframes'
      : score === -3
      ? 'Full bearish confluence across all timeframes'
      : score > 0
      ? `Bullish bias — ${score}/3 timeframes aligned`
      : score < 0
      ? `Bearish bias — ${Math.abs(score)}/3 timeframes aligned`
      : 'Mixed / no clear directional confluence';

  return { confluenceScore: score, description, timeframes };
}
