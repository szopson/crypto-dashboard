'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type {
  IChartApi,
  ISeriesApi,
  CandlestickData,
  Time,
  SeriesMarker,
} from 'lightweight-charts';

interface Candle {
  open_time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface SwingPoint {
  timestamp: number;
  price: number;
  kind: 'high' | 'low';
  type: 'HH' | 'HL' | 'LH' | 'LL';
}

interface OrderBlock {
  timestamp: number;
  high: number;
  low: number;
  kind: 'bullish' | 'bearish';
}

interface FairValueGap {
  timestamp: number;
  top: number;
  bottom: number;
  kind: 'bullish' | 'bearish';
  status: 'filled' | 'unfilled';
}

interface ChartData {
  symbol: string;
  timeframe: string;
  candles: Candle[];
  swings: SwingPoint[];
  orderBlocks: OrderBlock[];
  fvgs: FairValueGap[];
}

const SYMBOLS = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'];
const TIMEFRAMES = ['15m', '1h', '4h', '1d'];

export default function TradingChart() {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  const [symbol, setSymbol] = useState('BTC/USDT');
  const [timeframe, setTimeframe] = useState('1h');
  const [data, setData] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/candles?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}&limit=200`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: ChartData = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [symbol, timeframe]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Initialize chart
  useEffect(() => {
    if (!containerRef.current) return;

    // Dynamic import to avoid SSR issues with lightweight-charts
    import('lightweight-charts').then(({ createChart, CandlestickSeries, PriceScaleMode }) => {
      if (!containerRef.current) return;

      const chart = createChart(containerRef.current, {
        layout: {
          background: { color: '#09090b' },
          textColor: '#a1a1aa',
        },
        grid: {
          vertLines: { color: '#27272a' },
          horzLines: { color: '#27272a' },
        },
        crosshair: {
          vertLine: { color: '#52525b' },
          horzLine: { color: '#52525b' },
        },
        rightPriceScale: {
          borderColor: '#3f3f46',
          mode: PriceScaleMode.Normal,
        },
        timeScale: {
          borderColor: '#3f3f46',
          timeVisible: true,
        },
        width: containerRef.current.clientWidth,
        height: 420,
      });

      const series = chart.addSeries(CandlestickSeries, {
        upColor: '#34d399',
        downColor: '#f87171',
        borderUpColor: '#34d399',
        borderDownColor: '#f87171',
        wickUpColor: '#34d399',
        wickDownColor: '#f87171',
      });

      chartRef.current = chart;
      candleSeriesRef.current = series;

      const handleResize = () => {
        if (containerRef.current && chartRef.current) {
          chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
        }
      };
      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        chart.remove();
        chartRef.current = null;
        candleSeriesRef.current = null;
      };
    });
  }, []);

  // Update chart data
  useEffect(() => {
    if (!data || !candleSeriesRef.current) return;

    const candleData: CandlestickData<Time>[] = data.candles.map((c) => ({
      time: (c.open_time / 1000) as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    candleSeriesRef.current.setData(candleData);

    // Swing markers via createSeriesMarkers (lightweight-charts v5)
    const markers: SeriesMarker<Time>[] = data.swings
      .filter((s) => s.type === 'HH' || s.type === 'LL')
      .map((s) => ({
        time: (s.timestamp / 1000) as Time,
        position: s.kind === 'high' ? ('aboveBar' as const) : ('belowBar' as const),
        color: s.kind === 'high' ? '#a78bfa' : '#fb923c',
        shape: s.kind === 'high' ? ('arrowDown' as const) : ('arrowUp' as const),
        text: s.type,
        size: 1,
      }));

    import('lightweight-charts').then(({ createSeriesMarkers }) => {
      if (candleSeriesRef.current) {
        createSeriesMarkers(candleSeriesRef.current, markers);
      }
    });
    chartRef.current?.timeScale().fitContent();
  }, [data]);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900">
      {/* Controls */}
      <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-zinc-800 flex-wrap">
        <h2 className="font-semibold text-zinc-100">Chart</h2>
        <div className="flex items-center gap-2">
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          >
            {SYMBOLS.map((s) => (
              <option key={s} value={s}>
                {s.replace('/USDT', '')}
              </option>
            ))}
          </select>
          <div className="flex rounded-lg overflow-hidden border border-zinc-700">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  timeframe === tf
                    ? 'bg-zinc-600 text-zinc-100'
                    : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="px-5 py-3">
          <p className="text-red-400 text-sm">Failed to load chart data: {error}</p>
        </div>
      )}

      <div className="relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/80 z-10 rounded-b-xl">
            <div className="w-6 h-6 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
          </div>
        )}
        <div ref={containerRef} className="w-full" />
      </div>

      {/* Legend */}
      {data && (
        <div className="px-5 py-3 border-t border-zinc-800 flex gap-4 flex-wrap text-xs text-zinc-500">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-2 rounded-sm bg-emerald-400 inline-block" /> Up candle
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-2 rounded-sm bg-red-400 inline-block" /> Down candle
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-violet-400 font-mono">↓ HH</span> Higher High
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-orange-400 font-mono">↑ LL</span> Lower Low
          </span>
          <span className="text-zinc-600">
            OBs/FVGs: {data.orderBlocks.length} OBs · {data.fvgs.filter((f) => f.status === 'unfilled').length} open FVGs
          </span>
        </div>
      )}
    </div>
  );
}
