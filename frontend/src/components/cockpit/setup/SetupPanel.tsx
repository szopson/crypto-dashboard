"use client";

/**
 * SetupPanel — the AI Trade Setup panel on /cockpit.
 *
 * Orchestrates the feature: coin selector (BTC/ETH/SOL), auth-gated
 * generation against /api/ai-setup/generate, the rendered SetupCard, and the
 * follow-up SetupChat. Logged-out visitors get the blurred SetupDemo with a
 * sign-in CTA. Fetches nothing at render, so the cockpit page stays ISR.
 */
import { useState } from "react";
import { Crosshair, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import type { SetupCoin, TradeSetup } from "@/lib/setup-schema";
import { SETUP_COINS } from "@/lib/setup-schema";
import { SetupCard } from "./SetupCard";
import { SetupChat } from "./SetupChat";
import { SetupDemo } from "./SetupDemo";

interface GenerateResponse {
  setup?: TradeSetup;
  generated_at?: string;
  remaining_generations?: number;
  error?: string;
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-5 w-3/4 rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="h-4 w-1/2 rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="space-y-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-4 rounded bg-zinc-200 dark:bg-zinc-800" />
        ))}
      </div>
      <div className="h-16 rounded bg-zinc-200 dark:bg-zinc-800" />
      <p className="text-xs text-zinc-500">Reading funding, OI and the liquidation map…</p>
    </div>
  );
}

export function SetupPanel() {
  const { user, session } = useAuth();
  const [coin, setCoin] = useState<SetupCoin>("BTC");
  const [setup, setSetup] = useState<TradeSetup | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<{ text: string; nonce: number } | null>(null);

  const selectCoin = (c: SetupCoin) => {
    if (c === coin) return;
    // Setup + chat context is per-coin; switching clears both.
    setCoin(c);
    setSetup(null);
    setGeneratedAt(null);
    setError(null);
    setPrefill(null);
  };

  const generate = async () => {
    if (loading || !session?.access_token) return;
    setLoading(true);
    setError(null);
    setPrefill(null);

    try {
      const response = await fetch("/api/ai-setup/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ coin }),
      });
      const data = (await response.json().catch(() => ({}))) as GenerateResponse;

      if (!response.ok || !data.setup) {
        setError(
          data.error ??
            (response.status === 429
              ? "Daily limit reached — resets 00:00 UTC."
              : "Generation failed. Try again."),
        );
        if (response.status === 429) setRemaining(0);
        return;
      }

      setSetup(data.setup);
      setGeneratedAt(data.generated_at ?? null);
      setRemaining(data.remaining_generations ?? null);
    } catch {
      setError("Generation failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mb-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-indigo-500/15 p-1.5 text-indigo-700 dark:text-indigo-300">
            <Crosshair className="h-4 w-4" />
          </span>
          <span className="text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
            AI Trade Setup
          </span>
          <span className="hidden text-xs text-zinc-500 sm:inline">
            Hyperliquid · est. liq map
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-zinc-200 p-0.5 dark:border-zinc-800">
            {SETUP_COINS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => selectCoin(c)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  c === coin
                    ? "bg-indigo-600 text-white"
                    : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          {user && (
            <button
              type="button"
              onClick={generate}
              disabled={loading || remaining === 0}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-colors enabled:hover:bg-indigo-500 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              {setup ? "Regenerate" : "Generate setup"}
            </button>
          )}
        </div>
      </div>

      {!user ? (
        <SetupDemo />
      ) : loading ? (
        <LoadingSkeleton />
      ) : setup ? (
        <>
          <SetupCard
            setup={setup}
            onNextStepClick={(text) => setPrefill({ text, nonce: Date.now() })}
          />
          <SetupChat coin={coin} setup={setup} prefill={prefill} />
        </>
      ) : (
        <p className="py-6 text-center text-sm text-zinc-500">
          Generate a structured {coin} setup from live funding, open interest and the estimated
          liquidation map.
        </p>
      )}

      {error && (
        <p className="mt-3 rounded-lg bg-rose-500/10 p-2 text-xs text-rose-600 dark:text-rose-400">
          {error}
        </p>
      )}

      {user && (generatedAt || remaining != null) && !loading && (
        <p className="mt-3 text-[10px] text-zinc-400 dark:text-zinc-500">
          {generatedAt && `Generated ${new Date(generatedAt).toLocaleTimeString()}`}
          {generatedAt && remaining != null && " · "}
          {remaining != null && `${remaining} generations left today`}
        </p>
      )}
    </section>
  );
}
