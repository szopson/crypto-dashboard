/**
 * Server-only utilities for reading macro/blog MDX posts.
 *
 * Posts live in frontend/content/blog/{slug}.mdx with YAML frontmatter.
 */
import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

export interface BlogFrontmatter {
  title: string;
  date: string;
  summary: string;
  author?: string;
  tags?: string[];
  draft?: boolean;
  /** Optional hero YouTube video (bare id or any YouTube URL). */
  youtube_id?: string;
  /** Optional ticker for company-analysis posts, e.g. "NVDA". */
  ticker?: string;
}

export interface BlogPostSummary extends BlogFrontmatter {
  slug: string;
}

export interface BlogPost extends BlogPostSummary {
  content: string;
}

const CONTENT_ROOT = path.join(process.cwd(), "content", "blog");

async function safeReaddir(dir: string): Promise<string[]> {
  try {
    return await fs.readdir(dir);
  } catch {
    return [];
  }
}

export async function listPostSlugs(): Promise<string[]> {
  const entries = await safeReaddir(CONTENT_ROOT);
  return entries
    .filter((e) => e.endsWith(".mdx") && !e.startsWith("_"))
    .map((e) => e.replace(/\.mdx$/, ""));
}

export async function listPosts(): Promise<BlogPostSummary[]> {
  const slugs = await listPostSlugs();
  const out: BlogPostSummary[] = [];
  for (const slug of slugs) {
    const fm = await readFrontmatter(slug);
    if (fm && !fm.draft) out.push({ ...fm, slug });
  }
  return out.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
}

async function readFrontmatter(slug: string): Promise<BlogFrontmatter | null> {
  const file = path.join(CONTENT_ROOT, `${slug}.mdx`);
  try {
    const raw = await fs.readFile(file, "utf-8");
    const { data } = matter(raw);
    return data as BlogFrontmatter;
  } catch {
    return null;
  }
}

export async function readPost(slug: string): Promise<BlogPost | null> {
  const file = path.join(CONTENT_ROOT, `${slug}.mdx`);
  try {
    const raw = await fs.readFile(file, "utf-8");
    const { data, content } = matter(raw);
    return { ...(data as BlogFrontmatter), slug, content };
  } catch {
    return null;
  }
}
