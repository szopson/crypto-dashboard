/**
 * TypeScript types for Wealth Dashboard
 */

// Enums
export type AssetClass =
  | "crypto"
  | "stock"
  | "etf"
  | "bond"
  | "real_estate"
  | "cash"
  | "commodity"
  | "other";  // Custom assets: jewelry, watches, art, collectibles, etc.

export type DividendFrequency =
  | "monthly"
  | "quarterly"
  | "semi-annually"
  | "annually";

// Portfolio
export interface Portfolio {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  holdings_count?: number;
  total_value_usd?: number;
}

export interface PortfolioCreate {
  name: string;
  description?: string;
  is_default?: boolean;
}

export interface PortfolioUpdate {
  name?: string;
  description?: string;
  is_default?: boolean;
}

export interface PortfolioSummary {
  portfolio_id: string;
  portfolio_name: string;
  total_value_usd: number;
  total_cost_basis_usd: number;
  total_gain_loss_usd: number;
  total_gain_loss_pct: number;
  change_24h_usd: number;
  change_24h_pct: number;
  holdings_count: number;
  last_updated: string;
}

// Holding
export interface Holding {
  id: string;
  portfolio_id: string;
  user_id: string;
  asset_class: AssetClass;
  ticker: string;
  name: string;
  quantity: number;
  cost_basis: number | null;
  purchase_date: string | null;
  manual_price: number | null;
  manual_price_updated_at: string | null;
  annual_yield_pct: number | null;
  dividend_frequency: DividendFrequency | null;
  country_code: string;
  notes: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface HoldingWithPrice extends Holding {
  current_price_usd: number | null;
  price_source: string | null;
  current_value_usd: number | null;
  gain_loss_usd: number | null;
  gain_loss_pct: number | null;
  change_24h_pct: number | null;
  annual_income_usd: number | null;
  weight_pct: number | null;
}

export interface HoldingCreate {
  portfolio_id: string;
  asset_class: AssetClass;
  ticker: string;
  name: string;
  quantity: number;
  cost_basis?: number;
  purchase_date?: string;
  manual_price?: number;
  annual_yield_pct?: number;
  dividend_frequency?: DividendFrequency;
  country_code?: string;
  notes?: string;
  tags?: string[];
}

export interface HoldingUpdate {
  quantity?: number;
  cost_basis?: number;
  purchase_date?: string;
  manual_price?: number;
  annual_yield_pct?: number;
  dividend_frequency?: DividendFrequency;
  country_code?: string;
  notes?: string;
  tags?: string[];
}

// Analytics
export interface AssetAllocation {
  asset_class: AssetClass;
  value_usd: number;
  percentage: number;
  holdings_count: number;
  color: string;
}

export interface GeographyAllocation {
  country_code: string;
  country_name: string;
  value_usd: number;
  percentage: number;
}

export interface IncomeSource {
  holding_id: string;
  ticker: string;
  name: string;
  asset_class: AssetClass;
  annual_income_usd: number;
  yield_pct: number;
}

export interface IncomeBreakdown {
  total_annual_income_usd: number;
  average_yield_pct: number;
  by_asset_class: Record<string, number>[];
  by_holding: IncomeSource[];
}

export interface PortfolioAnalytics {
  summary: PortfolioSummary;
  allocation_by_class: AssetAllocation[];
  allocation_by_geography: GeographyAllocation[];
  income: IncomeBreakdown;
  top_holdings: HoldingWithPrice[];
}

export interface AIInsights {
  summary: string;
  highlights: string[];
  concerns: string[];
  opportunities: string[];
  generated_at: string;
}

// Assets & Prices
export interface AssetSearchResult {
  asset_class: AssetClass;
  ticker: string;
  name: string;
  symbol?: string;
  logo_url?: string;
  market_cap_rank?: number;
  country_code?: string;
  sector?: string;
}

export interface PriceData {
  asset_class: AssetClass;
  ticker: string;
  price_usd: number;
  change_24h_pct: number | null;
  market_cap: number | null;
  volume_24h: number | null;
  source: string;
  fetched_at: string;
}

export interface BatchPriceRequest {
  assets: Array<{ asset_class: string; ticker: string }>;
}

export interface BatchPriceResponse {
  prices: Record<string, PriceData>;
  errors: Record<string, string>;
}

// Asset class configuration
export const ASSET_CLASS_CONFIG: Record<
  AssetClass,
  { label: string; color: string; icon: string }
> = {
  crypto: { label: "Crypto", color: "#F7931A", icon: "bitcoin" },
  stock: { label: "Stocks", color: "#4CAF50", icon: "trending-up" },
  etf: { label: "ETFs", color: "#2196F3", icon: "layers" },
  bond: { label: "Bonds", color: "#9C27B0", icon: "shield" },
  real_estate: { label: "Real Estate", color: "#FF5722", icon: "home" },
  cash: { label: "Cash", color: "#607D8B", icon: "wallet" },
  commodity: { label: "Commodities", color: "#FFC107", icon: "gem" },
  other: { label: "Other", color: "#E91E63", icon: "package" },  // Custom assets
};
