'use client';

import { useState } from 'react';
import { CoinData } from '@/types';

interface GlobalStats {
  totalMarketCap: string;
  totalVolume: string;
  btcDominance: string;
  ethDominance: string;
}

interface Analysis {
  btcCyclePosition: {
    phase: string;
    confidence: string;
    summary: string;
  };
  marketSentiment: {
    overall: string;
    signals: string[];
  };
  topOpportunities: {
    coin: string;
    reason: string;
  }[];
  riskSummary: {
    level: string;
    factors: string[];
  };
  quickTake: string;
}

interface Props {
  coins: CoinData[];
  globalStats: GlobalStats;
}

const sentimentColor: Record<string, string> = {
  'Extreme Fear': 'text-red-500',
  Fear: 'text-orange-400',
  Neutral: 'text-zinc-300',
  Greed: 'text-emerald-400',
  'Extreme Greed': 'text-green-400',
};

const riskColor: Record<string, string> = {
  Low: 'text-emerald-400',
  Moderate: 'text-yellow-400',
  High: 'text-orange-400',
  Extreme: 'text-red-500',
};

const phaseColor: Record<string, string> = {
  Accumulation: 'text-blue-400',
  'Early Bull': 'text-emerald-400',
  'Bull Run': 'text-green-400',
  'Late Bull': 'text-yellow-400',
  Distribution: 'text-orange-400',
  'Bear Market': 'text-red-400',
};

export default function AIAnalysisButton({ coins, globalStats }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runAnalysis() {
    setLoading(true);
    setError(null);
    setAnalysis(null);
    setOpen(true);

    try {
      const res = await fetch('/api/ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coins, globalStats }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error ?? 'Analysis failed');
      } else {
        setAnalysis(data.analysis);
      }
    } catch {
      setError('Failed to connect to analysis service');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={runAnalysis}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-sm font-medium transition-colors"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="w-4 h-4"
        >
          <path d="M10 1a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 1ZM5.05 3.05a.75.75 0 0 1 1.06 0l1.062 1.06A.75.75 0 1 1 6.11 5.173L5.05 4.11a.75.75 0 0 1 0-1.06ZM14.95 3.05a.75.75 0 0 1 0 1.06l-1.061 1.062a.75.75 0 0 1-1.062-1.061l1.061-1.061a.75.75 0 0 1 1.062 0ZM3 9.25a.75.75 0 0 0 0 1.5h1.5a.75.75 0 0 0 0-1.5H3ZM15.5 9.25a.75.75 0 0 0 0 1.5H17a.75.75 0 0 0 0-1.5h-1.5ZM5.05 14.95a.75.75 0 0 0 1.062-1.06l-1.061-1.062a.75.75 0 0 0-1.062 1.061l1.061 1.061ZM13.888 13.89a.75.75 0 0 0-1.06 1.06l1.06 1.062a.75.75 0 0 0 1.062-1.061l-1.062-1.061ZM10 15a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 15ZM10 6.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" />
        </svg>
        AI Analysis
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => setOpen(false)}
          />

          {/* Modal */}
          <div className="relative z-10 w-full max-w-2xl rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
              <div className="flex items-center gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-5 h-5 text-indigo-400"
                >
                  <path d="M10 1a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 1ZM5.05 3.05a.75.75 0 0 1 1.06 0l1.062 1.06A.75.75 0 1 1 6.11 5.173L5.05 4.11a.75.75 0 0 1 0-1.06ZM14.95 3.05a.75.75 0 0 1 0 1.06l-1.061 1.062a.75.75 0 0 1-1.062-1.061l1.061-1.061a.75.75 0 0 1 1.062 0ZM3 9.25a.75.75 0 0 0 0 1.5h1.5a.75.75 0 0 0 0-1.5H3ZM15.5 9.25a.75.75 0 0 0 0 1.5H17a.75.75 0 0 0 0-1.5h-1.5ZM5.05 14.95a.75.75 0 0 0 1.062-1.06l-1.061-1.062a.75.75 0 0 0-1.062 1.061l1.061 1.061ZM13.888 13.89a.75.75 0 0 0-1.06 1.06l1.06 1.062a.75.75 0 0 0 1.062-1.061l-1.062-1.061ZM10 15a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 15ZM10 6.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" />
                </svg>
                <h2 className="text-base font-semibold text-zinc-100">
                  AI Market Analysis
                </h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-5 h-5"
                >
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              {loading && (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-zinc-400 text-sm">
                    Analyzing live market data...
                  </p>
                </div>
              )}

              {error && (
                <div className="rounded-lg border border-red-800 bg-red-950/50 p-4">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              {analysis && (
                <div className="space-y-5">
                  {/* Quick Take */}
                  <div className="rounded-lg border border-indigo-800/50 bg-indigo-950/30 p-4">
                    <p className="text-zinc-200 text-sm leading-relaxed">
                      {analysis.quickTake}
                    </p>
                  </div>

                  {/* 3-column grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* BTC Cycle */}
                    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                      <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">
                        BTC Cycle
                      </p>
                      <p
                        className={`text-base font-semibold ${phaseColor[analysis.btcCyclePosition.phase] ?? 'text-zinc-100'}`}
                      >
                        {analysis.btcCyclePosition.phase}
                      </p>
                      <p className="text-xs text-zinc-500 mt-1">
                        Confidence:{' '}
                        <span className="text-zinc-400">
                          {analysis.btcCyclePosition.confidence}
                        </span>
                      </p>
                      <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                        {analysis.btcCyclePosition.summary}
                      </p>
                    </div>

                    {/* Market Sentiment */}
                    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                      <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">
                        Sentiment
                      </p>
                      <p
                        className={`text-base font-semibold ${sentimentColor[analysis.marketSentiment.overall] ?? 'text-zinc-100'}`}
                      >
                        {analysis.marketSentiment.overall}
                      </p>
                      <ul className="mt-2 space-y-1">
                        {analysis.marketSentiment.signals.map((s, i) => (
                          <li key={i} className="text-xs text-zinc-400 flex gap-1.5">
                            <span className="text-zinc-600 shrink-0">•</span>
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Risk */}
                    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                      <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">
                        Risk Level
                      </p>
                      <p
                        className={`text-base font-semibold ${riskColor[analysis.riskSummary.level] ?? 'text-zinc-100'}`}
                      >
                        {analysis.riskSummary.level}
                      </p>
                      <ul className="mt-2 space-y-1">
                        {analysis.riskSummary.factors.map((f, i) => (
                          <li key={i} className="text-xs text-zinc-400 flex gap-1.5">
                            <span className="text-zinc-600 shrink-0">•</span>
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Top Opportunities */}
                  {analysis.topOpportunities.length > 0 && (
                    <div>
                      <p className="text-xs text-zinc-500 uppercase tracking-wide mb-3">
                        Notable Opportunities
                      </p>
                      <div className="space-y-2">
                        {analysis.topOpportunities.map((op, i) => (
                          <div
                            key={i}
                            className="flex items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3"
                          >
                            <span className="shrink-0 rounded bg-zinc-800 px-2 py-0.5 text-xs font-mono text-zinc-300">
                              {op.coin}
                            </span>
                            <p className="text-xs text-zinc-400 leading-relaxed">
                              {op.reason}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-zinc-600 text-center">
                    Analysis generated from live market data · Not financial advice
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
