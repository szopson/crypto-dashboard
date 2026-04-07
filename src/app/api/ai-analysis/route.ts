import Anthropic from '@anthropic-ai/sdk';
import { CoinData } from '@/types';

interface AnalysisRequest {
  coins: CoinData[];
  globalStats: {
    totalMarketCap: string;
    totalVolume: string;
    btcDominance: string;
    ethDominance: string;
  };
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: 'ANTHROPIC_API_KEY is not configured' },
      { status: 500 }
    );
  }

  let body: AnalysisRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { coins, globalStats } = body;

  const top10 = coins.slice(0, 10).map((c) => ({
    name: c.name,
    symbol: c.symbol.toUpperCase(),
    price: c.current_price,
    change24h: c.price_change_percentage_24h,
    change7d: c.price_change_percentage_7d_in_currency ?? 0,
    marketCap: c.market_cap,
  }));

  const prompt = `You are a crypto market analyst. Analyze the following real-time market data and provide a structured analysis.

GLOBAL MARKET DATA:
- Total Market Cap: ${globalStats.totalMarketCap}
- 24h Volume: ${globalStats.totalVolume}
- BTC Dominance: ${globalStats.btcDominance}
- ETH Dominance: ${globalStats.ethDominance}

TOP 10 CRYPTOCURRENCIES (by market cap):
${top10.map((c, i) => `${i + 1}. ${c.name} (${c.symbol}): $${c.price.toLocaleString()} | 24h: ${c.change24h >= 0 ? '+' : ''}${c.change24h.toFixed(2)}% | 7d: ${c.change7d >= 0 ? '+' : ''}${c.change7d.toFixed(2)}%`).join('\n')}

Provide a concise market analysis in JSON format with exactly this structure:
{
  "btcCyclePosition": {
    "phase": "one of: Accumulation | Early Bull | Bull Run | Late Bull | Distribution | Bear Market",
    "confidence": "Low | Medium | High",
    "summary": "1-2 sentence assessment based on BTC dominance and price action"
  },
  "marketSentiment": {
    "overall": "one of: Extreme Fear | Fear | Neutral | Greed | Extreme Greed",
    "signals": ["up to 3 key signals observed in the data"]
  },
  "topOpportunities": [
    {
      "coin": "symbol",
      "reason": "brief reason based on data"
    }
  ],
  "riskSummary": {
    "level": "one of: Low | Moderate | High | Extreme",
    "factors": ["up to 3 key risk factors from the data"]
  },
  "quickTake": "2-3 sentence overall market summary a trader would find actionable"
}

Return only valid JSON, no markdown fences.`;

  const client = new Anthropic({ apiKey });

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    const analysis = JSON.parse(text);
    return Response.json({ analysis });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Analysis failed';
    return Response.json({ error: message }, { status: 500 });
  }
}
