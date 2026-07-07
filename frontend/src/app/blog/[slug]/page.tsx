/**
 * /blog/[slug] — Individual macro post.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Calendar } from "lucide-react";
import { MDXRemote } from "next-mdx-remote/rsc";
import { listPostSlugs, readPost } from "@/lib/blog";
import { reportComponents } from "@/components/research/ReportComponents";
import { YouTubeEmbed } from "@/components/research/YouTubeEmbed";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const slugs = await listPostSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const post = await readPost(slug);
  if (!post) return {};
  return {
    title: `${post.title} — Follio`,
    description: post.summary,
  };
}

export default async function BlogPost({ params }: PageProps) {
  const { slug } = await params;
  const post = await readPost(slug);
  if (!post || post.draft) return notFound();

  return (
    <article className="mx-auto max-w-3xl px-6 py-12">
      <Link
        href="/blog"
        className="mb-6 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        <ChevronLeft className="h-4 w-4" /> Macro & Market
      </Link>

      <header className="mb-8 border-b border-zinc-200 pb-8 dark:border-zinc-800">
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <Calendar className="h-3.5 w-3.5" />
          <time dateTime={post.date}>{post.date}</time>
          {post.author && (
            <>
              <span>·</span>
              <span>{post.author}</span>
            </>
          )}
          {post.ticker && (
            <>
              <span>·</span>
              <Link
                href={`/research?q=${post.ticker}`}
                className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
              >
                ${post.ticker}
              </Link>
            </>
          )}
        </div>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">{post.title}</h1>
        <p className="mt-3 text-lg text-zinc-700 dark:text-zinc-300">{post.summary}</p>
        {post.tags?.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {post.tags.map((t) => (
              <span
                key={t}
                className="rounded-md bg-zinc-100 px-2 py-1 text-xs dark:bg-zinc-800"
              >
                {t}
              </span>
            ))}
          </div>
        ) : null}
      </header>

      {post.youtube_id && (
        <div className="mb-8">
          <YouTubeEmbed id={post.youtube_id} title={post.title} />
        </div>
      )}

      <div className="report-body max-w-none" suppressHydrationWarning>
        <MDXRemote source={post.content} components={reportComponents} />
      </div>
    </article>
  );
}
