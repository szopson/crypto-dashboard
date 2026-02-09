"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSymbol, formatSymbol } from "@/contexts/SymbolContext";
import type { BiasTimeframe, BiasType, RadarData } from "@/lib/types";

interface KeyLevel {
  price: number;
  type: string;
  timeframe: string;
  description: string;
}

interface BiasGridProps {
  biases: Record<string, BiasTimeframe>;
  radars?: Record<string, RadarData>;
  currentPrice: number;
  overallBias: BiasType;
  keyLevels?: KeyLevel[];
}

const TIMEFRAMES = ["1H", "4H", "1D", "3D", "1W", "1M"] as const;

function getBiasColor(bias: BiasType): string {
  switch (bias) {
    case "BULLISH":
      return "text-green-500";
    case "BEARISH":
      return "text-red-500";
    default:
      return "text-yellow-500";
  }
}

function getBiasBgColor(bias: BiasType): string {
  switch (bias) {
    case "BULLISH":
      return "bg-green-500/10";
    case "BEARISH":
      return "bg-red-500/10";
    default:
      return "bg-yellow-500/10";
  }
}

function getRadarColor(classification: string): string {
  switch (classification) {
    case "ACCUMULATE":
      return "text-green-500";
    case "SELL_THE_RALLY":
      return "text-red-500";
    default:
      return "text-yellow-500";
  }
}

export function BiasGrid({
  biases,
  radars,
  currentPrice,
  overallBias,
  keyLevels = [],
}: BiasGridProps) {
  const { symbol } = useSymbol();

  return (
    <TooltipProvider>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle>Bias Grid - {formatSymbol(symbol)}</CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold">
                ${currentPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
              <Badge className={getBiasBgColor(overallBias)}>
                <span className={getBiasColor(overallBias)}>{overallBias}</span>
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">TF</TableHead>
                <TableHead>Structure</TableHead>
                <TableHead className="text-center">RADAR</TableHead>
                <TableHead className="text-right">SS Level</TableHead>
                <TableHead className="text-right">Distance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {TIMEFRAMES.map((tf) => {
                const bias = biases[tf];
                const radar = radars?.[tf];

                if (!bias) return null;

                return (
                  <TableRow key={tf} className={getBiasBgColor(bias.structural_bias)}>
                    <TableCell className="font-medium">{tf}</TableCell>
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex flex-col cursor-help">
                            <span className={`font-semibold ${getBiasColor(bias.structural_bias)}`}>
                              {bias.structural_bias}
                            </span>
                            {bias.swing_structure && (
                              <span className="text-xs text-muted-foreground">
                                {bias.swing_structure}
                              </span>
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="font-mono text-xs">
                          <div className="space-y-1">
                            {bias.last_swing_high && (
                              <p>Swing High: ${bias.last_swing_high.toLocaleString()}</p>
                            )}
                            {bias.last_swing_low && (
                              <p>Swing Low: ${bias.last_swing_low.toLocaleString()}</p>
                            )}
                            {bias.confidence && (
                              <p>Confidence: {bias.confidence}</p>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="text-center">
                      {radar ? (
                        <Badge variant="outline" className={getRadarColor(radar.classification)}>
                          {radar.score.toFixed(1)}/6
                        </Badge>
                      ) : bias.radar_score !== null && bias.radar_score !== undefined ? (
                        <span>{bias.radar_score.toFixed(1)}/6</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {bias.secondary_swing_level ? (
                        <span>
                          ${bias.secondary_swing_level.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {bias.ss_distance_pct !== null && bias.ss_distance_pct !== undefined ? (
                        <span
                          className={
                            bias.ss_distance_pct < 0
                              ? "text-red-500"
                              : bias.ss_distance_pct < 2
                              ? "text-yellow-500"
                              : "text-green-500"
                          }
                        >
                          {bias.ss_distance_pct > 0 ? "+" : ""}
                          {bias.ss_distance_pct.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {/* Key Levels Section */}
          {keyLevels.length > 0 && (
            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold mb-2">Key Levels</h4>
              <div className="grid grid-cols-2 gap-2">
                {keyLevels.slice(0, 4).map((level, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between bg-muted/50 rounded px-2 py-1 text-sm"
                  >
                    <span className="text-muted-foreground">
                      {level.timeframe} {level.type.replace("SS_", "")}
                    </span>
                    <span className="font-mono">
                      ${level.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
