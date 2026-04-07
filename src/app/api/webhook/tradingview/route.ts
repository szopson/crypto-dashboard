import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/migrate';

// TradingView alert JSON payload format:
// {
//   "symbol": "BINANCE:BTCUSDT",
//   "side": "buy" | "sell",
//   "price": 65000,
//   "message": "BTC OB bounce setup",
//   "setup_type": "OB bounce"
// }

interface TVPayload {
  symbol?: string;
  side?: string;
  price?: number | string;
  message?: string;
  setup_type?: string;
}

function normalizeSymbol(raw: string): string {
  // "BINANCE:BTCUSDT" → "BTC/USDT"
  const base = raw.includes(':') ? raw.split(':')[1] : raw;
  return base.replace(/USDT$/, '/USDT').replace(/USD$/, '/USD');
}

export async function POST(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const secret = process.env.TV_WEBHOOK_SECRET;
  if (secret && searchParams.get('token') !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: TVPayload;
  try {
    const text = await request.text();
    // TradingView can send plain text or JSON
    try {
      body = JSON.parse(text);
    } catch {
      // Try to parse as key=value pairs
      const params = Object.fromEntries(new URLSearchParams(text));
      body = params as TVPayload;
    }
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const symbol = body.symbol ? normalizeSymbol(body.symbol) : 'UNKNOWN';
  const direction: 'long' | 'short' = body.side?.toLowerCase() === 'sell' ? 'short' : 'long';
  const entryPrice = parseFloat(String(body.price ?? '0'));

  if (entryPrice <= 0) {
    return NextResponse.json({ error: 'Invalid price' }, { status: 400 });
  }

  const db = getDb();
  const result = db.prepare(`
    INSERT INTO trades (symbol, direction, entry_price, setup_type, notes, status, source)
    VALUES (?, ?, ?, ?, ?, 'pending', 'tradingview')
  `).run(symbol, direction, entryPrice, body.setup_type ?? null, body.message ?? null);

  return NextResponse.json({
    id: result.lastInsertRowid,
    symbol,
    direction,
    entry_price: entryPrice,
    status: 'pending',
  });
}
