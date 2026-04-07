import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/migrate';

interface Trade {
  id: number;
  symbol: string;
  direction: string;
  pnl: number | null;
  risk: number | null;
  r_multiple: number | null;
  setup_type: string | null;
  status: string;
  created_at: number;
}

export async function GET() {
  const db = getDb();
  const allTrades = db.prepare('SELECT * FROM trades ORDER BY created_at ASC').all() as Trade[];
  const closedTrades = allTrades.filter((t) => t.status === 'closed');

  if (closedTrades.length === 0) {
    return NextResponse.json({
      totalTrades: allTrades.length,
      closedTrades: 0,
      openTrades: allTrades.filter((t) => t.status === 'open').length,
      winRate: null,
      avgR: null,
      profitFactor: null,
      totalPnl: 0,
      bestTrade: null,
      worstTrade: null,
      pnlCurve: [],
      bySetupType: [],
    });
  }

  const wins = closedTrades.filter((t) => (t.pnl ?? 0) > 0);
  const losses = closedTrades.filter((t) => (t.pnl ?? 0) <= 0);
  const winRate = (wins.length / closedTrades.length) * 100;

  const rsWithValue = closedTrades.filter((t) => t.r_multiple != null);
  const avgR = rsWithValue.length > 0
    ? rsWithValue.reduce((a, t) => a + (t.r_multiple ?? 0), 0) / rsWithValue.length
    : null;

  const grossWins = wins.reduce((a, t) => a + (t.pnl ?? 0), 0);
  const grossLosses = Math.abs(losses.reduce((a, t) => a + (t.pnl ?? 0), 0));
  const profitFactor = grossLosses > 0 ? grossWins / grossLosses : null;

  const totalPnl = closedTrades.reduce((a, t) => a + (t.pnl ?? 0), 0);

  const bestTrade = closedTrades.reduce((best, t) =>
    (t.pnl ?? -Infinity) > (best.pnl ?? -Infinity) ? t : best
  );
  const worstTrade = closedTrades.reduce((worst, t) =>
    (t.pnl ?? Infinity) < (worst.pnl ?? Infinity) ? t : worst
  );

  // Cumulative PnL curve
  let cumulative = 0;
  const pnlCurve = closedTrades.map((t) => {
    cumulative += t.pnl ?? 0;
    return { timestamp: t.created_at * 1000, pnl: cumulative };
  });

  // By setup type
  const setupMap: Record<string, { trades: number; wins: number; totalPnl: number }> = {};
  for (const t of closedTrades) {
    const key = t.setup_type ?? 'unknown';
    if (!setupMap[key]) setupMap[key] = { trades: 0, wins: 0, totalPnl: 0 };
    setupMap[key].trades++;
    if ((t.pnl ?? 0) > 0) setupMap[key].wins++;
    setupMap[key].totalPnl += t.pnl ?? 0;
  }
  const bySetupType = Object.entries(setupMap).map(([type, data]) => ({
    type,
    trades: data.trades,
    winRate: (data.wins / data.trades) * 100,
    totalPnl: data.totalPnl,
  }));

  return NextResponse.json({
    totalTrades: allTrades.length,
    closedTrades: closedTrades.length,
    openTrades: allTrades.filter((t) => t.status === 'open').length,
    winRate,
    avgR,
    profitFactor,
    totalPnl,
    bestTrade: { symbol: bestTrade.symbol, pnl: bestTrade.pnl },
    worstTrade: { symbol: worstTrade.symbol, pnl: worstTrade.pnl },
    pnlCurve,
    bySetupType,
  });
}
