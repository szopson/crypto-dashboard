/**
 * DerivativesCockpit — the one screen a perp trader keeps open.
 *
 * Server component: reads the shared crypto-pulse snapshot (Coinglass v4,
 * 60s cache) and renders a mobile-first, read-only derivatives surface —
 * deviations first, then per-coin funding / OI / liquidations / positioning.
 *
 * Built ON TOP of the existing crypto-pulse aggregation (not a duplicate).
 * Velo cross-exchange funding spread and basis/perp premium slot in later.
 */
import { Activity, RefreshCw } from "lucide-react";
import { fetchCryptoPulse, type CockpitCoin } from "@/lib/coinglass";
import { DeviationBanner } from "./DeviationBanner";
import { ExchangeCTA } from "./ExchangeCTA";
import { AffiliateDisclosure } from "./AffiliateDisclosure";

function fmtUsdShort(n: number | null | undefined): string {
  if (n == null) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

function fmtPrice(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1000) return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(4)}`;
}

function fmtPct(n: number | null | undefined, decimals = 2): string {
  if (n == null) return "—";
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(decimals)}%`;
}

const tone = (n: number | null | undefined) =>
  n == null ? "text-zinc-500" : n >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400";

export async function DerivativesCockpit() {
  let snap;
  try {
    snap = await fetchCryptoPulse();
  } catch {
    return (
      <div className="rounded-xl border border-zinc-200 p-6 text-sm text-zinc-500 dark:border-zinc-800">
        Derivatives feed is temporarily unavailable. Retry shortly.
      </div>
    );
  }

  const fa = snap.funding_aggregate;
  const time = new Date(snap.generated_at).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold tracking-tight">Derivatives Cockpit</h1>
        </div>
        <span className="flex items-center gap-1.5 text-xs text-zinc-500">
          <RefreshCw className="h-3 w-3" />
          Coinglass · {time} · 60s
        </span>
      </header>

      {/* Deviations first — interpretation over raw numbers, each with an
          "execute here" bridge to the cheapest-net venue for that symbol. */}
      <DeviationBanner
        deviations={snap.deviations}
        ctaSlot={(d) =>
          d.symbol && d.symbol !== "MKT" ? (
            <ExchangeCTA symbol={d.symbol} surface="cockpit_deviation" compact />
          ) : null
        }
      />

      {/* Per-coin derivatives grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {snap.coins.map((c) => (
          <CoinCard key={c.symbol} c={c} />
        ))}
      </div>

      {/* Cross-exchange funding dispersion (BTC) */}
      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            BTC funding by venue
          </h2>
          <span className="text-xs text-zinc-500">
            avg <span className={tone(fa.btc_avg_pct)}>{fmtPct(fa.btc_avg_pct, 4)}</span>
            {fa.btc_spread_pct != null && (
              <> · spread {fa.btc_spread_pct.toFixed(4)}%</>
            )}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {fa.btc_exchanges.length === 0 && <span className="text-xs text-zinc-500">—</span>}
          {fa.btc_exchanges.map((e) => (
            <span
              key={e.exchange}
              className="rounded-md border border-zinc-200 px-2 py-1 text-xs tabular-nums dark:border-zinc-800"
            >
              <span className="text-zinc-500">{e.exchange}</span>{" "}
              <span className={tone(e.rate_pct)}>{e.rate_pct.toFixed(4)}%</span>
            </span>
          ))}
        </div>
        {snap.velo_funding && snap.velo_funding.spread_pct_8h != null && (
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-zinc-100 pt-2.5 text-xs dark:border-zinc-800/60">
            <span className="font-medium text-zinc-500">Binance ↔ Hyperliquid</span>
            <span className="tabular-nums">
              <span className={tone(snap.velo_funding.binance_pct_8h)}>
                {fmtPct(snap.velo_funding.binance_pct_8h, 4)}
              </span>
              <span className="mx-1 text-zinc-400">vs</span>
              <span className={tone(snap.velo_funding.hyperliquid_pct_8h)}>
                {fmtPct(snap.velo_funding.hyperliquid_pct_8h, 4)}
              </span>
            </span>
            <span className="tabular-nums text-zinc-500">
              Δ {snap.velo_funding.spread_pct_8h.toFixed(4)}%
              {snap.velo_funding.spread_1h_ago_pct_8h != null && (
                <> · 1h ago {snap.velo_funding.spread_1h_ago_pct_8h.toFixed(4)}%</>
              )}
              {snap.velo_funding.spread_24h_ago_pct_8h != null && (
                <> · 24h ago {snap.velo_funding.spread_24h_ago_pct_8h.toFixed(4)}%</>
              )}
            </span>
            <span className="text-[10px] uppercase tracking-wide text-zinc-400">Velo</span>
          </div>
        )}
      </section>

      {/* Positioning + ETF */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Retail vs top traders (BTC)
          </h2>
          <div className="mt-2 text-lg font-semibold">
            {snap.positioning.retail_long_pct != null
              ? `Retail ${snap.positioning.retail_long_pct.toFixed(1)}% long`
              : "—"}
          </div>
          <div className={`mt-0.5 text-sm ${tone(snap.positioning.divergence_pct)}`}>
            {snap.positioning.top_trader_long_pct != null
              ? `Top ${snap.positioning.top_trader_long_pct.toFixed(1)}% long · Δ ${fmtPct(snap.positioning.divergence_pct, 1)}`
              : "—"}
          </div>
        </section>
        <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            BTC ETF flow
          </h2>
          <div className={`mt-2 text-lg font-semibold ${tone(snap.etf.btc_24h_flow_usd)}`}>
            {fmtUsdShort(snap.etf.btc_24h_flow_usd)} <span className="text-xs font-normal text-zinc-500">24h</span>
          </div>
          <div className="mt-0.5 text-sm text-zinc-500">
            7d <span className={tone(snap.etf.btc_7d_flow_usd)}>{fmtUsdShort(snap.etf.btc_7d_flow_usd)}</span>
          </div>
        </section>
      </div>

      <AffiliateDisclosure />

      <p className="pt-1 text-center text-[11px] text-zinc-400">
        Read-only market data. Not financial advice, not a buy/sell signal.
      </p>
    </div>
  );
}

function CoinCard({ c }: { c: CockpitCoin }) {
  const netLiqLong = c.long_liq_24h_usd; // longs liquidated
  const netLiqShort = c.short_liq_24h_usd;
  return (
    <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold">{c.symbol}</span>
        <span className="text-base font-semibold tabular-nums">{fmtPrice(c.price)}</span>
      </div>
      <div className="mt-0.5 flex items-center justify-between text-xs">
        <span className="text-zinc-500">funding</span>
        <span className={tone(c.funding_rate_oi)}>{fmtPct(c.funding_rate_oi, 4)}/8h</span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        <TfCell label="1h" price={c.price_change_1h_pct} oi={c.oi_change_1h_pct} />
        <TfCell label="4h" price={c.price_change_4h_pct} oi={c.oi_change_4h_pct} />
        <TfCell label="24h" price={c.price_change_24h_pct} oi={c.oi_change_24h_pct} />
      </div>

      <div className="mt-3 space-y-1 border-t border-zinc-100 pt-2 text-xs dark:border-zinc-800/60">
        <Row label="Open interest" value={fmtUsdShort(c.oi_usd)} />
        <Row label="L/S ratio 24h" value={c.long_short_24h ? c.long_short_24h.toFixed(2) : "—"} />
        {c.basis_pct != null && (
          <Row
            label="Basis (perp−spot)"
            value={
              <span>
                <span className={tone(c.basis_pct)}>{fmtPct(c.basis_pct, 3)}</span>
                {c.basis_24h_ago_pct != null && (
                  <span className="ml-1 text-zinc-400">· 24h {fmtPct(c.basis_24h_ago_pct, 3)}</span>
                )}
              </span>
            }
          />
        )}
        <Row
          label="Liq 24h (L / S)"
          value={
            <span>
              <span className="text-rose-600 dark:text-rose-400">{fmtUsdShort(netLiqLong)}</span>
              <span className="mx-1 text-zinc-400">/</span>
              <span className="text-emerald-600 dark:text-emerald-400">{fmtUsdShort(netLiqShort)}</span>
            </span>
          }
        />
      </div>

      <div className="mt-3">
        <ExchangeCTA symbol={c.symbol} surface="cockpit_coin" />
      </div>
    </div>
  );
}

function TfCell({ label, price, oi }: { label: string; price: number; oi: number }) {
  return (
    <div className="rounded-md bg-zinc-50 py-1.5 dark:bg-zinc-900/50">
      <div className="text-[10px] uppercase text-zinc-400">{label}</div>
      <div className={`tabular-nums ${tone(price)}`}>{fmtPct(price, 1)}</div>
      <div className="text-[10px] text-zinc-500">
        OI <span className={tone(oi)}>{fmtPct(oi, 1)}</span>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-zinc-500">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}
