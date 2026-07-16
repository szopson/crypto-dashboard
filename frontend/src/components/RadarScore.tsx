"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { RadarData } from "@/lib/types";

interface RadarScoreProps {
  radar: RadarData;
  showDetails?: boolean;
}

// UI relabel of the engine's internal regime enums: the raw names read as
// trade instructions ("ACCUMULATE", "SELL_THE_RALLY") — MiCA/KNF requires
// descriptive market-condition language. Engine values stay unchanged.
const CLASSIFICATION_LABEL: Record<string, string> = {
  ACCUMULATE: "Accumulation regime",
  NEUTRAL: "Neutral regime",
  SELL_THE_RALLY: "Distribution regime",
};

export function RadarScore({ radar, showDetails = false }: RadarScoreProps) {
  const colorMap: Record<string, string> = {
    green: "bg-green-500",
    yellow: "bg-yellow-500",
    red: "bg-red-500",
  };

  const textColorMap: Record<string, string> = {
    green: "text-green-500",
    yellow: "text-yellow-500",
    red: "text-red-500",
  };

  const bgColor = colorMap[radar.color] || "bg-gray-500";
  const textColor = textColorMap[radar.color] || "text-gray-500";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span>RADAR {radar.timeframe}</span>
          <Badge variant="outline" className={textColor}>
            {CLASSIFICATION_LABEL[radar.classification] ?? radar.classification}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          {/* Score circle */}
          <div
            className={`w-16 h-16 rounded-full ${bgColor} flex items-center justify-center text-white font-bold text-xl`}
          >
            {radar.score.toFixed(1)}
          </div>

          {/* Score bar */}
          <div className="flex-1">
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full ${bgColor} transition-all duration-500`}
                style={{ width: `${(radar.score / 6) * 100}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {radar.score} / {radar.max_score}
            </p>
          </div>
        </div>

        {/* Components */}
        {radar.components.length > 0 && (
          <div className="mt-3">
            <p className="text-xs text-muted-foreground mb-1">
              Contributing factors:
            </p>
            <div className="flex flex-wrap gap-1">
              {radar.components.map((comp, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {comp}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Detailed metrics */}
        {showDetails && radar.metrics && (
          <div className="mt-4 space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-muted-foreground">BBWP:</span>{" "}
                <span className={radar.metrics.bbwp.signal === "BULLISH" ? "text-green-500" : "text-red-500"}>
                  {radar.metrics.bbwp.bbwp?.toFixed(1)}%
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Gaussian:</span>{" "}
                <span className={radar.metrics.gaussian.signal === "BULLISH" ? "text-green-500" : "text-red-500"}>
                  {radar.metrics.gaussian.position_pct?.toFixed(1)}%
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">WVF:</span>{" "}
                <span>{radar.metrics.wvf.wvf?.toFixed(1)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Funding:</span>{" "}
                <span>{radar.metrics.funding.funding_rate?.toFixed(4)}%</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
