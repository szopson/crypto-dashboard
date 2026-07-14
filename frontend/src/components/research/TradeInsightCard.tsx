"use client";

/**
 * Pure renderer for one AI Insight (meta-review) — used for both a freshly
 * generated insight and history entries. Mirrors the scorecard's visual
 * language: process-first, evidence-cited, never directional.
 */
import { TrendingUp, TrendingDown, Minus, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { TradeInsight } from "@/lib/trade-insights";

const TREND_META: Record<
  TradeInsight["progress"]["trend"],
  { label: string; className: string; Icon: typeof TrendingUp }
> = {
  improving: {
    label: "Improving",
    className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    Icon: TrendingUp,
  },
  flat: {
    label: "Flat",
    className: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    Icon: Minus,
  },
  declining: {
    label: "Declining",
    className: "bg-red-500/15 text-red-600 dark:text-red-400",
    Icon: TrendingDown,
  },
};

const SEVERITY_CLASS: Record<string, string> = {
  minor: "border-zinc-400/40 text-zinc-500 dark:text-zinc-400",
  costly: "border-amber-500/40 text-amber-600 dark:text-amber-400",
  critical: "border-red-500/40 text-red-600 dark:text-red-400",
};

const DIRECTION_GLYPH: Record<string, string> = {
  better: "▲",
  same: "•",
  worse: "▼",
};

const DIRECTION_CLASS: Record<string, string> = {
  better: "text-emerald-500",
  same: "text-muted-foreground",
  worse: "text-red-500",
};

export function TradeInsightCard({
  insight,
  meta,
}: {
  insight: TradeInsight;
  meta?: string;
}) {
  const trend = TREND_META[insight.progress.trend];

  return (
    <div className="space-y-4">
      {/* Headline + trend */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <CardTitle className="text-base leading-snug">{insight.headline}</CardTitle>
            <span
              className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${trend.className}`}
            >
              <trend.Icon className="size-3.5" />
              {trend.label}
            </span>
          </div>
          {meta && <p className="text-xs text-muted-foreground">{meta}</p>}
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold tabular-nums">
              {insight.avg_process_score}
            </span>
            <span className="text-sm text-muted-foreground">
              / 100 avg process across {insight.trades_analyzed} trade
              {insight.trades_analyzed === 1 ? "" : "s"}
            </span>
          </div>
          {insight.progress.vs_previous_insight && (
            <p className="mt-2 text-sm text-muted-foreground">
              {insight.progress.vs_previous_insight}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Well / wrong */}
      <div className="grid gap-4 md:grid-cols-2">
        {insight.what_went_well.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-emerald-500">What went well</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5 text-sm list-disc pl-4">
                {insight.what_went_well.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
        {insight.what_went_wrong.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-amber-500">What went wrong</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5 text-sm list-disc pl-4">
                {insight.what_went_wrong.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Recurring patterns */}
      {insight.recurring_patterns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recurring patterns</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {insight.recurring_patterns.map((p, i) => (
              <div key={i} className="text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{p.pattern}</span>
                  <Badge
                    variant="outline"
                    className={`px-1.5 py-0 text-[10px] uppercase ${SEVERITY_CLASS[p.severity] ?? ""}`}
                  >
                    {p.severity}
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{p.evidence}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Dimension progress */}
      {insight.progress.dimension_notes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Process dimensions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {insight.progress.dimension_notes.map((d) => (
              <div key={d.key} className="flex items-start gap-2 text-sm">
                <span className={`w-4 shrink-0 text-center ${DIRECTION_CLASS[d.direction]}`}>
                  {DIRECTION_GLYPH[d.direction]}
                </span>
                <div className="min-w-0">
                  <span className="font-medium">{d.key.replace(/_/g, " ")}</span>
                  <span className="text-muted-foreground"> — {d.note}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Strategy adjustments (process-level only) */}
      {insight.strategy_adjustments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Strategy adjustments</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2.5 text-sm">
              {insight.strategy_adjustments.map((a, i) => (
                <li key={i}>
                  <p className="font-medium">{a.adjustment}</p>
                  <p className="text-xs text-muted-foreground">{a.rationale}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Focus next */}
      {insight.focus_next && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="size-4" /> Focus next
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{insight.focus_next}</p>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        This is a retrospective process review, not a signal or a buy/sell
        recommendation.
      </p>
    </div>
  );
}
