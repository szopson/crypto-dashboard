"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PortfolioSummary } from "@/lib/wealth-types";

interface PortfolioOverviewProps {
  summary: PortfolioSummary | null;
  loading?: boolean;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function PortfolioOverview({ summary, loading }: PortfolioOverviewProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Portfolio Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-12 bg-muted rounded" />
            <div className="grid grid-cols-3 gap-4">
              <div className="h-16 bg-muted rounded" />
              <div className="h-16 bg-muted rounded" />
              <div className="h-16 bg-muted rounded" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!summary) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Portfolio Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            No portfolio data available. Add some holdings to get started.
          </p>
        </CardContent>
      </Card>
    );
  }

  const isPositive24h = summary.change_24h_pct >= 0;
  const isPositiveTotal = summary.total_gain_loss_pct >= 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{summary.portfolio_name}</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Total Value */}
        <div className="mb-6">
          <p className="text-sm text-muted-foreground">Total Value</p>
          <div className="flex items-baseline gap-3">
            <span className="text-4xl font-bold">
              {formatCurrency(summary.total_value_usd)}
            </span>
            <span
              className={`text-lg font-medium ${
                isPositive24h ? "text-green-500" : "text-red-500"
              }`}
            >
              {formatPercent(summary.change_24h_pct)}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {isPositive24h ? "+" : ""}
            {formatCurrency(summary.change_24h_usd)} today
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-4">
          {/* Cost Basis */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Cost Basis
            </p>
            <p className="text-lg font-semibold">
              {formatCurrency(summary.total_cost_basis_usd)}
            </p>
          </div>

          {/* Total Gain/Loss */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Total Gain/Loss
            </p>
            <p
              className={`text-lg font-semibold ${
                isPositiveTotal ? "text-green-500" : "text-red-500"
              }`}
            >
              {formatCurrency(summary.total_gain_loss_usd)}
            </p>
            <p
              className={`text-xs ${
                isPositiveTotal ? "text-green-500" : "text-red-500"
              }`}
            >
              {formatPercent(summary.total_gain_loss_pct)}
            </p>
          </div>

          {/* Holdings Count */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Holdings
            </p>
            <p className="text-lg font-semibold">{summary.holdings_count}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default PortfolioOverview;
