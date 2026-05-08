import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/migrate';

interface AggRow {
  total_r: number | null;
  trade_count: number;
  wins: number;
  losses: number;
}

interface StreakRow {
  r_multiple: number | null;
}

function computeStreak(rows: StreakRow[]): { type: 'win' | 'loss' | 'none'; count: number } {
  if (rows.length === 0) return { type: 'none', count: 0 };
  const first = rows[0].r_multiple;
  if (first == null) return { type: 'none', count: 0 };
  const isWin = first > 0;
  let count = 0;
  for (const r of rows) {
    if (r.r_multiple == null) break;
    if ((r.r_multiple > 0) !== isWin) break;
    count++;
  }
  return { type: isWin ? 'win' : 'loss', count };
}

export async function GET() {
  const db = getDb();
  // SQLite: unixepoch('now','start of day') gives midnight UTC.
  // closed_at is unix seconds.
  const todayStart = "unixepoch('now','start of day')";

  const agg = db.prepare(`
    SELECT
      COALESCE(SUM(r_multiple), 0) AS total_r,
      COUNT(*) AS trade_count,
      SUM(CASE WHEN r_multiple > 0 THEN 1 ELSE 0 END) AS wins,
      SUM(CASE WHEN r_multiple <= 0 THEN 1 ELSE 0 END) AS losses
    FROM trades
    WHERE status = 'closed'
      AND closed_at >= ${todayStart}
  `).get() as AggRow;

  // Streak — last N closed trades, regardless of date.
  const recent = db.prepare(`
    SELECT r_multiple
    FROM trades
    WHERE status = 'closed' AND r_multiple IS NOT NULL
    ORDER BY closed_at DESC
    LIMIT 20
  `).all() as StreakRow[];

  return NextResponse.json({
    total_r: agg.total_r ?? 0,
    trade_count: agg.trade_count,
    wins: agg.wins ?? 0,
    losses: agg.losses ?? 0,
    streak: computeStreak(recent),
  });
}
