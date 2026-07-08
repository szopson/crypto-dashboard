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

/**
 * How referral attribution works for a venue:
 * - "market-param": a ref query param on the market deep-link attributes the
 *   trade (verified per venue before enabling).
 * - "signup-link": attribution happens at registration via the invite link
 *   (`signupUrl`); market-page params are NOT verified to attribute, so the
 *   CTA links to the invite page instead of the market.
 */
export type AttributionModel = "market-param" | "signup-link";

export interface Exchange {
  id: string;
  name: string;
  /** Products we route to. Cockpit uses "perp". */
  products: ExchangeProduct[];
  attribution: AttributionModel;
  /** Invite/registration URL with the ref code embedded ("signup-link" venues). */
  signupUrl?: string;
  /** Deep-link template for a perp market. `{market}` is replaced by perpSymbol(base). */
  perpMarketTemplate: string;
  /** Maps a base asset (e.g. "BTC") to this venue's perp market slug (e.g. "BTCUSDT"). */
  perpSymbol: (base: string) => string;
  /** Query param name carrying our referral code ("market-param" venues). */
  refParam: string;
  /** Referral code (⚠️ placeholders on disabled venues — replace before enabling). */
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
    // LIVE deal. Referral code 9KQXOX (user-provided invite:
    // bingxdao.com/invite/9KQXOX → canonical bingx.com/en/invite/9KQXOX).
    // Attribution at signup — market-page ref params are unverified on BingX,
    // so the CTA routes through the invite page. Standard perp taker 0.05%;
    // no automatic user rebate in the plain referral program (rebatePct 0)
    // — upgrade if/when a rebate-sharing tier is confirmed.
    id: "bingx",
    name: "BingX",
    products: ["perp", "spot"],
    attribution: "signup-link",
    signupUrl: "https://bingx.com/en/invite/9KQXOX",
    perpMarketTemplate: "https://bingx.com/en/perpetual/{market}",
    perpSymbol: (base) => `${base}-USDT`,
    refParam: "channel",
    refCode: "9KQXOX",
    takerFeePct: 0.05,
    rebatePct: 0,
    restrictedRegions: ["US"],
    enabled: true,
  },
  {
    id: "binance",
    name: "Binance",
    products: ["perp", "spot"],
    attribution: "market-param",
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
    attribution: "market-param",
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
    // LIVE deal. Referral code 96351543 (user-provided invite:
    // my.okx.com/pl/join/96351543). Attribution at signup — market-page
    // channelId params are unverified, so the CTA routes through the join
    // page. Standard perp taker 0.05%; no confirmed automatic user rebate in
    // the plain referral program (rebatePct 0) — upgrade if/when an
    // affiliate rev-share tier with user rebate is confirmed.
    id: "okx",
    name: "OKX",
    products: ["perp", "spot"],
    attribution: "signup-link",
    signupUrl: "https://my.okx.com/pl/join/96351543",
    perpMarketTemplate: "https://www.okx.com/trade-swap/{market}",
    perpSymbol: (base) => `${base.toLowerCase()}-usdt-swap`,
    refParam: "channelId",
    refCode: "96351543",
    takerFeePct: 0.05,
    rebatePct: 0,
    restrictedRegions: ["US"],
    enabled: true,
  },
  {
    id: "hyperliquid",
    attribution: "market-param",
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

/** User-facing affiliate disclosure. Subject to legal (MiCA/KNF) review.
 * Wording must stay accurate for mixed programs: some venues let us share a
 * fee rebate with you, others (plain referral) do not. */
export const AFFILIATE_DISCLOSURE =
  "Follio earns a commission when you sign up or trade through these links. Where the program allows, we share part of it back with you as a fee rebate. We rank venues by your real net cost, not by what we earn. This is not financial advice.";
