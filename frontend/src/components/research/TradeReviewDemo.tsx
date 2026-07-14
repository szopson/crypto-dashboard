"use client";

/**
 * TradeReviewDemo — the logged-out state of the trade-review page.
 *
 * Renders a static example scorecard blurred and non-interactive, with a
 * sign-in CTA overlay (same pattern as cockpit/setup/SetupDemo). The example
 * is representative output, clearly not the visitor's own trade.
 */
import { Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import type { TradeScorecard as Scorecard } from "@/lib/trade-review";
import { TradeScorecard } from "./TradeScorecard";

const DEMO_SCORECARD: Scorecard = {
  detected_symbol: "BTCUSDT",
  detected_direction: "long",
  detected_timeframe: "15m",
  process_score: 62,
  outcome: "loss",
  outcome_note:
    "Solid thesis and a defined stop, but the entry chased an extended move — a losing trade with a mostly sound process.",
  dimensions: [
    {
      key: "thesis_clarity",
      label: "Thesis clarity",
      score: 4,
      verdict: "clear sweep-and-reclaim idea marked on the chart",
    },
    {
      key: "risk_definition",
      label: "Risk definition",
      score: 4,
      verdict: "stop-loss visible below the reclaimed level",
    },
    {
      key: "reward_risk",
      label: "Reward / risk",
      score: 3,
      verdict: "~1.8R to the first target — acceptable, not great",
    },
    {
      key: "htf_alignment",
      label: "HTF alignment",
      score: 2,
      verdict: "counter-trend vs the 4H structure",
    },
    {
      key: "entry_execution",
      label: "Entry execution",
      score: 2,
      verdict: "entered late, mid-impulse instead of at the level",
    },
    {
      key: "discipline",
      label: "Discipline",
      score: 4,
      verdict: "size and stop respected; no revenge add",
    },
  ],
  what_went_well: [
    "Risk was bounded before entry — the stop was placed, not improvised.",
    "Position size stayed consistent with the plan.",
  ],
  what_to_improve: [
    "Wait for the retest instead of chasing the breakout candle.",
    "Check the 4H trend before taking counter-trend 15m entries.",
  ],
  key_lesson:
    "A defined stop saved this trade from being a disaster — but entry patience would have made it a better decision regardless of outcome.",
  market_context_note:
    "Funding was in its 80th 7-day percentile with crowded longs — a long entry here fought the positioning backdrop.",
};

export function TradeReviewDemo() {
  const { signInWithGoogle } = useAuth();

  return (
    <div className="relative">
      <div aria-hidden className="pointer-events-none select-none blur-sm">
        <TradeScorecard data={DEMO_SCORECARD} />
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="mx-4 flex max-w-sm flex-col items-center gap-3 rounded-xl border border-zinc-200 bg-white/95 p-5 text-center shadow-lg dark:border-zinc-800 dark:bg-zinc-950/95">
          <span className="rounded-md bg-indigo-500/15 p-2 text-indigo-700 dark:text-indigo-300">
            <Lock className="h-5 w-5" />
          </span>
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Sign in to review your trades
          </p>
          <p className="text-xs text-zinc-500">
            Upload a screenshot, get a decision-quality scorecard enriched with live
            derivatives context — free, 5 reviews per day.
          </p>
          <button
            type="button"
            onClick={() => signInWithGoogle("/app/trade-review")}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
          >
            Continue with Google
          </button>
        </div>
      </div>
    </div>
  );
}
