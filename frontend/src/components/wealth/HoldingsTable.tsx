"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Holding, AssetClass } from "@/lib/wealth-types";

// Extended holding with price data from usePortfolio
interface HoldingWithPrice extends Holding {
  current_price?: number;
  current_value?: number;
  change_24h_pct?: number;
}

interface HoldingsTableProps {
  holdings: HoldingWithPrice[];
  loading?: boolean;
  onDelete?: (holdingId: string) => Promise<void>;
  onEdit?: (holding: Holding) => void;
}

type SortField = "name" | "asset_class" | "quantity" | "value" | "gain";
type SortOrder = "asc" | "desc";

const ASSET_CLASS_COLORS: Record<AssetClass, string> = {
  crypto: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  stock: "bg-green-500/10 text-green-500 border-green-500/20",
  etf: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  bond: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  real_estate: "bg-red-500/10 text-red-500 border-red-500/20",
  cash: "bg-gray-500/10 text-gray-500 border-gray-500/20",
  commodity: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
};

const ASSET_CLASS_LABELS: Record<AssetClass, string> = {
  crypto: "Crypto",
  stock: "Stock",
  etf: "ETF",
  bond: "Bond",
  real_estate: "Real Estate",
  cash: "Cash",
  commodity: "Commodity",
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatQuantity(value: number, assetClass: AssetClass): string {
  if (assetClass === "crypto") {
    return value < 1 ? value.toFixed(8) : value.toFixed(4);
  }
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function HoldingsTable({
  holdings,
  loading,
  onDelete,
  onEdit,
}: HoldingsTableProps) {
  const [sortField, setSortField] = useState<SortField>("value");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [deleting, setDeleting] = useState<string | null>(null);

  // Calculate values for each holding (using current_price from API if available)
  const holdingsWithValues = holdings.map((h) => {
    // Use current_price from price service, fallback to manual_price
    const price = h.current_price || h.manual_price || 0;
    const quantity = Number(h.quantity);
    const value = price * quantity;
    const costBasis = h.cost_basis ? Number(h.cost_basis) * quantity : null;
    const gain = costBasis !== null ? value - costBasis : null;
    const gainPct = costBasis && costBasis > 0 ? (gain! / costBasis) * 100 : null;
    const change24h = h.change_24h_pct || null;

    return { ...h, price, value, costBasis, gain, gainPct, change24h };
  });

  // Sort holdings
  const sortedHoldings = [...holdingsWithValues].sort((a, b) => {
    let aVal: number | string = 0;
    let bVal: number | string = 0;

    switch (sortField) {
      case "name":
        aVal = a.name.toLowerCase();
        bVal = b.name.toLowerCase();
        break;
      case "asset_class":
        aVal = a.asset_class;
        bVal = b.asset_class;
        break;
      case "quantity":
        aVal = Number(a.quantity);
        bVal = Number(b.quantity);
        break;
      case "value":
        aVal = a.value;
        bVal = b.value;
        break;
      case "gain":
        aVal = a.gain || 0;
        bVal = b.gain || 0;
        break;
    }

    if (typeof aVal === "string" && typeof bVal === "string") {
      return sortOrder === "asc"
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }

    return sortOrder === "asc"
      ? (aVal as number) - (bVal as number)
      : (bVal as number) - (aVal as number);
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const handleDelete = async (holdingId: string) => {
    if (!onDelete) return;
    setDeleting(holdingId);
    try {
      await onDelete(holdingId);
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Holdings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (holdings.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Holdings</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            No holdings yet. Click "Add Holding" to get started.
          </p>
        </CardContent>
      </Card>
    );
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return <span className="ml-1">{sortOrder === "asc" ? "↑" : "↓"}</span>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Holdings ({holdings.length})</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("name")}
              >
                Asset <SortIcon field="name" />
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("asset_class")}
              >
                Type <SortIcon field="asset_class" />
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50 text-right"
                onClick={() => handleSort("quantity")}
              >
                Quantity <SortIcon field="quantity" />
              </TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50 text-right"
                onClick={() => handleSort("value")}
              >
                Value <SortIcon field="value" />
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50 text-right"
                onClick={() => handleSort("gain")}
              >
                Gain/Loss <SortIcon field="gain" />
              </TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedHoldings.map((holding) => (
              <TableRow key={holding.id}>
                <TableCell>
                  <div>
                    <span className="font-medium">{holding.ticker}</span>
                    <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                      {holding.name}
                    </p>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={ASSET_CLASS_COLORS[holding.asset_class]}
                  >
                    {ASSET_CLASS_LABELS[holding.asset_class]}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatQuantity(Number(holding.quantity), holding.asset_class)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {holding.price > 0 ? (
                    <div>
                      <span>{formatCurrency(holding.price)}</span>
                      {holding.change24h !== null && (
                        <p
                          className={`text-xs ${
                            holding.change24h >= 0
                              ? "text-green-500"
                              : "text-red-500"
                          }`}
                        >
                          {holding.change24h >= 0 ? "+" : ""}
                          {holding.change24h.toFixed(2)}%
                        </p>
                      )}
                    </div>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell className="text-right font-mono font-medium">
                  {holding.value > 0 ? formatCurrency(holding.value) : "-"}
                </TableCell>
                <TableCell className="text-right">
                  {holding.gain !== null ? (
                    <div>
                      <span
                        className={`font-mono font-medium ${
                          holding.gain >= 0 ? "text-green-500" : "text-red-500"
                        }`}
                      >
                        {holding.gain >= 0 ? "+" : ""}
                        {formatCurrency(holding.gain)}
                      </span>
                      {holding.gainPct !== null && (
                        <p
                          className={`text-xs ${
                            holding.gainPct >= 0
                              ? "text-green-500"
                              : "text-red-500"
                          }`}
                        >
                          {holding.gainPct >= 0 ? "+" : ""}
                          {holding.gainPct.toFixed(1)}%
                        </p>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2 justify-end">
                    {onEdit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(holding)}
                      >
                        Edit
                      </Button>
                    )}
                    {onDelete && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                        onClick={() => handleDelete(holding.id)}
                        disabled={deleting === holding.id}
                      >
                        {deleting === holding.id ? "..." : "Delete"}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default HoldingsTable;
