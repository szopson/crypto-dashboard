import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/migrate';

interface TradeRow {
  id: number;
  symbol: string;
  direction: 'long' | 'short';
  entry_price: number;
  stop_loss: number | null;
  take_profit: number | null;
  size: number;
  setup_type: string | null;
  notes: string | null;
  created_at: number;
}

export async function GET() {
  const db = getDb();

  const trades = db.prepare(`
    SELECT id, symbol, direction, entry_price, stop_loss, take_profit, size,
           setup_type, notes, created_at
    FROM trades
    WHERE status = 'open'
    ORDER BY created_at DESC
    LIMIT 5
  `).all() as TradeRow[];

  return NextResponse.json({ trades });
}
