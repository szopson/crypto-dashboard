"use client";

/**
 * OpportunityCard — one "what to watch" card in the Today's Watch section.
 *
 * Client component: expand/collapse is tracked in PostHog (attention step of
 * the card → context → affiliate_click funnel) and the ExchangeCTA at the
 * bottom is the conversion point. Cards describe unusual derivatives
 * configurations — never trade directions; see docs/research/OPPORTUNITY_ENGINE.md.
 */
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { analytics } from "@/components/PostHogProvider";
import { ExchangeCTA } from "./ExchangeCTA";

export interface OpportunityCardData {
  symbol: string;
  score: number;
  direction_pressure: "bullish" | "bearish" | "neutral";
  headline: string;
  why: string[];
  risks: string[];
}

const PRESSURE_DOT: Record<OpportunityCardData["direction_pressure"], string> = {
  bullish: "bg-emerald-500",
  bearish: "bg-rose-500",
  neutral: "bg-zinc-400",
};

function scoreChipClasses(score: number): string {
  if (score >= 70) return "bg-rose-500/15 text-rose-700 dark:text-rose-300";
  if (score >= 40) return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
  return "bg-zinc-500/15 text-zinc-600 dark:text-zinc-300";
}

export function OpportunityCard({
  card,
  defaultExpanded = false,
}: {
  card: OpportunityCardData;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const toggle = () => {
    if (!expanded) {
      analytics.trackOpportunityCardExpand({ symbol: card.symbol, score: card.score });
    }
    setExpanded((v) => !v);
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/40">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center justify-between gap-3 p-3 text-left"
        aria-expanded={expanded}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={`inline-block h-2 w-2 flex-shrink-0 rounded-full ${PRESSURE_DOT[card.direction_pressure]}`}
          />
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {card.symbol}
          </span>
          <span className="truncate text-sm font-semibold">{card.headline}</span>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <span
            className={`rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ${scoreChipClasses(card.score)}`}
          >
            {card.score}
          </span>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-zinc-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-zinc-400" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-zinc-100 p-3 dark:border-zinc-800">
          {card.why.length > 0 && (
            <ul className="space-y-1">
              {card.why.map((line, i) => (
                <li key={i} className="flex gap-2 text-xs text-zinc-700 dark:text-zinc-300">
                  <span className="text-emerald-600 dark:text-emerald-400">✓</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          )}
          {card.risks.length > 0 && (
            <ul className="space-y-1">
              {card.risks.map((line, i) => (
                <li key={i} className="flex gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                  <span className="text-rose-600 dark:text-rose-400">×</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          )}
          <ExchangeCTA symbol={card.symbol} surface="opportunity_card" compact />
          <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
            Data snapshot, not investment advice.
          </p>
        </div>
      )}
    </div>
  );
}
