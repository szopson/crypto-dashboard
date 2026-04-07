import type { Candle } from './structure';
import { detectSwings } from './structure';

export interface SRLevel {
  price: number;
  type: 'support' | 'resistance';
  strength: number; // 1–5
  touchCount: number;
  isRoundNumber: boolean;
}

const CLUSTER_THRESHOLD = 0.005; // 0.5%

function roundToSignificant(price: number): number {
  const magnitude = Math.pow(10, Math.floor(Math.log10(price)));
  return Math.round(price / magnitude) * magnitude;
}

function isRoundNumber(price: number): boolean {
  return price === roundToSignificant(price);
}

export function detectSRLevels(candles: Candle[]): SRLevel[] {
  if (candles.length < 10) return [];

  const swings = detectSwings(candles);
  const priceLast = candles.at(-1)?.close ?? 0;

  // Collect all swing prices
  const swingPrices = swings.map((s) => s.price);

  // Cluster nearby prices within CLUSTER_THRESHOLD
  const clusters: number[][] = [];
  const used = new Set<number>();

  for (let i = 0; i < swingPrices.length; i++) {
    if (used.has(i)) continue;
    const cluster = [swingPrices[i]];
    used.add(i);
    for (let j = i + 1; j < swingPrices.length; j++) {
      if (used.has(j)) continue;
      const pctDiff = Math.abs(swingPrices[j] - swingPrices[i]) / swingPrices[i];
      if (pctDiff <= CLUSTER_THRESHOLD) {
        cluster.push(swingPrices[j]);
        used.add(j);
      }
    }
    clusters.push(cluster);
  }

  const result: SRLevel[] = [];

  for (const cluster of clusters) {
    const avg = cluster.reduce((a, b) => a + b, 0) / cluster.length;
    const touchCount = cluster.length;
    const type: 'support' | 'resistance' = avg < priceLast ? 'support' : 'resistance';
    const strength = Math.min(5, Math.max(1, touchCount));

    result.push({
      price: avg,
      type,
      strength,
      touchCount,
      isRoundNumber: isRoundNumber(Math.round(avg)),
    });
  }

  // Add round number levels near current price (±10%)
  const roundBase = roundToSignificant(priceLast);
  const step = roundBase / 10;
  for (let offset = -3; offset <= 3; offset++) {
    const roundLevel = roundBase + offset * step;
    if (roundLevel <= 0) continue;
    const pctDiff = Math.abs(roundLevel - priceLast) / priceLast;
    if (pctDiff > 0.1) continue;
    // Only add if not already covered by a cluster
    const alreadyCovered = result.some(
      (r) => Math.abs(r.price - roundLevel) / roundLevel <= CLUSTER_THRESHOLD
    );
    if (!alreadyCovered) {
      result.push({
        price: roundLevel,
        type: roundLevel < priceLast ? 'support' : 'resistance',
        strength: 1,
        touchCount: 0,
        isRoundNumber: true,
      });
    }
  }

  // Sort by strength desc
  result.sort((a, b) => b.strength - a.strength);

  return result;
}
