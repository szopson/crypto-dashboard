// Market narrator — generates short commentary on significant market events.
// Called by the /api/internal/refresh endpoint when bias flips or key events detected.
// Also available for on-demand polling from the dashboard.

import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/migrate';
import { buildMarketContext } from '@/lib/context';

const NARRATOR_PROMPT = `You are a concise market narrator. Based on the following market event and context, write 1-2 sentences of plain-English commentary that a trader would find immediately useful.

Event: {EVENT}

Market context:
{CONTEXT}

Respond with ONLY the 1-2 sentence commentary. No markdown, no extra explanation.`;

interface NarratorRequest {
  event: string;
  symbol?: string;
  price?: number;
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  let body: NarratorRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const marketContext = await buildMarketContext();
  const prompt = NARRATOR_PROMPT
    .replace('{EVENT}', body.event)
    .replace('{CONTEXT}', marketContext);

  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    messages: [{ role: 'user', content: prompt }],
  });

  const commentary = message.content[0].type === 'text' ? message.content[0].text.trim() : '';

  // Save to events table
  const db = getDb();
  db.prepare(`
    INSERT INTO events (symbol, event_type, description, price)
    VALUES (?, ?, ?, ?)
  `).run(body.symbol ?? 'MARKET', 'narrator', commentary, body.price ?? null);

  return NextResponse.json({ commentary });
}

export async function GET() {
  const db = getDb();
  const events = db
    .prepare("SELECT * FROM events WHERE event_type = 'narrator' ORDER BY created_at DESC LIMIT 20")
    .all();
  return NextResponse.json({ events });
}
