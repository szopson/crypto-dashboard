/**
 * TypeScript types for Follio
 */

// Bias types
export type BiasType = "BULLISH" | "BEARISH" | "NEUTRAL";
export type ClassificationType = "ACCUMULATE" | "NEUTRAL" | "SELL_THE_RALLY";
export type TimeframeType = "1H" | "4H" | "1D" | "3D" | "1W" | "1M";

// Price response
export interface PriceData {
  symbol: string;
  price: number;
  bid?: number;
  ask?: number;
  change_24h?: number;
  volume_24h?: number;
  high_24h?: number;
  low_24h?: number;
  timestamp?: number;
}

// RADAR metrics
export interface RadarMetric {
  value?: number;
  signal: string;
  description?: string;
  bullish_point: number;
}

export interface BBWPMetric extends RadarMetric {
  bbwp?: number;
  bb_width?: number;
}

export interface GaussianMetric extends RadarMetric {
  gaussian_ma?: number;
  upper_band?: number;
  lower_band?: number;
  current_price?: number;
  position_pct?: number;
  crossover?: string;
}

export interface WVFMetric extends RadarMetric {
  wvf?: number;
  upper_band?: number;
  mid_line?: number;
}

export interface FundingMetric extends RadarMetric {
  funding_rate?: number;
}

export interface RadarMetrics {
  bbwp: BBWPMetric;
  gaussian: GaussianMetric;
  wvf: WVFMetric;
  funding: FundingMetric;
}

export interface RadarData {
  score: number;
  raw_score?: number;
  max_score: number;
  classification: ClassificationType;
  color: string;
  components: string[];
  metrics?: RadarMetrics;
  timestamp: string;
  timeframe: string;
}

export interface RadarCurrentResponse {
  timestamp: string;
  radars: Record<string, RadarData>;
}

// Bias data
export interface BiasTimeframe {
  timeframe: TimeframeType;
  structural_bias: BiasType;
  secondary_swing_level?: number;
  ss_distance_pct?: number;
  last_swing_high?: number;
  last_swing_low?: number;
  swing_structure?: string;
  radar_score?: number;
  confidence?: string;
}

export interface BiasCurrentResponse {
  timestamp: string;
  current_price: number;
  biases: Record<TimeframeType, BiasTimeframe>;
  overall_bias: BiasType;
  key_levels: Array<Record<string, unknown>>;
}

// Health check
export interface HealthResponse {
  status: string;
  version: string;
  exchange: string;
  symbol: string;
  timestamp: string;
}
