/**
 * Server-only utilities for reading sector brief MDX.
 */
import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

export interface SectorBriefFrontmatter {
  sector_slug: string;
  sector_name: string;
  headline: string;
  stance: string;
  date: string;
  generated_at?: string;
  member_count?: number;
}

export interface SectorBrief extends SectorBriefFrontmatter {
  content: string;
}

const CONTENT_ROOT = path.join(process.cwd(), "content", "sector_briefs");

export async function readSectorBrief(sectorSlug: string): Promise<SectorBrief | null> {
  const file = path.join(CONTENT_ROOT, `${sectorSlug}.mdx`);
  try {
    const raw = await fs.readFile(file, "utf-8");
    const { data, content } = matter(raw);
    return { ...(data as SectorBriefFrontmatter), content };
  } catch {
    return null;
  }
}
