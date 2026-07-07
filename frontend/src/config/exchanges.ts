/**
 * Exchange registry — the SINGLE source of truth for the affiliate layer.
 *
 * Every affiliate link, rebate figure and ranking input lives here. No ref
 * links or rebate numbers may be hardcoded anywhere else in the app.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️  PLACEHOLDER DATA — DO NOT SHIP AS-IS
 * `refCode`, `takerFeePct` and `rebatePct` below are illustrative defaults.
 * Replace each with the real values from the signed affiliate/rebate deal
 * before going live. `enabled: false` keeps an exchange out of the UI until its
 * deal is confirmed.
 *
 * ⚖️  LEGAL REVIEW REQUIRED (MiCA / KNF)
 * Promoting crypto services to EU consumers is regulated. Copy and disclosure
 * must be "fair, clear and not misleading", and regional availability
 * (`restrictedRegions`) must reflect where each venue may legally be promoted.
 * Treat everything in this file as subject to legal sign-off. See
 * AffiliateDisclosure.tsx for the user-facing disclosure copy.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type ExchangeProduct = "perp" | "spot";

export interface Exchange {
  id: string;
  name: string;
  /** Products we route to. Cockpit uses "perp". */
  products: ExchangeProduct[];
  /** Deep-link template for a perp market. `{market}` is replaced by perpSymbol(base). */
  perpMarketTemplate: string;
  /** Maps a base asset (e.g. "BTC") to this venue's perp market slug (e.g. "BTCUSDT"). */
  perpSymbol: (base: string) => string;
  /** Query param name carrying our referral code. */
  refParam: string;
  /** ⚠️ PLACEHOLDER referral code — replace with the real one. */
  refCode: string;
  /** Headline taker fee, percent (e.g. 0.05 = 0.05%). */
  takerFeePct: number;
  /** Share of fees returned to the user via our rebate, 0..1 (e.g. 0.2 = 20%). */
  rebatePct: number;
  /** ISO-3166 alpha-2 regions where this venue must NOT be promoted. Legal-driven. */
  restrictedRegions: string[];
  /** Flip to true only once the real deal + legal review are done. */
  enabled: boolean;
}

/**
 * Illustrative registry. Values are placeholders — see the header warning.
 * Ordering here is irrelevant: the UI ranks by real cost to the user
 * (see rankExchangesForSymbol in lib/affiliate.ts), never by our payout.
 */
export const EXCHANGES: Exchange[] = [
  {
    id: "binance",
    name: "Binance",
    products: ["perp", "spot"],
    perpMarketTemplate: "https://www.binance.com/en/futures/{market}",
    perpSymbol: (base) => `${base}USDT`,
    refParam: "ref",
    refCode: "TODO_BINANCE_REF",
    takerFeePct: 0.05,
    rebatePct: 0.2,
    restrictedRegions: ["US"],
    enabled: false,
  },
  {
    id: "bybit",
    name: "Bybit",
    products: ["perp", "spot"],
    perpMarketTemplate: "https://www.bybit.com/trade/usdt/{market}",
    perpSymbol: (base) => `${base}USDT`,
    refParam: "ref",
    refCode: "TODO_BYBIT_REF",
    takerFeePct: 0.055,
    rebatePct: 0.2,
    restrictedRegions: ["US"],
    enabled: false,
  },
  {
    id: "okx",
    name: "OKX",
    products: ["perp", "spot"],
    perpMarketTemplate: "https://www.okx.com/trade-swap/{market}",
    perpSymbol: (base) => `${base.toLowerCase()}-usdt-swap`,
    refParam: "channelId",
    refCode: "TODO_OKX_REF",
    takerFeePct: 0.05,
    rebatePct: 0.2,
    restrictedRegions: ["US"],
    enabled: false,
  },
  {
    id: "hyperliquid",
    name: "Hyperliquid",
    products: ["perp"],
    perpMarketTemplate: "https://app.hyperliquid.xyz/trade/{market}",
    perpSymbol: (base) => base,
    refParam: "ref",
    refCode: "TODO_HL_REF",
    takerFeePct: 0.045,
    rebatePct: 0.1,
    restrictedRegions: [],
    enabled: false,
  },
];

/** User-facing affiliate disclosure. Subject to legal (MiCA/KNF) review. */
export const AFFILIATE_DISCLOSURE =
  "Follio earns a commission when you trade through these links, and shares part of it back with you as a fee rebate. We rank venues by your real net cost, not by what we earn. This is not financial advice.";
