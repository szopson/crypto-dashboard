"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  ReferenceLine,
} from "recharts";

interface EquityPoint {
  date: string;
  equity: number;
  drawdown: number;
  drawdown_pct: number;
  trade_count: number;
}

interface EquityCurveData {
  timestamp: string;
  starting_equity: number;
  current_equity: number;
  peak_equity: number;
  max_drawdown: number;
  max_drawdown_pct: number;
  curve: EquityPoint[];
}

interface EquityCurveChartProps {
  startingEquity?: number;
}

export function EquityCurveChart({ startingEquity = 10000 }: EquityCurveChartProps) {
  const [data, setData] = useState<EquityCurveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(
          `/api/trades/equity-curve?starting_equity=${startingEquity}`
        );
        if (!response.ok) throw new Error("Failed to fetch equity curve");
        const result = await response.json();
        setData(result);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [startingEquity]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Equity Curve</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            Loading...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Equity Curve</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            {error || "No data available"}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (data.curve.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Equity Curve</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            No closed trades yet. Start trading to see your equity curve.
          </div>
        </CardContent>
      </Card>
    );
  }

  const pnl = data.current_equity - data.starting_equity;
  const pnlPct = ((pnl / data.starting_equity) * 100).toFixed(2);
  const isProfitable = pnl >= 0;

  // Format chart data with starting point
  const chartData = [
    { date: "Start", equity: data.starting_equity, drawdown_pct: 0 },
    ...data.curve,
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Equity Curve</CardTitle>
          <div className="text-right">
            <div className={`text-lg font-bold ${isProfitable ? "text-green-500" : "text-red-500"}`}>
              ${data.current_equity.toLocaleString()}
            </div>
            <div className={`text-sm ${isProfitable ? "text-green-500" : "text-red-500"}`}>
              {isProfitable ? "+" : ""}{pnlPct}%
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
          <div>
            <div className="text-muted-foreground">Starting</div>
            <div className="font-medium">${data.starting_equity.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Peak</div>
            <div className="font-medium">${data.peak_equity.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Max DD</div>
            <div className="font-medium text-red-500">
              -{data.max_drawdown_pct.toFixed(1)}%
            </div>
          </div>
        </div>

        {/* Equity Chart */}
        <div className="h-[200px] sm:h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
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
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                tickFormatter={(value) => {
                  if (value === "Start") return value;
                  const date = new Date(value);
                  return `${date.getMonth() + 1}/${date.getDate()}`;
                }}
                className="text-muted-foreground"
              />
              <YAxis
                tick={{ fontSize: 10 }}
                tickFormatter={(value) => `$${(value / 1000).toFixed(1)}k`}
                className="text-muted-foreground"
                domain={["dataMin - 100", "dataMax + 100"]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
                formatter={(value) => [`$${Number(value).toLocaleString()}`, "Equity"]}
              />
              <ReferenceLine
                y={data.starting_equity}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="3 3"
              />
              <Area
                type="monotone"
                dataKey="equity"
                stroke={isProfitable ? "#22c55e" : "#ef4444"}
                strokeWidth={2}
                fill="url(#equityGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Drawdown Chart (smaller) */}
        <div className="mt-4">
          <div className="text-sm text-muted-foreground mb-2">Drawdown %</div>
          <div className="h-[80px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="ddGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" hide />
                <YAxis
                  tick={{ fontSize: 9 }}
                  tickFormatter={(value) => `${value.toFixed(0)}%`}
                  domain={[0, "dataMax"]}
                  className="text-muted-foreground"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                  formatter={(value) => [`${Number(value).toFixed(2)}%`, "Drawdown"]}
                />
                <Area
                  type="monotone"
                  dataKey="drawdown_pct"
                  stroke="#ef4444"
                  strokeWidth={1}
                  fill="url(#ddGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
