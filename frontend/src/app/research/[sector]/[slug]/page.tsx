/**
 * /research/[sector]/[slug] — Individual equity report.
 *
 * Renders the MDX body with our custom report components.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { MDXRemote } from "next-mdx-remote/rsc";
import {
  listReportsInSector,
  listSectorSlugs,
  readReport,
  SECTOR_LABELS,
} from "@/lib/reports";
import { reportComponents } from "@/components/research/ReportComponents";

interface PageProps {
  params: Promise<{ sector: string; slug: string }>;
}

export async function generateStaticParams() {
  const params: { sector: string; slug: string }[] = [];
  for (const sector of await listSectorSlugs()) {
    for (const r of await listReportsInSector(sector)) {
      params.push({ sector, slug: r.slug });
    }
  }
  return params;
}

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://tradingcommandcenter.com";

export async function generateMetadata({ params }: PageProps) {
  const { sector, slug } = await params;
  const report = await readReport(sector, slug);
  if (!report) return {};
  const url = `${BASE_URL}/research/${sector}/${slug}`;
  const description = report.one_liner ?? `${report.company} equity research report.`;
  return {
    title: `${report.ticker} — ${report.company} | Follio Research`,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${report.ticker} — ${report.company}`,
      description,
      url,
      type: "article",
      publishedTime: report.date,
    },
  };
}

export default async function ReportPage({ params }: PageProps) {
  const { sector, slug } = await params;
  const report = await readReport(sector, slug);
  if (!report) return notFound();

  const sectorName = SECTOR_LABELS[sector]?.name ?? sector;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: `${report.ticker} — ${report.company}`,
    description: report.one_liner ?? `${report.company} equity research report.`,
    datePublished: report.date,
    author: { "@type": "Organization", name: "Follio Research" },
    publisher: { "@type": "Organization", name: "Follio" },
    mainEntityOfPage: `${BASE_URL}/research/${sector}/${slug}`,
    about: {
      "@type": "Corporation",
      name: report.company,
      tickerSymbol: report.ticker,
    },
    articleSection: sectorName,
  };

  return (
    <article className="mx-auto max-w-4xl px-6 py-12">
      {/* Escape "<" so frontmatter text can never close the script tag (XSS-safe per Next.js docs). */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <nav className="mb-6 flex items-center gap-2 text-sm text-zinc-500">
        <Link href="/research" className="hover:text-zinc-900 dark:hover:text-zinc-100">
          Research
        </Link>
        <span>/</span>
        <Link href={`/research/${sector}`} className="hover:text-zinc-900 dark:hover:text-zinc-100">
          {sectorName}
        </Link>
        <span>/</span>
        <span className="text-zinc-700 dark:text-zinc-300">{report.ticker}</span>
      </nav>

      <Link
        href={`/research/${sector}`}
        className="mb-2 inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        <ChevronLeft className="h-3.5 w-3.5" /> Back to {sectorName}
      </Link>

      <div className="report-body mt-4 max-w-none" suppressHydrationWarning>
        <MDXRemote source={report.content} components={reportComponents} />
      </div>
    </article>
  );
}
