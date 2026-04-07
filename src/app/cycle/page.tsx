'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/Header';

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';
const LS_KEY_200WMA = 'follio_cycle_200wma';
const LS_KEY_NUPL = 'follio_cycle_nupl';
const LS_KEY_LOG = 'follio_cycle_log';

interface LogEntry {
  timestamp: string;
  wma200: number;
  nupl: number;
}

interface Zone {
  name: string;
  wmaMin: number | null;
  wmaMax: number | null;
  nuplMin: number | null;
  nuplMax: number | null;
  color: string;
  bgColor: string;
  borderColor: string;
  wmaLabel: string;
  nuplLabel: string;
}

const ZONES: Zone[] = [
  {
    name: 'Accumulation',
    wmaMin: null,
    wmaMax: 1.0,
    nuplMin: null,
    nuplMax: 0,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
    wmaLabel: '< 1.0×',
    nuplLabel: '< 0',
  },
  {
    name: 'Value Window',
    wmaMin: 1.0,
    wmaMax: 1.5,
    nuplMin: 0,
    nuplMax: 0.25,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-400/10',
    borderColor: 'border-emerald-400/30',
    wmaLabel: '1.0× – 1.5×',
    nuplLabel: '0 – 0.25',
  },
  {
    name: 'Neutral',
    wmaMin: 1.5,
    wmaMax: 2.5,
    nuplMin: 0.25,
    nuplMax: 0.5,
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-400/10',
    borderColor: 'border-yellow-400/30',
    wmaLabel: '1.5× – 2.5×',
    nuplLabel: '0.25 – 0.5',
  },
  {
    name: 'Caution',
    wmaMin: 2.5,
    wmaMax: 3.5,
    nuplMin: 0.5,
    nuplMax: 0.75,
    color: 'text-orange-400',
    bgColor: 'bg-orange-400/10',
    borderColor: 'border-orange-400/30',
    wmaLabel: '2.5× – 3.5×',
    nuplLabel: '0.5 – 0.75',
  },
  {
    name: 'Euphoria',
    wmaMin: 3.5,
    wmaMax: null,
    nuplMin: 0.75,
    nuplMax: null,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    wmaLabel: '> 3.5×',
    nuplLabel: '> 0.75',
  },
];

function classifyZone(wmaMultiple: number | null): Zone {
  if (wmaMultiple === null) return ZONES[2]; // default Neutral
  if (wmaMultiple < 1.0) return ZONES[0];
  if (wmaMultiple < 1.5) return ZONES[1];
  if (wmaMultiple < 2.5) return ZONES[2];
  if (wmaMultiple < 3.5) return ZONES[3];
  return ZONES[4];
}

function formatCurrency(value: number): string {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function CyclePage() {
  const [btcPrice, setBtcPrice] = useState<number | null>(null);
  const [priceError, setPriceError] = useState(false);
  const [wma200Input, setWma200Input] = useState('');
  const [nuplInput, setNuplInput] = useState('');
  const [wma200, setWma200] = useState<number | null>(null);
  const [nupl, setNupl] = useState<number | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);

  // Load persisted values on mount
  useEffect(() => {
    const savedWma = localStorage.getItem(LS_KEY_200WMA);
    const savedNupl = localStorage.getItem(LS_KEY_NUPL);
    const savedLog = localStorage.getItem(LS_KEY_LOG);
    if (savedWma) {
      const v = parseFloat(savedWma);
      if (!isNaN(v)) {
        setWma200(v);
        setWma200Input(savedWma);
      }
    }
    if (savedNupl) {
      const v = parseFloat(savedNupl);
      if (!isNaN(v)) {
        setNupl(v);
        setNuplInput(savedNupl);
      }
    }
    if (savedLog) {
      try {
        setLog(JSON.parse(savedLog));
      } catch {
        // ignore
      }
    }
  }, []);

  // Fetch BTC price
  const fetchBtcPrice = useCallback(async () => {
    try {
      const res = await fetch(
        `${COINGECKO_BASE}/simple/price?ids=bitcoin&vs_currencies=usd`
      );
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setBtcPrice(data.bitcoin?.usd ?? null);
      setPriceError(false);
    } catch {
      setPriceError(true);
    }
  }, []);

  useEffect(() => {
    fetchBtcPrice();
    const interval = setInterval(fetchBtcPrice, 60_000);
    return () => clearInterval(interval);
  }, [fetchBtcPrice]);

  const wmaMultiple =
    btcPrice !== null && wma200 !== null && wma200 > 0
      ? btcPrice / wma200
      : null;

  const distancePct =
    wmaMultiple !== null ? (wmaMultiple - 1) * 100 : null;

  const currentZone = classifyZone(wmaMultiple);

  function handleUpdate() {
    const parsedWma = parseFloat(wma200Input);
    const parsedNupl = parseFloat(nuplInput);
    if (isNaN(parsedWma) || parsedWma <= 0) return;
    if (isNaN(parsedNupl)) return;

    setWma200(parsedWma);
    setNupl(parsedNupl);
    localStorage.setItem(LS_KEY_200WMA, String(parsedWma));
    localStorage.setItem(LS_KEY_NUPL, String(parsedNupl));

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      wma200: parsedWma,
      nupl: parsedNupl,
    };
    const updated = [entry, ...log].slice(0, 5);
    setLog(updated);
    localStorage.setItem(LS_KEY_LOG, JSON.stringify(updated));
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      <Header />

      <main className="max-w-screen-xl mx-auto px-6 py-8 space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-zinc-100">BTC Macro Cycle Dashboard</h2>
          <p className="text-zinc-500 text-sm mt-1">
            Combines BTC price vs 200-Week Moving Average with NUPL to estimate market cycle zone.
          </p>
        </div>

        {/* Zone Banner */}
        <div
          className={`rounded-xl border px-8 py-6 flex flex-col items-center justify-center text-center ${currentZone.bgColor} ${currentZone.borderColor}`}
        >
          <span className="text-xs uppercase tracking-widest text-zinc-400 mb-2">Current Zone</span>
          <span className={`text-4xl font-bold ${currentZone.color}`}>
            {currentZone.name}
          </span>
          {wmaMultiple !== null && (
            <span className="text-zinc-400 text-sm mt-2">
              {wmaMultiple.toFixed(2)}× 200WMA
              {nupl !== null && ` · NUPL ${nupl.toFixed(3)}`}
            </span>
          )}
          {wmaMultiple === null && (
            <span className="text-zinc-500 text-sm mt-2">Enter 200WMA below to classify</span>
          )}
        </div>

        {/* Metric Panels */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <div className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Live BTC Price</div>
            <div className="text-xl font-semibold text-zinc-100">
              {priceError ? (
                <span className="text-zinc-500 text-sm">Unavailable</span>
              ) : btcPrice !== null ? (
                formatCurrency(btcPrice)
              ) : (
                <span className="text-zinc-500 text-sm">Loading…</span>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <div className="text-xs text-zinc-500 uppercase tracking-wide mb-1">200-Week MA</div>
            <div className="text-xl font-semibold text-zinc-100">
              {wma200 !== null ? formatCurrency(wma200) : <span className="text-zinc-500 text-sm">Not set</span>}
            </div>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <div className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Distance to 200WMA</div>
            <div
              className={`text-xl font-semibold ${
                distancePct === null
                  ? 'text-zinc-500'
                  : distancePct >= 0
                  ? 'text-green-400'
                  : 'text-red-400'
              }`}
            >
              {distancePct !== null ? (
                `${distancePct >= 0 ? '+' : ''}${distancePct.toFixed(1)}%`
              ) : (
                <span className="text-sm">—</span>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <div className="text-xs text-zinc-500 uppercase tracking-wide mb-1">NUPL</div>
            <div className="text-xl font-semibold text-zinc-100">
              {nupl !== null ? nupl.toFixed(3) : <span className="text-zinc-500 text-sm">Not set</span>}
            </div>
          </div>
        </div>

        {/* Manual Input Form */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
          <h3 className="text-sm font-semibold text-zinc-300 mb-1">Update Signals</h3>
          <p className="text-xs text-zinc-500 mb-4">
            Source 200WMA from TradingView (BTC/USD weekly chart). Source NUPL from Glassnode or CryptoQuant.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-xs text-zinc-500 mb-1">200-Week Moving Average (USD)</label>
              <input
                type="number"
                value={wma200Input}
                onChange={(e) => setWma200Input(e.target.value)}
                placeholder="e.g. 40000"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-zinc-500 mb-1">NUPL (−1 to 1)</label>
              <input
                type="number"
                step="0.001"
                value={nuplInput}
                onChange={(e) => setNuplInput(e.target.value)}
                placeholder="e.g. 0.45"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleUpdate}
                className="w-full sm:w-auto bg-zinc-700 hover:bg-zinc-600 text-zinc-100 text-sm font-medium px-6 py-2 rounded-md transition-colors"
              >
                Update
              </button>
            </div>
          </div>
        </div>

        {/* Zone Map */}
        <div>
          <h3 className="text-sm font-semibold text-zinc-300 mb-3">Zone Map</h3>
          <div className="rounded-lg border border-zinc-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900 text-zinc-400 text-xs uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">Zone</th>
                  <th className="px-4 py-3 text-left">200WMA Multiple</th>
                  <th className="px-4 py-3 text-left">NUPL Range</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {ZONES.map((zone) => {
                  const isActive = zone.name === currentZone.name && wmaMultiple !== null;
                  return (
                    <tr
                      key={zone.name}
                      className={`border-b border-zinc-800 last:border-0 transition-colors ${
                        isActive ? zone.bgColor : 'bg-zinc-950'
                      }`}
                    >
                      <td className={`px-4 py-3 font-medium ${zone.color}`}>{zone.name}</td>
                      <td className="px-4 py-3 text-zinc-300 tabular-nums">{zone.wmaLabel}</td>
                      <td className="px-4 py-3 text-zinc-300 tabular-nums">{zone.nuplLabel}</td>
                      <td className="px-4 py-3">
                        {isActive ? (
                          <span className={`text-xs font-semibold ${zone.color}`}>▶ Active</span>
                        ) : (
                          <span className="text-xs text-zinc-600">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Alert Log */}
        <div>
          <h3 className="text-sm font-semibold text-zinc-300 mb-3">Alert Log</h3>
          {log.length === 0 ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6 text-center text-zinc-500 text-sm">
              No updates yet. Enter values above and click Update.
            </div>
          ) : (
            <div className="rounded-lg border border-zinc-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900 text-zinc-400 text-xs uppercase tracking-wide">
                    <th className="px-4 py-3 text-left">Timestamp</th>
                    <th className="px-4 py-3 text-right">200WMA</th>
                    <th className="px-4 py-3 text-right">NUPL</th>
                  </tr>
                </thead>
                <tbody>
                  {log.map((entry, i) => (
                    <tr
                      key={i}
                      className="border-b border-zinc-800 last:border-0 bg-zinc-950 hover:bg-zinc-900 transition-colors"
                    >
                      <td className="px-4 py-3 text-zinc-400 tabular-nums">
                        {new Date(entry.timestamp).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-zinc-100">
                        {formatCurrency(entry.wma200)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-zinc-100">
                        {entry.nupl.toFixed(3)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Disclaimer */}
        <p className="text-xs text-zinc-600 text-center pb-4">
          Educational only. Not financial advice. Past cycle patterns do not guarantee future results.
        </p>
      </main>
    </div>
  );
}
