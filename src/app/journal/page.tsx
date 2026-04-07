'use client';

import { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Trade {
  id: number;
  symbol: string;
  direction: 'long' | 'short';
  entry_price: number;
  exit_price: number | null;
  size: number;
  stop_loss: number | null;
  take_profit: number | null;
  pnl: number | null;
  r_multiple: number | null;
  setup_type: string | null;
  notes: string | null;
  status: string;
  source: string;
  created_at: number;
}

interface Stats {
  totalTrades: number;
  closedTrades: number;
  openTrades: number;
  winRate: number | null;
  avgR: number | null;
  profitFactor: number | null;
  totalPnl: number;
  pnlCurve: { timestamp: number; pnl: number }[];
}

const SETUP_TYPES = ['OB bounce', 'FVG fill', 'Liquidity sweep', 'S/R bounce', 'Breakout', 'Other'];

export default function JournalPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [tab, setTab] = useState<'trades' | 'stats'>('trades');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<{
    symbol: string;
    direction: 'long' | 'short';
    entry_price: string;
    exit_price: string;
    size: string;
    stop_loss: string;
    take_profit: string;
    setup_type: string;
    notes: string;
  }>({
    symbol: 'BTC/USDT',
    direction: 'long',
    entry_price: '',
    exit_price: '',
    size: '1',
    stop_loss: '',
    take_profit: '',
    setup_type: '',
    notes: '',
  });

  const loadData = useCallback(async () => {
    const [tradesRes, statsRes] = await Promise.all([
      fetch('/api/journal'),
      fetch('/api/journal/stats'),
    ]);
    if (tradesRes.ok) setTrades((await tradesRes.json()).trades);
    if (statsRes.ok) setStats(await statsRes.json());
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const submitTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = {
      symbol: form.symbol,
      direction: form.direction,
      entry_price: parseFloat(form.entry_price),
      ...(form.exit_price && { exit_price: parseFloat(form.exit_price) }),
      size: parseFloat(form.size),
      ...(form.stop_loss && { stop_loss: parseFloat(form.stop_loss) }),
      ...(form.take_profit && { take_profit: parseFloat(form.take_profit) }),
      setup_type: form.setup_type || undefined,
      notes: form.notes || undefined,
      status: form.exit_price ? 'closed' : 'open',
    };
    await fetch('/api/journal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    setShowForm(false);
    setForm({ symbol: 'BTC/USDT', direction: 'long', entry_price: '', exit_price: '', size: '1', stop_loss: '', take_profit: '', setup_type: '', notes: '' });
    loadData();
  };

  return (
    <main className="max-w-screen-xl mx-auto px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-100">Trade Journal</h1>
          <p className="text-zinc-500 text-sm mt-1">Log, track, and analyze your trades.</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
        >
          + Log Trade
        </button>
      </div>

      {showForm && (
        <form onSubmit={submitTrade} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 mb-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Symbol', key: 'symbol', type: 'text' },
            { label: 'Entry Price', key: 'entry_price', type: 'number' },
            { label: 'Exit Price', key: 'exit_price', type: 'number' },
            { label: 'Size', key: 'size', type: 'number' },
            { label: 'Stop Loss', key: 'stop_loss', type: 'number' },
            { label: 'Take Profit', key: 'take_profit', type: 'number' },
          ].map(({ label, key, type }) => (
            <div key={key}>
              <label className="text-xs text-zinc-500 mb-1 block">{label}</label>
              <input
                type={type}
                value={(form as Record<string, string>)[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                step="any"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          ))}
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Direction</label>
            <select
              value={form.direction}
              onChange={(e) => setForm((f) => ({ ...f, direction: e.target.value as 'long' | 'short' }))}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200"
            >
              <option value="long">Long</option>
              <option value="short">Short</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Setup Type</label>
            <select
              value={form.setup_type}
              onChange={(e) => setForm((f) => ({ ...f, setup_type: e.target.value }))}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200"
            >
              <option value="">— Select —</option>
              {SETUP_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="col-span-2 md:col-span-4">
            <label className="text-xs text-zinc-500 mb-1 block">Notes</label>
            <input
              type="text"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200"
            />
          </div>
          <div className="col-span-2 md:col-span-4 flex gap-2">
            <button type="submit" className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium">Save</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-sm">Cancel</button>
          </div>
        </form>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-zinc-800">
        {(['trades', 'stats'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${
              tab === t ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'trades' && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase">
                {['Symbol', 'Dir', 'Entry', 'Exit', 'Size', 'PnL', 'R', 'Setup', 'Status'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trades.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-zinc-600">No trades logged yet</td></tr>
              )}
              {trades.map((t) => (
                <tr key={t.id} className="border-b border-zinc-800/50 last:border-0 hover:bg-zinc-800/30">
                  <td className="px-4 py-3 font-mono text-zinc-200">{t.symbol.replace('/USDT', '')}</td>
                  <td className={`px-4 py-3 text-xs font-bold uppercase ${t.direction === 'long' ? 'text-emerald-400' : 'text-red-400'}`}>{t.direction}</td>
                  <td className="px-4 py-3 font-mono text-zinc-300">{t.entry_price.toLocaleString()}</td>
                  <td className="px-4 py-3 font-mono text-zinc-400">{t.exit_price?.toLocaleString() ?? '—'}</td>
                  <td className="px-4 py-3 text-zinc-400">{t.size}</td>
                  <td className={`px-4 py-3 font-mono font-medium ${(t.pnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {t.pnl != null ? `${(t.pnl >= 0 ? '+' : '')}${t.pnl.toFixed(2)}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{t.r_multiple != null ? `${t.r_multiple.toFixed(2)}R` : '—'}</td>
                  <td className="px-4 py-3 text-zinc-500 text-xs">{t.setup_type ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      t.status === 'open' ? 'bg-emerald-900/50 text-emerald-400' :
                      t.status === 'closed' ? 'bg-zinc-700 text-zinc-400' :
                      'bg-amber-900/50 text-amber-400'
                    }`}>{t.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'stats' && stats && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Win Rate', value: stats.winRate != null ? `${stats.winRate.toFixed(1)}%` : '—' },
              { label: 'Avg R-Multiple', value: stats.avgR != null ? `${stats.avgR.toFixed(2)}R` : '—' },
              { label: 'Profit Factor', value: stats.profitFactor != null ? stats.profitFactor.toFixed(2) : '—' },
              { label: 'Total PnL', value: stats.totalPnl !== 0 ? `${stats.totalPnl >= 0 ? '+' : ''}${stats.totalPnl.toFixed(2)}` : '—' },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                <div className="text-xs text-zinc-500 mb-1">{label}</div>
                <div className="text-xl font-bold text-zinc-100">{value}</div>
              </div>
            ))}
          </div>

          {stats.pnlCurve.length > 1 && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <div className="text-sm font-medium text-zinc-400 mb-3">PnL Curve</div>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={stats.pnlCurve}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="timestamp" hide />
                  <YAxis stroke="#71717a" tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', fontSize: 12 }}
                    formatter={(v: number) => [v.toFixed(2), 'Cumulative PnL']}
                  />
                  <Line type="monotone" dataKey="pnl" stroke="#6366f1" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
