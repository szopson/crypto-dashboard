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
import { AlertTriangle, ArrowRight, ChevronDown, LineChart } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { SharePortfolioButton } from "@/components/SharePortfolioButton";
import {
  PORTFOLIO_TIERS,
  PORTFOLIO_SNAPSHOT_DATE,
  tierTotalPct,
  themeBreakdown,
  maskedTotalPct,
  DONUT_PALETTE,
  type PortfolioTheme,
  type RiskTierId,
  type TokenChart,
} from "@/config/utility-portfolio";

function chartEmbedUrl(chart: TokenChart): string {
  if (chart.kind === "tradingview") {
    return `https://s.tradingview.com/widgetembed/?symbol=${encodeURIComponent(chart.symbol)}&interval=D&theme=dark&style=1&hidetopbar=1&hidelegend=1&saveimage=0&locale=en`;
  }
  return `https://dexscreener.com/${chart.chain}/${chart.pair}?embed=1&theme=dark&trades=0&info=0`;
}

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
  tier.tokens.map((t) => ({ ...t, tierId: tier.id, masked: !!tier.maskAllocations })),
);
const PUBLIC_TOKENS = ALL_TOKENS.filter((t) => !t.masked);
// Display base = the DISCLOSED sleeve only (core + frontier). Masked-tier
// weights are private and mathematically underivable only if they're outside
// the base — showing public shares of a base that includes them would let
// anyone reconstruct the hidden total by subtraction.
const PUBLIC_TOTAL = PUBLIC_TOKENS.reduce((s, t) => s + t.allocationPct, 0);
const disclosedPct = (v: number) => (v / PUBLIC_TOTAL) * 100;
const MAX_PCT = Math.max(...PUBLIC_TOKENS.map((t) => t.allocationPct));
const THEMES = themeBreakdown();
void maskedTotalPct; // real values stay config-side only

const LEGEND_TOP = 7;

// Donut segments: disclosed tokens only, sorted desc, shares of the
// disclosed sleeve (sums to 100).
const DONUT_TOKENS = [...PUBLIC_TOKENS].sort(
  (a, b) => b.allocationPct - a.allocationPct,
);
let donutCum = 0;
const DONUT_SEGMENTS = DONUT_TOKENS.map((t, i) => {
  const seg = {
    symbol: t.symbol,
    displayPct: disclosedPct(t.allocationPct),
    pct: disclosedPct(t.allocationPct),
    offset: donutCum,
    color: DONUT_PALETTE[i % DONUT_PALETTE.length],
  };
  donutCum += seg.pct;
  return seg;
});
const OTHERS_PCT = DONUT_TOKENS.slice(LEGEND_TOP).reduce(
  (s, t) => s + disclosedPct(t.allocationPct),
  0,
);

export default function PortfolioPage() {
  return (
    <>
    <SiteHeader />
    <main id="main-content" className="relative mx-auto max-w-4xl overflow-x-clip px-6 py-12">
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
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center rounded-full border border-(--glass-border) px-3 py-1 text-xs text-muted-foreground">
            Snapshot {PORTFOLIO_SNAPSHOT_DATE} · allocations drift with price
          </span>
          <SharePortfolioButton />
        </div>
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

      {/* Allocation — donut of the whole sleeve, one segment per token */}
      <section className="mb-8 animate-fade-up">
        <h2 className="mb-1 text-xl font-semibold">Allocation</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Every position as a share of the disclosed sleeve (Utility Core +
          Frontier). Moonshot sizing is private — see that tier&apos;s rules.
        </p>
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-center sm:gap-12">
          <svg
            viewBox="0 0 42 42"
            className="size-52 shrink-0 -rotate-90"
            aria-hidden
          >
            {DONUT_SEGMENTS.map((seg) => (
              <circle
                key={seg.symbol}
                cx="21"
                cy="21"
                r="15.915"
                fill="none"
                stroke={seg.color}
                strokeWidth="4.5"
                pathLength={100}
                strokeDasharray={`${Math.max(seg.pct - 0.6, 0.2)} ${100 - Math.max(seg.pct - 0.6, 0.2)}`}
                strokeDashoffset={-seg.offset}
              />
            ))}
          </svg>
          <div className="space-y-1.5 text-sm">
            {DONUT_SEGMENTS.slice(0, LEGEND_TOP).map((seg) => (
              <div key={seg.symbol} className="flex items-center gap-2.5 min-w-44">
                <span
                  className="size-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: seg.color }}
                />
                <span className="font-medium">{seg.symbol}</span>
                <span className="ml-auto font-mono text-muted-foreground">
                  {seg.displayPct.toFixed(1)}%
                </span>
              </div>
            ))}
            <div className="flex items-center gap-2.5 min-w-44">
              <span className="size-2.5 rounded-full shrink-0 bg-zinc-600" />
              <span className="font-medium text-muted-foreground">
                Others ({DONUT_TOKENS.length - LEGEND_TOP})
              </span>
              <span className="ml-auto font-mono text-muted-foreground">
                {OTHERS_PCT.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
        {/* Full data for screen readers — the donut is decorative */}
        <ul className="sr-only">
          {PUBLIC_TOKENS.map((t) => (
            <li key={t.symbol}>
              {t.symbol} ({t.name}): {disclosedPct(t.allocationPct).toFixed(1)} percent of the disclosed sleeve
            </li>
          ))}
          <li>Moonshot allocations are undisclosed.</li>
        </ul>
        <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {PORTFOLIO_TIERS.filter((t) => !t.maskAllocations).map((tier) => (
            <span key={tier.id} className="inline-flex items-center gap-1.5">
              <span className={`size-2 rounded-full ${TIER_ACCENT[tier.id].bar}`} />
              {tier.label} {disclosedPct(tierTotalPct(tier)).toFixed(1)}%
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-red-500" />
            Moonshots — sized privately
          </span>
        </div>
      </section>

      {/* Theme breakdown — the "utility season" story */}
      <section className="mb-10 animate-fade-up">
        <h2 className="mb-1 text-xl font-semibold">Where the conviction sits</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          The same sleeve grouped by utility theme.
        </p>
        {/* Masked-tier tokens are excluded from theme totals entirely —
            shares are of the disclosed sleeve, so hidden values can't be
            derived by subtraction. */}
        <div className="h-5 flex rounded-full overflow-hidden animate-bar-grow" aria-hidden>
          {THEMES.map((slice, i) => (
            <div
              key={slice.theme}
              className={`${THEME_COLOR[slice.theme].bar} ${i > 0 ? "border-l border-background/60" : ""}`}
              style={{ width: `${disclosedPct(slice.pct)}%` }}
            />
          ))}
        </div>
        <ul className="sr-only">
          {THEMES.map((s) => (
            <li key={s.theme}>
              {s.theme}: {disclosedPct(s.pct).toFixed(1)} percent of the disclosed sleeve
            </li>
          ))}
        </ul>
        <div className="mt-2 grid grid-cols-1 min-[400px]:grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          {THEMES.map((slice) => (
            <span key={slice.theme} className="inline-flex items-center gap-1.5">
              <span className={`size-2 rounded-full ${THEME_COLOR[slice.theme].dot}`} />
              {slice.theme}
              <span className="ml-auto font-mono text-foreground/80">
                {disclosedPct(slice.pct).toFixed(1)}%
              </span>
            </span>
          ))}
        </div>
      </section>

      {/* Context: where this sleeve sits in the whole portfolio + cycle
          stance. First-person, descriptive, uncertain — a personal approach
          being shared, never a recommendation (MiCA). */}
      <section className="mb-10 rounded-xl border border-(--glass-border) bg-card p-5 animate-fade-up">
        <h2 className="mb-2 text-xl font-semibold">How this fits my overall portfolio</h2>
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            This sleeve is the <span className="text-foreground font-medium">aggressive tail</span> of
            my portfolio — not the core. The core of my overall allocation is
            BTC, and I keep at least ~20% in stablecoins so there is always dry
            powder for drawdowns. Everything on this page sits on top of that
            base, sized so that a total wipeout would hurt but not matter.
          </p>
          <p>
            <span className="text-foreground font-medium">My cycle framing</span> (a
            personal guess, not a forecast): going by how previous cycles were
            timed, I expect the cycle low somewhere around November. I&apos;m
            building these positions gradually (DCA) before that, because
            individual utility tokens have historically bottomed — and moved —
            earlier than BTC itself. I may be completely wrong about both the
            timing and the tokens; the risk banner above is not decoration.
          </p>
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
              {!tier.maskAllocations && (
                <span className="ml-auto font-mono text-sm text-muted-foreground">
                  {disclosedPct(tierTotalPct(tier)).toFixed(1)}%
                </span>
              )}
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
                      {tier.maskAllocations ? "x%" : `${disclosedPct(token.allocationPct).toFixed(1)}%`}
                    </p>
                  </div>
                  {!tier.maskAllocations && (
                    <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full ${accent.bar} animate-bar-grow`}
                        style={{
                          width: `${(token.allocationPct / MAX_PCT) * 100}%`,
                        }}
                      />
                    </div>
                  )}
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

                  {/* Price chart — lazy iframe inside a closed <details>:
                      nothing loads until the user opens it, so 16 embeds
                      don't torpedo page load. */}
                  {token.chart && (
                    <details className="group/chart mt-3 rounded-lg border border-(--glass-border) bg-muted/20">
                      <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm font-medium list-none [&::-webkit-details-marker]:hidden">
                        <LineChart className="size-4 text-muted-foreground" />
                        Price chart
                        <span className="ml-auto text-xs text-muted-foreground">
                          {token.chart.kind === "tradingview" ? "TradingView" : "DEX Screener"}
                        </span>
                      </summary>
                      <div className="px-2 pb-2">
                        <iframe
                          src={chartEmbedUrl(token.chart)}
                          loading="lazy"
                          title={`${token.symbol} price chart`}
                          sandbox="allow-scripts allow-same-origin allow-popups"
                          referrerPolicy="strict-origin-when-cross-origin"
                          className="h-96 w-full rounded-md border-0"
                        />
                      </div>
                    </details>
                  )}

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
                        {token.research.catalysts &&
                          token.research.catalysts.length > 0 && (
                            <div>
                              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-sky-400">
                                Catalysts to watch
                              </p>
                              <ul className="space-y-1 text-muted-foreground">
                                {token.research.catalysts.map((c, i) => (
                                  <li key={i} className="flex gap-2">
                                    <span aria-hidden className="text-sky-400">→</span>
                                    {c}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
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

      {/* Content notes — <section>, not <footer>: the page-level footer
          landmark belongs to the shared SiteFooter. */}
      <section className="border-t border-(--glass-border) pt-6 text-sm text-muted-foreground space-y-3">
        <p>
          Percentages are shares of the disclosed sleeve (Utility Core +
          Frontier) — they say nothing about absolute amounts or overall
          net-worth allocation, and Moonshot sizing is private by design.
          Rounding means tiers and themes may not sum to exactly 100%.
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
      </section>
    </main>
    <SiteFooter />
    </>
  );
}
