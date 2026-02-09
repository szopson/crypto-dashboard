"use client";

import { useEffect, useRef, memo } from "react";
import { useSymbol } from "@/contexts/SymbolContext";

interface TradingViewMiniChartProps {
  width?: string | number;
  height?: number;
  theme?: "light" | "dark";
  dateRange?: "1D" | "1M" | "3M" | "12M" | "60M" | "ALL";
}

// Convert our symbol format to TradingView format
function toTradingViewSymbol(symbol: string): string {
  const base = symbol.split("/")[0];
  return `BYBIT:${base}USDT.P`;
}

function TradingViewMiniChartComponent({
  width = "100%",
  height = 220,
  theme = "dark",
  dateRange = "1M",
}: TradingViewMiniChartProps) {
  const { symbol: contextSymbol } = useSymbol();
  const tvSymbol = toTradingViewSymbol(contextSymbol);
  const containerRef = useRef<HTMLDivElement>(null);

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
    widgetContainer.appendChild(widgetDiv);

    // Create and load script
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbol: tvSymbol,
      width: width,
      height: height,
      locale: "en",
      dateRange: dateRange,
      colorTheme: theme,
      isTransparent: true,
      autosize: false,
      largeChartUrl: "",
      noTimeScale: false,
      chartOnly: false,
    });

    widgetContainer.appendChild(script);
    containerRef.current.appendChild(widgetContainer);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [tvSymbol, width, height, theme, dateRange]);

  return (
    <div
      ref={containerRef}
      style={{ height: `${height}px`, width: typeof width === "number" ? `${width}px` : width }}
    />
  );
}

export const TradingViewMiniChart = memo(TradingViewMiniChartComponent);
