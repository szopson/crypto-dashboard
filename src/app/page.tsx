import Image from 'next/image';
import { getTopCoins, getGlobalStats, formatCurrency, formatPercent } from '@/lib/api';
import { CoinData } from '@/types';
import Sparkline from '@/components/Sparkline';
import Header from '@/components/Header';
import AIAnalysisButton from '@/components/AIAnalysisButton';

export default async function Home() {
  let coins: CoinData[] = [];
  let globalStats: Record<string, unknown> | null = null;
  let coinsError = false;
  let statsError = false;

  try {
    coins = await getTopCoins(50);
  } catch {
    coinsError = true;
  }

  try {
    globalStats = await getGlobalStats();
  } catch {
    statsError = true;
  }

  const totalMarketCap =
    !statsError && globalStats
      ? formatCurrency(
          (globalStats.total_market_cap as Record<string, number>)?.usd ?? 0
        )
      : 'N/A';

  const totalVolume =
    !statsError && globalStats
      ? formatCurrency(
          (globalStats.total_volume as Record<string, number>)?.usd ?? 0
        )
      : 'N/A';

  const btcDominance =
    !statsError && globalStats
      ? `${((globalStats.market_cap_percentage as Record<string, number>)?.btc ?? 0).toFixed(1)}%`
      : 'N/A';

  const ethDominance =
    !statsError && globalStats
      ? `${((globalStats.market_cap_percentage as Record<string, number>)?.eth ?? 0).toFixed(1)}%`
      : 'N/A';

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      <Header />

      {/* Global Stats Bar */}
      <div className="border-b border-zinc-800 bg-zinc-900">
        <div className="max-w-screen-xl mx-auto px-6 py-3">
          {statsError ? (
            <p className="text-zinc-500 text-sm">Could not load global market stats.</p>
          ) : (
            <div className="flex flex-wrap gap-6 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-zinc-500">Market Cap</span>
                <span className="font-medium text-zinc-100">{totalMarketCap}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-zinc-500">24h Volume</span>
                <span className="font-medium text-zinc-100">{totalVolume}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-zinc-500">BTC Dominance</span>
                <span className="font-medium text-zinc-100">{btcDominance}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-zinc-500">ETH Dominance</span>
                <span className="font-medium text-zinc-100">{ethDominance}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-screen-xl mx-auto px-6 py-8">
        {/* Quick Access Banner */}
        <div className="bg-gradient-to-r from-emerald-900/20 to-zinc-900 border border-emerald-800/30 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-zinc-100 mb-1">Market Analysis Dashboard</h2>
              <p className="text-sm text-zinc-400">Real-time data, AI-powered insights, and comprehensive market coverage</p>
            </div>
            <div className="flex items-center gap-3">
              <a href="/briefing" className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors font-medium">
                Daily Briefing →
              </a>
              <a href="/assistant" className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors font-medium">
                AI Assistant →
              </a>
            </div>
          </div>
        </div>

        {/* Feature Highlights - Real Data */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="text-4xl font-bold text-emerald-400 mb-2 font-mono">{coins.length}</div>
            <div className="text-sm text-zinc-400">Cryptocurrencies</div>
            <div className="text-xs text-emerald-500 mt-1">Live tracking</div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="text-4xl font-bold text-cyan-400 mb-2 font-mono">4</div>
            <div className="text-sm text-zinc-400">Timeframes</div>
            <div className="text-xs text-cyan-500 mt-1">15m, 1h, 4h, 1d</div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="text-4xl font-bold text-amber-400 mb-2 font-mono">24/7</div>
            <div className="text-sm text-zinc-400">Market Monitoring</div>
            <div className="text-xs text-amber-500 mt-1">Real-time updates</div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="text-4xl font-bold text-emerald-400 mb-2 font-mono">AI</div>
            <div className="text-sm text-zinc-400">Powered Analysis</div>
            <div className="text-xs text-emerald-500 mt-1">Advanced models</div>
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-zinc-100">Top 50 Cryptocurrencies</h2>
          {!coinsError && (
            <AIAnalysisButton
              coins={coins}
              globalStats={{
                totalMarketCap,
                totalVolume,
                btcDominance,
                ethDominance,
              }}
            />
          )}
        </div>

        {coinsError ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center">
            <p className="text-zinc-400">Failed to load coin data. Please try again later.</p>
          </div>
        ) : (
          <div className="rounded-lg border border-zinc-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900 text-zinc-400 text-xs uppercase tracking-wide">
                    <th className="px-4 py-3 text-left w-12">#</th>
                    <th className="px-4 py-3 text-left">Coin</th>
                    <th className="px-4 py-3 text-right">Price</th>
                    <th className="px-4 py-3 text-right">24h %</th>
                    <th className="px-4 py-3 text-right">7d %</th>
                    <th className="px-4 py-3 text-right">Market Cap</th>
                    <th className="px-4 py-3 text-right">7d Chart</th>
                  </tr>
                </thead>
                <tbody>
                  {coins.map((coin, index) => {
                    const change24h = coin.price_change_percentage_24h ?? 0;
                    const change7d = coin.price_change_percentage_7d_in_currency ?? 0;
                    const sparklinePrices = coin.sparkline_in_7d?.price ?? [];

                    return (
                      <tr
                        key={coin.id}
                        className="border-b border-zinc-800 bg-zinc-950 hover:bg-zinc-900 transition-colors"
                      >
                        {/* Rank */}
                        <td className="px-4 py-3 text-zinc-500 tabular-nums">
                          {index + 1}
                        </td>

                        {/* Coin */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Image
                              src={coin.image}
                              alt={coin.name}
                              width={24}
                              height={24}
                              className="rounded-full"
                            />
                            <div>
                              <span className="font-medium text-zinc-100">
                                {coin.name}
                              </span>
                              <span className="ml-2 text-xs text-zinc-500 uppercase">
                                {coin.symbol}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Price */}
                        <td className="px-4 py-3 text-right tabular-nums text-zinc-100">
                          {formatCurrency(coin.current_price, coin.current_price < 1 ? 4 : 2)}
                        </td>

                        {/* 24h % */}
                        <td
                          className={`px-4 py-3 text-right tabular-nums font-medium ${
                            change24h >= 0 ? 'text-green-400' : 'text-red-400'
                          }`}
                        >
                          {formatPercent(change24h)}
                        </td>

                        {/* 7d % */}
                        <td
                          className={`px-4 py-3 text-right tabular-nums font-medium ${
                            change7d >= 0 ? 'text-green-400' : 'text-red-400'
                          }`}
                        >
                          {formatPercent(change7d)}
                        </td>

                        {/* Market Cap */}
                        <td className="px-4 py-3 text-right tabular-nums text-zinc-300">
                          {formatCurrency(coin.market_cap)}
                        </td>

                        {/* 7d Sparkline */}
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end">
                            <Sparkline prices={sparklinePrices} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
