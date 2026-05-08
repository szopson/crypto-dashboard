import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/migrate';

interface AlertRow {
  id: number;
  channel: string;
  ticker: string | null;
  severity: string | null;
  payload: string;
  created_at: number;
  sent_at: number | null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const limit = Math.min(Number(searchParams.get('limit') ?? 10), 100);
  const channel = searchParams.get('channel');
  const ticker = searchParams.get('ticker');
  const db = getDb();

  const filters: string[] = [];
  const params: unknown[] = [];
  if (channel) { filters.push('channel = ?'); params.push(channel); }
  if (ticker) { filters.push('ticker = ?'); params.push(ticker); }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  const rows = db.prepare(`
    SELECT id, channel, ticker, severity, payload, created_at, sent_at
    FROM alerts
    ${where}
    ORDER BY created_at DESC
    LIMIT ?
  `).all(...params, limit) as AlertRow[];

  const alerts = rows.map(r => {
    let payload: unknown = r.payload;
    try { payload = JSON.parse(r.payload); } catch { /* leave as string */ }
    return { ...r, payload };
  });

  return NextResponse.json({ alerts });
}
