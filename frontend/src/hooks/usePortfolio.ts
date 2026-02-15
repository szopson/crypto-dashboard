"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth, useAccessToken } from "@/contexts/AuthContext";
import { wealthApi } from "@/lib/wealth-api";
import type {
  Portfolio,
  PortfolioCreate,
  PortfolioSummary,
  Holding,
  HoldingCreate,
  HoldingUpdate,
  AssetAllocation,
  AssetClass,
  PriceData,
  ASSET_CLASS_CONFIG,
} from "@/lib/wealth-types";

// Extended holding with price data
interface HoldingWithPrice extends Holding {
  current_price?: number;
  current_value?: number;
  change_24h_pct?: number;
}

interface UsePortfolioReturn {
  // Data
  portfolios: Portfolio[];
  activePortfolio: Portfolio | null;
  holdings: HoldingWithPrice[];
  summary: PortfolioSummary | null;
  allocation: AssetAllocation[];
  prices: Record<string, PriceData>;

  // State
  loading: boolean;
  error: string | null;
  lastUpdate: Date | null;

  // Actions
  setActivePortfolio: (portfolio: Portfolio | null) => void;
  createPortfolio: (data: PortfolioCreate) => Promise<Portfolio>;
  deletePortfolio: (portfolioId: string) => Promise<void>;
  addHolding: (data: HoldingCreate) => Promise<Holding>;
  updateHolding: (holdingId: string, data: HoldingUpdate) => Promise<Holding>;
  deleteHolding: (holdingId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Hook for managing portfolio data and operations.
 */
export function usePortfolio(): UsePortfolioReturn {
  const { user } = useAuth();
  const accessToken = useAccessToken();

  // State
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [activePortfolio, setActivePortfolio] = useState<Portfolio | null>(null);
  const [holdings, setHoldings] = useState<HoldingWithPrice[]>([]);
  const [prices, setPrices] = useState<Record<string, PriceData>>({});
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Calculate allocation from holdings with live prices
  const allocation = useMemo((): AssetAllocation[] => {
    if (!holdings.length) return [];

    // Group holdings by asset class
    const byClass: Record<AssetClass, { value: number; count: number }> = {} as Record<
      AssetClass,
      { value: number; count: number }
    >;

    let totalValue = 0;

    for (const holding of holdings) {
      const assetClass = holding.asset_class;
      // Use current_price from price data, fallback to manual_price
      const price = holding.current_price || holding.manual_price || 0;
      const value = price * Number(holding.quantity);

      if (!byClass[assetClass]) {
        byClass[assetClass] = { value: 0, count: 0 };
      }

      byClass[assetClass].value += value;
      byClass[assetClass].count += 1;
      totalValue += value;
    }

    // Convert to allocation array
    const COLORS: Record<AssetClass, string> = {
      crypto: "#F7931A",
      stock: "#4CAF50",
      etf: "#2196F3",
      bond: "#9C27B0",
      real_estate: "#FF5722",
      cash: "#607D8B",
      commodity: "#FFC107",
      other: "#E91E63",
    };

    return Object.entries(byClass)
      .map(([assetClass, data]) => ({
        asset_class: assetClass as AssetClass,
        value_usd: data.value,
        percentage: totalValue > 0 ? (data.value / totalValue) * 100 : 0,
        holdings_count: data.count,
        color: COLORS[assetClass as AssetClass] || "#888888",
      }))
      .sort((a, b) => b.value_usd - a.value_usd);
  }, [holdings]);

  // Fetch portfolios
  const fetchPortfolios = useCallback(async () => {
    if (!accessToken) return;

    try {
      const data = await wealthApi.getPortfolios(accessToken);
      setPortfolios(data);

      // Set default active portfolio if none selected
      if (!activePortfolio && data.length > 0) {
        const defaultPortfolio =
          data.find((p) => p.is_default) || data[0];
        setActivePortfolio(defaultPortfolio);
      }
    } catch (err) {
      console.error("Error fetching portfolios:", err);
      throw err;
    }
  }, [accessToken, activePortfolio]);

  // Fetch holdings for active portfolio and their prices
  const fetchHoldings = useCallback(async () => {
    if (!accessToken || !activePortfolio) {
      setHoldings([]);
      setPrices({});
      return;
    }

    try {
      const data = await wealthApi.getHoldings(accessToken, {
        portfolioId: activePortfolio.id,
      });

      // Fetch prices for all holdings
      if (data.length > 0) {
        try {
          const assets = data.map((h) => ({
            asset_class: h.asset_class,
            ticker: h.ticker,
          }));

          const priceResponse = await wealthApi.getBatchPrices(assets, accessToken);
          const pricesMap = priceResponse.prices || {};
          setPrices(pricesMap);

          // Merge prices into holdings
          const holdingsWithPrices: HoldingWithPrice[] = data.map((h) => {
            const key = `${h.asset_class}:${h.ticker}`;
            const priceData = pricesMap[key];
            return {
              ...h,
              current_price: priceData?.price_usd || h.manual_price || 0,
              current_value: (priceData?.price_usd || h.manual_price || 0) * Number(h.quantity),
              change_24h_pct: priceData?.change_24h_pct ?? undefined,
            };
          });
          setHoldings(holdingsWithPrices);
        } catch (priceErr) {
          console.error("Error fetching prices:", priceErr);
          // Fall back to holdings without prices
          setHoldings(data.map((h) => ({
            ...h,
            current_price: h.manual_price || 0,
            current_value: (h.manual_price || 0) * Number(h.quantity),
          })));
        }
      } else {
        setHoldings([]);
      }
    } catch (err) {
      console.error("Error fetching holdings:", err);
      throw err;
    }
  }, [accessToken, activePortfolio]);

  // Fetch portfolio summary
  const fetchSummary = useCallback(async () => {
    if (!accessToken || !activePortfolio) {
      setSummary(null);
      return;
    }

    try {
      const data = await wealthApi.getPortfolioSummary(
        activePortfolio.id,
        accessToken
      );
      setSummary(data);
    } catch (err) {
      console.error("Error fetching summary:", err);
      throw err;
    }
  }, [accessToken, activePortfolio]);

  // Full refresh
  const refresh = useCallback(async () => {
    if (!accessToken) return;

    setLoading(true);
    setError(null);

    try {
      await fetchPortfolios();
      await Promise.all([fetchHoldings(), fetchSummary()]);
      setLastUpdate(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, [accessToken, fetchPortfolios, fetchHoldings, fetchSummary]);

  // Initial fetch
  useEffect(() => {
    if (user && accessToken) {
      refresh();
    }
  }, [user, accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // Refetch when active portfolio changes
  useEffect(() => {
    if (activePortfolio && accessToken) {
      Promise.all([fetchHoldings(), fetchSummary()]).catch(console.error);
    }
  }, [activePortfolio, accessToken, fetchHoldings, fetchSummary]);

  // Create portfolio
  const createPortfolio = useCallback(
    async (data: PortfolioCreate): Promise<Portfolio> => {
      if (!accessToken) {
        throw new Error("Not authenticated");
      }

      const newPortfolio = await wealthApi.createPortfolio(data, accessToken);
      setPortfolios((prev) => [...prev, newPortfolio]);

      // Set as active if it's the first one
      if (portfolios.length === 0) {
        setActivePortfolio(newPortfolio);
      }

      return newPortfolio;
    },
    [accessToken, portfolios.length]
  );

  // Delete portfolio
  const deletePortfolio = useCallback(
    async (portfolioId: string): Promise<void> => {
      if (!accessToken) {
        throw new Error("Not authenticated");
      }

      await wealthApi.deletePortfolio(portfolioId, accessToken);
      setPortfolios((prev) => prev.filter((p) => p.id !== portfolioId));

      // Clear active if it was deleted
      if (activePortfolio?.id === portfolioId) {
        const remaining = portfolios.filter((p) => p.id !== portfolioId);
        setActivePortfolio(remaining.length > 0 ? remaining[0] : null);
      }
    },
    [accessToken, activePortfolio, portfolios]
  );

  // Add holding
  const addHolding = useCallback(
    async (data: HoldingCreate): Promise<Holding> => {
      if (!accessToken) {
        throw new Error("Not authenticated");
      }

      const newHolding = await wealthApi.createHolding(data, accessToken);
      setHoldings((prev) => [...prev, newHolding]);

      // Refresh summary
      fetchSummary().catch(console.error);

      return newHolding;
    },
    [accessToken, fetchSummary]
  );

  // Update holding
  const updateHolding = useCallback(
    async (holdingId: string, data: HoldingUpdate): Promise<Holding> => {
      if (!accessToken) {
        throw new Error("Not authenticated");
      }

      const updated = await wealthApi.updateHolding(
        holdingId,
        data,
        accessToken
      );
      setHoldings((prev) =>
        prev.map((h) => (h.id === holdingId ? updated : h))
      );

      // Refresh summary
      fetchSummary().catch(console.error);

      return updated;
    },
    [accessToken, fetchSummary]
  );

  // Delete holding
  const deleteHolding = useCallback(
    async (holdingId: string): Promise<void> => {
      if (!accessToken) {
        throw new Error("Not authenticated");
      }

      await wealthApi.deleteHolding(holdingId, accessToken);
      setHoldings((prev) => prev.filter((h) => h.id !== holdingId));

      // Refresh summary
      fetchSummary().catch(console.error);
    },
    [accessToken, fetchSummary]
  );

  return {
    portfolios,
    activePortfolio,
    holdings,
    summary,
    allocation,
    prices,
    loading,
    error,
    lastUpdate,
    setActivePortfolio,
    createPortfolio,
    deletePortfolio,
    addHolding,
    updateHolding,
    deleteHolding,
    refresh,
  };
}

export default usePortfolio;
