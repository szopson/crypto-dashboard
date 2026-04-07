'use client';

import { useState, useEffect } from 'react';

interface Setup {
  id: number;
  symbol: string;
  direction: 'long' | 'short';
  entry_zone_low: number;
  entry_zone_high: number;
  target: number | null;
  invalidation: number;
  confluence_score: number;
  reasoning: string;
  status: string;
  created_at: number;
}

export default function SetupsPage() {
  const [setups, setSetups] = useState<Setup[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/setups/scan')
      .then((r) => r.json())
      .then((d) => setSetups(d.setups ?? []))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const runScan = async () => {
    setScanning(true);
    setError(null);
    try {
      const res = await fetch('/api/setups/scan', { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      setSetups((prev) => [...d.setups, ...prev]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setScanning(false);
    }
  };

  return (
    <main className="max-w-screen-xl mx-auto px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-100">Trade Setups</h1>
          <p className="text-zinc-500 text-sm mt-1">AI-identified high-probability setups with confluence ≥ 3.</p>
        </div>
        <button
          onClick={runScan}
          disabled={scanning}
          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-medium transition-colors"
        >
          {scanning ? 'Scanning…' : '⚡ Scan Now'}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-800/50 bg-red-900/20 p-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-zinc-800 animate-pulse" />
          ))}
        </div>
      )}

      {!loading && setups.length === 0 && !error && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center">
          <p className="text-zinc-500 text-sm">No active setups. Click "Scan Now" to find setups.</p>
        </div>
      )}

      <div className="space-y-3">
        {setups.map((s) => (
          <div key={s.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex items-center gap-3">
                <span className="font-mono font-bold text-zinc-100">
                  {s.symbol.replace('/USDT', '')}
                </span>
                <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${
                  s.direction === 'long' ? 'bg-emerald-900/50 text-emerald-400' : 'bg-red-900/50 text-red-400'
                }`}>
                  {s.direction}
                </span>
                <span className="text-xs text-zinc-500">
                  Confluence: <span className="text-indigo-400 font-bold">{s.confluence_score}/6</span>
                </span>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                s.status === 'active' ? 'bg-zinc-700 text-zinc-400' : 'bg-zinc-800 text-zinc-600'
              }`}>
                {s.status}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm mb-3">
              <div>
                <div className="text-xs text-zinc-500 mb-0.5">Entry Zone</div>
                <div className="font-mono text-zinc-300">
                  {s.entry_zone_low.toLocaleString()} – {s.entry_zone_high.toLocaleString()}
                </div>
              </div>
              {s.target && (
                <div>
                  <div className="text-xs text-zinc-500 mb-0.5">Target</div>
                  <div className="font-mono text-emerald-400">{s.target.toLocaleString()}</div>
                </div>
              )}
              <div>
                <div className="text-xs text-zinc-500 mb-0.5">Invalidation</div>
                <div className="font-mono text-red-400">{s.invalidation.toLocaleString()}</div>
              </div>
            </div>
            <p className="text-zinc-400 text-sm leading-relaxed">{s.reasoning}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
