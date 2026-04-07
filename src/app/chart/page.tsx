import TradingChart from '@/components/TradingChart';

export default function ChartPage() {
  return (
    <main className="max-w-screen-xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-zinc-100">Chart</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Candlestick chart with swing high/low, order block, and fair value gap overlays.
        </p>
      </div>
      <TradingChart />
    </main>
  );
}
