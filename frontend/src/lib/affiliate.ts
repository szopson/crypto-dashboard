/**
 * Affiliate deep-link builder + honest ranking.
 *
 * The ONE place that turns the exchange registry into user-facing links. Two
 * rules encoded here, both non-negotiable:
 *
 *  1. Ranking is by the user's REAL net cost — takerFee × (1 − rebate) — not by
 *     our payout. A venue that pays us more but costs the user more ranks lower.
 *  2. Nothing is shown for a venue that is disabled or restricted in the user's
 *     region.
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
 * given region. `region` is optional; when omitted, region gating is skipped
 * (caller is responsible for supplying it once geo-detection is wired).
 */
export function rankExchangesForSymbol(
  base: string,
  opts: { product?: ExchangeProduct; region?: string } = {},
): RankedExchange[] {
  const product = opts.product ?? "perp";
  return EXCHANGES.filter((e) => e.enabled)
    .filter((e) => e.products.includes(product))
    .filter((e) => !(opts.region && e.restrictedRegions.includes(opts.region)))
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
  opts: { product?: ExchangeProduct; region?: string } = {},
): RankedExchange | null {
  return rankExchangesForSymbol(base, opts)[0] ?? null;
}
