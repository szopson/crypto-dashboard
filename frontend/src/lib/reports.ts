/**
 * Server-only utilities for reading equity research MDX reports.
 *
 * Reports live in frontend/content/reports/{sector_slug}/{ticker}.mdx
 * with YAML frontmatter (parsed via gray-matter).
 */
import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

export type ReportRating =
  | "BUY"
  | "ACCUMULATE"
  | "HOLD"
  | "REDUCE"
  | "SELL";

export interface ReportFrontmatter {
  ticker: string;
  company: string;
  exchange?: string | null;
  sector_slug: string;
  sector_name: string;
  industry?: string | null;
  country?: string | null;
  rating: ReportRating;
  target_price: number | null;
  upside_pct: number | null;
  time_horizon?: string | null;
  one_liner?: string | null;
  price_at_report: number | null;
  market_cap: number | null;
  currency?: string;
  date: string;
  generated_at?: string;
  data_source?: string;
  engine_version?: string;
}

export interface ReportSummary extends ReportFrontmatter {
  slug: string; // file slug, typically lowercase ticker
}

export interface Report extends ReportSummary {
  content: string; // raw MDX body without frontmatter
}

const CONTENT_ROOT = path.join(process.cwd(), "content", "reports");

async function safeReaddir(dir: string): Promise<string[]> {
  try {
    return await fs.readdir(dir);
  } catch {
    return [];
  }
}

export async function listSectorSlugs(): Promise<string[]> {
  // Source of truth is the known sector catalog (SECTOR_LABELS below), not
  // the filesystem — that way sectors with only briefs (no full reports yet)
  // still appear in the navigation.
  return Object.keys(SECTOR_LABELS);
}

export async function listReportsInSector(sectorSlug: string): Promise<ReportSummary[]> {
  const sectorDir = path.join(CONTENT_ROOT, sectorSlug);
  const entries = await safeReaddir(sectorDir);
  const reports: ReportSummary[] = [];
  for (const entry of entries) {
    if (!entry.endsWith(".mdx")) continue;
    const slug = entry.replace(/\.mdx$/, "");
    const fm = await readFrontmatterOnly(sectorSlug, slug);
    if (fm) reports.push({ ...fm, slug });
  }
  return reports.sort((a, b) => a.ticker.localeCompare(b.ticker));
}

export async function listAllReports(): Promise<ReportSummary[]> {
  const sectors = await listSectorSlugs();
  const out: ReportSummary[] = [];
  for (const slug of sectors) {
    out.push(...(await listReportsInSector(slug)));
  }
  return out;
}

async function readFrontmatterOnly(
  sectorSlug: string,
  slug: string,
): Promise<ReportFrontmatter | null> {
  const file = path.join(CONTENT_ROOT, sectorSlug, `${slug}.mdx`);
  try {
    const raw = await fs.readFile(file, "utf-8");
    const { data } = matter(raw);
    return data as ReportFrontmatter;
  } catch {
    return null;
  }
}

export async function readReport(
  sectorSlug: string,
  slug: string,
): Promise<Report | null> {
  const file = path.join(CONTENT_ROOT, sectorSlug, `${slug}.mdx`);
  try {
    const raw = await fs.readFile(file, "utf-8");
    const { data, content } = matter(raw);
    return { ...(data as ReportFrontmatter), slug, content };
  } catch {
    return null;
  }
}

export const SECTOR_LABELS: Record<string, { name: string; description: string }> = {
  semiconductors: {
    name: "Semiconductors",
    description: "Chip designers and fabs powering AI and computing.",
  },
  "ai-infrastructure": {
    name: "AI Infrastructure",
    description: "Hyperscalers and platforms building the AI compute backbone.",
  },
  "ai-pure-play": {
    name: "AI Pure-Play",
    description: "Companies with direct AI application exposure.",
  },
  space: {
    name: "Space",
    description: "Launch, satellites, geospatial, and space infrastructure.",
  },
  quantum: {
    name: "Quantum Computing",
    description: "Pure-play quantum hardware and software.",
  },
  "pharma-biotech": {
    name: "Pharma & Biotech",
    description: "Drug developers from large-cap pharma to biotech.",
  },
  "nuclear-smr": {
    name: "Nuclear & SMR",
    description: "Nuclear utilities and small modular reactor developers.",
  },
  uranium: {
    name: "Uranium",
    description: "Uranium miners and fuel suppliers.",
  },
  "energy-storage": {
    name: "Energy Storage",
    description: "Batteries, grid storage, and energy management.",
  },
  robotics: {
    name: "Robotics & Automation",
    description: "Industrial, surgical, and warehouse robotics.",
  },
  "china-tech": {
    name: "China Tech",
    description: "Chinese internet and consumer tech.",
  },
  defense: {
    name: "Defense",
    description: "Defense primes and emerging drone/autonomy companies.",
  },
  "crypto-infra": {
    name: "Crypto Infrastructure",
    description: "Exchanges, miners, and treasury proxies levered to crypto market structure.",
  },
};
