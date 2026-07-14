"use client";

/**
 * Trade journal — the persistence/accountability view under the trade review.
 *
 * Lists a user's saved trade-review scorecards and charts their process score
 * over time. The point is the trend, not any single trade: is decision quality
 * improving? (Process, not outcome — same ethos as the analyzer.)
 */
import { useCallback, useEffect, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Trash2, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  listTradeReviews,
  deleteTradeReview,
  averageProcessScore,
  JournalNotProvisionedError,
  type SavedTradeReview,
} from "@/lib/trade-journal";

function scoreColor(score: number | null): string {
  if (score == null) return "text-muted-foreground";
  if (score >= 75) return "text-emerald-500";
  if (score >= 50) return "text-amber-500";
  return "text-red-500";
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export function TradeReviewJournal({ refreshKey = 0 }: { refreshKey?: number }) {
  const [reviews, setReviews] = useState<SavedTradeReview[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notProvisioned, setNotProvisioned] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setReviews(await listTradeReviews(50));
    } catch (e) {
      if (e instanceof JournalNotProvisionedError) {
        setNotProvisioned(true);
        setReviews([]);
      } else {
        setError(e instanceof Error ? e.message : "Failed to load the journal.");
        setReviews([]);
      }
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const onDelete = async (id: string) => {
    setReviews((prev) => prev?.filter((r) => r.id !== id) ?? null);
    try {
      await deleteTradeReview(id);
    } catch {
      load(); // resync on failure
    }
  };

  if (reviews === null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your trade journal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-2/3" />
        </CardContent>
      </Card>
    );
  }

  if (notProvisioned) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your trade journal</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            The journal is not set up yet. Apply the{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
              supabase/migrations/0001_trade_reviews.sql
            </code>{" "}
            migration in Supabase (SQL Editor) to save reviews.
          </p>
        </CardContent>
      </Card>
    );
  }

  const avg = averageProcessScore(reviews);
  // Chronological (oldest → newest) for the trend line.
  const trend = [...reviews]
    .reverse()
    .filter((r) => typeof r.process_score === "number")
    .map((r, i) => ({
      i,
      score: r.process_score as number,
      label: `${r.symbol || "?"} · ${fmtDate(r.created_at)}`,
    }));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">Your trade journal</CardTitle>
          {avg != null && (
            <Badge variant="secondary" className="gap-1">
              <TrendingUp className="size-3.5" />
              avg process {avg}/100
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <p className="text-sm text-red-500">{error}</p>}

        {reviews.length === 0 && !error && (
          <p className="text-sm text-muted-foreground">
            No saved reviews yet. Review a trade above and click &ldquo;Save to
            journal&rdquo; to track your decision quality over time.
          </p>
        )}

        {trend.length >= 2 && (
          <div className="h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
                <XAxis dataKey="i" hide />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} width={32} />
                <Tooltip
                  contentStyle={{ fontSize: 12 }}
                  labelFormatter={(_, p) => p?.[0]?.payload?.label ?? ""}
                  formatter={(v) => [`${v}/100`, "process"]}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {reviews.length > 0 && (
          <ul className="divide-y divide-border">
            {reviews.map((r) => (
              <li key={r.id} className="flex items-center gap-3 py-2 text-sm">
                <span
                  className={`w-10 shrink-0 text-right font-bold tabular-nums ${scoreColor(
                    r.process_score,
                  )}`}
                >
                  {r.process_score ?? "—"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {r.symbol && (
                      <span className="font-mono text-xs">{r.symbol}</span>
                    )}
                    {r.direction && r.direction !== "unclear" && (
                      <Badge variant="outline" className="px-1.5 py-0 text-[10px] uppercase">
                        {r.direction}
                      </Badge>
                    )}
                    {r.outcome && r.outcome !== "unclear" && (
                      <span className="text-xs text-muted-foreground">{r.outcome}</span>
                    )}
                  </div>
                </div>
                <time className="shrink-0 text-xs text-muted-foreground">
                  {fmtDate(r.created_at)}
                </time>
                <button
                  onClick={() => onDelete(r.id)}
                  className="shrink-0 text-muted-foreground hover:text-red-500"
                  aria-label="Delete entry"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
