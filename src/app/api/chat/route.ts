import Anthropic from '@anthropic-ai/sdk';
import { NextRequest } from 'next/server';
import { buildMarketContext } from '@/lib/context';

interface Message {
  role: 'user' | 'assistant';
  content: string | { type: string; [key: string]: unknown }[];
}

interface ChatRequest {
  messages: Message[];
  image?: {
    data: string;       // base64
    mediaType: string;  // image/png | image/jpeg | image/webp
  };
}

const SYSTEM_PROMPT = `You are a professional crypto trading analyst assistant integrated into a trading dashboard.
You have access to real-time market data including RADAR scores, swing structure, order blocks, fair value gaps, and support/resistance levels.
Be concise and actionable. Focus on what matters for the current session.

Current market context:
{MARKET_CONTEXT}`;

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  let body: ChatRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const marketContext = await buildMarketContext();
  const systemPrompt = SYSTEM_PROMPT.replace('{MARKET_CONTEXT}', marketContext);

  const client = new Anthropic({ apiKey });

  // Build messages array
  const messages: Anthropic.Messages.MessageParam[] = body.messages.map((msg, idx) => {
    // If this is the last user message and an image was provided, add image block
    if (idx === body.messages.length - 1 && msg.role === 'user' && body.image) {
      return {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: body.image.mediaType as 'image/png' | 'image/jpeg' | 'image/webp',
              data: body.image.data,
            },
          },
          {
            type: 'text',
            text: typeof msg.content === 'string' ? msg.content : 'Analyze this chart.',
          },
        ],
      };
    }
    return {
      role: msg.role,
      content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
    };
  });

  // Stream response
  const stream = await client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: systemPrompt,
    messages,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (
          chunk.type === 'content_block_delta' &&
          chunk.delta.type === 'text_delta'
        ) {
          controller.enqueue(encoder.encode(chunk.delta.text));
        }
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
    },
  });
}
