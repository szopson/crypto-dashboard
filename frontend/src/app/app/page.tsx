"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, ScanSearch } from "lucide-react";
import { useMarketData } from "@/hooks/useMarketData";
import { useSymbol, formatSymbolShort, formatSymbol } from "@/contexts/SymbolContext";
import { BiasGrid } from "@/components/BiasGrid";
import { RadarScore } from "@/components/RadarScore";
import { PriceDisplay } from "@/components/PriceDisplay";
import { TradingViewChart } from "@/components/TradingViewChart";
import { AlertsList } from "@/components/AlertsList";
import { ConfluenceCheck } from "@/components/ConfluenceCheck";
import { CopilotChat } from "@/components/CopilotChat";
import TradeJournal from "@/components/TradeJournal";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SentimentBar } from "@/components/SentimentBar";
import { SymbolSelector } from "@/components/SymbolSelector";
import { BacktestPanel } from "@/components/BacktestPanel";
import { KeyboardShortcuts } from "@/components/KeyboardShortcuts";
import { InstallPWA } from "@/components/InstallPWA";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { QuotaPopover } from "@/components/QuotaPopover";
import { FloatingActions } from "@/components/FloatingActions";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  SkeletonPrice,
  SkeletonRadar,
  SkeletonBiasGrid,
  SkeletonSentimentBar,
} from "@/components/ui/skeleton";

export default function Dashboard() {
  const { symbol } = useSymbol();
  const { price, radar, bias, loading, error, lastUpdate, stale, lastGoodAt, refresh } =
    useMarketData(60000, symbol); // Refresh every 60 seconds
  const [activeTab, setActiveTab] = useState("overview");
  const [chartOpen, setChartOpen] = useState(false);
  // Backtest is RADAR-only with no fee model — not honest enough to headline.
  // Kept reachable for power users behind ?labs=1 (read post-mount: this is a
  // client page and useSearchParams would force a Suspense boundary).
  const [showLabs, setShowLabs] = useState(false);
  useEffect(() => {
    setShowLabs(new URLSearchParams(window.location.search).get("labs") === "1");
  }, []);

  if (loading && !price) {
    return (
      <div className="min-h-screen bg-background">
        {/* Skeleton Header */}
        <header className="border-b bg-card sticky top-0 z-50">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-6 w-40 bg-muted animate-pulse rounded hidden sm:block" />
              <div className="h-9 w-28 bg-muted animate-pulse rounded-md" />
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="h-9 w-20 bg-muted animate-pulse rounded-md" />
              <div className="h-9 w-9 bg-muted animate-pulse rounded-md" />
            </div>
          </div>
        </header>

        {/* Skeleton Sentiment Bar */}
        <div className="border-b">
          <div className="container mx-auto">
            <SkeletonSentimentBar />
          </div>
        </div>

        {/* Skeleton Main Content */}
        <main className="container mx-auto px-2 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
          {/* Skeleton Tabs */}
          <div className="h-10 w-full max-w-2xl bg-muted animate-pulse rounded-lg" />

          {/* Skeleton Dashboard */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <div className="sm:col-span-2 lg:col-span-1">
              <SkeletonPrice />
            </div>
            <div className="sm:col-span-2 lg:col-span-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <SkeletonRadar />
                <SkeletonRadar />
              </div>
            </div>
          </div>

          <SkeletonBiasGrid />
        </main>
      </div>
    );
  }

  return (
    <ErrorBoundary>
    <div className="min-h-screen bg-background">
      {/* Keyboard Shortcuts Handler */}
      <KeyboardShortcuts onRefresh={refresh} onTabChange={setActiveTab} />

      {/* Floating Action Button (Mobile) */}
      <FloatingActions onRefresh={refresh} onTabChange={setActiveTab} />

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-(--glass-border) bg-background/60 backdrop-blur-md">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg sm:text-xl font-bold text-gradient-brand">Follio</h1>
            <SymbolSelector />
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              href="/research"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:inline"
            >
              Research
            </Link>
            <ConnectionStatus degraded={!!error} />
            {lastUpdate && (
              <span className="text-xs sm:text-sm text-muted-foreground hidden md:inline">
                {lastUpdate.toLocaleTimeString()}
              </span>
            )}
            <Button variant="outline" size="sm" onClick={refresh} className="h-9 hidden sm:flex">
              Refresh
            </Button>
            <QuotaPopover />
            <InstallPWA />
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Degraded-mode banner: the engine is erroring but the workspace keeps
          rendering — from a cached snapshot when one exists. */}
      {error && (
        <div className="border-b border-amber-500/30 bg-amber-500/10">
          <div className="container mx-auto px-4 py-2 flex items-center justify-between gap-3 text-sm text-amber-600 dark:text-amber-400">
            <span>
              Live engine unreachable
              {stale && lastGoodAt
                ? ` — snapshot from ${lastGoodAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                : ""}
              {" · retrying"}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={refresh}
              className="h-7 px-2 text-amber-600 dark:text-amber-400 hover:text-amber-500"
            >
              Retry now
            </Button>
          </div>
        </div>
      )}

      {/* Sentiment Bar */}
      <div className="border-b">
        <div className="container mx-auto">
          <SentimentBar />
        </div>
      </div>

      {/* Main content */}
      <main className="container mx-auto px-2 sm:px-4 py-4 sm:py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
          <div className="overflow-x-auto -mx-2 px-2 sm:mx-0 sm:px-0 scrollbar-hide">
            <TabsList variant="glass" className="inline-flex w-max sm:w-full h-10 p-1 gap-0.5 rounded-xl">
              <TabsTrigger value="overview" className="text-xs sm:text-sm px-3 sm:px-4 whitespace-nowrap">Overview</TabsTrigger>
              <TabsTrigger value="confluence" className="text-xs sm:text-sm px-3 sm:px-4 whitespace-nowrap">Confluence</TabsTrigger>
              <TabsTrigger value="journal" className="text-xs sm:text-sm px-3 sm:px-4 whitespace-nowrap">Journal</TabsTrigger>
              <TabsTrigger value="copilot" className="text-xs sm:text-sm px-3 sm:px-4 whitespace-nowrap">Copilot</TabsTrigger>
              <TabsTrigger value="alerts" className="text-xs sm:text-sm px-3 sm:px-4 whitespace-nowrap">Alerts</TabsTrigger>
              {showLabs && (
                <TabsTrigger value="backtest" className="text-xs sm:text-sm px-3 sm:px-4 whitespace-nowrap">Backtest</TabsTrigger>
              )}
            </TabsList>
          </div>

          <TabsContent value="overview" className="space-y-4 sm:space-y-6">
            {/* Top row: Price and RADAR scores */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {/* Price */}
              <div className="sm:col-span-2 lg:col-span-1">
                {price && <PriceDisplay price={price} />}
              </div>

              {/* RADAR scores */}
              <div className="sm:col-span-2 lg:col-span-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  {radar?.radars["1D"] && (
                    <RadarScore radar={radar.radars["1D"]} showDetails />
                  )}
                  {radar?.radars["1W"] && (
                    <RadarScore radar={radar.radars["1W"]} showDetails />
                  )}
                </div>
              </div>
            </div>

            {/* Bias Grid */}
            {bias && (
              <BiasGrid
                biases={bias.biases}
                radars={radar?.radars}
                currentPrice={bias.current_price}
                overallBias={bias.overall_bias}
                keyLevels={bias.key_levels as Array<{ price: number; type: string; timeframe: string; description: string }>}
              />
            )}

            {/* Chart (folded in from the former Chart tab) */}
            <div className="rounded-xl border border-(--glass-border)">
              <button
                type="button"
                onClick={() => setChartOpen((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/40 transition-colors rounded-xl"
              >
                <span>Price chart — {formatSymbolShort(symbol)}</span>
                <ChevronDown
                  className={`size-4 text-muted-foreground transition-transform ${chartOpen ? "rotate-180" : ""}`}
                />
              </button>
              {chartOpen && (
                <div className="px-2 pb-2 sm:px-4 sm:pb-4">
                  <TradingViewChart height={400} />
                </div>
              )}
            </div>

            {/* Info section */}
            <Card>
              <CardContent className="pt-4 sm:pt-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 text-xs sm:text-sm">
                  <div>
                    <h3 className="font-semibold mb-1 sm:mb-2">RADAR Guide</h3>
                    <ul className="space-y-0.5 sm:space-y-1 text-muted-foreground">
                      <li>
                        <span className="text-green-500">5-6:</span> Accumulation regime
                      </li>
                      <li>
                        <span className="text-yellow-500">3-4:</span> Neutral regime
                      </li>
                      <li>
                        <span className="text-red-500">0-2:</span> Distribution regime
                      </li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1 sm:mb-2">Structure</h3>
                    <ul className="space-y-0.5 sm:space-y-1 text-muted-foreground">
                      <li><span className="text-green-500">HH_HL:</span> Bullish</li>
                      <li><span className="text-red-500">LH_LL:</span> Bearish</li>
                      <li><span className="text-yellow-500">Mixed:</span> Choppy</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1 sm:mb-2">Secondary Swing</h3>
                    <ul className="space-y-0.5 sm:space-y-1 text-muted-foreground">
                      <li>SS = Invalidation</li>
                      <li>Break SS = Flip</li>
                      <li>Dist = vs SS</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1 sm:mb-2">Data Source</h3>
                    <ul className="space-y-0.5 sm:space-y-1 text-muted-foreground">
                      <li>Bybit</li>
                      <li>{formatSymbol(symbol)} Perp</li>
                      <li>Refresh: 60s</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="confluence" className="space-y-4 sm:space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
              <div className="lg:col-span-2 order-2 lg:order-1">
                <ConfluenceCheck />
              </div>
              <div className="space-y-3 sm:space-y-4 order-1 lg:order-2">
                {price && <PriceDisplay price={price} />}
                {radar?.radars["1D"] && (
                  <RadarScore radar={radar.radars["1D"]} showDetails />
                )}
                {bias && (
                  <Card>
                    <CardContent className="pt-4">
                      <h3 className="font-semibold mb-2">MTF Bias</h3>
                      <div className="space-y-2 text-sm">
                        {["1H", "4H", "1D", "1W"].map((tf) => {
                          const b = bias.biases[tf as keyof typeof bias.biases];
                          if (!b) return null;
                          return (
                            <div key={tf} className="flex justify-between">
                              <span className="text-muted-foreground">{tf}</span>
                              <div className="text-right">
                                <span
                                  className={
                                    b.structural_bias === "BULLISH"
                                      ? "text-green-500"
                                      : b.structural_bias === "BEARISH"
                                      ? "text-red-500"
                                      : "text-yellow-500"
                                  }
                                >
                                  {b.structural_bias}
                                </span>
                                {b.ss_distance_pct !== null && b.ss_distance_pct !== undefined && (
                                  <span className="text-xs text-muted-foreground ml-2">
                                    ({b.ss_distance_pct > 0 ? "+" : ""}{b.ss_distance_pct.toFixed(1)}%)
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="journal" className="space-y-6">
            <Link
              href="/app/trade-review"
              className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4 hover:bg-primary/10 transition-colors"
            >
              <ScanSearch className="size-5 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium">Trade Review</p>
                <p className="text-xs text-muted-foreground">
                  Upload a trade screenshot — grade the decision, not the outcome.
                </p>
              </div>
            </Link>
            <TradeJournal />
          </TabsContent>

          <TabsContent value="copilot" className="space-y-4 sm:space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
              <div className="lg:col-span-2 h-[400px] sm:h-[500px] lg:h-[600px] order-2 lg:order-1">
                <CopilotChat />
              </div>
              <div className="space-y-3 sm:space-y-4 order-1 lg:order-2">
                {price && <PriceDisplay price={price} />}
                {radar?.radars["1D"] && (
                  <RadarScore radar={radar.radars["1D"]} showDetails />
                )}
                {bias && (
                  <Card>
                    <CardContent className="pt-4">
                      <h3 className="font-semibold mb-2">Current Bias</h3>
                      <div className="text-2xl font-bold mb-2">
                        <span
                          className={
                            bias.overall_bias === "BULLISH"
                              ? "text-green-500"
                              : bias.overall_bias === "BEARISH"
                              ? "text-red-500"
                              : "text-yellow-500"
                          }
                        >
                          {bias.overall_bias}
                        </span>
                      </div>
                      <div className="space-y-1 text-sm">
                        {["1D", "1W"].map((tf) => {
                          const b = bias.biases[tf as keyof typeof bias.biases];
                          if (!b) return null;
                          return (
                            <div key={tf} className="flex justify-between">
                              <span className="text-muted-foreground">{tf}</span>
                              <span>{b.structural_bias}</span>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          {showLabs && (
            <TabsContent value="backtest" className="space-y-4 sm:space-y-6">
              <BacktestPanel />
            </TabsContent>
          )}

          <TabsContent value="alerts" className="space-y-4 sm:space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <AlertsList maxHeight={500} />
              <Card>
                <CardContent className="pt-6">
                  <h3 className="font-semibold mb-4">TradingView Webhook Setup</h3>
                  <div className="space-y-4 text-sm">
                    <div>
                      <p className="font-medium mb-2">Webhook URL:</p>
                      <code className="block bg-muted px-3 py-2 rounded text-xs">
                        https://your-domain.com/api/webhook/tradingview
                      </code>
                    </div>
                    <div>
                      <p className="font-medium mb-2">Alert Message Format (JSON):</p>
                      <pre className="bg-muted px-3 py-2 rounded text-xs overflow-x-auto">
{`{
  "symbol": "{{ticker}}",
  "action": "{{strategy.order.action}}",
  "price": {{close}},
  "timeframe": "{{interval}}",
  "time": "{{time}}",
  "alert_name": "My Alert",
  "message": "Custom message"
}`}
                      </pre>
                    </div>
                    <div>
                      <p className="font-medium mb-2">Available Variables:</p>
                      <ul className="list-disc list-inside text-muted-foreground space-y-1">
                        <li><code className="text-xs">{`{{ticker}}`}</code> - Symbol name</li>
                        <li><code className="text-xs">{`{{close}}`}</code> - Close price</li>
                        <li><code className="text-xs">{`{{open}}`}</code>, <code className="text-xs">{`{{high}}`}</code>, <code className="text-xs">{`{{low}}`}</code> - OHLC</li>
                        <li><code className="text-xs">{`{{volume}}`}</code> - Volume</li>
                        <li><code className="text-xs">{`{{interval}}`}</code> - Timeframe</li>
                        <li><code className="text-xs">{`{{time}}`}</code> - Time of alert</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
    </ErrorBoundary>
  );
}
