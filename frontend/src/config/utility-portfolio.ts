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
  | "Oracles"
  | "Early stage";

/**
 * Optional research notes rendered as an expandable section on the token
 * card. Source: docs/research/ portfolio research doc. MUST stay descriptive
 * (project strengths/risks) — never sizing advice, return targets or
 * buy language (MiCA/KNF).
 */
export interface TokenResearch {
  thesis: string;
  strengths: string[];
  risks: string[];
}

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
  research?: TokenResearch;
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
        research: {
          thesis:
            "TAO is the reserve asset of the Bittensor network: miners serve models and inference inside specialized subnets, validators grade the output, and every subnet's ALPHA token is priced against TAO. Hard cap of 21M with a halving emission curve gives it a BTC-like supply profile applied to AI infrastructure.",
          strengths: [
            "Established position as one of the leading decentralized-AI infrastructure networks",
            "21M hard cap + halving-style emission — scarce-asset supply profile",
            "Structural demand: every subnet needs TAO as the pricing and liquidity asset for its rewards",
          ],
          risks: [
            "Highly experimental ecosystem — no guarantee subnet models find sustainable product-market fit",
            "Technical complexity limits organic retail demand beyond the AI narrative",
            "Deep-drawdown volatility and potential exposure to future AI/compute-market regulation",
          ],
        },
      },
      {
        symbol: "PEAQ",
        theme: "DePIN",
        name: "peaq",
        allocationPct: 10.4,
        description:
          "Layer-1 built for DePIN and machine real-world assets — machines as first-class economic actors.",
        research: {
          thesis:
            "peaq is a layer-1 purpose-built for DePIN and the machine economy: vehicles, robots and devices get on-chain IDs, wallets and the ability to transact autonomously. The bet is that machine real-world assets and machine-to-machine payments become a category of their own.",
          strengths: [
            "Clear category focus — one of the few L1s built specifically for DePIN",
            "Growing roster of machine/DePIN projects deploying on the network",
            "Machine identity + payments is a differentiated primitive, not a generic L1 pitch",
          ],
          risks: [
            "DePIN adoption is early — machine-economy demand is still mostly thesis",
            "Competes with general-purpose L1s/L2s that can host the same apps",
            "Token demand depends on real network usage materializing",
          ],
        }
      },
      {
        symbol: "ZBCN",
        theme: "Payments",
        name: "Zebec Network",
        allocationPct: 8.0,
        description:
          "Payments infrastructure — continuous streaming of payroll and payments on-chain.",
        research: {
          thesis:
            "Zebec evolved from pure payment streaming into a multi-chain financial network: payroll, cards and a SuperApp, expanding toward RWA and DePIN. Product fees are paid in ZBCN (client stablecoins auto-convert on fee accrual), and revenue funds a buyback program; the final investor unlocks end in March 2026, after which the tokenomics turn deflationary.",
          strengths: [
            "Live revenue-generating products (payroll, card, SuperApp) with fees tied to the token",
            "Maturing tokenomics: unlocks ending, revenue-funded buyback and burn",
            "Overlaps several utility narratives at once — payments, RWA, cards, DePIN",
          ],
          risks: [
            "Fintech-grade regulatory exposure: KYC/AML, card licensing, compliance costs",
            "Value accrual depends on one core business — weak cash flow means weak buybacks",
            "Competitive Web3 payroll/payments segment",
          ],
        },
      },
      {
        symbol: "LYX",
        theme: "Identity",
        name: "LUKSO",
        allocationPct: 7.8,
        description:
          "Identity-centric layer-1 (Universal Profiles) targeting the creative and social economy.",
        research: {
          thesis:
            "LUKSO targets the creative and social economy with identity as the core primitive: Universal Profiles are smart-contract accounts with recoverability and rich metadata, aiming to make on-chain identity usable for mainstream brands and creators.",
          strengths: [
            "Universal Profiles are a genuinely different UX primitive vs plain wallets",
            "Founder pedigree from the Ethereum ecosystem (ERC-20 co-author)",
            "Brand/creator niche avoids head-on competition with DeFi chains",
          ],
          risks: [
            "Network effects in social/creator crypto have been hard to bootstrap",
            "Small ecosystem relative to major L1s/L2s",
            "Identity standards can be copied onto larger chains",
          ],
        }
      },
      {
        symbol: "AZERO",
        theme: "Privacy",
        name: "Aleph Zero",
        allocationPct: 7.4,
        description:
          "Privacy-enhancing layer-1 combining zero-knowledge proofs with multi-party computation, sub-second finality.",
        research: {
          thesis:
            "Aleph Zero combines a fast DAG-based consensus (sub-second finality) with a privacy layer built on zero-knowledge proofs and multi-party computation — aiming at use cases that need confidentiality with compliance in mind.",
          strengths: [
            "Differentiated privacy stack (zk + MPC) rather than mixer-style anonymity",
            "Strong performance profile — sub-second finality",
            "Enterprise-oriented positioning on privacy-with-compliance",
          ],
          risks: [
            "Privacy chains face persistent regulatory overhang",
            "Ecosystem growth has lagged the tech",
            "Competes with both privacy protocols and zk features landing on major chains",
          ],
        }
      },
      {
        symbol: "FET",
        theme: "AI",
        name: "Artificial Superintelligence Alliance",
        allocationPct: 6.4,
        description:
          "Merged Fetch.ai / SingularityNET / Ocean stack — decentralized agentic-AI infrastructure and marketplaces.",
        research: {
          thesis:
            "FET is becoming the base token of the Artificial Superintelligence Alliance — the Fetch.ai / SingularityNET / Ocean Protocol merger building a vertically integrated decentralized-AI stack from agents through data to research. AGIX and OCEAN fold into it at fixed exchange rates; supply is ~2.7B.",
          strengths: [
            "Three merged ecosystems: more developers, use cases and community than any single one",
            "Deep liquidity and top-tier exchange coverage",
            "Working agent, data and research stack for building real applications",
          ],
          risks: [
            "Heavy supply and high FDV relative to current adoption",
            "Multi-project merger adds governance, integration and coordination risk",
            "Agent adoption still trails the 'decentralized AGI' marketing",
          ],
        },
      },
      {
        symbol: "DMTR",
        theme: "AgriTech",
        name: "Dimitra",
        allocationPct: 3.7,
        description:
          "Agritech data platform bringing satellite, sensor and ML tooling to emerging-market farming.",
        research: {
          thesis:
            "Dimitra applies satellite imagery, IoT sensors and machine learning to emerging-market agriculture, with token-gated access to its platforms. The bet is real-world agritech adoption paying into an on-chain economy.",
          strengths: [
            "Real-world vertical with concrete government/agribusiness deployments",
            "AgriTech is uncorrelated with typical crypto narratives — diversifying exposure",
            "Token tied to platform access rather than pure speculation",
          ],
          risks: [
            "Emerging-market B2G/B2B sales cycles are slow and lumpy",
            "Low liquidity and limited exchange coverage",
            "Platform value must ultimately justify the token layer",
          ],
        }
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
        research: {
          thesis:
            "Boson Protocol builds decentralized commerce rails: physical products sold as redeemable on-chain vouchers with game-theoretic dispute resolution, removing the trusted intermediary from e-commerce settlement.",
          strengths: [
            "Novel primitive — trust-minimized physical-goods settlement",
            "Commerce is a massive addressable market if Web3 retail materializes",
            "Long-running project that survived a full bear cycle",
          ],
          risks: [
            "Web3 commerce demand has repeatedly under-delivered vs expectations",
            "Requires both merchant and buyer adoption simultaneously",
            "Thin liquidity and modest developer traction",
          ],
        }
      },
      {
        symbol: "ORAI",
        theme: "AI",
        name: "Oraichain",
        allocationPct: 2.3,
        description:
          "AI oracle layer and AI-centric chain — verifiable AI computation for smart contracts.",
        research: {
          thesis:
            "Oraichain started as an AI oracle — verifying AI model outputs for smart contracts — and expanded into an AI-centric chain and tooling stack, positioning itself as verifiability infrastructure for on-chain AI.",
          strengths: [
            "Early mover on AI-oracle verifiability, a niche most AI tokens ignore",
            "Full stack: chain, oracle, and AI tooling under one ecosystem",
            "Verifiable AI becomes more relevant as agents touch real funds",
          ],
          risks: [
            "Small ecosystem vs the leading AI-crypto platforms",
            "AI-oracle demand is still nascent",
            "Cosmos-adjacent ecosystems have struggled to retain liquidity",
          ],
        }
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
        research: {
          thesis:
            "Partisia brings academic-grade multi-party computation to a blockchain: data can be computed on while staying encrypted, targeting confidential enterprise workloads and privacy-preserving data markets.",
          strengths: [
            "Deep MPC research pedigree — the team helped pioneer commercial MPC",
            "Confidential compute is a real enterprise requirement, not a crypto-native fad",
            "Differentiated from zk-only privacy approaches",
          ],
          risks: [
            "Enterprise adoption of token-based infrastructure remains slow",
            "Low market visibility and liquidity",
            "Privacy-tech competition from zk stacks with larger ecosystems",
          ],
        }
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
        research: {
          thesis:
            "Auki Labs is building the posemesh — a decentralized machine-perception network that lets devices, robots and AR applications share a common understanding of physical space. Think DePIN economics applied to spatial computing: nodes contribute positioning capability and earn for serving it.",
          strengths: [
            "Spatial computing tailwind — AR glasses and robotics both need shared positioning",
            "Live deployments in retail (in-store navigation) rather than pure whitepaper",
            "Niche with few direct decentralized competitors",
          ],
          risks: [
            "Market timing depends on AR/robotics hardware adoption curves",
            "Small cap, thin liquidity, limited analyst coverage",
            "Concentrated single-team execution risk",
          ],
        }
      },
    ],
  },
  {
    id: "moonshot",
    label: "Moonshots",
    riskLabel: "Extreme risk",
    description:
      "Sub-$1M microcaps — live or early products, but negligible liquidity, thin holder bases and no market validation. Lottery-ticket sizing; assume total loss is the base case.",
    tokens: [
      {
        symbol: "NRL",
        theme: "Payments",
        name: "NodeRails",
        allocationPct: 5.3,
        chain: "Solana",
        description:
          "Multi-chain crypto payments gateway — hosted checkouts, payment links, subscriptions and dispute protection across EVM, Solana and Sui.",
        research: {
          thesis:
            "NodeRails is checkout infrastructure for web3 commerce: hosted checkouts, payment links, subscriptions, invoices and dispute protection, built on a full payment-intent lifecycle (created \u2192 authorized \u2192 captured \u2192 settled, plus refunds and disputes) with webhooks and on-chain refunds. NRL is the brand's Solana SPL token with ~1B fully circulating supply \u2014 no unlock overhang.",
          strengths: [
            "Developer-friendly stack: APIs, webhooks and a coherent payment-intent model",
            "Live product in a real vertical (e-commerce payments), not just a whitepaper",
            "Fully circulating supply \u2014 a clean spot market with no vesting cliffs ahead",
          ],
          risks: [
            "No explicit value-capture from business revenue to the token yet \u2014 stablecoins sit at the center of the payment flow, not NRL",
            "Extremely thin liquidity, few holders, top-10 addresses hold ~40% of supply",
            "No major exchange listings \u2014 price is easy to move",
          ],
        },
      },
      {
        symbol: "OCCA",
        theme: "AI",
        name: "OCCA AI",
        allocationPct: 1.6,
        chain: "Solana",
        description:
          "Operating layer for agent-run companies — on-chain identity, treasury and a verifiable trace of every AI agent's actions.",
        research: {
          thesis:
            "OCCA AI is building the operating layer for companies run by autonomous AI agents: every agent, task and transaction lands on-chain, state is deterministic, and models are called only where a step actually needs inference \u2014 the goal is an agent-run company that is fully auditable on-chain rather than a black-box LLM SaaS.",
          strengths: [
            "Pure exposure to the autonomous-agents narrative \u2014 agent identity, treasury and audit trail as the product",
            "Verifiable-on-chain stats by design, not dashboard claims",
            "Integrates with existing agent runtimes rather than reinventing them",
          ],
          risks: [
            "No published tokenomics \u2014 supply breakdown, vesting and value accrual are unknown",
            "Concept stage: no disclosed revenue or mature product",
            "Extreme microcap liquidity \u2014 exits from any meaningful size are narrow",
          ],
        },
      },
      {
        symbol: "SWCH",
        theme: "Oracles",
        name: "Switchboard",
        allocationPct: 0.6,
        chain: "Solana",
        description:
          "Permissionless oracle network — low-latency price feeds, verifiable randomness and a cross-provider aggregator, extending into AI inference.",
        research: {
          thesis:
            "Switchboard is a permissionless oracle network: sub-100ms streaming price feeds, verifiable randomness and an aggregator that combines providers like Chainlink and Pyth into one feed, extended with TEE-secured custom data and an AI inference exchange. Staked tokens (svSWTCH) carry governance and a share of oracle fees, and operators need delegated stake as economic security.",
          strengths: [
            "Fundamental use case \u2014 oracles and VRF are needed in every market regime",
            "Explicit value capture: staking rewards paid from real oracle fees",
            "Working product with cross-chain integrations at a very small market cap",
          ],
          risks: [
            "Entrenched competition (Chainlink, Pyth, RedStone) with far larger network effects",
            "Conflicting circulating-supply data across trackers and extreme volatility since listing",
            "The AI inference exchange is new and unproven as a demand source",
          ],
        },
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
