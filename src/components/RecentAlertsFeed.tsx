'use client';

import { useEffect, useState } from 'react';

interface AlertRow {
  id: number;
  channel: string;
  ticker: string | null;
  severity: string | null;
  payload: unknown;
  created_at: number;
  sent_at: number | null;
}

const POLL_INTERVAL_MS = 30_000;

function severityColor(sev: string | null): string {
  switch (sev) {
    case 'VERY_HIGH': return 'border-emerald-500/60 bg-emerald-950/20';
    case 'HIGH': return 'border-emerald-700/40 bg-emerald-950/10';
    case 'MEDIUM': return 'border-amber-700/40 bg-amber-950/10';
    case 'LOW': return 'border-zinc-700 bg-zinc-900/40';
    default: return 'border-zinc-800 bg-zinc-950';
  }
}

function timeAgo(unixSeconds: number): string {
  const diff = Math.floor(Date.now() / 1000) - unixSeconds;
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export default function RecentAlertsFeed({ limit = 10 }: { limit?: number }) {
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(`/api/dashboard/recent-alerts?limit=${limit}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json() as { alerts: AlertRow[] };
        if (!cancelled) {
          setAlerts(data.alerts);
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
  }, [limit]);

  if (loading) {
    return (
      <div className="border border-zinc-800 rounded-lg p-6 bg-zinc-950">
        <div className="text-xs uppercase tracking-wider text-zinc-500 mb-3">Recent alerts</div>
        <div className="space-y-2">
          {[0, 1, 2].map(i => <div key={i} className="h-10 bg-zinc-900 rounded animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-rose-900/50 rounded-lg p-6 bg-rose-950/20">
        <div className="text-sm text-rose-400">Recent alerts: {error}</div>
      </div>
    );
  }

  return (
    <div className="border border-zinc-800 rounded-lg p-6 bg-zinc-950">
      <div className="flex items-baseline justify-between mb-3">
        <div className="text-xs uppercase tracking-wider text-zinc-500">Recent alerts</div>
        <div className="text-xs text-zinc-600">{alerts.length} entries</div>
      </div>

      {alerts.length === 0 ? (
        <div className="text-sm text-zinc-500 py-4">No alerts yet.</div>
      ) : (
        <ul className="space-y-2">
          {alerts.map(a => (
            <li key={a.id} className={`border rounded px-3 py-2 ${severityColor(a.severity)}`}>
              <div className="flex items-baseline justify-between gap-3">
                <div className="flex items-baseline gap-2 min-w-0">
                  <span className="font-mono text-xs text-zinc-500">{timeAgo(a.created_at)}</span>
                  <span className="font-semibold text-zinc-200 truncate">{a.channel}</span>
                  {a.ticker && <span className="text-zinc-400 text-sm">· {a.ticker}</span>}
                </div>
                {a.severity && (
                  <span className="text-xs font-mono text-zinc-400 shrink-0">{a.severity}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
