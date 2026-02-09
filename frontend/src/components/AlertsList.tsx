"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Alert {
  id: number;
  timestamp: string;
  symbol: string;
  action?: string;
  price?: number;
  message?: string;
  timeframe?: string;
  processed: boolean;
}

interface AlertsListProps {
  maxHeight?: number;
  refreshInterval?: number;
}

export function AlertsList({
  maxHeight = 400,
  refreshInterval = 30000,
}: AlertsListProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    try {
      const response = await fetch("/api/alerts");
      if (!response.ok) {
        throw new Error("Failed to fetch alerts");
      }
      const data = await response.json();
      setAlerts(data.alerts || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteAlert = async (id: number) => {
    try {
      const response = await fetch(`/api/alerts/${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setAlerts((prev) => prev.filter((a) => a.id !== id));
      }
    } catch (err) {
      console.error("Failed to delete alert:", err);
    }
  };

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchAlerts, refreshInterval]);

  const getActionColor = (action?: string) => {
    if (!action) return "bg-gray-500/20 text-gray-400";
    const upper = action.toUpperCase();
    if (upper.includes("BUY") || upper.includes("LONG")) {
      return "bg-green-500/20 text-green-500";
    }
    if (upper.includes("SELL") || upper.includes("SHORT")) {
      return "bg-red-500/20 text-red-500";
    }
    return "bg-yellow-500/20 text-yellow-500";
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">TradingView Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            Loading alerts...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">TradingView Alerts</CardTitle>
          <Button variant="ghost" size="sm" onClick={fetchAlerts}>
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="text-center text-destructive py-4">
            Error: {error}
          </div>
        ) : alerts.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <p>No alerts yet</p>
            <p className="text-xs mt-2">
              Configure TradingView webhooks to send alerts to:
            </p>
            <code className="text-xs bg-muted px-2 py-1 rounded mt-1 block">
              POST /api/webhook/tradingview
            </code>
          </div>
        ) : (
          <ScrollArea style={{ height: maxHeight }}>
            <div className="space-y-2">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-start justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{alert.symbol}</span>
                      {alert.action && (
                        <Badge className={getActionColor(alert.action)}>
                          {alert.action}
                        </Badge>
                      )}
                      {alert.timeframe && (
                        <span className="text-xs text-muted-foreground">
                          {alert.timeframe}
                        </span>
                      )}
                    </div>
                    {alert.price && (
                      <p className="text-sm font-mono">
                        ${alert.price.toLocaleString()}
                      </p>
                    )}
                    {alert.message && (
                      <p className="text-xs text-muted-foreground truncate mt-1">
                        {alert.message}
                      </p>
                    )}
                  </div>
                  <div className="text-right ml-2 flex-shrink-0">
                    <p className="text-xs text-muted-foreground">
                      {formatDate(alert.timestamp)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatTime(alert.timestamp)}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs mt-1"
                      onClick={() => deleteAlert(alert.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
