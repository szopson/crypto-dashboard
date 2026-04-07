import type { Candle } from './structure';
import { detectSwings } from './structure';

export type LiquidityType = 'buy_side' | 'sell_side';
export type LiquidityLevel = 'equal_high' | 'equal_low';

export interface LiquidityZone {
  price: number;
  type: LiquidityType;
  level: LiquidityLevel;
  swept: boolean;
  touchCount: number;
}

const EQUAL_THRESHOLD = 0.003; // 0.3%

export function detectLiquidityZones(candles: Candle[]): LiquidityZone[] {
  if (candles.length < 10) return [];

  const swings = detectSwings(candles);
  const highs = swings.filter((s) => s.kind === 'high');
  const lows = swings.filter((s) => s.kind === 'low');

  const result: LiquidityZone[] = [];

  // Equal highs — sell-side liquidity (buy stops cluster above equal highs)
  const usedHigh = new Set<number>();
  for (let i = 0; i < highs.length; i++) {
    if (usedHigh.has(i)) continue;
    const cluster = [highs[i]];
    usedHigh.add(i);
    for (let j = i + 1; j < highs.length; j++) {
      if (usedHigh.has(j)) continue;
      const diff = Math.abs(highs[j].price - highs[i].price) / highs[i].price;
      if (diff <= EQUAL_THRESHOLD) {
        cluster.push(highs[j]);
        usedHigh.add(j);
      }
    }
    if (cluster.length < 2) continue;
    const avgPrice = cluster.reduce((a, b) => a + b.price, 0) / cluster.length;
    // Swept: any later candle's high exceeded this level
    const lastIdx = Math.max(...cluster.map((c) => c.index));
    const swept = candles.slice(lastIdx + 1).some((c) => c.high > avgPrice * (1 + EQUAL_THRESHOLD));
    result.push({
      price: avgPrice,
      type: 'sell_side',
      level: 'equal_high',
      swept,
      touchCount: cluster.length,
    });
  }

  // Equal lows — buy-side liquidity (sell stops cluster below equal lows)
  const usedLow = new Set<number>();
  for (let i = 0; i < lows.length; i++) {
    if (usedLow.has(i)) continue;
    const cluster = [lows[i]];
    usedLow.add(i);
    for (let j = i + 1; j < lows.length; j++) {
      if (usedLow.has(j)) continue;
      const diff = Math.abs(lows[j].price - lows[i].price) / lows[i].price;
      if (diff <= EQUAL_THRESHOLD) {
        cluster.push(lows[j]);
        usedLow.add(j);
      }
    }
    if (cluster.length < 2) continue;
    const avgPrice = cluster.reduce((a, b) => a + b.price, 0) / cluster.length;
    const lastIdx = Math.max(...cluster.map((c) => c.index));
    const swept = candles.slice(lastIdx + 1).some((c) => c.low < avgPrice * (1 - EQUAL_THRESHOLD));
    result.push({
      price: avgPrice,
      type: 'buy_side',
      level: 'equal_low',
      swept,
      touchCount: cluster.length,
    });
  }

  return result;
}
