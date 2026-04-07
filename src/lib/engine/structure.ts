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
