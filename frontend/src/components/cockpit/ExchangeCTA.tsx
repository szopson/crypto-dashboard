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
 */
import { ArrowUpRight } from "lucide-react";
import { rankExchangesForSymbol } from "@/lib/affiliate";
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
  const ranked = rankExchangesForSymbol(symbol);
  const best = ranked[0];
  if (!best) return null;

  const onClick = () =>
    analytics.trackAffiliateClick({
      exchange: best.exchange.name,
      symbol,
      effectiveFeePct: best.effectiveFeePct,
      rebatePct: best.exchange.rebatePct,
      surface,
    });

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
  );
}
