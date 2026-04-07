import Anthropic from '@anthropic-ai/sdk';
import { NextRequest } from 'next/server';
import { buildMarketContext } from '@/lib/context';
import { getDb } from '@/lib/db/migrate';

const BRIEFING_PROMPT = `You are a professional crypto trading analyst. Based on the following market data, generate a concise morning market briefing for a trader.

Market data:
{MARKET_CONTEXT}

Generate a structured morning briefing with these sections:
1. **Overall Market Bias** — 2-3 sentences on macro conditions
2. **RADAR Summary** — table-style overview of bullish/bearish signals per symbol
3. **Key Levels to Watch** — top 3-5 S/R levels near current price
4. **Structure Events (last 24h)** — notable swing highs/lows, swept liquidity
5. **Session Focus** — 2-3 actionable focus areas for today's session

Be concise, professional, and actionable. Use markdown formatting.`;

export async function POST(request: NextRequest) {
  // Optional: protect with same secret as /api/internal/refresh
  const secret = process.env.INTERNAL_REFRESH_SECRET;
  if (secret) {
    const provided = request.headers.get('x-refresh-secret');
    if (provided !== secret) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  const marketContext = await buildMarketContext();
  const prompt = BRIEFING_PROMPT.replace('{MARKET_CONTEXT}', marketContext);

  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = message.content[0].type === 'text' ? message.content[0].text : '';
  const date = new Date().toISOString().split('T')[0];

  const db = getDb();
  db.prepare(`
    INSERT INTO briefings (date, content) VALUES (?, ?)
    ON CONFLICT(date) DO UPDATE SET content = excluded.content, created_at = unixepoch()
  `).run(date, content);

  return Response.json({ date, content });
}

export async function GET() {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];
  const briefing = db
    .prepare('SELECT * FROM briefings WHERE date = ?')
    .get(today) as { id: number; date: string; content: string; created_at: number } | undefined;

  if (!briefing) {
    return Response.json({ briefing: null });
  }

  return Response.json({ briefing });
}
