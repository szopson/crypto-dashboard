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
 * Region gating: nothing renders until the user's region is resolved (post
 * mount), then ranking fails closed — unknown region hides every venue with
 * regional restrictions. Keeps restricted venues out of SSR HTML entirely.
 */
import { useSyncExternalStore } from "react";
import { ArrowUpRight } from "lucide-react";
import { rankExchangesForSymbol } from "@/lib/affiliate";
import { detectRegion } from "@/lib/region";
import { analytics } from "@/components/PostHogProvider";

// Region never changes within a page lifetime, so the store never notifies.
const subscribeNever = () => () => {};
const PENDING = "pending" as const;

export function ExchangeCTA({
  symbol,
  surface,
  compact = false,
}: {
  symbol: string;
  surface: string;
  compact?: boolean;
}) {
  // "pending" on the server and during hydration, resolved region afterwards —
  // restricted venues never appear in SSR HTML or the first client paint.
  const region = useSyncExternalStore(subscribeNever, detectRegion, () => PENDING);

  if (region === PENDING) return null;
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
        className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
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
        className="flex items-center justify-between gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
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
          className="flex items-center justify-end gap-1 text-[11px] text-zinc-500 hover:text-zinc-300"
        >
          or {second.exchange.name} · net fee {second.effectiveFeePct.toFixed(3)}%
          <ArrowUpRight className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}
