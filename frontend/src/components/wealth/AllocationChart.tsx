"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AssetAllocation, AssetClass } from "@/lib/wealth-types";

interface AllocationChartProps {
  allocation: AssetAllocation[];
  loading?: boolean;
}

const ASSET_CLASS_LABELS: Record<AssetClass, string> = {
  crypto: "Crypto",
  stock: "Stocks",
  etf: "ETFs",
  bond: "Bonds",
  real_estate: "Real Estate",
  cash: "Cash",
  commodity: "Commodities",
  other: "Other",
};

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`;
  }
  return `$${value.toFixed(0)}`;
}

export function AllocationChart({ allocation, loading }: AllocationChartProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Asset Allocation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-40 bg-muted rounded-full w-40 mx-auto" />
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-8 bg-muted rounded" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (allocation.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Asset Allocation</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            No allocation data available.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Calculate total value
  const totalValue = allocation.reduce((sum, a) => sum + a.value_usd, 0);

  // Create gradient for donut chart
  let cumulativePercent = 0;
  const gradientStops = allocation
    .filter((a) => a.percentage > 0)
    .map((a) => {
      const start = cumulativePercent;
      cumulativePercent += a.percentage;
      return `${a.color} ${start}% ${cumulativePercent}%`;
    })
    .join(", ");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Asset Allocation</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center">
          {/* Donut Chart */}
          <div
            className="relative w-40 h-40 rounded-full mb-6"
            style={{
              background: `conic-gradient(${gradientStops})`,
            }}
          >
            {/* Inner circle (creates donut effect) */}
            <div className="absolute inset-6 rounded-full bg-background flex items-center justify-center flex-col">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="text-lg font-bold">{formatCurrency(totalValue)}</span>
            </div>
          </div>

          {/* Legend */}
          <div className="w-full space-y-2">
            {allocation.map((item) => (
              <div
                key={item.asset_class}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm">
                    {ASSET_CLASS_LABELS[item.asset_class]}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono text-muted-foreground">
                    {item.percentage.toFixed(1)}%
                  </span>
                  <span className="text-sm font-mono font-medium w-20 text-right">
                    {formatCurrency(item.value_usd)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default AllocationChart;
