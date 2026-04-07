import { NextRequest, NextResponse } from 'next/server';
import { computeRadar } from '@/lib/engine/radar';
import { fetchAndStore } from '@/lib/engine/fetcher';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const symbol = searchParams.get('symbol') ?? 'BTC/USDT';
  const timeframe = searchParams.get('timeframe') ?? '1h';

  try {
    // Ensure candles are fresh before computing
    await fetchAndStore(symbol, timeframe);
    const result = await computeRadar(symbol, timeframe);

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 's-maxage=300' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
