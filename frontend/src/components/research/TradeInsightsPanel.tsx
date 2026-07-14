"use client";

/**
 * AI Insights panel — sits in the journal area of /app/trade-review.
 *
 * Lets the user run a meta-review over their last 3/5/10 trades or last 7
 * days (min 3 saved reviews; 2 runs/day, enforced server-side). Shows the
 * fresh insight plus a collapsible history of past insights.
 */
import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Loader2, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { listTradeReviews } from "@/lib/trade-journal";
import {
  listInsights,
  deleteInsight,
  InsightsNotProvisionedError,
  type SavedInsight,
} from "@/lib/insight-journal";
import type { TradeInsight } from "@/lib/trade-insights";
import { TradeInsightCard } from "./TradeInsightCard";

type PeriodChoice = "3" | "5" | "10" | "7d";

const PERIOD_OPTIONS: { value: PeriodChoice; label: string }[] = [
  { value: "3", label: "Last 3 trades" },
  { value: "5", label: "Last 5" },
  { value: "10", label: "Last 10" },
  { value: "7d", label: "Last 7 days" },
];

function periodBody(choice: PeriodChoice) {
  return choice === "7d"
    ? { period_kind: "last_7d" as const }
    : { period_kind: "last_n" as const, n: Number(choice) as 3 | 5 | 10 };
}

function insightMeta(row: SavedInsight): string {
  const period =
    row.period_kind === "last_7d" ? "last 7 days" : `last ${row.period_n} trades`;
  const date = new Date(row.created_at).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  return `${period} · ${date}`;
}

export function TradeInsightsPanel({ refreshKey = 0 }: { refreshKey?: number }) {
  const { session } = useAuth();
  const [period, setPeriod] = useState<PeriodChoice>("3");
  const [reviewCount, setReviewCount] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [fresh, setFresh] = useState<{ insight: TradeInsight; meta: string } | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [history, setHistory] = useState<SavedInsight[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [openHistoryId, setOpenHistoryId] = useState<string | null>(null);
  const [notProvisioned, setNotProvisioned] = useState(false);

  useEffect(() => {
    if (!generating) return;
    setElapsed(0);
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [generating]);

  const load = useCallback(async () => {
    try {
      const reviews = await listTradeReviews(3);
      setReviewCount(reviews.length);
    } catch {
      setReviewCount(0);
    }
    try {
      setHistory(await listInsights(20));
      setNotProvisioned(false);
    } catch (e) {
      if (e instanceof InsightsNotProvisionedError) setNotProvisioned(true);
      setHistory([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const generate = async () => {
    if (!session?.access_token || generating) return;
    setGenerating(true);
    setError(null);
    setFresh(null);
    try {
      const res = await fetch("/api/trade-review/insights", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(periodBody(period)),
      });
      const json = await res.json();
      if (res.status === 401) {
        throw new Error("Your session expired — sign in again to generate insights.");
      }
      if (!res.ok) throw new Error(json.error || "Insight generation failed.");
      const label =
        period === "7d"
          ? `last 7 days · ${json.trades_analyzed} trades`
          : `last ${json.trades_analyzed} trades`;
      setFresh({ insight: json.insight as TradeInsight, meta: label });
      if (typeof json.remaining_insights === "number") {
        setRemaining(json.remaining_insights);
      }
      load(); // refresh history with the persisted row
    } catch (e) {
      setError(e instanceof Error ? e.message : "Insight generation failed.");
    } finally {
      setGenerating(false);
    }
  };

  const onDelete = async (id: string) => {
    setHistory((prev) => prev.filter((h) => h.id !== id));
    try {
      await deleteInsight(id);
    } catch {
      load(); // resync on failure
    }
  };

  const tooFewReviews = reviewCount != null && reviewCount < 3;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4" /> AI Insights
          </CardTitle>
          {remaining != null && (
            <span className="text-xs text-muted-foreground">
              {remaining} run{remaining === 1 ? "" : "s"} left today
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          A meta-review of your recent trades: what went well, what keeps
          repeating, and how your process is trending. Never a trade signal.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setPeriod(opt.value)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                period === opt.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-muted/40"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <Button
          onClick={generate}
          disabled={generating || tooFewReviews || reviewCount == null}
          className="w-full"
        >
          {generating ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Generating insights… {elapsed}s
            </>
          ) : (
            <>
              <Sparkles className="size-4" /> Generate insights
            </>
          )}
        </Button>
        {tooFewReviews && (
          <p className="-mt-2 text-center text-xs text-muted-foreground">
            Save at least 3 trade reviews to unlock insights
            {reviewCount != null ? ` (${reviewCount}/3 so far)` : ""}.
          </p>
        )}
        {notProvisioned && (
          <p className="-mt-2 text-center text-xs text-muted-foreground">
            Insights history is not set up yet (apply{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-[10px]">
              supabase/migrations/0004_trade_review_insights.sql
            </code>
            ).
          </p>
        )}

        {error && (
          <p className="text-sm text-red-500" role="alert">
            {error}
          </p>
        )}

        {fresh && <TradeInsightCard insight={fresh.insight} meta={fresh.meta} />}

        {history.length > 0 && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setHistoryOpen((o) => !o)}
              className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {historyOpen ? (
                <ChevronDown className="size-4" />
              ) : (
                <ChevronRight className="size-4" />
              )}
              Past insights ({history.length})
            </button>
            {historyOpen && (
              <ul className="divide-y divide-border">
                {history.map((row) => (
                  <li key={row.id} className="py-2">
                    <div className="flex items-center gap-3 text-sm">
                      <button
                        type="button"
                        onClick={() =>
                          setOpenHistoryId((id) => (id === row.id ? null : row.id))
                        }
                        className="min-w-0 flex-1 truncate text-left hover:text-foreground text-muted-foreground transition-colors"
                      >
                        {row.insight.headline}
                      </button>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {insightMeta(row)}
                      </span>
                      <button
                        type="button"
                        onClick={() => onDelete(row.id)}
                        className="shrink-0 text-muted-foreground hover:text-red-500"
                        aria-label="Delete insight"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                    {openHistoryId === row.id && (
                      <div className="mt-3">
                        <TradeInsightCard insight={row.insight} meta={insightMeta(row)} />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
