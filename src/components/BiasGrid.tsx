'use client';

import { useEffect, useState, useCallback } from 'react';

interface RadarResult {
  symbol: string;
  timeframe: string;
  trend: number;
  momentum: number;
  volume_z: number;
  structure: number;
  bias: number;
  score: number;
  updatedAt: number;
}

interface BiasResponse {
  symbols: {
    symbol: string;
    timeframes: Record<string, RadarResult>;
  }[];
}

const TIMEFRAMES = ['1h', '4h', '1d'];
const POLL_INTERVAL_MS = 5 * 60 * 1000;

function biasLabel(bias: number): string {
  if (bias > 0.2) return 'BULLISH';
  if (bias < -0.2) return 'BEARISH';
  return 'NEUTRAL';
}

function biasColor(bias: number): string {
  if (bias > 0.2) return 'text-emerald-400';
  if (bias < -0.2) return 'text-red-400';
  return 'text-zinc-400';
}

function biasBg(bias: number): string {
  if (bias > 0.2) return 'bg-emerald-900/30 border-emerald-700/40';
  if (bias < -0.2) return 'bg-red-900/30 border-red-700/40';
  return 'bg-zinc-800/50 border-zinc-700/40';
}

function scoreColor(score: number): string {
  if (score >= 60) return 'bg-emerald-700 text-emerald-100';
  if (score <= 40) return 'bg-red-700 text-red-100';
  return 'bg-zinc-600 text-zinc-200';
}

export default function BiasGrid() {
  const [data, setData] = useState<BiasResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/bias');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: BiasResponse = await res.json();
      setData(json);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-zinc-800" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-800/50 bg-red-900/20 p-6">
        <p className="text-red-400 text-sm">Failed to load bias data: {error}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900">
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
        <h2 className="font-semibold text-zinc-100">Market Bias</h2>
        {lastUpdated && (
          <span className="text-xs text-zinc-500">
            Updated {lastUpdated.toLocaleTimeString()}
          </span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="px-5 py-3 text-left text-zinc-500 font-medium">Symbol</th>
              {TIMEFRAMES.map((tf) => (
                <th key={tf} className="px-5 py-3 text-center text-zinc-500 font-medium">
                  {tf}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data?.symbols.map(({ symbol, timeframes }) => (
              <tr key={symbol} className="border-b border-zinc-800/50 last:border-0">
                <td className="px-5 py-4 font-mono font-medium text-zinc-200">
                  {symbol.replace('/USDT', '')}
                </td>
                {TIMEFRAMES.map((tf) => {
                  const r = timeframes[tf];
                  if (!r) {
                    return (
                      <td key={tf} className="px-5 py-4 text-center">
                        <span className="text-zinc-600 text-xs">—</span>
                      </td>
                    );
                  }
                  return (
                    <td key={tf} className="px-5 py-4">
                      <div
                        className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 ${biasBg(r.bias)}`}
                      >
                        <span className={`font-semibold text-xs tracking-wide ${biasColor(r.bias)}`}>
                          {biasLabel(r.bias)}
                        </span>
                        <span
                          className={`text-xs rounded px-1.5 py-0.5 font-mono font-bold ${scoreColor(r.score)}`}
                        >
                          {r.score}
                        </span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
