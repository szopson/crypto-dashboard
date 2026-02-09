"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import type {
  PriceData,
  RadarCurrentResponse,
  BiasCurrentResponse,
} from "@/lib/types";

interface MarketData {
  price: PriceData | null;
  radar: RadarCurrentResponse | null;
  bias: BiasCurrentResponse | null;
  loading: boolean;
  error: string | null;
  lastUpdate: Date | null;
  refresh: () => Promise<void>;
}

export function useMarketData(refreshInterval = 60000, symbol?: string): MarketData {
  const [price, setPrice] = useState<PriceData | null>(null);
  const [radar, setRadar] = useState<RadarCurrentResponse | null>(null);
  const [bias, setBias] = useState<BiasCurrentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all data in parallel
      const [priceData, radarData, biasData] = await Promise.all([
        api.getPrice(symbol),
        api.getRadarCurrent(symbol),
        api.getBiasCurrent(symbol),
      ]);

      setPrice(priceData);
      setRadar(radarData);
      setBias(biasData);
      setLastUpdate(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
      console.error("Error fetching market data:", err);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  // Fetch when symbol changes
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh
  useEffect(() => {
    if (refreshInterval <= 0) return;

    const interval = setInterval(fetchData, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchData, refreshInterval]);

  return {
    price,
    radar,
    bias,
    loading,
    error,
    lastUpdate,
    refresh: fetchData,
  };
}
