'use client';

import { useEffect, useState } from 'react';

interface PatternData {
  id: number;
  ticker: string;
  pattern_type: string | null;
  confidence: number | null;
  smc_score: number | null;
  velo_score: number | null;
  final_score: number | null;
  bias: string | null;
  raw_metrics: unknown;
  detected_at: number;
}

const POLL_INTERVAL_MS = 60_000;

function confidenceLabel(score: number | null): string {
  if (score == null) return 'NO_EDGE';
  const abs = Math.abs(score);
  if (abs >= 80) return 'VERY_HIGH';
  if (abs >= 60) return 'HIGH';
  if (abs >= 40) return 'MODERATE';
  return 'NO_EDGE';
}

function confidenceColor(label: string): string {
  switch (label) {
    case 'VERY_HIGH': return 'text-emerald-400';
    case 'HIGH': return 'text-emerald-300';
    case 'MODERATE': return 'text-amber-300';
    default: return 'text-zinc-500';
  }
}

function biasColor(bias: string | null): string {
  if (bias === 'bullish') return 'text-emerald-400';
  if (bias === 'bearish') return 'text-rose-400';
  return 'text-zinc-400';
}

function timeAgo(unixSeconds: number): string {
  const diff = Math.floor(Date.now() / 1000) - unixSeconds;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function ActivePatternCard({ ticker = 'BTC' }: { ticker?: string }) {
  const [pattern, setPattern] = useState<PatternData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(`/api/dashboard/active-pattern?ticker=${ticker}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json() as { pattern: PatternData | null };
        if (!cancelled) {
          setPattern(data.pattern);
          setError(null);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'fetch failed');
          setLoading(false);
        }
      }
    };

    load();
    const id = setInterval(load, POLL_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [ticker]);

  if (loading) {
    return (
      <div className="border border-zinc-800 rounded-lg p-6 bg-zinc-950 animate-pulse">
        <div className="h-4 w-32 bg-zinc-800 rounded mb-4" />
        <div className="h-8 w-48 bg-zinc-800 rounded mb-2" />
        <div className="h-3 w-full bg-zinc-900 rounded" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-rose-900/50 rounded-lg p-6 bg-rose-950/20">
        <div className="text-sm text-rose-400">Active pattern: {error}</div>
      </div>
    );
  }

  if (!pattern) {
    return (
      <div className="border border-zinc-800 rounded-lg p-6 bg-zinc-950">
        <div className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Active pattern · {ticker}</div>
        <div className="text-zinc-400">No pattern detected yet. Run the engine to populate <code className="text-zinc-300">pattern_history</code>.</div>
      </div>
    );
  }

  const label = confidenceLabel(pattern.final_score);

  return (
    <div className="border border-zinc-800 rounded-lg p-6 bg-zinc-950">
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <div className="text-xs uppercase tracking-wider text-zinc-500">Active pattern · {pattern.ticker}</div>
          <div className="text-2xl font-semibold text-zinc-100 mt-1">
            {pattern.pattern_type ?? '—'}
          </div>
        </div>
        <div className="text-right">
          <div className={`text-xl font-bold ${confidenceColor(label)}`}>{label}</div>
          <div className="text-sm text-zinc-400 mt-0.5">
            score <span className="font-mono">{pattern.final_score?.toFixed(0) ?? '—'}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div>
          <div className="text-xs text-zinc-500">VELO</div>
          <div className="font-mono text-zinc-200">{pattern.velo_score?.toFixed(0) ?? '—'}</div>
        </div>
        <div>
          <div className="text-xs text-zinc-500">SMC</div>
          <div className="font-mono text-zinc-200">{pattern.smc_score?.toFixed(0) ?? '—'}</div>
        </div>
        <div>
          <div className="text-xs text-zinc-500">Bias</div>
          <div className={`font-semibold ${biasColor(pattern.bias)}`}>{pattern.bias ?? '—'}</div>
        </div>
      </div>

      <div className="text-xs text-zinc-500">
        Detected {timeAgo(pattern.detected_at)}
      </div>
    </div>
  );
}
