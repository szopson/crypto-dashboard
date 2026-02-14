/**
 * API client for Wealth Dashboard
 */
import type {
  Portfolio,
  PortfolioCreate,
  PortfolioUpdate,
  PortfolioSummary,
  Holding,
  HoldingCreate,
  HoldingUpdate,
  AssetSearchResult,
  PriceData,
  BatchPriceResponse,
  AssetClass,
} from "./wealth-types";

const API_BASE = "/api/wealth";

/**
 * Make an authenticated API request
 */
async function fetchWithAuth<T>(
  endpoint: string,
  accessToken: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `API error: ${response.status}`);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

/**
 * Wealth Dashboard API client
 */
export const wealthApi = {
  // ==========================================================================
  // PORTFOLIOS
  // ==========================================================================

  /**
   * Create a new portfolio
   */
  createPortfolio: (
    data: PortfolioCreate,
    accessToken: string
  ): Promise<Portfolio> =>
    fetchWithAuth("/portfolios", accessToken, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  /**
   * List all portfolios
   */
  getPortfolios: (accessToken: string): Promise<Portfolio[]> =>
    fetchWithAuth("/portfolios", accessToken),

  /**
   * Get a specific portfolio
   */
  getPortfolio: (portfolioId: string, accessToken: string): Promise<Portfolio> =>
    fetchWithAuth(`/portfolios/${portfolioId}`, accessToken),

  /**
   * Update a portfolio
   */
  updatePortfolio: (
    portfolioId: string,
    data: PortfolioUpdate,
    accessToken: string
  ): Promise<Portfolio> =>
    fetchWithAuth(`/portfolios/${portfolioId}`, accessToken, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  /**
   * Delete a portfolio
   */
  deletePortfolio: (
    portfolioId: string,
    accessToken: string
  ): Promise<{ status: string }> =>
    fetchWithAuth(`/portfolios/${portfolioId}`, accessToken, {
      method: "DELETE",
    }),

  /**
   * Get portfolio summary with values
   */
  getPortfolioSummary: (
    portfolioId: string,
    accessToken: string
  ): Promise<PortfolioSummary> =>
    fetchWithAuth(`/portfolios/${portfolioId}/summary`, accessToken),

  // ==========================================================================
  // HOLDINGS
  // ==========================================================================

  /**
   * Create a new holding
   */
  createHolding: (data: HoldingCreate, accessToken: string): Promise<Holding> =>
    fetchWithAuth("/holdings", accessToken, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  /**
   * List holdings (optionally filtered by portfolio or asset class)
   */
  getHoldings: (
    accessToken: string,
    options?: { portfolioId?: string; assetClass?: AssetClass }
  ): Promise<Holding[]> => {
    const params = new URLSearchParams();
    if (options?.portfolioId) {
      params.set("portfolio_id", options.portfolioId);
    }
    if (options?.assetClass) {
      params.set("asset_class", options.assetClass);
    }
    const query = params.toString();
    return fetchWithAuth(`/holdings${query ? `?${query}` : ""}`, accessToken);
  },

  /**
   * Get a specific holding
   */
  getHolding: (holdingId: string, accessToken: string): Promise<Holding> =>
    fetchWithAuth(`/holdings/${holdingId}`, accessToken),

  /**
   * Update a holding
   */
  updateHolding: (
    holdingId: string,
    data: HoldingUpdate,
    accessToken: string
  ): Promise<Holding> =>
    fetchWithAuth(`/holdings/${holdingId}`, accessToken, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  /**
   * Delete a holding
   */
  deleteHolding: (
    holdingId: string,
    accessToken: string
  ): Promise<{ status: string }> =>
    fetchWithAuth(`/holdings/${holdingId}`, accessToken, {
      method: "DELETE",
    }),

  // ==========================================================================
  // PRICES
  // ==========================================================================

  /**
   * Get price for a single asset
   */
  getPrice: (
    assetClass: AssetClass,
    ticker: string,
    accessToken: string,
    refresh?: boolean
  ): Promise<PriceData> => {
    const params = refresh ? "?refresh=true" : "";
    return fetchWithAuth(
      `/prices/${assetClass}/${ticker}${params}`,
      accessToken
    );
  },

  /**
   * Get prices for multiple assets
   */
  getBatchPrices: (
    assets: Array<{ asset_class: string; ticker: string }>,
    accessToken: string
  ): Promise<BatchPriceResponse> =>
    fetchWithAuth("/prices/batch", accessToken, {
      method: "POST",
      body: JSON.stringify({ assets }),
    }),

  // ==========================================================================
  // ASSET SEARCH
  // ==========================================================================

  /**
   * Search for assets
   */
  searchAssets: (
    query: string,
    accessToken: string,
    options?: { assetClass?: AssetClass; limit?: number }
  ): Promise<AssetSearchResult[]> => {
    const params = new URLSearchParams({ q: query });
    if (options?.assetClass) {
      params.set("asset_class", options.assetClass);
    }
    if (options?.limit) {
      params.set("limit", options.limit.toString());
    }
    return fetchWithAuth(`/assets/search?${params}`, accessToken);
  },

  /**
   * List assets by class
   */
  getAssetsByClass: (
    assetClass: AssetClass,
    accessToken: string,
    limit?: number
  ): Promise<AssetSearchResult[]> => {
    const params = limit ? `?limit=${limit}` : "";
    return fetchWithAuth(`/assets/${assetClass}${params}`, accessToken);
  },
};

export default wealthApi;
