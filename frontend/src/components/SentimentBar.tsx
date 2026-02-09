"use client";

import { useEffect, useState } from "react";
import { useSymbol } from "@/contexts/SymbolContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface SentimentData {
  timestamp: string;
  symbol: string;
  market_mood: {
    mood: string;
    color: string;
    description: string;
  };
  contrarian_signal: {
    outlook: string;
    score: number;
    color: string;
    description: string;
  };
  fear_greed: {
    value: number;
    yesterday_value: number | null;
    change: number | null;
    classification: string;
    signal: string;
    trading_sentiment: string;
  };
  funding: {
    rate: number;
    signal: string;
    trading_sentiment: string;
  };
  long_short: {
    long_ratio: number;
    short_ratio: number;
    ratio: number;
    signal: string;
    estimated: boolean;
  };
  open_interest: {
    value: number | null;
    symbol: string;
  };
  price: {
    current: number | null;
    change_24h: number | null;
  };
}

interface SentimentBarProps {
  refreshInterval?: number;
}

export function SentimentBar({ refreshInterval = 300000 }: SentimentBarProps) {
  const { symbol } = useSymbol();
  const [sentiment, setSentiment] = useState<SentimentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSentiment = async () => {
    try {
      const params = new URLSearchParams();
      if (symbol) params.append("symbol", symbol);
      const url = `/api/sentiment${params.toString() ? `?${params}` : ""}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch sentiment");
      const data = await response.json();
      setSentiment(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error fetching sentiment");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSentiment();
    const interval = setInterval(fetchSentiment, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval, symbol]);

  if (loading && !sentiment) {
    return (
      <Card className="bg-card/50 backdrop-blur">
        <CardContent className="py-2 px-4">
          <div className="flex items-center justify-center text-sm text-muted-foreground">
            Loading sentiment...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error && !sentiment) {
    return null;
  }

  if (!sentiment) return null;

  const getMoodColor = (mood: string) => {
    switch (mood) {
      case "EUPHORIC":
        return "text-green-500 bg-green-500/10";
      case "GREEDY":
        return "text-lime-500 bg-lime-500/10";
      case "FEARFUL":
        return "text-red-500 bg-red-500/10";
      case "CAUTIOUS":
        return "text-orange-500 bg-orange-500/10";
      default:
        return "text-yellow-500 bg-yellow-500/10";
    }
  };

  const getSignalColor = (outlook: string) => {
    switch (outlook) {
      case "STRONG_BUY":
        return "text-green-500 bg-green-500/10";
      case "BUY":
        return "text-lime-500 bg-lime-500/10";
      case "STRONG_SELL":
        return "text-red-500 bg-red-500/10";
      case "SELL":
        return "text-orange-500 bg-orange-500/10";
      default:
        return "text-yellow-500 bg-yellow-500/10";
    }
  };

  const getFearGreedColor = (value: number) => {
    if (value <= 25) return "text-red-500";
    if (value <= 45) return "text-orange-500";
    if (value <= 55) return "text-yellow-500";
    if (value <= 75) return "text-lime-500";
    return "text-green-500";
  };

  const getFundingColor = (rate: number) => {
    if (rate > 0.03) return "text-red-500";
    if (rate > 0.01) return "text-orange-500";
    if (rate < -0.03) return "text-green-500";
    if (rate < -0.01) return "text-lime-500";
    return "text-muted-foreground";
  };

  const getLongShortColor = (longRatio: number) => {
    if (longRatio > 60) return "text-red-500";
    if (longRatio > 55) return "text-orange-500";
    if (longRatio < 40) return "text-green-500";
    if (longRatio < 45) return "text-lime-500";
    return "text-muted-foreground";
  };

  const getChangeColor = (change: number | null) => {
    if (change === null) return "text-muted-foreground";
    if (change > 5) return "text-green-500";
    if (change > 0) return "text-lime-500";
    if (change < -5) return "text-red-500";
    if (change < 0) return "text-orange-500";
    return "text-muted-foreground";
  };

  return (
    <TooltipProvider>
      <Card className="bg-card/80 backdrop-blur border-b">
        <CardContent className="py-2 px-2 sm:px-4">
          <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-4 text-xs sm:text-sm">
            {/* Market Mood */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground hidden sm:inline">Mood:</span>
                  <Badge
                    variant="outline"
                    className={`font-semibold ${getMoodColor(sentiment.market_mood.mood)}`}
                  >
                    {sentiment.market_mood.mood}
                  </Badge>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{sentiment.market_mood.description}</p>
                <p className="text-xs text-muted-foreground">Current market sentiment</p>
              </TooltipContent>
            </Tooltip>

            <div className="hidden sm:block h-4 w-px bg-border" />

            {/* Contrarian Signal */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground hidden sm:inline">Signal:</span>
                  <Badge
                    variant="outline"
                    className={`font-semibold ${getSignalColor(sentiment.contrarian_signal.outlook)}`}
                  >
                    {sentiment.contrarian_signal.outlook.replace("_", " ")}
                  </Badge>
                  <span className="text-muted-foreground text-xs">
                    ({sentiment.contrarian_signal.score > 0 ? "+" : ""}{sentiment.contrarian_signal.score.toFixed(0)})
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Contrarian Trading Signal</p>
                <p className="text-xs text-muted-foreground">{sentiment.contrarian_signal.description}</p>
                <p className="text-xs mt-1">Score: {sentiment.contrarian_signal.score.toFixed(1)} (-100 to +100)</p>
              </TooltipContent>
            </Tooltip>

            <div className="hidden sm:block h-4 w-px bg-border" />

            {/* Fear & Greed with Change */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">F&G:</span>
                  <span className={`font-medium ${getFearGreedColor(sentiment.fear_greed.value)}`}>
                    {sentiment.fear_greed.value}
                  </span>
                  {sentiment.fear_greed.change !== null && (
                    <span className={`text-xs ${getChangeColor(sentiment.fear_greed.change)}`}>
                      ({sentiment.fear_greed.change > 0 ? "+" : ""}{sentiment.fear_greed.change})
                    </span>
                  )}
                  <span className="text-muted-foreground text-xs hidden md:inline">
                    ({sentiment.fear_greed.classification})
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Fear & Greed Index: {sentiment.fear_greed.classification}</p>
                <p className="text-xs">Today: {sentiment.fear_greed.value}</p>
                {sentiment.fear_greed.yesterday_value !== null && (
                  <p className="text-xs">Yesterday: {sentiment.fear_greed.yesterday_value}</p>
                )}
                {sentiment.fear_greed.change !== null && (
                  <p className={`text-xs font-medium ${getChangeColor(sentiment.fear_greed.change)}`}>
                    Change: {sentiment.fear_greed.change > 0 ? "+" : ""}{sentiment.fear_greed.change}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">0 = Extreme Fear, 100 = Extreme Greed</p>
              </TooltipContent>
            </Tooltip>

            <div className="hidden sm:block h-4 w-px bg-border" />

            {/* Funding Rate */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Fund:</span>
                  <span className={`font-medium ${getFundingColor(sentiment.funding.rate)}`}>
                    {sentiment.funding.rate > 0 ? "+" : ""}{sentiment.funding.rate.toFixed(4)}%
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Funding Rate: {sentiment.funding.rate.toFixed(4)}%</p>
                <p className="text-xs text-muted-foreground">Positive = longs pay shorts</p>
                <p className="text-xs">Signal: {sentiment.funding.signal}</p>
              </TooltipContent>
            </Tooltip>

            <div className="hidden sm:block h-4 w-px bg-border" />

            {/* Long/Short Ratio */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">L/S:</span>
                  <span className={`font-medium ${getLongShortColor(sentiment.long_short.long_ratio)}`}>
                    {sentiment.long_short.long_ratio.toFixed(0)}%
                  </span>
                  <span className="text-muted-foreground">/</span>
                  <span className="font-medium">
                    {sentiment.long_short.short_ratio.toFixed(0)}%
                  </span>
                  {sentiment.long_short.estimated && (
                    <span className="text-xs text-muted-foreground">*</span>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Long/Short Ratio</p>
                <p className="text-xs">Longs: {sentiment.long_short.long_ratio.toFixed(1)}%</p>
                <p className="text-xs">Shorts: {sentiment.long_short.short_ratio.toFixed(1)}%</p>
                <p className="text-xs">Signal: {sentiment.long_short.signal}</p>
                {sentiment.long_short.estimated && (
                  <p className="text-xs text-muted-foreground">* Estimated from funding</p>
                )}
              </TooltipContent>
            </Tooltip>

            {/* Open Interest (optional) */}
            {sentiment.open_interest.value && (
              <>
                <div className="hidden lg:block h-4 w-px bg-border" />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="hidden lg:flex items-center gap-1.5">
                      <span className="text-muted-foreground">OI:</span>
                      <span className="font-medium">
                        ${(sentiment.open_interest.value / 1e9).toFixed(2)}B
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Open Interest</p>
                    <p className="text-xs">${sentiment.open_interest.value?.toLocaleString()}</p>
                  </TooltipContent>
                </Tooltip>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
