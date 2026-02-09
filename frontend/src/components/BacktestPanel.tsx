"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { useSymbol } from "@/contexts/SymbolContext";

interface BacktestTrade {
  entry_time: string;
  entry_price: number;
  direction: string;
  entry_reason: string;
  exit_time: string;
  exit_price: number;
  exit_reason: string;
  pnl: number;
  pnl_pct: number;
  radar_score: number;
}

interface BacktestResult {
  success: boolean;
  timestamp: string;
  config: {
    symbol: string;
    timeframe: string;
    start_date: string;
    end_date: string;
    initial_capital: number;
    strategy: string;
    entry_radar_range: [number, number];
    take_profit_pct: number;
    stop_loss_pct: number;
    direction: string;
  };
  results: {
    total_trades: number;
    winning_trades: number;
    losing_trades: number;
    win_rate: number;
    total_pnl: number;
    total_pnl_pct: number;
    final_capital: number;
    max_drawdown: number;
    max_drawdown_pct: number;
    profit_factor: number | null;
    avg_trade_pnl: number;
    avg_win: number | null;
    avg_loss: number | null;
  };
  trades: BacktestTrade[];
  equity_curve: { date: string; equity: number }[];
}

export function BacktestPanel() {
  const { symbol: currentSymbol, availableSymbols } = useSymbol();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [symbol, setSymbol] = useState(currentSymbol);
  const [timeframe, setTimeframe] = useState("1d");
  const [lookbackDays, setLookbackDays] = useState("365");
  const [initialCapital, setInitialCapital] = useState("10000");
  const [entryRadarMin, setEntryRadarMin] = useState("2");
  const [entryRadarMax, setEntryRadarMax] = useState("4");
  const [takeProfitPct, setTakeProfitPct] = useState("10");
  const [stopLossPct, setStopLossPct] = useState("5");
  const [direction, setDirection] = useState("LONG");

  const runBacktest = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        symbol,
        timeframe,
        lookback_days: lookbackDays,
        initial_capital: initialCapital,
        entry_radar_min: entryRadarMin,
        entry_radar_max: entryRadarMax,
        take_profit_pct: takeProfitPct,
        stop_loss_pct: stopLossPct,
        direction,
      });

      const response = await fetch(`/api/backtest/run?${params}`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Backtest failed");
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error running backtest");
    } finally {
      setLoading(false);
    }
  };

  const isProfitable = result && result.results.total_pnl_pct >= 0;

  return (
    <div className="space-y-4">
      {/* Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Backtest Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="symbol">Symbol</Label>
              <Select value={symbol} onValueChange={setSymbol}>
                <SelectTrigger id="symbol">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableSymbols.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.split("/")[0]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timeframe">Timeframe</Label>
              <Select value={timeframe} onValueChange={setTimeframe}>
                <SelectTrigger id="timeframe">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1h">1 Hour</SelectItem>
                  <SelectItem value="4h">4 Hours</SelectItem>
                  <SelectItem value="1d">1 Day</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="lookback">Lookback (days)</Label>
              <Input
                id="lookback"
                type="number"
                value={lookbackDays}
                onChange={(e) => setLookbackDays(e.target.value)}
                min="30"
                max="365"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="capital">Initial Capital ($)</Label>
              <Input
                id="capital"
                type="number"
                value={initialCapital}
                onChange={(e) => setInitialCapital(e.target.value)}
                min="100"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="radarMin">RADAR Min</Label>
              <Input
                id="radarMin"
                type="number"
                value={entryRadarMin}
                onChange={(e) => setEntryRadarMin(e.target.value)}
                min="0"
                max="6"
                step="0.5"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="radarMax">RADAR Max</Label>
              <Input
                id="radarMax"
                type="number"
                value={entryRadarMax}
                onChange={(e) => setEntryRadarMax(e.target.value)}
                min="0"
                max="6"
                step="0.5"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tp">Take Profit (%)</Label>
              <Input
                id="tp"
                type="number"
                value={takeProfitPct}
                onChange={(e) => setTakeProfitPct(e.target.value)}
                min="1"
                max="50"
                step="0.5"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sl">Stop Loss (%)</Label>
              <Input
                id="sl"
                type="number"
                value={stopLossPct}
                onChange={(e) => setStopLossPct(e.target.value)}
                min="0.5"
                max="20"
                step="0.5"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="direction">Direction</Label>
              <Select value={direction} onValueChange={setDirection}>
                <SelectTrigger id="direction">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LONG">Long Only</SelectItem>
                  <SelectItem value="SHORT">Short Only</SelectItem>
                  <SelectItem value="BOTH">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={runBacktest}
            disabled={loading}
            className="mt-4 w-full"
          >
            {loading ? "Running Backtest..." : "Run Backtest"}
          </Button>

          {error && (
            <div className="mt-2 text-sm text-red-500">{error}</div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <>
          {/* Stats Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>Backtest Results</span>
                <span
                  className={`text-lg ${
                    isProfitable ? "text-green-500" : "text-red-500"
                  }`}
                >
                  {isProfitable ? "+" : ""}
                  {result.results.total_pnl_pct.toFixed(2)}%
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Total Trades</div>
                  <div className="font-medium text-lg">
                    {result.results.total_trades}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Win Rate</div>
                  <div
                    className={`font-medium text-lg ${
                      result.results.win_rate >= 50
                        ? "text-green-500"
                        : "text-red-500"
                    }`}
                  >
                    {result.results.win_rate.toFixed(1)}%
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Profit Factor</div>
                  <div
                    className={`font-medium text-lg ${
                      (result.results.profit_factor || 0) >= 1
                        ? "text-green-500"
                        : "text-red-500"
                    }`}
                  >
                    {result.results.profit_factor?.toFixed(2) || "N/A"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Max Drawdown</div>
                  <div className="font-medium text-lg text-red-500">
                    -{result.results.max_drawdown_pct.toFixed(1)}%
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Initial Capital</div>
                  <div className="font-medium">
                    ${result.config.initial_capital.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Final Capital</div>
                  <div
                    className={`font-medium ${
                      isProfitable ? "text-green-500" : "text-red-500"
                    }`}
                  >
                    ${result.results.final_capital.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Avg Win</div>
                  <div className="font-medium text-green-500">
                    ${result.results.avg_win?.toFixed(2) || "N/A"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Avg Loss</div>
                  <div className="font-medium text-red-500">
                    ${result.results.avg_loss?.toFixed(2) || "N/A"}
                  </div>
                </div>
              </div>

              {/* Equity Curve */}
              {result.equity_curve.length > 0 && (
                <div className="mt-6">
                  <div className="text-sm text-muted-foreground mb-2">
                    Equity Curve
                  </div>
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={result.equity_curve}
                        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient
                            id="backtestGradient"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor={isProfitable ? "#22c55e" : "#ef4444"}
                              stopOpacity={0.3}
                            />
                            <stop
                              offset="95%"
                              stopColor={isProfitable ? "#22c55e" : "#ef4444"}
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          className="stroke-muted"
                        />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 10 }}
                          tickFormatter={(value) => {
                            const date = new Date(value);
                            return `${date.getMonth() + 1}/${date.getDate()}`;
                          }}
                          className="text-muted-foreground"
                        />
                        <YAxis
                          tick={{ fontSize: 10 }}
                          tickFormatter={(value) =>
                            `$${(value / 1000).toFixed(1)}k`
                          }
                          className="text-muted-foreground"
                          domain={["dataMin - 500", "dataMax + 500"]}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                          labelStyle={{ color: "hsl(var(--foreground))" }}
                          formatter={(value) => [
                            `$${Number(value).toLocaleString()}`,
                            "Equity",
                          ]}
                        />
                        <ReferenceLine
                          y={result.config.initial_capital}
                          stroke="hsl(var(--muted-foreground))"
                          strokeDasharray="3 3"
                        />
                        <Area
                          type="monotone"
                          dataKey="equity"
                          stroke={isProfitable ? "#22c55e" : "#ef4444"}
                          strokeWidth={2}
                          fill="url(#backtestGradient)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Trades List */}
          {result.trades.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Trade History ({result.trades.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pb-2 font-medium">Entry</th>
                        <th className="pb-2 font-medium">Exit</th>
                        <th className="pb-2 font-medium">Direction</th>
                        <th className="pb-2 font-medium text-right">Entry $</th>
                        <th className="pb-2 font-medium text-right">Exit $</th>
                        <th className="pb-2 font-medium text-right">P&L</th>
                        <th className="pb-2 font-medium text-center">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.trades.map((trade, idx) => {
                        const isWin = trade.pnl >= 0;
                        return (
                          <tr
                            key={idx}
                            className="border-b border-muted last:border-0"
                          >
                            <td className="py-2 text-muted-foreground">
                              {new Date(trade.entry_time).toLocaleDateString()}
                            </td>
                            <td className="py-2 text-muted-foreground">
                              {new Date(trade.exit_time).toLocaleDateString()}
                            </td>
                            <td className="py-2">
                              <span
                                className={
                                  trade.direction === "LONG"
                                    ? "text-green-500"
                                    : "text-red-500"
                                }
                              >
                                {trade.direction}
                              </span>
                            </td>
                            <td className="py-2 text-right">
                              ${trade.entry_price.toLocaleString()}
                            </td>
                            <td className="py-2 text-right">
                              ${trade.exit_price.toLocaleString()}
                            </td>
                            <td
                              className={`py-2 text-right font-medium ${
                                isWin ? "text-green-500" : "text-red-500"
                              }`}
                            >
                              {isWin ? "+" : ""}
                              {trade.pnl_pct.toFixed(2)}%
                            </td>
                            <td className="py-2 text-center">
                              <span
                                className={`px-2 py-0.5 rounded text-xs ${
                                  trade.exit_reason === "TP"
                                    ? "bg-green-500/20 text-green-500"
                                    : trade.exit_reason === "SL"
                                    ? "bg-red-500/20 text-red-500"
                                    : "bg-muted text-muted-foreground"
                                }`}
                              >
                                {trade.exit_reason}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
