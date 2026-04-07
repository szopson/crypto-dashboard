import { CoinData, OHLCData } from '@/types';

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';

export async function getTopCoins(limit = 50): Promise<CoinData[]> {
  const res = await fetch(
    `${COINGECKO_BASE}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${limit}&page=1&sparkline=true&price_change_percentage=7d`,
    { next: { revalidate: 60 } }
  );
  if (!res.ok) throw new Error('Failed to fetch coins');
  return res.json();
}

export async function getCoinOHLC(
  coinId: string,
  days: number = 7
): Promise<OHLCData[]> {
  const res = await fetch(
    `${COINGECKO_BASE}/coins/${coinId}/ohlc?vs_currency=usd&days=${days}`,
    { next: { revalidate: 300 } }
  );
  if (!res.ok) throw new Error(`Failed to fetch OHLC for ${coinId}`);
  const raw: number[][] = await res.json();
  return raw.map(([timestamp, open, high, low, close]) => ({
    timestamp,
    open,
    high,
    low,
    close,
    volume: 0,
  }));
}

export async function getGlobalStats() {
  const res = await fetch(`${COINGECKO_BASE}/global`, {
    next: { revalidate: 120 },
  });
  if (!res.ok) throw new Error('Failed to fetch global stats');
  const { data } = await res.json();
  return data;
}

export function formatCurrency(value: number, decimals = 2): string {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(1)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  return `$${value.toFixed(decimals)}`;
}

export function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}
