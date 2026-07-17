"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSymbol } from "@/contexts/SymbolContext";

// 30-day RADAR score history from the engine's hourly snapshot job. The
// table starts empty by construction, so "collecting" is a designed state,
// not a broken one.
const MIN_POINTS_FOR_CHART = 10;

interface HistoryPoint {
  timestamp: string;
  score: number;
  classification: string;
}

export function RadarSparkline({ timeframe = "1D" }: { timeframe?: string }) {
  const { symbol } = useSymbol();
  const [points, setPoints] = useState<HistoryPoint[] | null>(null);

  const fetchHistory = useCallback(async () => {
    try {
      const params = new URLSearchParams({ symbol, timeframe, days: "30" });
      const res = await fetch(`/api/radar/history?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      setPoints(Array.isArray(data.points) ? data.points : []);
    } catch {
      // History is a nice-to-have — fail silently, card shows collecting state.
    }
  }, [symbol, timeframe]);

  useEffect(() => {
    setPoints(null);
    fetchHistory();
  }, [fetchHistory]);

  if (points === null) return null;

  const width = 600;
  const height = 60;
  const maxScore = 6;

  let svgPath = "";
  if (points.length >= MIN_POINTS_FOR_CHART) {
    const xs = (i: number) => (i / (points.length - 1)) * width;
    const ys = (score: number) => height - (score / maxScore) * height;
    svgPath = points
      .map((p, i) => `${i === 0 ? "M" : "L"}${xs(i).toFixed(1)},${ys(p.score).toFixed(1)}`)
      .join(" ");
  }

  const latest = points[points.length - 1];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">
          RADAR {timeframe} — 30-day history
        </CardTitle>
      </CardHeader>
      <CardContent>
        {points.length >= MIN_POINTS_FOR_CHART ? (
          <div>
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="w-full h-16"
              preserveAspectRatio="none"
              role="img"
              aria-label={`RADAR ${timeframe} score history`}
            >
              {/* Regime bands: 5-6 accumulation, 3-4 neutral, 0-2 distribution */}
              <rect x="0" y="0" width={width} height={height / 6} className="fill-emerald-500/10" />
              <rect x="0" y={height / 2} width={width} height={height / 2} className="fill-red-500/10" />
              <path
                d={svgPath}
                fill="none"
                strokeWidth="2"
                className="stroke-primary"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            <p className="text-xs text-muted-foreground mt-1">
              {points.length} hourly snapshots · latest {latest.score.toFixed(1)}/6
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-3">
            Collecting history — {points.length} snapshot
            {points.length === 1 ? "" : "s"} so far. The chart appears after ~
            {MIN_POINTS_FOR_CHART} hourly snapshots.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
