export interface CoinData {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_percentage_24h: number;
  price_change_percentage_7d_in_currency?: number;
  market_cap: number;
  total_volume: number;
  image: string;
  sparkline_in_7d?: { price: number[] };
}

export interface OHLCData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface NewsItem {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  sentiment?: 'bullish' | 'bearish' | 'neutral';
}

export interface OnChainMetric {
  name: string;
  value: number | string;
  change24h?: number;
  description: string;
}

export interface TradingSignal {
  coin: string;
  action: 'buy' | 'sell' | 'hold';
  confidence: number; // 0-100
  indicators: string[];
  timestamp: string;
}

export type TimeRange = '1h' | '24h' | '7d' | '30d' | '90d' | '1y';

export interface DashboardTab {
  id: string;
  label: string;
  icon?: string;
}
