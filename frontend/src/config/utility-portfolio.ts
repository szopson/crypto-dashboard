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

export interface PortfolioToken {
  symbol: string;
  name: string;
  /** Percent of the whole altcoin sleeve (all tiers sum to ~100). */
  allocationPct: number;
  description: string;
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
        name: "Bittensor",
        allocationPct: 28.1,
        description:
          "Decentralized machine-intelligence network — subnets compete to serve AI workloads and are rewarded in TAO.",
      },
      {
        symbol: "PEAQ",
        name: "peaq",
        allocationPct: 10.4,
        description:
          "Layer-1 built for DePIN and machine real-world assets — machines as first-class economic actors.",
      },
      {
        symbol: "ZBCN",
        name: "Zebec Network",
        allocationPct: 8.0,
        description:
          "Payments infrastructure — continuous streaming of payroll and payments on-chain.",
      },
      {
        symbol: "LYX",
        name: "LUKSO",
        allocationPct: 7.8,
        description:
          "Identity-centric layer-1 (Universal Profiles) targeting the creative and social economy.",
      },
      {
        symbol: "AZERO",
        name: "Aleph Zero",
        allocationPct: 7.4,
        description:
          "Privacy-enhancing layer-1 combining zero-knowledge proofs with multi-party computation, sub-second finality.",
      },
      {
        symbol: "FET",
        name: "Artificial Superintelligence Alliance",
        allocationPct: 6.4,
        description:
          "Merged Fetch.ai / SingularityNET / Ocean stack — decentralized agentic-AI infrastructure and marketplaces.",
      },
      {
        symbol: "DMTR",
        name: "Dimitra",
        allocationPct: 3.7,
        description:
          "Agritech data platform bringing satellite, sensor and ML tooling to emerging-market farming.",
      },
      {
        symbol: "AVICI",
        name: "Avici",
        allocationPct: 3.5,
        description:
          "Early-stage project — small allocation while the thesis matures.",
      },
      {
        symbol: "BOSON",
        name: "Boson Protocol",
        allocationPct: 2.5,
        description:
          "Decentralized commerce — physical goods tokenized as redeemable on-chain vouchers.",
      },
      {
        symbol: "ORAI",
        name: "Oraichain",
        allocationPct: 2.3,
        description:
          "AI oracle layer and AI-centric chain — verifiable AI computation for smart contracts.",
      },
      {
        symbol: "OPENX",
        name: "OpenxAI Network",
        allocationPct: 1.4,
        description:
          "Open, decentralized AI model hosting and deployment — early stage.",
      },
      {
        symbol: "MPC",
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
        name: "NRL",
        allocationPct: 5.3,
        chain: "Solana",
        description:
          "Development-phase microcap on Solana — project is just getting started.",
      },
      {
        symbol: "OCCA",
        name: "OCCA",
        allocationPct: 1.6,
        chain: "Solana",
        description:
          "Development-phase microcap on Solana — project is just getting started.",
      },
      {
        symbol: "SWCH",
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
