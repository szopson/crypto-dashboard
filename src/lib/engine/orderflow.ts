import type { Candle } from './structure';

export type OBKind = 'bullish' | 'bearish';

export interface OrderBlock {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  kind: OBKind;
  index: number;
}

export type FVGKind = 'bullish' | 'bearish';
export type FVGStatus = 'unfilled' | 'filled';

export interface FairValueGap {
  timestamp: number;
  top: number;
  bottom: number;
  kind: FVGKind;
  status: FVGStatus;
  index: number;
}

function avgBodySize(candles: Candle[]): number {
  if (candles.length === 0) return 0;
  const sum = candles.reduce((a, c) => a + Math.abs(c.close - c.open), 0);
  return sum / candles.length;
}

export function detectOrderBlocks(candles: Candle[]): OrderBlock[] {
  const result: OrderBlock[] = [];
  const lookback = Math.min(20, candles.length);

  for (let i = 1; i < candles.length - 1; i++) {
    const prev = candles[i - 1];
    const curr = candles[i];
    const window = candles.slice(Math.max(0, i - lookback), i);
    const avg = avgBodySize(window) || 1;
    const currBody = Math.abs(curr.close - curr.open);

    // Bullish OB: last bearish candle before a strong bullish move
    const prevBearish = prev.close < prev.open;
    const currBullish = curr.close > curr.open && currBody > avg * 1.5;
    if (prevBearish && currBullish) {
      result.push({
        timestamp: prev.open_time,
        open: prev.open,
        high: prev.high,
        low: prev.low,
        close: prev.close,
        kind: 'bullish',
        index: i - 1,
      });
    }

    // Bearish OB: last bullish candle before a strong bearish move
    const prevBullish = prev.close > prev.open;
    const currBearish = curr.close < curr.open && currBody > avg * 1.5;
    if (prevBullish && currBearish) {
      result.push({
        timestamp: prev.open_time,
        open: prev.open,
        high: prev.high,
        low: prev.low,
        close: prev.close,
        kind: 'bearish',
        index: i - 1,
      });
    }
  }

  return result;
}

export function detectFVGs(candles: Candle[]): FairValueGap[] {
  const result: FairValueGap[] = [];

  for (let i = 0; i < candles.length - 2; i++) {
    const c0 = candles[i];
    const c2 = candles[i + 2];

    // Bullish FVG: gap between c0.high and c2.low
    if (c0.high < c2.low) {
      const top = c2.low;
      const bottom = c0.high;
      // Check if filled by any candle between i+2 and end
      const filled = candles.slice(i + 3).some((c) => c.low <= bottom || c.close <= bottom);
      result.push({
        timestamp: candles[i + 1].open_time,
        top,
        bottom,
        kind: 'bullish',
        status: filled ? 'filled' : 'unfilled',
        index: i + 1,
      });
    }

    // Bearish FVG: gap between c2.high and c0.low
    if (c0.low > c2.high) {
      const top = c0.low;
      const bottom = c2.high;
      const filled = candles.slice(i + 3).some((c) => c.high >= top || c.close >= top);
      result.push({
        timestamp: candles[i + 1].open_time,
        top,
        bottom,
        kind: 'bearish',
        status: filled ? 'filled' : 'unfilled',
        index: i + 1,
      });
    }
  }

  return result;
}
