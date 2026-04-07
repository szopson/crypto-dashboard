import { NextRequest, NextResponse } from 'next/server';
import { fetchAndStore } from '@/lib/engine/fetcher';
import { computeRadar } from '@/lib/engine/radar';

const SYMBOLS = process.env.CCXT_SYMBOLS
  ? process.env.CCXT_SYMBOLS.split(',').map((s) => s.trim())
  : ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'];

const TIMEFRAMES = ['15m', '1h', '4h', '1d'];

// Called by n8n hourly cron workflow.
// Requires X-Refresh-Secret header matching INTERNAL_REFRESH_SECRET env var.
export async function POST(request: NextRequest) {
  const secret = process.env.INTERNAL_REFRESH_SECRET;
  if (secret) {
    const provided = request.headers.get('x-refresh-secret');
    if (provided !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const results: { symbol: string; timeframe: string; status: string; error?: string }[] = [];

  for (const symbol of SYMBOLS) {
    for (const tf of TIMEFRAMES) {
      try {
        await fetchAndStore(symbol, tf);
        await computeRadar(symbol, tf);
        results.push({ symbol, timeframe: tf, status: 'ok' });
      } catch (err) {
        results.push({
          symbol,
          timeframe: tf,
          status: 'error',
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  const failed = results.filter((r) => r.status === 'error');
  return NextResponse.json({
    refreshed: results.length,
    failed: failed.length,
    results,
    timestamp: new Date().toISOString(),
  });
}
