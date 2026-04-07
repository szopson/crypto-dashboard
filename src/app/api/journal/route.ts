import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/migrate';

interface TradeInput {
  symbol: string;
  direction: 'long' | 'short';
  entry_price: number;
  exit_price?: number;
  size?: number;
  stop_loss?: number;
  take_profit?: number;
  setup_type?: string;
  notes?: string;
  status?: 'open' | 'closed' | 'pending';
  source?: string;
}

function calcPnl(trade: TradeInput): { pnl: number | null; risk: number | null; r_multiple: number | null } {
  const pnl = trade.exit_price != null
    ? (trade.direction === 'long'
        ? (trade.exit_price - trade.entry_price) * (trade.size ?? 1)
        : (trade.entry_price - trade.exit_price) * (trade.size ?? 1))
    : null;

  const risk = trade.stop_loss != null
    ? Math.abs(trade.entry_price - trade.stop_loss) * (trade.size ?? 1)
    : null;

  const r_multiple = pnl != null && risk != null && risk > 0 ? pnl / risk : null;

  return { pnl, risk, r_multiple };
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const status = searchParams.get('status');
  const db = getDb();

  const query = status
    ? 'SELECT * FROM trades WHERE status = ? ORDER BY created_at DESC LIMIT 100'
    : 'SELECT * FROM trades ORDER BY created_at DESC LIMIT 100';

  const trades = status ? db.prepare(query).all(status) : db.prepare(query).all();
  return NextResponse.json({ trades });
}

export async function POST(request: NextRequest) {
  let body: TradeInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!body.symbol || !body.direction || !body.entry_price) {
    return NextResponse.json({ error: 'symbol, direction, entry_price required' }, { status: 400 });
  }

  const { pnl, risk, r_multiple } = calcPnl(body);
  const db = getDb();

  const result = db.prepare(`
    INSERT INTO trades (symbol, direction, entry_price, exit_price, size, stop_loss, take_profit,
      pnl, risk, r_multiple, setup_type, notes, status, source, closed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    body.symbol,
    body.direction,
    body.entry_price,
    body.exit_price ?? null,
    body.size ?? 1,
    body.stop_loss ?? null,
    body.take_profit ?? null,
    pnl,
    risk,
    r_multiple,
    body.setup_type ?? null,
    body.notes ?? null,
    body.status ?? 'open',
    body.source ?? 'manual',
    body.status === 'closed' ? Math.floor(Date.now() / 1000) : null,
  );

  return NextResponse.json({ id: result.lastInsertRowid });
}
