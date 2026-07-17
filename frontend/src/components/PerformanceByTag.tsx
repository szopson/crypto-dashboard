"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface TagStats {
  total_trades: number;
  wins: number;
  losses: number;
  win_rate: number;
  total_pnl: number;
}

interface PerformanceByTagProps {
  /** Bump to refetch (e.g. after a trade is closed). */
  refreshKey?: number;
}

// Per-setup analytics from the journal's comma-separated tags — surfaces
// which setups actually work for THIS user (process feedback, not signals).
export function PerformanceByTag({ refreshKey = 0 }: PerformanceByTagProps) {
  const { session } = useAuth();
  const [tags, setTags] = useState<Record<string, TagStats> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const res = await fetch("/api/trades/performance/by-tag", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        setError(res.status === 401 ? "Session expired." : "Failed to load.");
        return;
      }
      const data = await res.json();
      setTags(data.tags || {});
      setError(null);
    } catch {
      setError("Failed to load.");
    }
  }, [session?.access_token]);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshKey]);

  const entries = tags
    ? Object.entries(tags).sort((a, b) => b[1].total_trades - a[1].total_trades)
    : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Performance by Tag</CardTitle>
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="text-sm text-muted-foreground">{error}</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            Tag your trades (e.g. &quot;swing, ob&quot;) to see which setups
            actually work for you.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tag</TableHead>
                <TableHead className="text-right">Trades</TableHead>
                <TableHead className="text-right">Win rate</TableHead>
                <TableHead className="text-right">Total P&L</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map(([tag, s]) => (
                <TableRow key={tag}>
                  <TableCell className="font-medium">{tag}</TableCell>
                  <TableCell className="text-right">
                    {s.total_trades}
                    <span className="text-xs text-muted-foreground ml-1">
                      ({s.wins}W/{s.losses}L)
                    </span>
                  </TableCell>
                  <TableCell className="text-right">{s.win_rate.toFixed(1)}%</TableCell>
                  <TableCell
                    className={`text-right font-mono ${
                      s.total_pnl >= 0 ? "text-green-500" : "text-red-500"
                    }`}
                  >
                    {s.total_pnl >= 0 ? "+" : ""}${s.total_pnl.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
