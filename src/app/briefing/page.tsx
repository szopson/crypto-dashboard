'use client';

import { useState, useEffect } from 'react';

interface Briefing {
  id: number;
  date: string;
  content: string;
  created_at: number;
}

export default function BriefingPage() {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/briefing/generate')
      .then((r) => r.json())
      .then((d) => setBriefing(d.briefing))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const generateBriefing = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/briefing/generate', { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      setBriefing({ id: 0, date: d.date, content: d.content, created_at: Date.now() / 1000 });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <main className="max-w-screen-lg mx-auto px-6 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-100">Daily Market Briefing</h1>
          <p className="text-zinc-500 text-sm mt-1">
            AI-generated morning report summarizing market conditions, key levels, and session focus.
          </p>
        </div>
        <button
          onClick={generateBriefing}
          disabled={generating}
          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-medium transition-colors whitespace-nowrap"
        >
          {generating ? 'Generating…' : '⚡ Generate Today'}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-800/50 bg-red-900/20 p-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {loading && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 animate-pulse">
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-4 bg-zinc-800 rounded" />
            ))}
          </div>
        </div>
      )}

      {!loading && !briefing && !error && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center">
          <p className="text-zinc-500 text-sm">No briefing for today yet.</p>
          <p className="text-zinc-600 text-xs mt-1">
            Click "Generate Today" or configure the n8n daily workflow.
          </p>
        </div>
      )}

      {briefing && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-800">
            <span className="text-zinc-400 text-sm font-mono">{briefing.date}</span>
            <span className="text-zinc-600 text-xs">
              Generated {new Date(briefing.created_at * 1000).toLocaleTimeString()}
            </span>
          </div>
          <div className="prose prose-invert prose-sm max-w-none">
            <pre className="whitespace-pre-wrap font-sans text-zinc-300 text-sm leading-relaxed">
              {briefing.content}
            </pre>
          </div>
        </div>
      )}
    </main>
  );
}
