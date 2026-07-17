"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  /** True while the displayed data is a cached snapshot, not a live fetch. */
  stale: boolean;
  /** When the displayed data was last known good (live fetch or cache write). */
  lastGoodAt: Date | null;
  refresh: () => Promise<void>;
}

// Last-good snapshot per symbol so an engine outage degrades to "stale data
// + banner" instead of a dead workspace. Version the key so a shape change
// invalidates old entries instead of crashing on parse.
const CACHE_PREFIX = "follio-md-v1:";
const CACHE_INDEX_KEY = "follio-md-v1:__index"; // LRU list of cached symbols
const MAX_CACHED_SYMBOLS = 6;
const MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1000; // older snapshots are misleading
const BACKOFF_MS = [10_000, 30_000, 60_000];

interface CachedSnapshot {
  price: PriceData | null;
  radar: RadarCurrentResponse | null;
  bias: BiasCurrentResponse | null;
  savedAt: number;
}

function readCache(symbolKey: string): CachedSnapshot | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + symbolKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedSnapshot;
    if (
      typeof parsed?.savedAt !== "number" ||
      Date.now() - parsed.savedAt > MAX_CACHE_AGE_MS
    ) {
      localStorage.removeItem(CACHE_PREFIX + symbolKey);
      return null;
    }
    return parsed;
  } catch {
    // Corrupt entry or storage unavailable — drop it silently.
    try {
      localStorage.removeItem(CACHE_PREFIX + symbolKey);
    } catch {}
    return null;
  }
}

function writeCache(symbolKey: string, snapshot: CachedSnapshot) {
  try {
    localStorage.setItem(CACHE_PREFIX + symbolKey, JSON.stringify(snapshot));
    // LRU index: most-recent first, evict beyond the cap.
    const raw = localStorage.getItem(CACHE_INDEX_KEY);
    let index: string[] = [];
    try {
      index = raw ? (JSON.parse(raw) as string[]) : [];
      if (!Array.isArray(index)) index = [];
    } catch {
      index = [];
    }
    index = [symbolKey, ...index.filter((s) => s !== symbolKey)];
    for (const evicted of index.slice(MAX_CACHED_SYMBOLS)) {
      localStorage.removeItem(CACHE_PREFIX + evicted);
    }
    localStorage.setItem(
      CACHE_INDEX_KEY,
      JSON.stringify(index.slice(0, MAX_CACHED_SYMBOLS)),
    );
  } catch {
    // Quota exceeded / private mode — caching is best-effort.
  }
}

export function useMarketData(refreshInterval = 60000, symbol?: string): MarketData {
  const symbolKey = symbol ?? "__default";
  const [price, setPrice] = useState<PriceData | null>(null);
  const [radar, setRadar] = useState<RadarCurrentResponse | null>(null);
  const [bias, setBias] = useState<BiasCurrentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [stale, setStale] = useState(false);
  const [lastGoodAt, setLastGoodAt] = useState<Date | null>(null);

  const failCountRef = useRef(0);
  // Latest per-resource values for merging partial results into the cache
  // without waiting for a state render.
  const latestRef = useRef<{
    price: PriceData | null;
    radar: RadarCurrentResponse | null;
    bias: BiasCurrentResponse | null;
  }>({ price: null, radar: null, bias: null });

  const fetchData = useCallback(async (): Promise<boolean> => {
    setLoading(true);

    // Each resource settles independently — one failing endpoint must not
    // blank the others.
    const [priceRes, radarRes, biasRes] = await Promise.allSettled([
      api.getPrice(symbol),
      api.getRadarCurrent(symbol),
      api.getBiasCurrent(symbol),
    ]);

    if (priceRes.status === "fulfilled") {
      latestRef.current.price = priceRes.value;
      setPrice(priceRes.value);
    }
    if (radarRes.status === "fulfilled") {
      latestRef.current.radar = radarRes.value;
      setRadar(radarRes.value);
    }
    if (biasRes.status === "fulfilled") {
      latestRef.current.bias = biasRes.value;
      setBias(biasRes.value);
    }

    const failures = [priceRes, radarRes, biasRes].filter(
      (r) => r.status === "rejected",
    ) as PromiseRejectedResult[];
    const anyFulfilled = failures.length < 3;

    if (anyFulfilled) {
      const now = new Date();
      setLastUpdate(now);
      setLastGoodAt(now);
      setStale(false);
      writeCache(symbolKey, { ...latestRef.current, savedAt: now.getTime() });
    }

    if (failures.length > 0) {
      failCountRef.current += 1;
      const reason = failures[0].reason;
      setError(reason instanceof Error ? reason.message : "Failed to fetch data");
      console.error("Error fetching market data:", reason);
    } else {
      failCountRef.current = 0;
      setError(null);
    }

    setLoading(false);
    return failures.length === 0;
  }, [symbol, symbolKey]);

  // On symbol change: reset, hydrate from cache (marked stale), then poll.
  // A timeout chain (not setInterval) so the delay can stretch to the
  // backoff schedule while the engine is erroring.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    latestRef.current = { price: null, radar: null, bias: null };
    failCountRef.current = 0;
    setPrice(null);
    setRadar(null);
    setBias(null);
    setError(null);
    setLastUpdate(null);
    setLoading(true);

    const cached = readCache(symbolKey);
    if (cached) {
      latestRef.current = {
        price: cached.price,
        radar: cached.radar,
        bias: cached.bias,
      };
      setPrice(cached.price);
      setRadar(cached.radar);
      setBias(cached.bias);
      setStale(true);
      setLastGoodAt(new Date(cached.savedAt));
    } else {
      setStale(false);
      setLastGoodAt(null);
    }

    const tick = async () => {
      const ok = await fetchData();
      if (cancelled || refreshInterval <= 0) return;
      const delay = ok
        ? refreshInterval
        : BACKOFF_MS[Math.min(failCountRef.current - 1, BACKOFF_MS.length - 1)];
      timer = setTimeout(tick, delay);
    };
    tick();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [fetchData, refreshInterval, symbolKey]);

  const refresh = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  return {
    price,
    radar,
    bias,
    loading,
    error,
    lastUpdate,
    stale,
    lastGoodAt,
    refresh,
  };
}
