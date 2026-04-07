// Builds market context JSON for Claude system prompts.
// Called server-side only.

import { getDb } from './db/migrate';
import { detectSwings } from './engine/structure';
import { detectOrderBlocks, detectFVGs } from './engine/orderflow';
import { detectSRLevels } from './engine/levels';

interface Candle {
  open_time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface RadarRow {
  symbol: string;
  timeframe: string;
  trend: number;
  momentum: number;
  volume_z: number;
  structure: number;
  bias: number;
  score: number;
  timestamp: number;
}

export async function buildMarketContext(): Promise<string> {
  try {
    const db = getDb();
    const symbols = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'];
    const timeframes = ['1h', '4h'];

    const radarData: Record<string, Record<string, RadarRow>> = {};

    for (const sym of symbols) {
      radarData[sym] = {};
      for (const tf of timeframes) {
        const row = db
          .prepare(
            'SELECT * FROM radar_scores WHERE symbol=? AND timeframe=? ORDER BY timestamp DESC LIMIT 1'
          )
          .get(sym, tf) as RadarRow | undefined;
        if (row) radarData[sym][tf] = row;
      }
    }

    // Get candles for structure analysis (BTC 1h as representative)
    const candles = db
      .prepare(
        'SELECT * FROM candles WHERE symbol=? AND timeframe=? ORDER BY open_time ASC LIMIT 200'
      )
      .all('BTC/USDT', '1h') as Candle[];

    const swings = detectSwings(candles).slice(-10);
    const obs = detectOrderBlocks(candles).slice(-5);
    const fvgs = detectFVGs(candles).filter((f) => f.status === 'unfilled').slice(-5);
    const srLevels = detectSRLevels(candles).slice(0, 8);
    const currentPrice = candles.at(-1)?.close ?? 0;

    const context = {
      timestamp: new Date().toISOString(),
      btcCurrentPrice: currentPrice,
      radarScores: radarData,
      btcStructure: {
        swings: swings.map((s) => ({
          type: s.type,
          price: s.price,
          kind: s.kind,
        })),
        activeOrderBlocks: obs.map((o) => ({
          kind: o.kind,
          high: o.high,
          low: o.low,
        })),
        openFVGs: fvgs.map((f) => ({
          kind: f.kind,
          top: f.top,
          bottom: f.bottom,
        })),
        srLevels: srLevels.map((l) => ({
          price: l.price,
          type: l.type,
          strength: l.strength,
          isRoundNumber: l.isRoundNumber,
        })),
      },
    };

    return JSON.stringify(context, null, 2);
  } catch {
    return JSON.stringify({ error: 'Market context unavailable — no candle data in DB yet' });
  }
}
