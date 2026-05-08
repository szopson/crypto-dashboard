import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/migrate';

interface PatternRow {
  id: number;
  ticker: string;
  pattern_type: string | null;
  confidence: number | null;
  smc_score: number | null;
  velo_score: number | null;
  final_score: number | null;
  bias: string | null;
  raw_metrics: string | null;
  detected_at: number;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const ticker = searchParams.get('ticker') ?? 'BTC';
  const db = getDb();

  const row = db.prepare(`
    SELECT id, ticker, pattern_type, confidence, smc_score, velo_score, final_score,
           bias, raw_metrics, detected_at
    FROM pattern_history
    WHERE ticker = ?
    ORDER BY detected_at DESC
    LIMIT 1
  `).get(ticker) as PatternRow | undefined;

  if (!row) {
    return NextResponse.json({ pattern: null });
  }

  let raw_metrics: unknown = null;
  if (row.raw_metrics) {
    try {
      raw_metrics = JSON.parse(row.raw_metrics);
    } catch {
      raw_metrics = row.raw_metrics;
    }
  }

  return NextResponse.json({
    pattern: { ...row, raw_metrics },
  });
}
