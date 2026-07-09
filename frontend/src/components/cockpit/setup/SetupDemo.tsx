"use client";

/**
 * SetupDemo — the logged-out state of the AI Trade Setup panel.
 *
 * Renders a static example setup blurred and non-interactive, with a
 * sign-in CTA overlay. The example is representative output, clearly not
 * live data (the overlay makes that unambiguous).
 */
import { Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import type { TradeSetup } from "@/lib/setup-schema";
import { SetupCard } from "./SetupCard";

const DEMO_SETUP: TradeSetup = {
  coin: "BTC",
  bias: "bearish",
  tldr: "Positioning is structurally long-heavy; the $61K–$62K long-liq band is the line in the sand — a break triggers cascading forced selling.",
  priceLine: "$62,885 (1h HL perp) — grinding lower from the $64K rejection, probing the upper edge of the heaviest long-liq cluster.",
  watchLine: "A reclaim above $63K relieves downside pressure; failure to hold $61K–$61.5K opens the flush path toward $60K.",
  signals: [
    { name: "Price (1h HL)", value: "$62,885", read: "Below 1h VWAP, trending down", bias: "bearish" },
    { name: "OI", value: "$6.24B", read: "Near top of 7d range — crowded", bias: "elevated" },
    { name: "Funding (1h)", value: "+0.0058%", read: "25th percentile — low, not frothy", bias: "neutral" },
    { name: "Liq imbalance (est.)", value: "4.6x long", read: "est. $8.6B long-liq vs $1.9B short-liq nearby", bias: "bearish" },
  ],
  catalysts: [
    "Clear rejection from the $64K–$64.7K zone with a volume spike on the selloff to $61.7K — distribution pattern.",
    "Funding flat — no cost to hold shorts, no squeeze premium for longs.",
  ],
  story:
    "BTC put in a local top near $64.7K and has been decaying since. The liquidation map is the key structural read: est. $3.4B of long-liq sits at $61.1K–$61.5K. With imbalance heavily favoring longs, those clusters are the tripwire.",
  keyLevels: [
    { level: "$63,000–$63,550", type: "Short-liq zone (est. $1.1B)", note: "Reclaim = squeeze trigger toward $64K+" },
    { level: "$62,885", type: "Spot (1h)", note: "Below the overhead liq wall" },
    { level: "$61,087–$61,548", type: "Long-liq cluster (est. $3.4B)", note: "Line in the sand; break = cascade toward $60K" },
  ],
  bottomLine:
    "No clean long setup here — wait for either a flush into the $60K–$61K zone with reversal confirmation, or a strong reclaim of $63K+ before considering a long.",
  nextSteps: {
    derivatives: "Monitor if funding flips negative as a sign of long capitulation.",
    technical: "Watch for a reclaim above $63K for a short-squeeze setup.",
    setup: "Evaluate a long only if BTC flushes into $60K–$61K and shows a reversal candle.",
  },
};

export function SetupDemo() {
  const { signInWithGoogle } = useAuth();

  return (
    <div className="relative">
      <div aria-hidden className="pointer-events-none select-none blur-sm">
        <SetupCard setup={DEMO_SETUP} />
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="mx-4 flex max-w-sm flex-col items-center gap-3 rounded-xl border border-zinc-200 bg-white/95 p-5 text-center shadow-lg dark:border-zinc-800 dark:bg-zinc-950/95">
          <span className="rounded-md bg-indigo-500/15 p-2 text-indigo-700 dark:text-indigo-300">
            <Lock className="h-5 w-5" />
          </span>
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Sign in to generate live setups
          </p>
          <p className="text-xs text-zinc-500">
            Structured trade setups from live Hyperliquid funding, OI and liquidation data —
            free, 10 per day.
          </p>
          <button
            type="button"
            onClick={() => signInWithGoogle()}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
          >
            Continue with Google
          </button>
        </div>
      </div>
    </div>
  );
}
