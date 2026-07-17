"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useSymbol, formatSymbol } from "@/contexts/SymbolContext";
import { RiskSizer, type RiskSizerPrefill } from "@/components/RiskSizer";
import { ExchangeCTA } from "@/components/cockpit/ExchangeCTA";
import { formatSymbolShort } from "@/contexts/SymbolContext";
import { CheckCircle2, CircleDashed, XCircle } from "lucide-react";

// Honest reframe of the SNIPER engine output (MiCA/KNF): the same payload
// rendered as a CONDITIONS CHECKLIST for a trade the user is already
// considering — no signal badge, no recommendation string, no engine-decided
// position size. The engine's `signal`/`recommendation`/`position_size_pct`
// fields are deliberately ignored.

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
}

// The engine emits DISCRETE point tiers (0 / 0.5 / 1.0 / 1.5), so binning is
// on the tiers themselves: at max = met, intermediate nonzero = partial,
// zero = not met. A percentage rule (e.g. >=75%) would make "partial"
// unreachable for the 1.0-max components.
type ConditionState = "met" | "partial" | "not_met";

function binCondition(points: number, max: number): ConditionState {
  if (!Number.isFinite(points) || !Number.isFinite(max) || max <= 0)
    return "not_met";
  if (points >= max) return "met";
  if (points > 0) return "partial";
  return "not_met";
}

const CONDITION_UI: Record<
  ConditionState,
  { label: string; className: string }
> = {
  met: { label: "Met", className: "text-emerald-500" },
  partial: { label: "Partial", className: "text-amber-500" },
  not_met: { label: "Not met", className: "text-muted-foreground" },
};

function ConditionIcon({ state }: { state: ConditionState }) {
  if (state === "met") return <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />;
  if (state === "partial") return <CircleDashed className="size-4 text-amber-500 shrink-0" />;
  return <XCircle className="size-4 text-muted-foreground shrink-0" />;
}

const formatPrice = (price: number) =>
  price.toLocaleString(undefined, { maximumFractionDigits: 0 });

// "demand_zone" -> "Demand zone"
const humanizeZone = (t: string) => {
  const s = t.replace(/_/g, " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

interface ConfluenceCheckProps {
  refreshInterval?: number;
}

export function ConfluenceCheck({ refreshInterval = 60000 }: ConfluenceCheckProps) {
  const { symbol } = useSymbol();
  const [data, setData] = useState<SniperData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<RiskSizerPrefill | null>(null);
  const { addToast } = useToast();

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams({ symbol });
      const response = await fetch(`/api/sniper/analyze?${params}`);
      if (!response.ok) {
        throw new Error("Failed to fetch confluence analysis");
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
    setPrefill(null);
    fetchData();
    const interval = setInterval(fetchData, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchData, refreshInterval]);

  const copyLevels = (setup: TradeSetup, maxScore: number) => {
    const text = `${humanizeZone(setup.entry_zone_type)} ${setup.timeframe} — ${formatSymbol(symbol)}
Zone: $${formatPrice(setup.entry_zone.low)} - $${formatPrice(setup.entry_zone.high)}
Invalidation (SS): $${formatPrice(setup.stop_loss)}
R-multiple levels: 1R $${formatPrice(setup.take_profits.tp1)} | 2R $${formatPrice(setup.take_profits.tp2)} | 3R $${formatPrice(setup.take_profits.tp3)}
Confluence: ${setup.confluence_score.toFixed(1)}/${maxScore.toFixed(1)}`;

    navigator.clipboard
      .writeText(text)
      .then(() => addToast("Levels copied to clipboard", "success"))
      .catch(() => addToast("Failed to copy", "error"));
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Confluence Check - {formatSymbol(symbol)}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Checking market conditions...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Confluence Check - {formatSymbol(symbol)}</CardTitle>
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

  const maxScore = data.confluence.max_score || 5;

  return (
    <div className="space-y-4">
      {/* Conditions checklist */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Confluence Check - {formatSymbol(symbol)}</CardTitle>
          <p className="text-xs text-muted-foreground">
            Context check for a trade YOU are considering — not a signal.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            {data.confluence.components.map((comp, idx) => {
              const state = binCondition(comp.points, comp.max);
              const ui = CONDITION_UI[state];
              return (
                <div
                  key={idx}
                  className="flex items-start gap-3 rounded-lg border border-(--glass-border) p-3"
                >
                  <ConditionIcon state={state} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">
                        {comp.name.replace(/_/g, " ")}
                      </span>
                      <span className={`text-xs font-medium ${ui.className}`}>
                        {ui.label}
                        <span className="ml-2 font-mono text-muted-foreground">
                          {comp.points.toFixed(1)}/{comp.max.toFixed(1)}
                        </span>
                      </span>
                    </div>
                    {comp.note && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {comp.note}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            {data.confluence.score.toFixed(1)} of {maxScore.toFixed(1)} condition
            points present at ${formatPrice(data.current_price)}.
          </p>
        </CardContent>
      </Card>

      {/* Levels in play — structural levels as market description */}
      {data.setups.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Levels in Play</CardTitle>
            <p className="text-xs text-muted-foreground">
              Structural levels near price — context, not instructions.
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.setups.map((setup, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-lg border border-(--glass-border)"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium">
                      {humanizeZone(setup.entry_zone_type)} · {setup.timeframe}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => copyLevels(setup, maxScore)}
                    >
                      Copy
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Zone</p>
                      <p className="font-mono">
                        ${formatPrice(setup.entry_zone.low)} - ${formatPrice(setup.entry_zone.high)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Invalidation (SS)</p>
                      <p className="font-mono">${formatPrice(setup.stop_loss)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">R-multiple levels</p>
                      <p className="font-mono text-xs">
                        1R ${formatPrice(setup.take_profits.tp1)} · 2R $
                        {formatPrice(setup.take_profits.tp2)} · 3R $
                        {formatPrice(setup.take_profits.tp3)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Confluence</p>
                      <p className="font-mono">
                        {setup.confluence_score.toFixed(1)}/{maxScore.toFixed(1)}
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 h-7 text-xs"
                    onClick={() =>
                      // Round to cents — engine floats carry precision noise
                      // ("63629.100000000006") that would land in the inputs.
                      setPrefill({
                        entry: Number(setup.entry_price.toFixed(2)),
                        stopLoss: Number(setup.stop_loss.toFixed(2)),
                      })
                    }
                  >
                    Use in risk sizer
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {data.setups.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No structural zones near price right now.
          </CardContent>
        </Card>
      )}

      {/* User-risk-based sizing */}
      <RiskSizer prefill={prefill} />

      {/* Execution bridge — region-gated, renders nothing when no venue */}
      <div className="flex justify-end">
        <ExchangeCTA
          symbol={formatSymbolShort(symbol)}
          surface="app-confluence"
          compact
        />
      </div>
    </div>
  );
}
