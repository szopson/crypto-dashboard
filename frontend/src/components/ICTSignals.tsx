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

interface ICTSignal {
  direction: "LONG" | "SHORT";
  signal_type: string;
  confidence: number;
  entry_type: string;
  entry_zone: { high: number; low: number; mid: number };
  stop_loss: number;
  take_profits: { tp1: number; tp2: number; tp3: number | null };
  risk_reward: { risk: number; reward_1: number; reward_2: number; rr_ratio: number };
  context: { htf_bias: string; session: string; in_killzone: boolean };
  components: {
    htf_bias: string;
    htf_aligned: boolean;
    amd_phase: string;
    amd_confidence: number;
    mss_confirmed: boolean;
    fvg_formed: boolean;
    swept_level: number | null;
    sweep_extreme: number | null;
  };
  timestamp: string;
}

interface AMDData {
  phase: "ACCUMULATION" | "MANIPULATION" | "DISTRIBUTION" | "NONE";
  direction: "BULLISH" | "BEARISH" | null;
  confidence: number;
  details?: Record<string, unknown>;
}

interface SessionData {
  session: string;
  description: string;
  is_high_volume: boolean;
  in_killzone: boolean;
  utc_time: string;
}

interface ICTData {
  success: boolean;
  timestamp: string;
  symbol: string;
  current_price: number;
  signal: ICTSignal | null;
  amd: AMDData;
  session: SessionData;
  htf_structure?: { bias: string };
  ltf_structure?: { bias: string };
}

interface ICTSignalsProps {
  refreshInterval?: number;
}

export function ICTSignals({ refreshInterval = 60000 }: ICTSignalsProps) {
  const { symbol } = useSymbol();
  const [data, setData] = useState<ICTData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToast();

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams({ symbol });
      const response = await fetch(`/api/ict/signals?${params}`);
      if (!response.ok) {
        throw new Error("Failed to fetch ICT signals");
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

  const getPhaseColor = (phase: string) => {
    switch (phase) {
      case "ACCUMULATION":
        return "bg-blue-500/20 text-blue-400";
      case "MANIPULATION":
        return "bg-yellow-500/20 text-yellow-400";
      case "DISTRIBUTION":
        return "bg-green-500/20 text-green-400";
      default:
        return "bg-zinc-500/20 text-zinc-400";
    }
  };

  const getDirectionColor = (direction: string | null) => {
    if (direction === "BULLISH" || direction === "LONG") return "text-green-500";
    if (direction === "BEARISH" || direction === "SHORT") return "text-red-500";
    return "text-zinc-400";
  };

  const formatPrice = (price: number) => {
    return price.toLocaleString(undefined, { maximumFractionDigits: 0 });
  };

  const copySignalToClipboard = (signal: ICTSignal) => {
    const text = `ICT ${signal.direction} Signal
Entry Type: ${signal.entry_type}
Entry Zone: $${formatPrice(signal.entry_zone.low)} - $${formatPrice(signal.entry_zone.high)}
Stop Loss: $${formatPrice(signal.stop_loss)}
TP1: $${formatPrice(signal.take_profits.tp1)}
TP2: $${formatPrice(signal.take_profits.tp2)}
R:R: ${signal.risk_reward.rr_ratio.toFixed(1)}
Confidence: ${(signal.confidence * 100).toFixed(0)}%
HTF Bias: ${signal.context.htf_bias}
Session: ${signal.context.session}${signal.context.in_killzone ? " (Killzone)" : ""}`;

    navigator.clipboard.writeText(text).then(() => {
      addToast("Signal copied to clipboard", "success");
    }).catch(() => {
      addToast("Failed to copy", "error");
    });
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>ICT Signals - {formatSymbol(symbol)}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Analyzing ICT patterns...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>ICT Signals - {formatSymbol(symbol)}</CardTitle>
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

  return (
    <div className="space-y-4">
      {/* Session & AMD Phase */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle>ICT Signals - {formatSymbol(symbol)}</CardTitle>
            <div className="flex items-center gap-2">
              {data.session?.in_killzone && (
                <Badge className="bg-emerald-500/20 text-emerald-400">
                  Killzone
                </Badge>
              )}
              <Badge variant="outline" className="text-xs">
                {data.session?.session || "UNKNOWN"}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* AMD Phase Indicator */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/50 border border-zinc-800">
            <div>
              <p className="text-sm text-muted-foreground">AMD Cycle</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge className={getPhaseColor(data.amd?.phase || "NONE")}>
                  {data.amd?.phase || "NONE"}
                </Badge>
                {data.amd?.direction && (
                  <span className={`text-sm font-medium ${getDirectionColor(data.amd.direction)}`}>
                    {data.amd.direction}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Confidence</p>
              <p className="text-lg font-bold">
                {((data.amd?.confidence || 0) * 100).toFixed(0)}%
              </p>
            </div>
          </div>

          {/* Phase Progress */}
          <div className="grid grid-cols-3 gap-2">
            {["ACCUMULATION", "MANIPULATION", "DISTRIBUTION"].map((phase) => (
              <div
                key={phase}
                className={`p-2 rounded text-center text-xs ${
                  data.amd?.phase === phase
                    ? getPhaseColor(phase)
                    : "bg-zinc-800/50 text-zinc-500"
                }`}
              >
                {phase.charAt(0)}
              </div>
            ))}
          </div>

          {/* HTF Bias */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">HTF Bias (4H)</span>
            <span className={getDirectionColor(data.htf_structure?.bias || null)}>
              {data.htf_structure?.bias || "N/A"}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Active Signal */}
      {data.signal && (
        <Card className={
          data.signal.direction === "LONG"
            ? "border-green-500/30"
            : "border-red-500/30"
        }>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <span className={getDirectionColor(data.signal.direction)}>
                  {data.signal.direction === "LONG" ? "🟢" : "🔴"}
                </span>
                ICT Signal
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge className={
                  data.signal.direction === "LONG"
                    ? "bg-green-500/20 text-green-400"
                    : "bg-red-500/20 text-red-400"
                }>
                  {data.signal.direction}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => copySignalToClipboard(data.signal!)}
                >
                  Copy
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Confidence */}
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Signal Confidence</span>
                <span className="text-sm font-bold">
                  {(data.signal.confidence * 100).toFixed(0)}%
                </span>
              </div>
              <Progress value={data.signal.confidence * 100} className="h-2" />
            </div>

            {/* Entry Details */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Entry Type</p>
                <p className="font-medium">{data.signal.entry_type.replace("_", " ")}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Entry Zone</p>
                <p className="font-mono">
                  ${formatPrice(data.signal.entry_zone.low)} - ${formatPrice(data.signal.entry_zone.high)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Stop Loss</p>
                <p className="font-mono text-red-500">
                  ${formatPrice(data.signal.stop_loss)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Risk : Reward</p>
                <p className="font-bold">{data.signal.risk_reward.rr_ratio.toFixed(1)}</p>
              </div>
            </div>

            {/* Take Profits */}
            <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/20">
              <p className="text-sm text-muted-foreground mb-2">Take Profits</p>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">TP1 (1:1)</p>
                  <p className="font-mono text-green-500">
                    ${formatPrice(data.signal.take_profits.tp1)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">TP2 (2:1)</p>
                  <p className="font-mono text-green-500">
                    ${formatPrice(data.signal.take_profits.tp2)}
                  </p>
                </div>
                {data.signal.take_profits.tp3 && (
                  <div>
                    <p className="text-xs text-muted-foreground">TP3 (3:1)</p>
                    <p className="font-mono text-green-500">
                      ${formatPrice(data.signal.take_profits.tp3)}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Components */}
            <Accordion type="single" collapsible>
              <AccordionItem value="components">
                <AccordionTrigger className="text-sm">
                  Signal Components
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">HTF Bias</span>
                      <span className={getDirectionColor(data.signal.components.htf_bias)}>
                        {data.signal.components.htf_bias}
                        {data.signal.components.htf_aligned ? " ✓" : " ✗"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">AMD Phase</span>
                      <span>{data.signal.components.amd_phase}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">MSS Confirmed</span>
                      <span>{data.signal.components.mss_confirmed ? "✓ Yes" : "✗ No"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">FVG Formed</span>
                      <span>{data.signal.components.fvg_formed ? "✓ Yes" : "✗ No"}</span>
                    </div>
                    {data.signal.components.swept_level && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Swept Level</span>
                        <span className="font-mono">
                          ${formatPrice(data.signal.components.swept_level)}
                        </span>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      )}

      {/* No Signal */}
      {!data.signal && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <p className="mb-2">No ICT signal currently active</p>
            <p className="text-sm">
              {data.amd?.phase === "ACCUMULATION" && "Waiting for manipulation (liquidity sweep)..."}
              {data.amd?.phase === "MANIPULATION" && "Sweep detected - waiting for displacement..."}
              {data.amd?.phase === "NONE" && "Waiting for market structure to form..."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Current Price */}
      <div className="text-center text-sm text-muted-foreground">
        Current: ${formatPrice(data.current_price)} | {data.session?.utc_time}
      </div>
    </div>
  );
}
