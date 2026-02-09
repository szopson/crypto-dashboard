"use client";

import { useEffect, useRef, memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSymbol, formatSymbol } from "@/contexts/SymbolContext";

interface TradingViewChartProps {
  interval?: string;
  theme?: "light" | "dark";
  height?: number;
  showToolbar?: boolean;
}

// Convert our symbol format to TradingView format
// "BTC/USDT:USDT" -> "BYBIT:BTCUSDT.P"
function toTradingViewSymbol(symbol: string): string {
  const base = symbol.split("/")[0]; // "BTC"
  return `BYBIT:${base}USDT.P`;
}

function TradingViewChartComponent({
  interval = "D",
  theme = "dark",
  height = 500,
  showToolbar = true,
}: TradingViewChartProps) {
  const { symbol: contextSymbol } = useSymbol();
  const tvSymbol = toTradingViewSymbol(contextSymbol);
  const containerRef = useRef<HTMLDivElement>(null);
  const scriptRef = useRef<HTMLScriptElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear previous widget
    containerRef.current.innerHTML = "";

    // Create widget container
    const widgetContainer = document.createElement("div");
    widgetContainer.className = "tradingview-widget-container";
    widgetContainer.style.height = "100%";
    widgetContainer.style.width = "100%";

    const widgetDiv = document.createElement("div");
    widgetDiv.className = "tradingview-widget-container__widget";
    widgetDiv.style.height = `calc(100% - 32px)`;
    widgetDiv.style.width = "100%";

    widgetContainer.appendChild(widgetDiv);
    containerRef.current.appendChild(widgetContainer);

    // Create and load script
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: tvSymbol,
      interval: interval,
      timezone: "Etc/UTC",
      theme: theme,
      style: "1",
      locale: "en",
      enable_publishing: false,
      allow_symbol_change: true,
      calendar: false,
      support_host: "https://www.tradingview.com",
      hide_top_toolbar: !showToolbar,
      hide_legend: false,
      save_image: false,
      hide_volume: false,
      studies: [
        "STD;Bollinger_Bands",
        "STD;RSI",
      ],
      container_id: widgetDiv.id || undefined,
    });

    widgetContainer.appendChild(script);
    scriptRef.current = script;

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [tvSymbol, interval, theme, showToolbar]);

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{formatSymbol(contextSymbol)} Chart</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div
          ref={containerRef}
          style={{ height: `${height}px`, width: "100%" }}
        />
      </CardContent>
    </Card>
  );
}

export const TradingViewChart = memo(TradingViewChartComponent);
