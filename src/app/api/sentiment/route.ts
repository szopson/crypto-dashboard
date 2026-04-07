import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/migrate';

interface FngResponse {
  data: { value: string; value_classification: string; timestamp: string }[];
}

interface TrendingCoin {
  item: {
    name: string;
    symbol: string;
    score: number;
  };
}

interface TrendingResponse {
  coins: TrendingCoin[];
}

function getBiasModifier(value: number): number {
  // Contrarian interpretation
  if (value <= 25) return 1;   // Extreme Fear → bullish signal
  if (value <= 40) return 0;   // Fear → neutral
  if (value >= 80) return -1;  // Extreme Greed → bearish signal
  if (value >= 65) return 0;   // Greed → neutral
  return 0;
}

export async function GET() {
  const today = new Date().toISOString().split('T')[0];
  const db = getDb();

  // Return cached if already fetched today
  const cached = db.prepare('SELECT * FROM sentiment WHERE date = ?').get(today) as
    | { fng_value: number; fng_label: string; bias_modifier: number; raw_data: string }
    | undefined;

  if (cached) {
    return NextResponse.json({
      date: today,
      fng_value: cached.fng_value,
      fng_label: cached.fng_label,
      bias_modifier: cached.bias_modifier,
      raw: JSON.parse(cached.raw_data),
    });
  }

  try {
    const [fngRes, trendingRes] = await Promise.allSettled([
      fetch('https://api.alternative.me/fng/?limit=7', { next: { revalidate: 3600 } }),
      fetch('https://api.coingecko.com/api/v3/search/trending', { next: { revalidate: 3600 } }),
    ]);

    let fngValue = 50;
    let fngLabel = 'Neutral';
    let fngHistory: unknown[] = [];

    if (fngRes.status === 'fulfilled' && fngRes.value.ok) {
      const data: FngResponse = await fngRes.value.json();
      fngValue = parseInt(data.data[0].value, 10);
      fngLabel = data.data[0].value_classification;
      fngHistory = data.data;
    }

    let trending: unknown[] = [];
    if (trendingRes.status === 'fulfilled' && trendingRes.value.ok) {
      const data: TrendingResponse = await trendingRes.value.json();
      trending = data.coins.map((c) => ({ name: c.item.name, symbol: c.item.symbol }));
    }

    const biasModifier = getBiasModifier(fngValue);
    const rawData = JSON.stringify({ fngHistory, trending });

    db.prepare(`
      INSERT INTO sentiment (date, fng_value, fng_label, bias_modifier, raw_data)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(date) DO UPDATE SET
        fng_value = excluded.fng_value,
        fng_label = excluded.fng_label,
        bias_modifier = excluded.bias_modifier,
        raw_data = excluded.raw_data
    `).run(today, fngValue, fngLabel, biasModifier, rawData);

    return NextResponse.json({
      date: today,
      fng_value: fngValue,
      fng_label: fngLabel,
      bias_modifier: biasModifier,
      raw: { fngHistory, trending },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
