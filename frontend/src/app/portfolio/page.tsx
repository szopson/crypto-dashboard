/**
 * /portfolio — "Altcoin Utility Season Portfolio".
 *
 * Jakub's personal altcoin allocation published as a transparency signpost.
 * Percentages of the altcoin sleeve only — never absolute sizes (see
 * config/utility-portfolio.ts for the hard rules). Public, static, SEO-able.
 */
import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";
import {
  PORTFOLIO_TIERS,
  PORTFOLIO_SNAPSHOT_DATE,
  tierTotalPct,
} from "@/config/utility-portfolio";

export const metadata = {
  title: "Altcoin Utility Season Portfolio — Follio",
  description:
    "A personal high-risk altcoin allocation shared for transparency — utility narratives (AI, DePIN, payments, privacy) in percentages, with honest risk tiers. Not investment advice.",
};

const TIER_ACCENT: Record<string, { border: string; chip: string; bar: string }> = {
  core: {
    border: "border-amber-500/25",
    chip: "bg-amber-500/15 text-amber-400",
    bar: "bg-amber-500",
  },
  frontier: {
    border: "border-orange-500/25",
    chip: "bg-orange-500/15 text-orange-400",
    bar: "bg-orange-500",
  },
  moonshot: {
    border: "border-red-500/25",
    chip: "bg-red-500/15 text-red-400",
    bar: "bg-red-500",
  },
};

// Bars are scaled to the largest single position so relative sizing reads at
// a glance.
const MAX_PCT = Math.max(
  ...PORTFOLIO_TIERS.flatMap((t) => t.tokens.map((x) => x.allocationPct)),
);

export default function PortfolioPage() {
  return (
    <div className="relative mx-auto max-w-4xl overflow-x-clip px-6 py-12">
      {/* Decorative accent glows */}
      <div aria-hidden className="glow-blob -z-10 -top-32 -right-24 h-80 w-80 bg-amber-500/20 animate-pulse-glow" />
      <div aria-hidden className="glow-blob -z-10 top-1/3 -left-32 h-80 w-80 bg-red-500/10" />

      <header className="mb-6">
        <h1 className="text-4xl font-semibold tracking-tight">
          Altcoin Utility Season Portfolio
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          My personal altcoin allocation, shared as a signpost — what I actually
          hold and why, in percentages of the altcoin sleeve. Utility narratives
          only: AI compute, DePIN, payments, privacy, spatial computing.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Snapshot: {PORTFOLIO_SNAPSHOT_DATE} · allocations drift with price and
          are not rebalanced daily.
        </p>
      </header>

      {/* Risk banner — this page must never read as a recommendation */}
      <div className="mb-10 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
        <AlertTriangle className="size-5 shrink-0 text-red-400 mt-0.5" />
        <div className="text-sm">
          <p className="font-semibold text-red-400">
            High / extreme risk — not investment advice
          </p>
          <p className="text-muted-foreground mt-1">
            This is a personal allocation published for transparency and
            education, not a solicitation or recommendation to buy anything.
            Every line here can go to zero — the bottom tier is priced like it
            will. Do your own research and never size positions you can&apos;t
            afford to lose entirely.
          </p>
        </div>
      </div>

      {/* Tier summary */}
      <div className="mb-10 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {PORTFOLIO_TIERS.map((tier) => {
          const accent = TIER_ACCENT[tier.id];
          return (
            <div
              key={tier.id}
              className={`rounded-xl border ${accent.border} bg-card p-4`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{tier.label}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${accent.chip}`}
                >
                  {tier.riskLabel}
                </span>
              </div>
              <p className="mt-2 text-2xl font-bold">
                {tierTotalPct(tier).toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground">of the sleeve</p>
            </div>
          );
        })}
      </div>

      {/* Tiers */}
      {PORTFOLIO_TIERS.map((tier) => {
        const accent = TIER_ACCENT[tier.id];
        return (
          <section key={tier.id} className="mb-12">
            <div className="mb-1 flex items-center gap-3">
              <h2 className="text-xl font-semibold">{tier.label}</h2>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${accent.chip}`}
              >
                {tier.riskLabel}
              </span>
            </div>
            <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
              {tier.description}
            </p>
            <div className="space-y-3">
              {tier.tokens.map((token) => (
                <div
                  key={token.symbol}
                  className={`rounded-xl border ${accent.border} bg-card p-4`}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-semibold">
                      {token.symbol}
                      <span className="ml-2 text-sm font-normal text-muted-foreground">
                        {token.name}
                        {token.chain ? ` · ${token.chain}` : ""}
                      </span>
                    </p>
                    <p className="font-mono font-semibold shrink-0">
                      {token.allocationPct.toFixed(1)}%
                    </p>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full ${accent.bar}`}
                      style={{
                        width: `${(token.allocationPct / MAX_PCT) * 100}%`,
                      }}
                    />
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {token.description}
                  </p>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {/* Footer notes */}
      <footer className="border-t border-(--glass-border) pt-6 text-sm text-muted-foreground space-y-3">
        <p>
          Percentages are shares of the altcoin sleeve only — they say nothing
          about absolute amounts or overall net-worth allocation. Rounding means
          tiers may not sum to exactly 100%.
        </p>
        <p>
          Want the process behind sizing and grading decisions like these? Try
          the{" "}
          <Link
            href="/app/trade-review"
            className="text-primary hover:underline inline-flex items-center gap-1"
          >
            AI Trade Review <ArrowRight className="size-3.5" />
          </Link>{" "}
          — it grades your decision, not your PnL.
        </p>
      </footer>
    </div>
  );
}
