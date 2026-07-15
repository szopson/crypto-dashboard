/**
 * CryptoMacroPulse — live derivatives snapshot widget.
 *
 * Server component variant: fetches once on the server (uses fetch with
 * next.revalidate to share the cache with /api/crypto-pulse). Client refresh
 * is intentionally not built here — the page that hosts the widget will
 * be regenerated server-side at most every 60s, which matches the data
 * cadence the upstream provider supports anyway.
 */
import { Activity, TrendingUp, TrendingDown, Coins, Waves } from "lucide-react";
import { fetchCryptoPulse } from "@/lib/coinglass";

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

const toneClass = (n: number | null | undefined) =>
  n == null ? "text-muted-foreground" : n >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400";

export async function CryptoMacroPulse() {
  let snap;
  try {
    snap = await fetchCryptoPulse();
  } catch {
    return null;
  }
  const btc = snap.coins.find((c) => c.symbol === "BTC");
  const eth = snap.coins.find((c) => c.symbol === "ETH");
  const totalLiq24h = snap.coins.reduce((s, c) => s + (c.liquidation_24h_usd ?? 0), 0);

  return (
    <section className="not-prose mb-10 overflow-hidden rounded-2xl glass-card">
      <header className="flex items-center justify-between border-b border-(--glass-border) px-6 py-3 text-xs uppercase tracking-wide text-muted-foreground">
        <span className="flex items-center gap-2">
          <Activity className="h-3.5 w-3.5" />
          Crypto Macro Pulse
        </span>
        <span>Coinglass · {new Date(snap.generated_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })} UTC</span>
      </header>

      <div className="grid grid-cols-2 gap-px bg-muted md:grid-cols-4">
        <PulseCard
          label="BTC"
          icon={<Coins className="h-4 w-4" />}
          primary={fmtPrice(btc?.price)}
          secondary={fmtPct(btc?.price_change_24h_pct)}
          secondaryTone={btc?.price_change_24h_pct}
          extra={`OI ${fmtUsdShort(btc?.oi_usd)} · L/S ${btc?.long_short_24h?.toFixed(2)}`}
        />
        <PulseCard
          label="ETH"
          icon={<Coins className="h-4 w-4" />}
          primary={fmtPrice(eth?.price)}
          secondary={fmtPct(eth?.price_change_24h_pct)}
          secondaryTone={eth?.price_change_24h_pct}
          extra={`OI ${fmtUsdShort(eth?.oi_usd)} · L/S ${eth?.long_short_24h?.toFixed(2)}`}
        />
        <PulseCard
          label="BTC Funding (avg)"
          icon={<Waves className="h-4 w-4" />}
          primary={fmtPct(snap.funding_aggregate.btc_avg_pct, 4)}
          secondary={
            snap.funding_aggregate.btc_avg_pct == null
              ? "—"
              : snap.funding_aggregate.btc_avg_pct > 0.015
                ? "Hot — contrarian short"
                : snap.funding_aggregate.btc_avg_pct < -0.005
                  ? "Cold — contrarian long"
                  : "Neutral"
          }
          secondaryTone={
            snap.funding_aggregate.btc_avg_pct != null && snap.funding_aggregate.btc_avg_pct > 0.015
              ? -1
              : snap.funding_aggregate.btc_avg_pct != null && snap.funding_aggregate.btc_avg_pct < -0.005
                ? 1
                : null
          }
          extra={`${snap.funding_aggregate.btc_exchanges.length} exchanges`}
        />
        <PulseCard
          label="BTC ETF Flow 24h"
          icon={
            (snap.etf.btc_24h_flow_usd ?? 0) >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />
          }
          primary={fmtUsdShort(snap.etf.btc_24h_flow_usd)}
          secondary={`7d ${fmtUsdShort(snap.etf.btc_7d_flow_usd)}`}
          secondaryTone={snap.etf.btc_24h_flow_usd}
          extra={`${snap.etf.breakdown_24h.length} ETFs reported`}
        />
      </div>

      <div className="grid grid-cols-1 gap-px bg-muted md:grid-cols-3">
        <SubBlock label="Liquidations 24h">
          <div className="text-base font-semibold">{fmtUsdShort(totalLiq24h)}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            <span className="text-rose-600">L {fmtUsdShort(btc?.long_liq_24h_usd)}</span>
            <span className="mx-1">·</span>
            <span className="text-emerald-600">S {fmtUsdShort(btc?.short_liq_24h_usd)}</span>
          </div>
        </SubBlock>
        <SubBlock label="Retail vs Top traders (BTC)">
          <div className="text-base font-semibold">
            {snap.positioning.retail_long_pct != null
              ? `Retail ${snap.positioning.retail_long_pct.toFixed(1)}% long`
              : "—"}
          </div>
          <div className={`mt-0.5 text-xs ${toneClass(snap.positioning.divergence_pct)}`}>
            {snap.positioning.top_trader_long_pct != null
              ? `Top ${snap.positioning.top_trader_long_pct.toFixed(1)}% long · Δ ${fmtPct(snap.positioning.divergence_pct, 1)}`
              : "—"}
          </div>
        </SubBlock>
        <SubBlock label="OI 24h change (BTC)">
          <div className={`text-base font-semibold ${toneClass(btc?.oi_change_24h_pct)}`}>
            {fmtPct(btc?.oi_change_24h_pct)}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            Price 24h <span className={toneClass(btc?.price_change_24h_pct)}>{fmtPct(btc?.price_change_24h_pct)}</span>
          </div>
        </SubBlock>
      </div>

      {snap.signals.length > 0 && (
        <ul className="space-y-1 border-t border-(--glass-border) bg-amber-50/40 px-6 py-3 text-sm dark:bg-amber-950/20">
          {snap.signals.map((s, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-1.5 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-500" />
              <span>{s}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PulseCard({
  label,
  icon,
  primary,
  secondary,
  secondaryTone,
  extra,
}: {
  label: string;
  icon?: React.ReactNode;
  primary: string;
  secondary?: string;
  secondaryTone?: number | null;
  extra?: string;
}) {
  return (
    <div className="bg-card p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{primary}</div>
      {secondary && (
        <div className={`mt-0.5 text-xs ${toneClass(secondaryTone ?? null)}`}>{secondary}</div>
      )}
      {extra && <div className="mt-1 text-xs text-muted-foreground">{extra}</div>}
    </div>
  );
}

function SubBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1">{children}</div>
    </div>
  );
}
