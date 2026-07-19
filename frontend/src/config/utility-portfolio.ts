/**
 * "Altcoin Utility Season Portfolio" — Jakub's personal altcoin allocation,
 * published as a transparency/education signpost on /portfolio.
 *
 * HARD RULES (MiCA/KNF):
 * - Percentages of the altcoin sleeve ONLY — absolute position sizes, USD
 *   values and entry prices must NEVER appear here or on the page.
 * - Descriptions are utility descriptions, not price theses — no targets,
 *   no "buy"/"accumulate" language.
 *
 * Snapshot date is shown on the page; update `snapshotDate` when refreshing
 * the allocations.
 */

export type RiskTierId = "core" | "frontier" | "moonshot";

export type PortfolioTheme =
  | "AI"
  | "DePIN"
  | "Spatial computing"
  | "Privacy"
  | "Payments"
  | "Identity"
  | "AgriTech"
  | "Commerce"
  | "Early stage";

export interface PortfolioToken {
  symbol: string;
  name: string;
  /** Percent of the whole altcoin sleeve (all tiers sum to ~100). */
  allocationPct: number;
  description: string;
  /**
   * Canonical utility theme — single source of truth for the theme
   * breakdown on the page. "Early stage" is a lifecycle bucket (thesis not
   * yet classifiable), deliberately distinct from utility themes.
   */
  theme: PortfolioTheme;
  chain?: string;
}

export interface RiskTier {
  id: RiskTierId;
  label: string;
  riskLabel: string;
  description: string;
  tokens: PortfolioToken[];
}

export const PORTFOLIO_SNAPSHOT_DATE = "2026-07-19";

export const PORTFOLIO_TIERS: RiskTier[] = [
  {
    id: "core",
    label: "Utility Core",
    riskLabel: "High risk",
    description:
      "Established utility narratives — AI compute, DePIN, payments, privacy. Still altcoins: deep drawdowns are the norm, not the exception.",
    tokens: [
      {
        symbol: "TAO",
        theme: "AI",
        name: "Bittensor",
        allocationPct: 28.1,
        description:
          "Decentralized machine-intelligence network — subnets compete to serve AI workloads and are rewarded in TAO.",
      },
      {
        symbol: "PEAQ",
        theme: "DePIN",
        name: "peaq",
        allocationPct: 10.4,
        description:
          "Layer-1 built for DePIN and machine real-world assets — machines as first-class economic actors.",
      },
      {
        symbol: "ZBCN",
        theme: "Payments",
        name: "Zebec Network",
        allocationPct: 8.0,
        description:
          "Payments infrastructure — continuous streaming of payroll and payments on-chain.",
      },
      {
        symbol: "LYX",
        theme: "Identity",
        name: "LUKSO",
        allocationPct: 7.8,
        description:
          "Identity-centric layer-1 (Universal Profiles) targeting the creative and social economy.",
      },
      {
        symbol: "AZERO",
        theme: "Privacy",
        name: "Aleph Zero",
        allocationPct: 7.4,
        description:
          "Privacy-enhancing layer-1 combining zero-knowledge proofs with multi-party computation, sub-second finality.",
      },
      {
        symbol: "FET",
        theme: "AI",
        name: "Artificial Superintelligence Alliance",
        allocationPct: 6.4,
        description:
          "Merged Fetch.ai / SingularityNET / Ocean stack — decentralized agentic-AI infrastructure and marketplaces.",
      },
      {
        symbol: "DMTR",
        theme: "AgriTech",
        name: "Dimitra",
        allocationPct: 3.7,
        description:
          "Agritech data platform bringing satellite, sensor and ML tooling to emerging-market farming.",
      },
      {
        symbol: "AVICI",
        theme: "Early stage",
        name: "Avici",
        allocationPct: 3.5,
        description:
          "Early-stage project — small allocation while the thesis matures.",
      },
      {
        symbol: "BOSON",
        theme: "Commerce",
        name: "Boson Protocol",
        allocationPct: 2.5,
        description:
          "Decentralized commerce — physical goods tokenized as redeemable on-chain vouchers.",
      },
      {
        symbol: "ORAI",
        theme: "AI",
        name: "Oraichain",
        allocationPct: 2.3,
        description:
          "AI oracle layer and AI-centric chain — verifiable AI computation for smart contracts.",
      },
      {
        symbol: "OPENX",
        theme: "AI",
        name: "OpenxAI Network",
        allocationPct: 1.4,
        description:
          "Open, decentralized AI model hosting and deployment — early stage.",
      },
      {
        symbol: "MPC",
        theme: "Privacy",
        name: "Partisia Blockchain",
        allocationPct: 1.0,
        description:
          "Privacy blockchain built on multi-party computation — confidential smart contracts.",
      },
    ],
  },
  {
    id: "frontier",
    label: "Frontier",
    riskLabel: "Very high risk",
    description:
      "Younger protocols with a live product but an unproven market. Sized accordingly.",
    tokens: [
      {
        symbol: "AUKI",
        theme: "Spatial computing",
        name: "Auki Labs (posemesh)",
        allocationPct: 10.1,
        description:
          "Decentralized machine-perception network — shared spatial computing (the posemesh) for AR and robotics positioning.",
      },
    ],
  },
  {
    id: "moonshot",
    label: "Moonshots",
    riskLabel: "Extreme risk",
    description:
      "Development-phase microcaps — pre-product, no track record, launchpad-origin. Lottery-ticket sizing; assume total loss is the base case.",
    tokens: [
      {
        symbol: "NRL",
        theme: "Early stage",
        name: "NRL",
        allocationPct: 5.3,
        chain: "Solana",
        description:
          "Development-phase microcap on Solana — project is just getting started.",
      },
      {
        symbol: "OCCA",
        theme: "Early stage",
        name: "OCCA",
        allocationPct: 1.6,
        chain: "Solana",
        description:
          "Development-phase microcap on Solana — project is just getting started.",
      },
      {
        symbol: "SWCH",
        theme: "Early stage",
        name: "SWCH",
        allocationPct: 0.6,
        chain: "Solana",
        description:
          "Development-phase microcap on Solana — project is just getting started.",
      },
    ],
  },
];

export function tierTotalPct(tier: RiskTier): number {
  return tier.tokens.reduce((s, t) => s + t.allocationPct, 0);
}

// Sleeve invariant: allocations must sum to ~100 (rounding tolerance ±1.5).
// The page is statically prerendered, so a bad edit fails the BUILD, not the
// visitor.
const SLEEVE_SUM = PORTFOLIO_TIERS.reduce((s, t) => s + tierTotalPct(t), 0);
if (Math.abs(SLEEVE_SUM - 100) > 1.5) {
  throw new Error(
    `utility-portfolio: allocations sum to ${SLEEVE_SUM.toFixed(1)}% — expected ~100%. Fix the percentages.`,
  );
}

export interface ThemeSlice {
  theme: PortfolioTheme;
  pct: number;
}

/** Theme totals derived from the canonical per-token theme field, desc. */
export function themeBreakdown(): ThemeSlice[] {
  const totals = new Map<PortfolioTheme, number>();
  for (const tier of PORTFOLIO_TIERS) {
    for (const t of tier.tokens) {
      totals.set(t.theme, (totals.get(t.theme) ?? 0) + t.allocationPct);
    }
  }
  return [...totals.entries()]
    .map(([theme, pct]) => ({ theme, pct }))
    .sort((a, b) => {
      // "Early stage" is a lifecycle bucket — always last, regardless of size.
      if (a.theme === "Early stage") return 1;
      if (b.theme === "Early stage") return -1;
      return b.pct - a.pct;
    });
}
