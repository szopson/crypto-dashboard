"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/toast";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useSymbol, formatSymbol } from "@/contexts/SymbolContext";

interface ConfluenceComponent {
  name: string;
  points: number;
  max: number;
  note: string;
}

interface TradeSetup {
  direction: "LONG" | "SHORT";
  entry_zone_type: string;
  entry_zone: { high: number; low: number };
  entry_price: number;
  stop_loss: number;
  take_profits: { tp1: number; tp2: number; tp3: number };
  risk_reward: number;
  confluence_score: number;
  position_size_pct: number;
  timeframe: string;
  notes: string[];
}

interface SniperData {
  timestamp: string;
  current_price: number;
  confluence: {
    score: number;
    max_score: number;
    signal: string;
    recommendation: string;
    components: ConfluenceComponent[];
  };
  setups: TradeSetup[];
  radar_score?: number;
  radar_classification?: string;
}

interface SniperAnalysisProps {
  refreshInterval?: number;
}

export function SniperAnalysis({ refreshInterval = 60000 }: SniperAnalysisProps) {
  const { symbol } = useSymbol();
  const [data, setData] = useState<SniperData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToast();

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams({ symbol });
      const response = await fetch(`/api/sniper/analyze?${params}`);
      if (!response.ok) {
        throw new Error("Failed to fetch SNIPER analysis");
      }
      const result = await response.json();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    setLoading(true);
    fetchData();
    const interval = setInterval(fetchData, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchData, refreshInterval]);

  const getSignalColor = (signal: string) => {
    if (signal.includes("LONG")) return "text-green-500";
    if (signal.includes("SHORT")) return "text-red-500";
    return "text-yellow-500";
  };

  const getSignalBgColor = (signal: string) => {
    if (signal.includes("LONG")) return "bg-green-500/20";
    if (signal.includes("SHORT")) return "bg-red-500/20";
    return "bg-yellow-500/20";
  };

  const formatPrice = (price: number) => {
    return price.toLocaleString(undefined, { maximumFractionDigits: 0 });
  };

  const copySetupToClipboard = (setup: TradeSetup) => {
    const text = `${setup.direction} ${setup.timeframe} Setup
Entry Zone: $${formatPrice(setup.entry_zone.low)} - $${formatPrice(setup.entry_zone.high)}
Stop Loss: $${formatPrice(setup.stop_loss)}
TP1: $${formatPrice(setup.take_profits.tp1)}
TP2: $${formatPrice(setup.take_profits.tp2)}
TP3: $${formatPrice(setup.take_profits.tp3)}
R:R: ${setup.risk_reward.toFixed(1)}
Position Size: ${setup.position_size_pct}%
Confluence: ${setup.confluence_score.toFixed(1)}/6
${setup.notes.length > 0 ? `Notes: ${setup.notes.join(", ")}` : ""}`;

    navigator.clipboard.writeText(text).then(() => {
      addToast("Setup copied to clipboard", "success");
    }).catch(() => {
      addToast("Failed to copy", "error");
    });
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>SNIPER - {formatSymbol(symbol)}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Analyzing market conditions...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>SNIPER - {formatSymbol(symbol)}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-destructive mb-4">{error || "No data"}</p>
            <Button onClick={fetchData}>Retry</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const confluencePercent = (data.confluence.score / data.confluence.max_score) * 100;

  return (
    <div className="space-y-4">
      {/* Confluence Score */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle>SNIPER - {formatSymbol(symbol)}</CardTitle>
            <Badge className={getSignalBgColor(data.confluence.signal)}>
              <span className={getSignalColor(data.confluence.signal)}>
                {data.confluence.signal.replace("_", " ")}
              </span>
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Score display */}
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium">Confluence Score</span>
              <span className="text-sm font-bold">
                {data.confluence.score.toFixed(1)} / {data.confluence.max_score}
              </span>
            </div>
            <Progress value={confluencePercent} className="h-3" />
          </div>

          {/* Engine `recommendation` deliberately not rendered: it contains
              sizing advice ("consider full size") — MiCA/KNF. The full
              Confluence Check reframe replaces this component next. */}

          {/* Components breakdown */}
          <Accordion type="single" collapsible>
            <AccordionItem value="components">
              <AccordionTrigger className="text-sm">
                Score Breakdown
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  {data.confluence.components.map((comp, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {comp.name.replace("_", " ")}
                      </span>
                      <div className="text-right">
                        <span className="font-mono">
                          {comp.points.toFixed(1)}/{comp.max.toFixed(1)}
                        </span>
                        <p className="text-xs text-muted-foreground">
                          {comp.note}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* Trade Setups */}
      {data.setups.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Trade Setups</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.setups.map((setup, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-lg border ${
                    setup.direction === "LONG"
                      ? "border-green-500/30 bg-green-500/5"
                      : "border-red-500/30 bg-red-500/5"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <Badge
                      className={
                        setup.direction === "LONG"
                          ? "bg-green-500/20 text-green-500"
                          : "bg-red-500/20 text-red-500"
                      }
                    >
                      {setup.direction} {setup.timeframe}
                    </Badge>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {setup.entry_zone_type.replace("_", " ")}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => copySetupToClipboard(setup)}
                      >
                        Copy
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Entry Zone</p>
                      <p className="font-mono">
                        ${formatPrice(setup.entry_zone.low)} - ${formatPrice(setup.entry_zone.high)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Stop Loss</p>
                      <p className="font-mono text-red-500">
                        ${formatPrice(setup.stop_loss)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Take Profits</p>
                      <p className="font-mono text-green-500">
                        TP1: ${formatPrice(setup.take_profits.tp1)}
                      </p>
                      <p className="font-mono text-green-500 text-xs">
                        TP2: ${formatPrice(setup.take_profits.tp2)} | TP3: ${formatPrice(setup.take_profits.tp3)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Position Size</p>
                      <p className="font-bold">{setup.position_size_pct}%</p>
                      <p className="text-xs text-muted-foreground">
                        R:R {setup.risk_reward.toFixed(1)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {data.setups.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No trade setups available. Confluence may be too low or no zones nearby.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
