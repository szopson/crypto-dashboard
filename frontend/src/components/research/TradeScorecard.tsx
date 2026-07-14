"use client";

/**
 * Renders a trade-review scorecard. Deliberately foregrounds the process-vs-outcome
 * split: the big number is decision quality, the outcome is a small separate chip —
 * that's the whole "process, not outcome" point.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { TradeScorecard as Scorecard } from "@/lib/trade-review";

function scoreColor(score: number): string {
  if (score >= 75)
    return "text-emerald-500 drop-shadow-[0_0_14px_oklch(0.765_0.177_163_/_45%)]";
  if (score >= 50)
    return "text-amber-500 drop-shadow-[0_0_14px_oklch(0.769_0.188_70_/_45%)]";
  return "text-red-500 drop-shadow-[0_0_14px_oklch(0.645_0.246_16_/_45%)]";
}

function dimBar(score: number): string {
  if (score >= 4) return "bg-emerald-500";
  if (score >= 3) return "bg-amber-500";
  return "bg-red-500";
}

const OUTCOME_LABEL: Record<Scorecard["outcome"], string> = {
  win: "Outcome: win",
  loss: "Outcome: loss",
  open: "Outcome: open position",
  unclear: "Outcome: unclear",
};

const DIRECTION_LABEL: Record<Scorecard["detected_direction"], string> = {
  long: "LONG",
  short: "SHORT",
  unclear: "direction ?",
};

export function TradeScorecard({ data }: { data: Scorecard }) {
  return (
    <div className="space-y-4">
      {/* Header: process score (hero) + outcome (small, separate) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              {data.detected_symbol && (
                <Badge variant="secondary" className="font-mono">
                  {data.detected_symbol}
                </Badge>
              )}
              <Badge variant="outline">
                {DIRECTION_LABEL[data.detected_direction]}
              </Badge>
              {data.detected_timeframe && (
                <Badge variant="outline">{data.detected_timeframe}</Badge>
              )}
            </div>
            <Badge
              variant={
                data.outcome === "loss" ? "destructive" : "secondary"
              }
            >
              {OUTCOME_LABEL[data.outcome]}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-3">
            <span
              className={`text-5xl font-bold tabular-nums ${scoreColor(
                data.process_score,
              )}`}
            >
              {data.process_score}
            </span>
            <span className="text-muted-foreground text-sm">
              / 100 — decision quality (independent of outcome)
            </span>
          </div>
          {data.outcome_note && (
            <p className="mt-2 text-sm text-muted-foreground">
              {data.outcome_note}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Dimensions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Process dimensions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.dimensions.map((d) => (
            <div key={d.key}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{d.label}</span>
                <span className="tabular-nums text-muted-foreground">
                  {d.score}/5
                </span>
              </div>
              <Progress
                value={(d.score / 5) * 100}
                className="h-1.5 mt-1"
                indicatorClassName={dimBar(d.score)}
              />
              {d.verdict && (
                <p className="mt-1 text-xs text-muted-foreground">{d.verdict}</p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Strengths / fixes */}
      <div className="grid gap-4 md:grid-cols-2">
        {data.what_went_well.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-emerald-500">
                What went well
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5 text-sm list-disc pl-4">
                {data.what_went_well.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
        {data.what_to_improve.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-amber-500">
                What to improve
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5 text-sm list-disc pl-4">
                {data.what_to_improve.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Market context (Coinglass moat) */}
      {data.market_context_note && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Market context (Coinglass)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {data.market_context_note}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Key lesson */}
      {data.key_lesson && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-base">Key lesson</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{data.key_lesson}</p>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        This is a retrospective decision review, not a signal or a buy/sell
        recommendation. We grade the process, not the outcome.
      </p>
    </div>
  );
}
