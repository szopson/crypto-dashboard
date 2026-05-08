'use client';

import { useEffect, useState } from 'react';

interface PnlData {
  total_r: number;
  trade_count: number;
  wins: number;
  losses: number;
  streak: { type: 'win' | 'loss' | 'none'; count: number };
}

const POLL_INTERVAL_MS = 60_000;

export default function TodayPnlCard() {
  const [data, setData] = useState<PnlData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch('/api/dashboard/today-pnl');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const d = await res.json() as PnlData;
        if (!cancelled) {
          setData(d);
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
  }, []);

  if (loading) {
    return <div className="border border-zinc-800 rounded-lg p-6 bg-zinc-950 h-32 animate-pulse" />;
  }

  if (error || !data) {
    return (
      <div className="border border-rose-900/50 rounded-lg p-6 bg-rose-950/20">
        <div className="text-sm text-rose-400">Today P&L: {error ?? 'no data'}</div>
      </div>
    );
  }

  const totalRColor = data.total_r > 0 ? 'text-emerald-400'
                    : data.total_r < 0 ? 'text-rose-400'
                    : 'text-zinc-300';

  const streakLabel = data.streak.type === 'none'
    ? '—'
    : `${data.streak.count} ${data.streak.type}${data.streak.count > 1 ? 's' : ''} in a row`;
  const streakColor = data.streak.type === 'win' ? 'text-emerald-400'
                    : data.streak.type === 'loss' ? 'text-rose-400'
                    : 'text-zinc-500';

  return (
    <div className="border border-zinc-800 rounded-lg p-6 bg-zinc-950">
      <div className="text-xs uppercase tracking-wider text-zinc-500 mb-3">Today P&L</div>

      <div className="flex items-baseline gap-2 mb-3">
        <div className={`text-3xl font-mono font-bold ${totalRColor}`}>
          {data.total_r > 0 ? '+' : ''}{data.total_r.toFixed(2)}
        </div>
        <div className="text-sm text-zinc-500">R</div>
      </div>

      <div className="grid grid-cols-3 gap-3 text-sm">
        <div>
          <div className="text-xs text-zinc-500">Trades</div>
          <div className="font-mono text-zinc-200">{data.trade_count}</div>
        </div>
        <div>
          <div className="text-xs text-zinc-500">W / L</div>
          <div className="font-mono">
            <span className="text-emerald-400">{data.wins}</span>
            <span className="text-zinc-600"> / </span>
            <span className="text-rose-400">{data.losses}</span>
          </div>
        </div>
        <div>
          <div className="text-xs text-zinc-500">Streak</div>
          <div className={`font-mono text-xs ${streakColor}`}>{streakLabel}</div>
        </div>
      </div>
    </div>
  );
}
