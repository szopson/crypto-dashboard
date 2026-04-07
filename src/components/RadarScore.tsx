'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

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

const SYMBOLS = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'];
const TIMEFRAMES = ['15m', '1h', '4h', '1d'];

// Normalize a metric value to 0–100 for radar display
function normalize(value: number, min: number, max: number): number {
  return Math.round(((value - min) / (max - min)) * 100);
}

function toChartData(r: RadarResult) {
  return [
    { metric: 'Trend', value: normalize(r.trend, -1, 1) },
    { metric: 'Momentum', value: normalize(r.momentum, -1, 1) },
    { metric: 'Volume', value: Math.min(100, Math.max(0, Math.round((r.volume_z + 3) / 6 * 100))) },
    { metric: 'Structure', value: normalize(r.structure, -1, 1) },
    { metric: 'Bias', value: normalize(r.bias, -1, 1) },
    { metric: 'Score', value: r.score },
  ];
}

function arrow(value: number): string {
  if (value > 0.1) return '↑';
  if (value < -0.1) return '↓';
  return '→';
}

function metricColor(value: number): string {
  if (value > 0.1) return 'text-emerald-400';
  if (value < -0.1) return 'text-red-400';
  return 'text-zinc-400';
}

export default function RadarScore() {
  const [symbol, setSymbol] = useState('BTC/USDT');
  const [timeframe, setTimeframe] = useState('1h');
  const [data, setData] = useState<RadarResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/radar?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: RadarResult = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [symbol, timeframe]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const chartData = data ? toChartData(data) : [];

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900">
      {/* Header + controls */}
      <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-zinc-800 flex-wrap">
        <h2 className="font-semibold text-zinc-100">RADAR Score</h2>
        <div className="flex items-center gap-2">
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          >
            {SYMBOLS.map((s) => (
              <option key={s} value={s}>
                {s.replace('/USDT', '')}
              </option>
            ))}
          </select>
          <div className="flex rounded-lg overflow-hidden border border-zinc-700">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  timeframe === tf
                    ? 'bg-zinc-600 text-zinc-100'
                    : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && (
        <div className="p-6 animate-pulse">
          <div className="h-64 rounded-lg bg-zinc-800" />
        </div>
      )}

      {error && (
        <div className="p-6">
          <p className="text-red-400 text-sm">Failed to load radar data: {error}</p>
        </div>
      )}

      {data && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-zinc-800">
          {/* Radar chart */}
          <div className="p-5">
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart data={chartData}>
                <PolarGrid stroke="#3f3f46" />
                <PolarAngleAxis
                  dataKey="metric"
                  tick={{ fill: '#a1a1aa', fontSize: 11 }}
                />
                <Radar
                  name="Score"
                  dataKey="value"
                  stroke="#6366f1"
                  fill="#6366f1"
                  fillOpacity={0.25}
                  dot={{ r: 3, fill: '#6366f1' }}
                />
                <Tooltip
                  contentStyle={{
                    background: '#18181b',
                    border: '1px solid #3f3f46',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(v) => [`${v}/100`]}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Numeric breakdown */}
          <div className="p-5 space-y-3">
            <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Metrics</div>
            {[
              { label: 'Trend', raw: data.trend },
              { label: 'Momentum', raw: data.momentum },
              { label: 'Structure', raw: data.structure },
              { label: 'Bias', raw: data.bias },
            ].map(({ label, raw }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-zinc-400 text-sm">{label}</span>
                <span className={`font-mono font-bold text-sm ${metricColor(raw)}`}>
                  {arrow(raw)} {raw.toFixed(2)}
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between">
              <span className="text-zinc-400 text-sm">Volume Z</span>
              <span className="font-mono font-bold text-sm text-zinc-300">
                {data.volume_z.toFixed(2)}σ
              </span>
            </div>
            <div className="pt-2 border-t border-zinc-800 flex items-center justify-between">
              <span className="text-zinc-300 text-sm font-medium">Score</span>
              <span className="font-mono font-bold text-xl text-indigo-400">
                {data.score}
                <span className="text-sm text-zinc-500">/100</span>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
