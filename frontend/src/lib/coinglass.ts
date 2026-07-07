/**
 * Server-only Coinglass v4 client.
 *
 * Aggregates derivatives + ETF + liquidation data into a single "Crypto Macro
 * Pulse" snapshot consumed by the /api/crypto-pulse route.
 *
 * The API key (COINGLASS_API_KEY) MUST never reach the client; this module is
 * marked server-only and may only be imported from API routes or server
 * components. The widget component fetches the assembled snapshot from
 * /api/crypto-pulse instead of calling Coinglass directly.
 */
import "server-only";

const BASE = "https://open-api-v4.coinglass.com";

const KEY = process.env.COINGLASS_API_KEY;

interface CoinMarket {
  symbol: string;
  current_price: number;
  market_cap_usd: number;
  open_interest_usd: number;
  open_interest_market_cap_ratio: number;
  avg_funding_rate_by_oi: number;
  avg_funding_rate_by_vol: number;
  price_change_percent_1h: number;
  price_change_percent_4h: number;
  price_change_percent_24h: number;
  open_interest_change_percent_1h: number;
  open_interest_change_percent_4h: number;
  open_interest_change_percent_24h: number;
  long_short_ratio_1h: number;
  long_short_ratio_4h: number;
  long_short_ratio_24h: number;
  liquidation_usd_1h: number;
  liquidation_usd_4h: number;
  liquidation_usd_24h: number;
  long_liquidation_usd_24h: number;
  short_liquidation_usd_24h: number;
}

interface ETFFlowDay {
  timestamp: number;
  flow_usd: number;
  price_usd: number;
  etf_flows?: { etf_ticker: string; flow_usd: number }[];
}

interface LongShortPoint {
  time: number;
  global_account_long_percent?: number;
  global_account_short_percent?: number;
  global_account_long_short_ratio?: number;
  top_account_long_percent?: number;
  top_account_short_percent?: number;
  top_account_long_short_ratio?: number;
}

export interface CryptoPulseSnapshot {
  generated_at: string;
  coins: {
    symbol: string;
    price: number;
    funding_rate_oi: number; // %
    oi_usd: number;
    oi_change_24h_pct: number;
    long_short_24h: number;
    price_change_24h_pct: number;
    liquidation_24h_usd: number;
    long_liq_24h_usd: number;
    short_liq_24h_usd: number;
  }[];
  funding_aggregate: {
    btc_avg_pct: number | null;
    eth_avg_pct: number | null;
    btc_exchanges: { exchange: string; rate_pct: number }[];
  };
  etf: {
    btc_24h_flow_usd: number | null;
    btc_7d_flow_usd: number | null;
    btc_last_timestamp: number | null;
    breakdown_24h: { ticker: string; flow_usd: number }[];
  };
  positioning: {
    retail_long_pct: number | null;
    top_trader_long_pct: number | null;
    divergence_pct: number | null; // top_trader - retail
  };
  signals: string[]; // human-readable interpretation tags
  source: "coinglass.v4";
}

async function cgGet<T = unknown>(path: string): Promise<T | null> {
  const key = process.env.COINGLASS_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { "CG-API-KEY": key },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { code?: number | string; msg?: string; data?: T };
    // Coinglass v4 returns code as a string ("0") not a number — accept both.
    if (j.code != null && String(j.code) !== "0") return null;
    return j.data ?? null;
  } catch {
    return null;
  }
}

function pickCoin(markets: CoinMarket[] | null, symbol: string): CoinMarket | undefined {
  return markets?.find((m) => m.symbol === symbol);
}

export async function fetchCryptoPulse(): Promise<CryptoPulseSnapshot> {
  const symbols = ["BTC", "ETH", "SOL"];

  const [markets, btcFunding, etfFlows, retailLS, topLS] = await Promise.all([
    cgGet<CoinMarket[]>("/api/futures/coins-markets"),
    cgGet<
      {
        symbol: string;
        stablecoin_margin_list?: { exchange: string; funding_rate: number }[];
      }[]
    >("/api/futures/funding-rate/exchange-list?symbol=BTC"),
    cgGet<ETFFlowDay[]>("/api/etf/bitcoin/flow-history?asset=BTC"),
    cgGet<LongShortPoint[]>(
      "/api/futures/global-long-short-account-ratio/history?exchange=Binance&symbol=BTCUSDT&interval=1h&limit=4",
    ),
    cgGet<LongShortPoint[]>(
      "/api/futures/top-long-short-account-ratio/history?exchange=Binance&symbol=BTCUSDT&interval=1h&limit=4",
    ),
  ]);

  const coins = symbols.map((sym) => {
    const m = pickCoin(markets, sym);
    return {
      symbol: sym,
      price: m?.current_price ?? 0,
      funding_rate_oi: m?.avg_funding_rate_by_oi ?? 0,
      oi_usd: m?.open_interest_usd ?? 0,
      oi_change_24h_pct: m?.open_interest_change_percent_24h ?? 0,
      long_short_24h: m?.long_short_ratio_24h ?? 0,
      price_change_24h_pct: m?.price_change_percent_24h ?? 0,
      liquidation_24h_usd: m?.liquidation_usd_24h ?? 0,
      long_liq_24h_usd: m?.long_liquidation_usd_24h ?? 0,
      short_liq_24h_usd: m?.short_liquidation_usd_24h ?? 0,
    };
  });

  // BTC funding aggregate across exchanges
  const btcExchanges = (btcFunding ?? [])
    .find((r) => r.symbol === "BTC")
    ?.stablecoin_margin_list?.slice(0, 8)
    .map((e) => ({ exchange: e.exchange, rate_pct: e.funding_rate })) ?? [];
  const btcAvg = btcExchanges.length
    ? btcExchanges.reduce((s, e) => s + e.rate_pct, 0) / btcExchanges.length
    : null;
  const ethCoin = pickCoin(markets, "ETH");
  const ethAvg = ethCoin?.avg_funding_rate_by_oi ?? null;

  // ETF flows: 24h + 7d sum
  const flowsSorted = (etfFlows ?? []).slice().sort((a, b) => b.timestamp - a.timestamp);
  const last = flowsSorted[0];
  const last7 = flowsSorted.slice(0, 7);
  const btc24h = last?.flow_usd ?? null;
  const btc7d = last7.length ? last7.reduce((s, d) => s + (d.flow_usd ?? 0), 0) : null;
  const breakdown = (last?.etf_flows ?? []).slice(0, 10).map((e) => ({
    ticker: e.etf_ticker,
    flow_usd: e.flow_usd,
  }));

  // Positioning: latest retail vs top trader
  const retail = retailLS?.[retailLS.length - 1];
  const top = topLS?.[topLS.length - 1];
  const retailLong = retail?.global_account_long_percent ?? null;
  const topLong = top?.top_account_long_percent ?? null;
  const divergence = retailLong != null && topLong != null ? topLong - retailLong : null;

  // Heuristic signals. Coinglass returns funding rates as percent-per-8h
  // (e.g. 0.01 means 0.01% per 8h ≈ 11% APR). Thresholds chosen accordingly.
  const signals: string[] = [];
  if (btcAvg != null && btcAvg > 0.03) signals.push(`BTC funding hot (${btcAvg.toFixed(4)}%/8h) — contrarian short bias`);
  else if (btcAvg != null && btcAvg > 0.015) signals.push(`BTC funding elevated (${btcAvg.toFixed(4)}%/8h)`);
  if (btcAvg != null && btcAvg < -0.005) signals.push(`BTC funding negative (${btcAvg.toFixed(4)}%/8h) — contrarian long bias`);
  if (btc24h != null && btc24h > 200_000_000) signals.push(`Strong ETF inflow 24h ($${(btc24h / 1e6).toFixed(0)}M) — institutional bid`);
  if (btc24h != null && btc24h < -100_000_000) signals.push(`Net ETF outflow 24h ($${(btc24h / 1e6).toFixed(0)}M) — institutional risk-off`);
  if (btc7d != null && btc7d < -500_000_000) signals.push(`7d ETF cumulative outflow $${(btc7d / 1e6).toFixed(0)}M — sustained institutional selling`);
  if (btc7d != null && btc7d > 1_000_000_000) signals.push(`7d ETF cumulative inflow $${(btc7d / 1e6).toFixed(0)}M — sustained institutional buying`);
  if (divergence != null && divergence < -8) signals.push("Top traders less long than retail — distribution risk");
  if (divergence != null && divergence > 8) signals.push("Top traders more long than retail — accumulation");
  const btcCoin = pickCoin(markets, "BTC");
  if (btcCoin?.open_interest_change_percent_24h && btcCoin.open_interest_change_percent_24h < -3 && btcCoin.price_change_percent_24h && btcCoin.price_change_percent_24h > 0) {
    signals.push("OI dropping while price rises — short squeeze ending");
  }
  if (btcCoin?.open_interest_change_percent_24h && btcCoin.open_interest_change_percent_24h > 5 && btcCoin.price_change_percent_24h && btcCoin.price_change_percent_24h < 0) {
    signals.push("OI rising while price falls — leveraged shorts adding, squeeze risk");
  }

  return {
    generated_at: new Date().toISOString(),
    coins,
    funding_aggregate: {
      btc_avg_pct: btcAvg,
      eth_avg_pct: ethAvg,
      btc_exchanges: btcExchanges,
    },
    etf: {
      btc_24h_flow_usd: btc24h,
      btc_7d_flow_usd: btc7d,
      btc_last_timestamp: last?.timestamp ?? null,
      breakdown_24h: breakdown,
    },
    positioning: {
      retail_long_pct: retailLong,
      top_trader_long_pct: topLong,
      divergence_pct: divergence,
    },
    signals,
    source: "coinglass.v4",
  };
}
