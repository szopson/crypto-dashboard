"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Plus, TrendingUp, TrendingDown, Target, Download } from "lucide-react";
import { EquityCurveChart } from "./EquityCurveChart";

interface Trade {
  id: number;
  symbol: string;
  direction: "LONG" | "SHORT";
  status: "OPEN" | "CLOSED" | "CANCELLED";
  entry_price: number;
  entry_time: string;
  entry_zone_type?: string;
  position_size?: number;
  leverage: number;
  stop_loss?: number;
  take_profit_1?: number;
  take_profit_2?: number;
  take_profit_3?: number;
  risk_reward?: number;
  exit_price?: number;
  exit_time?: string;
  exit_reason?: string;
  realized_pnl?: number;
  realized_pnl_pct?: number;
  confluence_score?: number;
  radar_score?: number;
  radar_classification?: string;
  structural_bias?: string;
  notes?: string;
  tags?: string;
  outcome?: string;
}

interface TradeStats {
  period: string;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  win_rate?: number;
  total_pnl: number;
  avg_win?: number;
  avg_loss?: number;
  profit_factor?: number;
  expectancy?: number;
  current_streak: number;
  max_win_streak: number;
  max_loss_streak: number;
  long_trades: number;
  short_trades: number;
  long_win_rate?: number;
  short_win_rate?: number;
}

// Same-origin: Traefik routes /api to the engine in prod; next.config rewrites
// cover dev. The old NEXT_PUBLIC_API_URL fallback bypassed both.
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

export default function TradeJournal() {
  const { session } = useAuth();
  const authHeaders = useCallback(
    (): Record<string, string> =>
      session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
    [session?.access_token],
  );
  const [authError, setAuthError] = useState(false);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [stats, setStats] = useState<TradeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [exitPrice, setExitPrice] = useState("");
  const [exitReason, setExitReason] = useState("MANUAL");
  const [filter, setFilter] = useState<"ALL" | "OPEN" | "CLOSED">("ALL");

  // Form state for new trade
  const [newTrade, setNewTrade] = useState({
    direction: "LONG" as "LONG" | "SHORT",
    entry_price: "",
    stop_loss: "",
    take_profit_1: "",
    take_profit_2: "",
    position_size: "",
    leverage: "1",
    notes: "",
    tags: "",
  });

  const fetchTrades = async () => {
    try {
      const statusParam = filter !== "ALL" ? `?status=${filter}` : "";
      const res = await fetch(`${API_BASE}/api/trades${statusParam}`, {
        headers: authHeaders(),
      });
      if (res.status === 401) {
        setAuthError(true);
        return;
      }
      setAuthError(false);
      const data = await res.json();
      setTrades(data.trades || []);
    } catch (error) {
      console.error("Error fetching trades:", error);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/trades/stats/summary`, {
        headers: authHeaders(),
      });
      if (res.status === 401) return;
      const data = await res.json();
      setStats(data);
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchTrades(), fetchStats()]);
      setLoading(false);
    };
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, session?.access_token]);

  const handleCreateTrade = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/trades`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          direction: newTrade.direction,
          entry_price: parseFloat(newTrade.entry_price),
          stop_loss: newTrade.stop_loss ? parseFloat(newTrade.stop_loss) : undefined,
          take_profit_1: newTrade.take_profit_1 ? parseFloat(newTrade.take_profit_1) : undefined,
          take_profit_2: newTrade.take_profit_2 ? parseFloat(newTrade.take_profit_2) : undefined,
          position_size: newTrade.position_size ? parseFloat(newTrade.position_size) : undefined,
          leverage: parseFloat(newTrade.leverage),
          notes: newTrade.notes || undefined,
          tags: newTrade.tags || undefined,
        }),
      });

      if (res.ok) {
        setIsDialogOpen(false);
        setNewTrade({
          direction: "LONG",
          entry_price: "",
          stop_loss: "",
          take_profit_1: "",
          take_profit_2: "",
          position_size: "",
          leverage: "1",
          notes: "",
          tags: "",
        });
        await fetchTrades();
        await fetchStats();
      }
    } catch (error) {
      console.error("Error creating trade:", error);
    }
  };

  const handleCloseTrade = async () => {
    if (!selectedTrade || !exitPrice) return;

    try {
      const res = await fetch(
        `${API_BASE}/api/trades/${selectedTrade.id}/close?exit_price=${exitPrice}&exit_reason=${exitReason}`,
        { method: "POST", headers: authHeaders() }
      );

      if (res.ok) {
        setCloseDialogOpen(false);
        setSelectedTrade(null);
        setExitPrice("");
        await fetchTrades();
        await fetchStats();
      }
    } catch (error) {
      console.error("Error closing trade:", error);
    }
  };

  const formatPrice = (price?: number) => {
    if (!price) return "-";
    return `$${price.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  };

  const formatPnl = (pnl?: number, pct?: number) => {
    if (pnl === undefined || pnl === null) return "-";
    const sign = pnl >= 0 ? "+" : "";
    const pctStr = pct !== undefined ? ` (${sign}${pct.toFixed(2)}%)` : "";
    return `${sign}$${pnl.toFixed(2)}${pctStr}`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString();
  };

  const exportToCSV = () => {
    const headers = [
      "ID", "Date", "Symbol", "Direction", "Status", "Entry Price", "Stop Loss",
      "Take Profit 1", "Take Profit 2", "Exit Price", "Exit Reason", "P&L",
      "P&L %", "R:R", "RADAR Score", "Bias", "Notes"
    ];

    const rows = trades.map(trade => [
      trade.id,
      new Date(trade.entry_time).toISOString(),
      trade.symbol,
      trade.direction,
      trade.status,
      trade.entry_price,
      trade.stop_loss || "",
      trade.take_profit_1 || "",
      trade.take_profit_2 || "",
      trade.exit_price || "",
      trade.exit_reason || "",
      trade.realized_pnl || "",
      trade.realized_pnl_pct || "",
      trade.risk_reward || "",
      trade.radar_score || "",
      trade.structural_bias || "",
      `"${(trade.notes || "").replace(/"/g, '""')}"`
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `trades_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportToJSON = () => {
    const data = {
      exported_at: new Date().toISOString(),
      stats: stats,
      trades: trades
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `trades_${new Date().toISOString().split("T")[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-300" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {authError && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-400">
          Session expired — sign in again to load your journal.
        </div>
      )}
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{stats.total_trades}</div>
              <div className="text-sm text-muted-foreground">Total Trades</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-green-500">
                {stats.win_rate?.toFixed(1) || 0}%
              </div>
              <div className="text-sm text-muted-foreground">Win Rate</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className={`text-2xl font-bold ${stats.total_pnl >= 0 ? "text-green-500" : "text-red-500"}`}>
                {stats.total_pnl >= 0 ? "+" : ""}${stats.total_pnl.toFixed(2)}
              </div>
              <div className="text-sm text-muted-foreground">Total P&L</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-blue-500">
                {stats.profit_factor?.toFixed(2) || "-"}
              </div>
              <div className="text-sm text-muted-foreground">Profit Factor</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">
                {stats.current_streak > 0 ? `+${stats.current_streak}` : stats.current_streak}
              </div>
              <div className="text-sm text-muted-foreground">Current Streak</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex gap-2 text-lg font-bold">
                <span className="text-green-500">{stats.winning_trades}W</span>
                <span className="text-red-500">{stats.losing_trades}L</span>
              </div>
              <div className="text-sm text-muted-foreground">W/L Record</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Equity Curve Chart */}
      {stats && stats.total_trades > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <EquityCurveChart startingEquity={10000} />
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Performance Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Avg Win</div>
                  <div className="font-medium text-green-500">
                    ${stats.avg_win?.toFixed(2) || "0.00"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Avg Loss</div>
                  <div className="font-medium text-red-500">
                    ${stats.avg_loss?.toFixed(2) || "0.00"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Expectancy</div>
                  <div className="font-medium">
                    ${stats.expectancy?.toFixed(2) || "0.00"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Max Win Streak</div>
                  <div className="font-medium text-green-500">{stats.max_win_streak}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Max Loss Streak</div>
                  <div className="font-medium text-red-500">{stats.max_loss_streak}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Long Win Rate</div>
                  <div className="font-medium">
                    {stats.long_win_rate?.toFixed(1) || "0"}% ({stats.long_trades})
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Short Win Rate</div>
                  <div className="font-medium">
                    {stats.short_win_rate?.toFixed(1) || "0"}% ({stats.short_trades})
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Trade List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
          <CardTitle>Trade Journal</CardTitle>
          <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
            <Select value={filter} onValueChange={(v: "ALL" | "OPEN" | "CLOSED") => setFilter(v)}>
              <SelectTrigger className="w-24 sm:w-32">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                <SelectItem value="OPEN">Open</SelectItem>
                <SelectItem value="CLOSED">Closed</SelectItem>
              </SelectContent>
            </Select>

            {trades.length > 0 && (
              <div className="flex gap-1">
                <Button variant="outline" size="sm" onClick={exportToCSV} title="Export to CSV">
                  <Download className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">CSV</span>
                </Button>
                <Button variant="outline" size="sm" onClick={exportToJSON} title="Export to JSON">
                  <Download className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">JSON</span>
                </Button>
              </div>
            )}

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" /> New Trade
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Log New Trade</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <Button
                      variant={newTrade.direction === "LONG" ? "default" : "outline"}
                      className={newTrade.direction === "LONG" ? "bg-green-600 hover:bg-green-700" : ""}
                      onClick={() => setNewTrade({ ...newTrade, direction: "LONG" })}
                    >
                      <TrendingUp className="w-4 h-4 mr-2" /> LONG
                    </Button>
                    <Button
                      variant={newTrade.direction === "SHORT" ? "default" : "outline"}
                      className={newTrade.direction === "SHORT" ? "bg-red-600 hover:bg-red-700" : ""}
                      onClick={() => setNewTrade({ ...newTrade, direction: "SHORT" })}
                    >
                      <TrendingDown className="w-4 h-4 mr-2" /> SHORT
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Entry Price</Label>
                      <Input
                        type="number"
                        value={newTrade.entry_price}
                        onChange={(e) => setNewTrade({ ...newTrade, entry_price: e.target.value })}
                        placeholder="69000"
                      />
                    </div>
                    <div>
                      <Label>Stop Loss</Label>
                      <Input
                        type="number"
                        value={newTrade.stop_loss}
                        onChange={(e) => setNewTrade({ ...newTrade, stop_loss: e.target.value })}
                        placeholder="68000"
                      />
                    </div>
                    <div>
                      <Label>Take Profit 1</Label>
                      <Input
                        type="number"
                        value={newTrade.take_profit_1}
                        onChange={(e) => setNewTrade({ ...newTrade, take_profit_1: e.target.value })}
                        placeholder="71000"
                      />
                    </div>
                    <div>
                      <Label>Take Profit 2</Label>
                      <Input
                        type="number"
                        value={newTrade.take_profit_2}
                        onChange={(e) => setNewTrade({ ...newTrade, take_profit_2: e.target.value })}
                        placeholder="73000"
                      />
                    </div>
                    <div>
                      <Label>Position Size ($)</Label>
                      <Input
                        type="number"
                        value={newTrade.position_size}
                        onChange={(e) => setNewTrade({ ...newTrade, position_size: e.target.value })}
                        placeholder="1000"
                      />
                    </div>
                    <div>
                      <Label>Leverage</Label>
                      <Input
                        type="number"
                        value={newTrade.leverage}
                        onChange={(e) => setNewTrade({ ...newTrade, leverage: e.target.value })}
                        placeholder="1"
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Notes</Label>
                    <Textarea
                      value={newTrade.notes}
                      onChange={(e) => setNewTrade({ ...newTrade, notes: e.target.value })}
                      placeholder="Trade rationale..."
                    />
                  </div>

                  <div>
                    <Label>Tags (comma-separated)</Label>
                    <Input
                      value={newTrade.tags}
                      onChange={(e) => setNewTrade({ ...newTrade, tags: e.target.value })}
                      placeholder="swing, trend, ob"
                    />
                  </div>

                  <Button
                    onClick={handleCreateTrade}
                    disabled={!newTrade.entry_price}
                    className="w-full"
                  >
                    Log Trade
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead>Entry</TableHead>
                <TableHead>SL / TP1</TableHead>
                <TableHead>R:R</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Exit</TableHead>
                <TableHead>P&L</TableHead>
                <TableHead>Context</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trades.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                    No trades logged yet. Click "New Trade" to start.
                  </TableCell>
                </TableRow>
              ) : (
                trades.map((trade) => (
                  <TableRow key={trade.id}>
                    <TableCell className="whitespace-nowrap">
                      {new Date(trade.entry_time).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={trade.direction === "LONG" ? "default" : "destructive"}>
                        {trade.direction === "LONG" ? (
                          <TrendingUp className="w-3 h-3 mr-1" />
                        ) : (
                          <TrendingDown className="w-3 h-3 mr-1" />
                        )}
                        {trade.direction}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatPrice(trade.entry_price)}</TableCell>
                    <TableCell className="text-sm">
                      <div className="text-red-400">{formatPrice(trade.stop_loss)}</div>
                      <div className="text-green-400">{formatPrice(trade.take_profit_1)}</div>
                    </TableCell>
                    <TableCell>{trade.risk_reward?.toFixed(1) || "-"}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          trade.status === "OPEN"
                            ? "outline"
                            : trade.outcome === "WIN"
                            ? "default"
                            : "destructive"
                        }
                        className={trade.status === "OPEN" ? "border-yellow-500 text-yellow-500" : ""}
                      >
                        {trade.status === "OPEN" ? "OPEN" : trade.outcome || trade.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {trade.exit_price ? (
                        <div>
                          <div>{formatPrice(trade.exit_price)}</div>
                          <div className="text-xs text-muted-foreground">{trade.exit_reason}</div>
                        </div>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      <span
                        className={
                          trade.realized_pnl && trade.realized_pnl >= 0
                            ? "text-green-500"
                            : "text-red-500"
                        }
                      >
                        {formatPnl(trade.realized_pnl, trade.realized_pnl_pct)}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div>RADAR: {trade.radar_score?.toFixed(1) || "-"}</div>
                      <div>Bias: {trade.structural_bias || "-"}</div>
                    </TableCell>
                    <TableCell>
                      {trade.status === "OPEN" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedTrade(trade);
                            setCloseDialogOpen(true);
                          }}
                        >
                          <Target className="w-3 h-3 mr-1" /> Close
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Close Trade Dialog */}
      <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close Trade #{selectedTrade?.id}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              {selectedTrade?.direction} @ {formatPrice(selectedTrade?.entry_price)}
            </div>

            <div>
              <Label>Exit Price</Label>
              <Input
                type="number"
                value={exitPrice}
                onChange={(e) => setExitPrice(e.target.value)}
                placeholder="70000"
              />
            </div>

            <div>
              <Label>Exit Reason</Label>
              <Select value={exitReason} onValueChange={setExitReason}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TP1">Take Profit 1</SelectItem>
                  <SelectItem value="TP2">Take Profit 2</SelectItem>
                  <SelectItem value="TP3">Take Profit 3</SelectItem>
                  <SelectItem value="SL">Stop Loss</SelectItem>
                  <SelectItem value="MANUAL">Manual</SelectItem>
                  <SelectItem value="TRAILING">Trailing Stop</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleCloseTrade} disabled={!exitPrice} className="w-full">
              Close Trade
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
