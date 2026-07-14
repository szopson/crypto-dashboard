"use client";

/**
 * ExchangeCTA — the "see signal → execute here" bridge (the revenue engine).
 *
 * Renders an affiliate deep-link to the venue with the LOWEST real net cost for
 * this symbol (takerFee × (1 − rebate)), computed from the config-driven
 * registry via rankExchangesForSymbol. Clicks are tracked in PostHog.
 *
 * Renders nothing when no venue is enabled — so placeholder/unsigned deals
 * never surface a live referral link. Flip an exchange's `enabled` to true (with
 * a real refCode) in config/exchanges.ts to activate it.
 *
 * Region gating: nothing renders until the user's region is resolved (server
 * GeoIP verdict with timezone fallback — see useRegion), then ranking fails
 * closed — unknown region hides every venue with regional restrictions.
 * Keeps restricted venues out of SSR HTML entirely.
 */
import { ArrowUpRight } from "lucide-react";
import { rankExchangesForSymbol } from "@/lib/affiliate";
import { useRegion } from "@/hooks/useRegion";
import { analytics } from "@/components/PostHogProvider";

export function ExchangeCTA({
  symbol,
  surface,
  compact = false,
}: {
  symbol: string;
  surface: string;
  compact?: boolean;
}) {
  const region = useRegion();

  if (region === "pending") return null;
  const ranked = rankExchangesForSymbol(symbol, { region });
  const best = ranked[0];
  if (!best) return null;
  // Runner-up gets a light secondary link (full variant only) — with equal
  // net fees the ranking is a tie and hiding a live venue would be arbitrary.
  const second = ranked[1];

  const track = (r: (typeof ranked)[number]) => () =>
    analytics.trackAffiliateClick({
      exchange: r.exchange.name,
      symbol,
      effectiveFeePct: r.effectiveFeePct,
      rebatePct: r.exchange.rebatePct,
      surface,
    });
  const onClick = track(best);

  if (compact) {
    return (
      <a
        href={best.href}
        target="_blank"
        rel="noopener noreferrer nofollow sponsored"
        onClick={onClick}
        className="inline-flex items-center gap-1 rounded-md bg-emerald-500 px-2.5 py-1.5 text-xs font-semibold text-emerald-950 shadow-[0_0_16px_-6px_var(--glow-emerald)] transition-all hover:bg-emerald-400 hover:shadow-[0_0_24px_-4px_var(--glow-emerald)]"
      >
        Trade {symbol} · {best.exchange.name}
        <ArrowUpRight className="h-3 w-3" />
      </a>
    );
  }

  return (
    <div className="space-y-1">
      <a
        href={best.href}
        target="_blank"
        rel="noopener noreferrer nofollow sponsored"
        onClick={onClick}
        className="flex items-center justify-between gap-2 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-emerald-950 shadow-[0_0_20px_-6px_var(--glow-emerald)] transition-all hover:bg-emerald-400 hover:shadow-[0_0_32px_-4px_var(--glow-emerald)]"
      >
        <span className="flex items-center gap-1.5">
          Execute {symbol} perp on {best.exchange.name}
          <ArrowUpRight className="h-4 w-4" />
        </span>
        <span className="text-[11px] font-normal opacity-90">
          {best.rebateDisplayPct > 0 && <>{best.rebateDisplayPct}% rebate · </>}
          net fee {best.effectiveFeePct.toFixed(3)}%
        </span>
      </a>
      {second && (
        <a
          href={second.href}
          target="_blank"
          rel="noopener noreferrer nofollow sponsored"
          onClick={track(second)}
          className="flex items-center justify-end gap-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          or {second.exchange.name} · net fee {second.effectiveFeePct.toFixed(3)}%
          <ArrowUpRight className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}
