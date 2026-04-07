import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/migrate';
import { fetchAndStore } from '@/lib/engine/fetcher';
import { detectSwings } from '@/lib/engine/structure';
import { detectOrderBlocks, detectFVGs } from '@/lib/engine/orderflow';

interface Candle {
  open_time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const symbol = searchParams.get('symbol') ?? 'BTC/USDT';
  const timeframe = searchParams.get('timeframe') ?? '1h';
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '200', 10), 500);
  const overlays = searchParams.get('overlays') !== 'false';

  try {
    await fetchAndStore(symbol, timeframe);

    const db = getDb();
    const candles = db
      .prepare(
        'SELECT open_time, open, high, low, close, volume FROM candles WHERE symbol = ? AND timeframe = ? ORDER BY open_time DESC LIMIT ?'
      )
      .all(symbol, timeframe, limit) as Candle[];

    // Return in ascending order for charting
    candles.reverse();

    if (!overlays) {
      return NextResponse.json({ symbol, timeframe, candles }, {
        headers: { 'Cache-Control': 's-maxage=60' },
      });
    }

    const swings = detectSwings(candles);
    const orderBlocks = detectOrderBlocks(candles);
    const fvgs = detectFVGs(candles);

    return NextResponse.json(
      { symbol, timeframe, candles, swings, orderBlocks, fvgs },
      { headers: { 'Cache-Control': 's-maxage=60' } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
