/**
 * /research/[sector] — Sector report list.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { MDXRemote } from "next-mdx-remote/rsc";
import {
  listReportsInSector,
  listSectorSlugs,
  SECTOR_LABELS,
} from "@/lib/reports";
import { readSectorBrief } from "@/lib/sector_briefs";
import { reportComponents } from "@/components/research/ReportComponents";

interface PageProps {
  params: Promise<{ sector: string }>;
}

export async function generateStaticParams() {
  const slugs = await listSectorSlugs();
  return slugs.map((sector) => ({ sector }));
}

export async function generateMetadata({ params }: PageProps) {
  const { sector } = await params;
  const meta = SECTOR_LABELS[sector];
  return {
    title: meta ? `${meta.name} — Follio Research` : "Sector — Follio Research",
    description: meta?.description,
  };
}

export default async function SectorPage({ params }: PageProps) {
  const { sector } = await params;
  const meta = SECTOR_LABELS[sector];
  if (!meta) return notFound();

  const reports = await listReportsInSector(sector);
  const brief = await readSectorBrief(sector);

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <Link
        href="/research"
        className="mb-6 inline-flex items-center gap-1 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        <ChevronLeft className="h-4 w-4" /> All sectors
      </Link>
      <header className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight">{meta.name}</h1>
        <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">{meta.description}</p>
        <p className="mt-1 text-sm text-zinc-500">
          {reports.length} report{reports.length !== 1 ? "s" : ""} in coverage
        </p>
      </header>

      {brief && (
        <section className="report-body mb-12 max-w-none" suppressHydrationWarning>
          <MDXRemote source={brief.content} components={reportComponents} />
        </section>
      )}

      <h2 className="mb-4 text-xl font-semibold">Reports in coverage</h2>

      {reports.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
          No reports yet for this sector.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {reports.map((r) => (
            <Link
              key={r.slug}
              href={`/research/${sector}/${r.slug}`}
              className="group block rounded-xl border border-zinc-200 bg-white p-5 transition hover:border-zinc-300 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
            >
              <div className="flex items-baseline justify-between">
                <div className="font-mono text-lg font-semibold">{r.ticker}</div>
                <RatingBadge rating={r.rating} />
              </div>
              <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{r.company}</div>
              {r.one_liner && (
                <p className="mt-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                  {r.one_liner}
                </p>
              )}
              <div className="mt-4 flex items-center justify-between text-xs text-zinc-500">
                <span>{r.date}</span>
                <span>
                  Target ${r.target_price?.toFixed(0) ?? "n/a"} ·{" "}
                  <span className={(r.upside_pct ?? 0) >= 0 ? "text-emerald-600" : "text-rose-600"}>
                    {r.upside_pct != null
                      ? `${r.upside_pct >= 0 ? "+" : ""}${r.upside_pct.toFixed(0)}%`
                      : ""}
                  </span>
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
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
