import Anthropic from '@anthropic-ai/sdk';
import { NextRequest } from 'next/server';
import { buildMarketContext } from '@/lib/context';
import { getDb } from '@/lib/db/migrate';

const SETUP_PROMPT = `You are a professional crypto trade setup analyst. Analyze the following market data and identify high-probability trade setups.

Market data:
{MARKET_CONTEXT}

Identify any setups where at least 3 confluence factors align. For each setup, return a JSON array:

[
  {
    "symbol": "BTC/USDT",
    "direction": "long" or "short",
    "entry_zone_low": number,
    "entry_zone_high": number,
    "target": number or null,
    "invalidation": number,
    "confluence_score": number (3-6, higher = more aligned signals),
    "reasoning": "2-3 sentence explanation of the confluence factors"
  }
]

Return ONLY the JSON array, no explanation outside it. If no high-probability setups exist, return [].`;

interface Setup {
  symbol: string;
  direction: 'long' | 'short';
  entry_zone_low: number;
  entry_zone_high: number;
  target?: number;
  invalidation: number;
  confluence_score: number;
  reasoning: string;
}

export async function POST(request: NextRequest) {
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
  const prompt = SETUP_PROMPT.replace('{MARKET_CONTEXT}', marketContext);

  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '[]';
  let setups: Setup[] = [];
  try {
    setups = JSON.parse(text);
  } catch {
    return Response.json({ error: 'Failed to parse Claude response', raw: text }, { status: 500 });
  }

  const db = getDb();
  const insert = db.prepare(`
    INSERT INTO setups (symbol, direction, entry_zone_low, entry_zone_high, target, invalidation, confluence_score, reasoning)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((rows: Setup[]) => {
    for (const s of rows) {
      insert.run(
        s.symbol, s.direction, s.entry_zone_low, s.entry_zone_high,
        s.target ?? null, s.invalidation, s.confluence_score, s.reasoning
      );
    }
  });

  insertMany(setups);

  return Response.json({ scanned: setups.length, setups });
}

export async function GET() {
  const db = getDb();
  const setups = db
    .prepare("SELECT * FROM setups WHERE status = 'active' ORDER BY confluence_score DESC, created_at DESC LIMIT 20")
    .all();
  return Response.json({ setups });
}
