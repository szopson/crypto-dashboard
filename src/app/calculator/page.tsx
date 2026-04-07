'use client';

import { useState, useMemo } from 'react';
import Header from '@/components/Header';

const ASSETS = {
  BTC: { label: 'Bitcoin', ticker: 'BTC', conservative: 0.37, avg: 0.74, optimistic: 1.11 },
  ETH: { label: 'Ethereum', ticker: 'ETH', conservative: 0.25, avg: 0.50, optimistic: 0.75 },
  SOL: { label: 'Solana', ticker: 'SOL', conservative: 0.30, avg: 0.60, optimistic: 0.90 },
  BNB: { label: 'BNB', ticker: 'BNB', conservative: 0.20, avg: 0.40, optimistic: 0.60 },
  XRP: { label: 'XRP', ticker: 'XRP', conservative: 0.15, avg: 0.30, optimistic: 0.45 },
} as const;

type AssetKey = keyof typeof ASSETS;
type Scenario = 'conservative' | 'avg' | 'optimistic';
type Horizon = 1 | 5 | 10;

const SCENARIOS: { key: Scenario; label: string }[] = [
  { key: 'conservative', label: 'Conservative' },
  { key: 'avg', label: 'Historical Avg' },
  { key: 'optimistic', label: 'Optimistic' },
];

const HORIZONS: Horizon[] = [1, 5, 10];

interface YearRow {
  year: number;
  portfolioValue: number;
  annualGain: number;
  cumulativeGain: number;
}

function formatUSD(value: number): string {
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPct(value: number): string {
  return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}%`;
}

export default function CalculatorPage() {
  const [asset, setAsset] = useState<AssetKey>('BTC');
  const [investmentInput, setInvestmentInput] = useState('1000');
  const [horizon, setHorizon] = useState<Horizon>(5);
  const [scenario, setScenario] = useState<Scenario>('avg');

  const investment = useMemo(() => {
    const v = parseFloat(investmentInput.replace(/[^0-9.]/g, ''));
    return isNaN(v) || v <= 0 ? 0 : v;
  }, [investmentInput]);

  const cagr = ASSETS[asset][scenario];

  const yearRows: YearRow[] = useMemo(() => {
    if (investment <= 0) return [];
    const rows: YearRow[] = [];
    for (let y = 1; y <= horizon; y++) {
      const portfolioValue = investment * Math.pow(1 + cagr, y);
      const prevValue = investment * Math.pow(1 + cagr, y - 1);
      const annualGain = portfolioValue - prevValue;
      const cumulativeGain = portfolioValue - investment;
      rows.push({ year: y, portfolioValue, annualGain, cumulativeGain });
    }
    return rows;
  }, [investment, cagr, horizon]);

  const finalValue = yearRows[yearRows.length - 1]?.portfolioValue ?? 0;
  const totalGain = finalValue - investment;
  const roi = investment > 0 ? totalGain / investment : 0;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      <Header />

      <main className="max-w-screen-xl mx-auto px-6 py-8 space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-zinc-100">Portfolio Growth Calculator</h2>
          <p className="text-zinc-500 text-sm mt-1">
            Project crypto portfolio growth based on historical average returns across 3 scenarios.
          </p>
        </div>

        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Asset Selector */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
            <div className="text-xs text-zinc-500 uppercase tracking-wide mb-3">Asset</div>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(ASSETS) as AssetKey[]).map((key) => (
                <button
                  key={key}
                  onClick={() => setAsset(key)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    asset === key
                      ? 'bg-zinc-100 text-zinc-950'
                      : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  }`}
                >
                  {key}
                </button>
              ))}
            </div>
          </div>

          {/* Investment Input */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
            <label className="block text-xs text-zinc-500 uppercase tracking-wide mb-3">
              Starting Investment (USD)
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={investmentInput}
              onChange={(e) => setInvestmentInput(e.target.value)}
              placeholder="e.g. 1000"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
            />
          </div>

          {/* Time Horizon */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
            <div className="text-xs text-zinc-500 uppercase tracking-wide mb-3">Time Horizon</div>
            <div className="flex gap-2">
              {HORIZONS.map((h) => (
                <button
                  key={h}
                  onClick={() => setHorizon(h)}
                  className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                    horizon === h
                      ? 'bg-zinc-100 text-zinc-950'
                      : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  }`}
                >
                  {h} yr{h > 1 ? 's' : ''}
                </button>
              ))}
            </div>
          </div>

          {/* Scenario */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
            <div className="text-xs text-zinc-500 uppercase tracking-wide mb-3">Scenario</div>
            <div className="flex gap-2">
              {SCENARIOS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setScenario(key)}
                  className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                    scenario === key
                      ? 'bg-zinc-100 text-zinc-950'
                      : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results Panel */}
        {investment > 0 ? (
          <>
            <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-6">
              <div className="text-xs text-zinc-500 uppercase tracking-wide mb-4">
                Projection: {ASSETS[asset].label} · {SCENARIOS.find(s => s.key === scenario)?.label} · {horizon} year{horizon > 1 ? 's' : ''}
                <span className="ml-2 text-zinc-600">({(cagr * 100).toFixed(0)}% CAGR)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div>
                  <div className="text-xs text-zinc-500 mb-1">Final Value</div>
                  <div className="text-3xl font-bold text-green-400">{formatUSD(finalValue)}</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500 mb-1">Total Gain</div>
                  <div className="text-3xl font-bold text-green-400">{formatUSD(totalGain)}</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500 mb-1">ROI</div>
                  <div className="text-3xl font-bold text-green-400">{formatPct(roi)}</div>
                </div>
              </div>
            </div>

            {/* Year-by-Year Table */}
            <div>
              <h3 className="text-sm font-semibold text-zinc-300 mb-3">Year-by-Year Breakdown</h3>
              <div className="rounded-lg border border-zinc-800 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-900 text-zinc-400 text-xs uppercase tracking-wide">
                      <th className="px-4 py-3 text-left">Year</th>
                      <th className="px-4 py-3 text-right">Portfolio Value</th>
                      <th className="px-4 py-3 text-right">Annual Gain</th>
                      <th className="px-4 py-3 text-right">Cumulative Gain</th>
                    </tr>
                  </thead>
                  <tbody>
                    {yearRows.map((row) => (
                      <tr
                        key={row.year}
                        className="border-b border-zinc-800 last:border-0 bg-zinc-950 hover:bg-zinc-900 transition-colors"
                      >
                        <td className="px-4 py-3 text-zinc-400 tabular-nums">Year {row.year}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-zinc-100 font-medium">
                          {formatUSD(row.portfolioValue)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-green-400">
                          +{formatUSD(row.annualGain)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-green-400">
                          +{formatUSD(row.cumulativeGain)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-500 text-sm">
            Enter a starting investment amount to see projections.
          </div>
        )}

        {/* CAGR Reference Table */}
        <div>
          <h3 className="text-sm font-semibold text-zinc-300 mb-3">Historical CAGR Reference</h3>
          <div className="rounded-lg border border-zinc-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900 text-zinc-400 text-xs uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">Asset</th>
                  <th className="px-4 py-3 text-right">Conservative</th>
                  <th className="px-4 py-3 text-right">Historical Avg</th>
                  <th className="px-4 py-3 text-right">Optimistic</th>
                </tr>
              </thead>
              <tbody>
                {(Object.entries(ASSETS) as [AssetKey, typeof ASSETS[AssetKey]][]).map(([key, data]) => (
                  <tr
                    key={key}
                    className={`border-b border-zinc-800 last:border-0 transition-colors ${
                      asset === key ? 'bg-zinc-800/50' : 'bg-zinc-950 hover:bg-zinc-900'
                    }`}
                  >
                    <td className="px-4 py-3 font-medium text-zinc-100">
                      {key} <span className="text-zinc-500 font-normal text-xs">{data.label}</span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-300">
                      ~{(data.conservative * 100).toFixed(0)}%
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-300">
                      ~{(data.avg * 100).toFixed(0)}%
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-300">
                      ~{(data.optimistic * 100).toFixed(0)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Disclaimer */}
        <p className="text-xs text-zinc-600 text-center pb-4">
          Projections based on historical averages and are for educational purposes only. Past performance does not guarantee future results. Not financial advice.
        </p>
      </main>
    </div>
  );
}
