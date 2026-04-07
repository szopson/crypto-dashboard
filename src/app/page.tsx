import Image from 'next/image';
import { getTopCoins, getGlobalStats, formatCurrency, formatPercent } from '@/lib/api';
import { CoinData } from '@/types';
import Sparkline from '@/components/Sparkline';

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
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="max-w-screen-xl mx-auto flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-white">Follio</h1>
          <span className="text-zinc-500 text-sm">Crypto Dashboard</span>
        </div>
      </header>

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
        <h2 className="text-lg font-semibold text-zinc-100 mb-4">Top 50 Cryptocurrencies</h2>

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
