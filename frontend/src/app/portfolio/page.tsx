/**
 * /portfolio — "Altcoin Utility Season Portfolio".
 *
 * Jakub's personal altcoin allocation published as a transparency signpost.
 * Percentages of the altcoin sleeve only — never absolute sizes (see
 * config/utility-portfolio.ts for the hard rules). Public, static, SEO-able.
 *
 * Layout order is deliberate (compliance): the risk banner renders BEFORE any
 * portfolio visualization. Stacked-bar widths are normalized so rounding
 * noise (~100.1%) can't overflow the track.
 */
import Link from "next/link";
import { AlertTriangle, ArrowRight, ChevronDown } from "lucide-react";
import {
  PORTFOLIO_TIERS,
  PORTFOLIO_SNAPSHOT_DATE,
  tierTotalPct,
  themeBreakdown,
  type PortfolioTheme,
  type RiskTierId,
} from "@/config/utility-portfolio";

export const metadata = {
  title: "Altcoin Utility Season Portfolio — Follio",
  description:
    "A personal high-risk altcoin allocation shared for transparency — utility narratives (AI, DePIN, payments, privacy) in percentages, with honest risk tiers. Not investment advice.",
};

// Tailwind 4 compiles statically — keep FULL class strings in maps, never
// interpolate fragments into class names.
const TIER_ACCENT: Record<RiskTierId, { border: string; chip: string; bar: string }> = {
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

const THEME_COLOR: Record<PortfolioTheme, { bar: string; dot: string; chip: string }> = {
  AI: { bar: "bg-emerald-500", dot: "bg-emerald-500", chip: "bg-emerald-500/15 text-emerald-400" },
  DePIN: { bar: "bg-cyan-500", dot: "bg-cyan-500", chip: "bg-cyan-500/15 text-cyan-400" },
  "Spatial computing": { bar: "bg-violet-500", dot: "bg-violet-500", chip: "bg-violet-500/15 text-violet-400" },
  Privacy: { bar: "bg-blue-500", dot: "bg-blue-500", chip: "bg-blue-500/15 text-blue-400" },
  Payments: { bar: "bg-teal-500", dot: "bg-teal-500", chip: "bg-teal-500/15 text-teal-400" },
  Identity: { bar: "bg-pink-500", dot: "bg-pink-500", chip: "bg-pink-500/15 text-pink-400" },
  AgriTech: { bar: "bg-lime-500", dot: "bg-lime-500", chip: "bg-lime-500/15 text-lime-400" },
  Commerce: { bar: "bg-orange-400", dot: "bg-orange-400", chip: "bg-orange-400/15 text-orange-300" },
  Oracles: { bar: "bg-sky-500", dot: "bg-sky-500", chip: "bg-sky-500/15 text-sky-400" },
  // Lifecycle bucket, not a utility theme — deliberately muted.
  "Early stage": { bar: "bg-zinc-600", dot: "bg-zinc-600", chip: "bg-zinc-500/15 text-zinc-400" },
};

// All tokens flattened in tier order (core → frontier → moonshot, each already
// sorted descending by allocation in the config).
const ALL_TOKENS = PORTFOLIO_TIERS.flatMap((tier) =>
  tier.tokens.map((t) => ({ ...t, tierId: tier.id })),
);
const SLEEVE_TOTAL = ALL_TOKENS.reduce((s, t) => s + t.allocationPct, 0);
const MAX_PCT = Math.max(...ALL_TOKENS.map((t) => t.allocationPct));
const THEMES = themeBreakdown();

export default function PortfolioPage() {
  return (
    <div className="relative mx-auto max-w-4xl overflow-x-clip px-6 py-12">
      {/* Decorative accent glows */}
      <div aria-hidden className="glow-blob -z-10 -top-32 -right-24 h-80 w-80 bg-amber-500/20 animate-pulse-glow" />
      <div aria-hidden className="glow-blob -z-10 top-1/3 -left-32 h-80 w-80 bg-red-500/10" />

      <header className="mb-6 animate-fade-up">
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight">
          Altcoin Utility Season Portfolio
        </h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          My personal altcoin allocation, shared as a signpost — what I actually
          hold and why, in percentages of the altcoin sleeve. Utility narratives
          only: AI compute, DePIN, payments, privacy, spatial computing.
        </p>
        <p className="mt-3">
          <span className="inline-flex items-center rounded-full border border-(--glass-border) px-3 py-1 text-xs text-muted-foreground">
            Snapshot {PORTFOLIO_SNAPSHOT_DATE} · allocations drift with price
          </span>
        </p>
      </header>

      {/* Risk banner — must precede every portfolio visualization */}
      <div className="mb-8 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 animate-fade-up">
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

      {/* Sleeve at a glance — every token as a tier-colored segment */}
      <section className="mb-8 animate-fade-up">
        <h2 className="mb-1 text-xl font-semibold">The sleeve at a glance</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Every position as a share of the whole — colored by risk tier.
        </p>
        <div className="h-5 flex rounded-full overflow-hidden animate-bar-grow" aria-hidden>
          {ALL_TOKENS.map((token, i) => (
            <div
              key={token.symbol}
              className={`${TIER_ACCENT[token.tierId].bar} ${i > 0 ? "border-l border-background/60" : ""}`}
              style={{ width: `${(token.allocationPct / SLEEVE_TOTAL) * 100}%` }}
            />
          ))}
        </div>
        {/* Full data for screen readers — segments above are decorative */}
        <ul className="sr-only">
          {ALL_TOKENS.map((t) => (
            <li key={t.symbol}>
              {t.symbol} ({t.name}): {t.allocationPct.toFixed(1)} percent
            </li>
          ))}
        </ul>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {PORTFOLIO_TIERS.map((tier) => (
            <span key={tier.id} className="inline-flex items-center gap-1.5">
              <span className={`size-2 rounded-full ${TIER_ACCENT[tier.id].bar}`} />
              {tier.label} {tierTotalPct(tier).toFixed(1)}%
            </span>
          ))}
        </div>
      </section>

      {/* Theme breakdown — the "utility season" story */}
      <section className="mb-10 animate-fade-up">
        <h2 className="mb-1 text-xl font-semibold">Where the conviction sits</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          The same sleeve grouped by utility theme. &quot;Early stage&quot; is a
          lifecycle bucket — positions too young to classify — not a theme.
        </p>
        <div className="h-5 flex rounded-full overflow-hidden animate-bar-grow" aria-hidden>
          {THEMES.map((slice, i) => (
            <div
              key={slice.theme}
              className={`${THEME_COLOR[slice.theme].bar} ${i > 0 ? "border-l border-background/60" : ""}`}
              style={{ width: `${(slice.pct / SLEEVE_TOTAL) * 100}%` }}
            />
          ))}
        </div>
        <ul className="sr-only">
          {THEMES.map((s) => (
            <li key={s.theme}>
              {s.theme}: {s.pct.toFixed(1)} percent
            </li>
          ))}
        </ul>
        <div className="mt-2 grid grid-cols-1 min-[400px]:grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          {THEMES.map((slice) => (
            <span key={slice.theme} className="inline-flex items-center gap-1.5">
              <span className={`size-2 rounded-full ${THEME_COLOR[slice.theme].dot}`} />
              {slice.theme}
              <span className="ml-auto font-mono text-foreground/80">
                {slice.pct.toFixed(1)}%
              </span>
            </span>
          ))}
        </div>
      </section>

      {/* Tiers */}
      {PORTFOLIO_TIERS.map((tier) => {
        const accent = TIER_ACCENT[tier.id];
        return (
          <section key={tier.id} className="mb-12 animate-fade-up">
            <div className="mb-1 flex items-center gap-3">
              <h2 className="text-xl font-semibold">{tier.label}</h2>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${accent.chip}`}
              >
                {tier.riskLabel}
              </span>
              <span className="ml-auto font-mono text-sm text-muted-foreground">
                {tierTotalPct(tier).toFixed(1)}%
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
                      className={`h-full rounded-full ${accent.bar} animate-bar-grow`}
                      style={{
                        width: `${(token.allocationPct / MAX_PCT) * 100}%`,
                      }}
                    />
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {token.description}
                  </p>
                  <p className="mt-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${THEME_COLOR[token.theme].chip}`}
                    >
                      {token.theme}
                    </span>
                  </p>

                  {/* Native <details> — expandable without client JS, keeps
                      the page a static server component. */}
                  {token.research && (
                    <details className="group mt-3 rounded-lg border border-(--glass-border) bg-muted/20">
                      <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm font-medium list-none [&::-webkit-details-marker]:hidden">
                        <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
                        Research notes
                      </summary>
                      <div className="px-3 pb-3 space-y-3 text-sm">
                        <p className="text-muted-foreground">
                          {token.research.thesis}
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-500">
                              Strengths
                            </p>
                            <ul className="space-y-1 text-muted-foreground">
                              {token.research.strengths.map((s, i) => (
                                <li key={i} className="flex gap-2">
                                  <span aria-hidden className="text-emerald-500">+</span>
                                  {s}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-red-400">
                              Risks
                            </p>
                            <ul className="space-y-1 text-muted-foreground">
                              {token.research.risks.map((r, i) => (
                                <li key={i} className="flex gap-2">
                                  <span aria-hidden className="text-red-400">−</span>
                                  {r}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground/70">
                          Descriptive project notes, not investment advice.
                        </p>
                      </div>
                    </details>
                  )}
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
          tiers and themes may not sum to exactly 100%.
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
