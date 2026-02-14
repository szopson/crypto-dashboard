/**
 * API client for Trading Command Center backend
 */
import type {
  PriceData,
  RadarData,
  RadarCurrentResponse,
  BiasCurrentResponse,
  HealthResponse,
} from "./types";

const API_BASE = "/api";

function buildUrl(endpoint: string, params?: Record<string, string | undefined>): string {
  const url = new URL(`${API_BASE}${endpoint}`, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.append(key, value);
      }
    });
  }
  return url.pathname + url.search;
}

async function fetchApi<T>(endpoint: string, params?: Record<string, string | undefined>): Promise<T> {
  const url = buildUrl(endpoint, params);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export const api = {
  /**
   * Health check
   */
  health: (): Promise<HealthResponse> => fetchApi("/health"),

  /**
   * Get available symbols
   */
  getSymbols: (): Promise<{ symbols: string[]; default: string; exchange: string }> =>
    fetchApi("/symbols"),

  /**
   * Get current price
   */
  getPrice: (symbol?: string): Promise<PriceData> =>
    fetchApi("/price", { symbol }),

  /**
   * Get current RADAR metrics for all timeframes
   */
  getRadarCurrent: (symbol?: string): Promise<RadarCurrentResponse> =>
    fetchApi("/radar/current", { symbol }),

  /**
   * Get RADAR for specific timeframe
   */
  getRadar: (timeframe: string, symbol?: string): Promise<RadarData> =>
    fetchApi(`/radar/${timeframe}`, { symbol }),

  /**
   * Get current bias for all timeframes
   */
  getBiasCurrent: (symbol?: string): Promise<BiasCurrentResponse> =>
    fetchApi("/bias/current", { symbol }),

  /**
   * Get funding rate
   */
  getFunding: (symbol?: string): Promise<{ funding_rate: number; symbol: string }> =>
    fetchApi("/funding", { symbol }),

  /**
   * Get market sentiment
   */
  getSentiment: (symbol?: string): Promise<Record<string, unknown>> =>
    fetchApi("/sentiment", { symbol }),
};

export default api;
