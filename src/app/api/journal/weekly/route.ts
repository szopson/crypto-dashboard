import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/migrate';
import { buildMarketContext } from '@/lib/context';

interface Trade {
  id: number;
  symbol: string;
  direction: string;
  pnl: number | null;
  r_multiple: number | null;
  setup_type: string | null;
  notes: string | null;
  status: string;
  created_at: number;
}

const WEEKLY_PROMPT = `You are a professional trading coach. Generate a weekly trading performance review based on the following data.

Trade data from this week:
{TRADE_DATA}

Market conditions:
{MARKET_CONTEXT}

Write a structured weekly review with these sections:
1. **Weekly Performance Summary** — PnL, win rate, trade count
2. **Market Conditions** — dominant bias from RADAR data
3. **Pattern Analysis** — which setups worked or failed
4. **Lessons & Observations** — recurring mistakes or strengths from notes
5. **Next Week Focus** — 2-3 actionable focus areas

Be direct and specific. Use the actual trade data. Format in markdown.`;

export async function POST(request: NextRequest) {
  const secret = process.env.INTERNAL_REFRESH_SECRET;
  if (secret) {
    const provided = request.headers.get('x-refresh-secret');
    if (provided !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  const db = getDb();
  const weekAgo = Math.floor((Date.now() - 7 * 24 * 3600 * 1000) / 1000);
  const trades = db
    .prepare('SELECT * FROM trades WHERE created_at >= ? ORDER BY created_at ASC')
    .all(weekAgo) as Trade[];

  const tradeData = trades.length > 0
    ? JSON.stringify(trades.map((t) => ({
        symbol: t.symbol,
        direction: t.direction,
        pnl: t.pnl,
        r: t.r_multiple,
        setup: t.setup_type,
        notes: t.notes,
        status: t.status,
      })), null, 2)
    : 'No trades logged this week.';

  const marketContext = await buildMarketContext();
  const prompt = WEEKLY_PROMPT
    .replace('{TRADE_DATA}', tradeData)
    .replace('{MARKET_CONTEXT}', marketContext);

  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = message.content[0].type === 'text' ? message.content[0].text : '';

  // Get start of current week (Monday)
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const weekKey = monday.toISOString().split('T')[0];

  db.prepare(`
    INSERT INTO briefings (date, content) VALUES (?, ?)
    ON CONFLICT(date) DO UPDATE SET content = excluded.content, created_at = unixepoch()
  `).run(`weekly-${weekKey}`, content);

  return NextResponse.json({ weekKey, content, tradesAnalyzed: trades.length });
}

export async function GET() {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const weekKey = `weekly-${monday.toISOString().split('T')[0]}`;

  const db = getDb();
  const review = db.prepare('SELECT * FROM briefings WHERE date = ?').get(weekKey) as
    | { date: string; content: string; created_at: number }
    | undefined;

  return NextResponse.json({ review: review ?? null });
}
