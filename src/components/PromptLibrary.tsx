'use client';

import { useState } from 'react';
import { PROMPT_CATEGORY_LABEL, RESEARCH_PROMPTS, ResearchPrompt } from '@/lib/prompts/research';

interface Props {
  onSelect: (prompt: string) => void;
}

const CATEGORY_COLORS: Record<ResearchPrompt['category'], string> = {
  risk: 'bg-rose-900/40 text-rose-300 border-rose-800',
  positioning: 'bg-indigo-900/40 text-indigo-300 border-indigo-800',
  macro: 'bg-amber-900/40 text-amber-300 border-amber-800',
  income: 'bg-emerald-900/40 text-emerald-300 border-emerald-800',
  speculation: 'bg-fuchsia-900/40 text-fuchsia-300 border-fuchsia-800',
  sentiment: 'bg-sky-900/40 text-sky-300 border-sky-800',
};

export default function PromptLibrary({ onSelect }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-zinc-800 rounded-xl bg-zinc-900/60">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left text-sm text-zinc-300 hover:text-zinc-100 transition-colors"
      >
        <span className="flex items-center gap-2">
          <span className="text-zinc-500">▸</span>
          <span className="font-medium">Research prompt library</span>
          <span className="text-xs text-zinc-500">({RESEARCH_PROMPTS.length})</span>
        </span>
        <span className="text-xs text-zinc-500">{open ? 'Hide' : 'Show'}</span>
      </button>
      {open && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 border-t border-zinc-800">
          {RESEARCH_PROMPTS.map((p) => (
            <button
              key={p.id}
              onClick={() => onSelect(p.prompt)}
              className="text-left rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800/80 hover:border-zinc-700 p-3 transition-colors group"
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="text-sm font-medium text-zinc-100 group-hover:text-white">
                  {p.title}
                </span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded border uppercase tracking-wide ${CATEGORY_COLORS[p.category]}`}
                >
                  {PROMPT_CATEGORY_LABEL[p.category]}
                </span>
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed">{p.summary}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
