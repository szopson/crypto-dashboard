/**
 * /research — Research hub.
 *
 * Lists sectors and the latest reports across all coverage.
 * Public-facing (SEO target). No auth required.
 */
import Link from "next/link";
import { ArrowRight, TrendingUp } from "lucide-react";
import {
  listAllReports,
  listSectorSlugs,
  SECTOR_LABELS,
  type ReportSummary,
} from "@/lib/reports";
import { CryptoMacroPulse } from "@/components/research/CryptoMacroPulse";

// Revalidate the research home every 60s to refresh the Coinglass snapshot
// while still serving from the static SSG cache between intervals.
export const revalidate = 60;

export const metadata = {
  title: "Equity Research — Follio",
  description:
    "Deep-dive equity research reports across semiconductors, AI, space, quantum, biotech, energy, and more.",
};

export default async function ResearchHome() {
  const sectors = await listSectorSlugs();
  const reports = await listAllReports();
  const sorted = [...reports].sort((a, b) =>
    (b.date ?? "").localeCompare(a.date ?? ""),
  );
  const latest = sorted.slice(0, 8);

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <header className="mb-8">
        <h1 className="text-4xl font-semibold tracking-tight">Equity Research</h1>
        <p className="mt-3 max-w-2xl text-zinc-600 dark:text-zinc-400">
          Bloomberg-style deep dives across {sectors.length} sectors. Every report is grounded in
          fundamentals, peer comps, ownership signals, and a clear price target with horizon.
        </p>
      </header>

      <CryptoMacroPulse />

      <section className="mb-12">
        <h2 className="mb-4 text-xl font-semibold">Sectors</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sectors.map((slug) => {
            const meta = SECTOR_LABELS[slug] ?? { name: slug, description: "" };
            const count = reports.filter((r) => r.sector_slug === slug).length;
            return (
              <Link
                key={slug}
                href={`/research/${slug}`}
                className="group block rounded-xl border border-zinc-200 bg-white p-5 transition hover:border-zinc-300 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
              >
                <div className="flex items-baseline justify-between">
                  <h3 className="font-semibold">{meta.name}</h3>
                  <span className="text-xs text-zinc-500">{count} report{count !== 1 ? "s" : ""}</span>
                </div>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {meta.description}
                </p>
                <div className="mt-3 flex items-center gap-1 text-xs font-medium text-emerald-600 group-hover:gap-2 dark:text-emerald-400">
                  View sector <ArrowRight className="h-3.5 w-3.5 transition-all" />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold">Latest Reports</h2>
        {latest.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-500 dark:border-zinc-700">
            No reports published yet. Generate the first batch via{" "}
            <code className="rounded bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800">
              python -m engine.report.equity.cli --all
            </code>
            .
          </p>
        ) : (
          <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {latest.map((r) => (
              <li key={`${r.sector_slug}-${r.slug}`}>
                <ReportRow report={r} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ReportRow({ report }: { report: ReportSummary }) {
  const sectorName = SECTOR_LABELS[report.sector_slug]?.name ?? report.sector_slug;
  const upsideUp = (report.upside_pct ?? 0) >= 0;
  return (
    <Link
      href={`/research/${report.sector_slug}/${report.slug}`}
      className="flex items-center gap-4 p-4 transition hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
    >
      <div className="flex h-10 w-16 flex-shrink-0 items-center justify-center rounded-md bg-zinc-100 font-mono text-sm font-medium dark:bg-zinc-800">
        {report.ticker}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{report.company}</div>
        <div className="mt-0.5 text-xs text-zinc-500">
          {sectorName} · {report.date}
        </div>
      </div>
      <div className="flex flex-shrink-0 items-center gap-4 text-sm">
        <RatingBadge rating={report.rating} />
        <div className="hidden text-right sm:block">
          <div className="text-xs text-zinc-500">Target</div>
          <div className="font-medium tabular-nums">
            ${report.target_price?.toFixed(0) ?? "n/a"}
          </div>
        </div>
        <div
          className={`hidden w-16 text-right text-sm font-medium sm:flex sm:items-center sm:justify-end ${
            upsideUp ? "text-emerald-600" : "text-rose-600"
          }`}
        >
          <TrendingUp className="mr-1 h-3.5 w-3.5" />
          {report.upside_pct != null
            ? `${report.upside_pct >= 0 ? "+" : ""}${report.upside_pct.toFixed(0)}%`
            : "—"}
        </div>
      </div>
    </Link>
  );
}

function RatingBadge({ rating }: { rating: string }) {
  const color: Record<string, string> = {
    BUY: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    ACCUMULATE: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    HOLD: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    REDUCE: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
    SELL: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  };
  return (
    <span
      className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${
        color[rating] ?? "bg-zinc-200 text-zinc-700 dark:bg-zinc-800"
      }`}
    >
      {rating}
    </span>
  );
}
