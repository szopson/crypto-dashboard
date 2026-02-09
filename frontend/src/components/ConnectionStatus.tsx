"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type ConnectionState = "connected" | "disconnected" | "checking";

export function ConnectionStatus() {
  const [status, setStatus] = useState<ConnectionState>("checking");
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [latency, setLatency] = useState<number | null>(null);

  const checkConnection = useCallback(async () => {
    const startTime = Date.now();
    try {
      const response = await fetch("/api/health", {
        method: "GET",
        cache: "no-store",
      });

      if (response.ok) {
        setStatus("connected");
        setLatency(Date.now() - startTime);
      } else {
        setStatus("disconnected");
        setLatency(null);
      }
    } catch {
      setStatus("disconnected");
      setLatency(null);
    }
    setLastCheck(new Date());
  }, []);

  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, [checkConnection]);

  const statusConfig = {
    connected: {
      color: "bg-green-500",
      text: "Connected",
      pulse: false,
    },
    disconnected: {
      color: "bg-red-500",
      text: "Disconnected",
      pulse: true,
    },
    checking: {
      color: "bg-yellow-500",
      text: "Checking...",
      pulse: true,
    },
  };

  const config = statusConfig[status];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className="gap-1.5 cursor-pointer h-7 px-2"
            onClick={checkConnection}
          >
            <span
              className={`w-2 h-2 rounded-full ${config.color} ${
                config.pulse ? "animate-pulse" : ""
              }`}
            />
            <span className="text-xs hidden sm:inline">{config.text}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <div className="text-xs space-y-1">
            <p className="font-medium">Backend Status: {config.text}</p>
            {latency && <p>Latency: {latency}ms</p>}
            {lastCheck && (
              <p>Last checked: {lastCheck.toLocaleTimeString()}</p>
            )}
            <p className="text-muted-foreground">Click to refresh</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
