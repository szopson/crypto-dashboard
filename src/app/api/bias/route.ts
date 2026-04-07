import { NextResponse } from 'next/server';
import { computeRadar, RadarResult } from '@/lib/engine/radar';
import { fetchAndStore } from '@/lib/engine/fetcher';

const SYMBOLS = process.env.CCXT_SYMBOLS
  ? process.env.CCXT_SYMBOLS.split(',').map((s) => s.trim())
  : ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'];

const TIMEFRAMES = ['1h', '4h', '1d'];

export async function GET() {
  try {
    const results: {
      symbol: string;
      timeframes: Record<string, RadarResult>;
    }[] = [];

    for (const symbol of SYMBOLS) {
      const timeframes: Record<string, RadarResult> = {};
      for (const tf of TIMEFRAMES) {
        await fetchAndStore(symbol, tf);
        timeframes[tf] = await computeRadar(symbol, tf);
      }
      results.push({ symbol, timeframes });
    }

    return NextResponse.json(
      { symbols: results },
      { headers: { 'Cache-Control': 's-maxage=300' } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
