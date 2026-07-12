/**
 * Affiliate deep-link builder + honest ranking.
 *
 * The ONE place that turns the exchange registry into user-facing links. Two
 * rules encoded here, both non-negotiable:
 *
 *  1. Ranking is by the user's REAL net cost — takerFee × (1 − rebate) — not by
 *     our payout. A venue that pays us more but costs the user more ranks lower.
 *  2. Nothing is shown for a venue that is disabled or restricted in the user's
 *     region. Region gating fails CLOSED: callers must pass an explicit region
 *     decision, and `null` (unknown) hides every venue that has any regional
 *     restriction. Detection is best-effort client-side (see region.ts).
 */
import { EXCHANGES, type Exchange, type ExchangeProduct } from "@/config/exchanges";

export interface RankedExchange {
  exchange: Exchange;
  href: string;
  /** Net taker fee the user actually pays after our rebate, percent. */
  effectiveFeePct: number;
  /** Rebate as a whole-number percent for display, e.g. 20. */
  rebateDisplayPct: number;
}

/** Build the affiliate link for a venue. For "signup-link" venues attribution
 * happens at registration, so the CTA routes to the invite page; for
 * "market-param" venues it deep-links the specific perp market with the ref. */
export function buildAffiliateLink(exchange: Exchange, base: string): string {
  if (exchange.attribution === "signup-link" && exchange.signupUrl) {
    return exchange.signupUrl;
  }
  const market = exchange.perpSymbol(base);
  const url = exchange.perpMarketTemplate.replace("{market}", market);
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}${exchange.refParam}=${encodeURIComponent(exchange.refCode)}`;
}

/** Net taker fee after rebate — the number that actually matters to the user. */
export function effectiveFeePct(exchange: Exchange): number {
  return exchange.takerFeePct * (1 - exchange.rebatePct);
}

/**
 * Rank venues for a symbol by real net cost, ascending. Filters out disabled
 * venues, venues that don't offer the product, and venues restricted in the
 * user's region. The region decision is REQUIRED: an ISO-3166 alpha-2 code when
 * known, or `null` when unknown — unknown fails closed, i.e. every venue with a
 * non-empty `restrictedRegions` is excluded until eligibility is established.
 */
export function rankExchangesForSymbol(
  base: string,
  opts: { product?: ExchangeProduct; region: string | null },
): RankedExchange[] {
  const product = opts.product ?? "perp";
  const region = opts.region?.toUpperCase() ?? null;
  return EXCHANGES.filter((e) => e.enabled)
    .filter((e) => e.products.includes(product))
    .filter((e) =>
      region === null ? e.restrictedRegions.length === 0 : !e.restrictedRegions.includes(region),
    )
    .map((e) => ({
      exchange: e,
      href: buildAffiliateLink(e, base),
      effectiveFeePct: effectiveFeePct(e),
      rebateDisplayPct: Math.round(e.rebatePct * 100),
    }))
    .sort((a, b) => a.effectiveFeePct - b.effectiveFeePct);
}

/** Convenience: the single best (cheapest net) venue for a symbol, or null. */
export function bestExchangeForSymbol(
  base: string,
  opts: { product?: ExchangeProduct; region: string | null },
): RankedExchange | null {
  return rankExchangesForSymbol(base, opts)[0] ?? null;
}
