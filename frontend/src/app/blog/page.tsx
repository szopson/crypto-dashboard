/**
 * /blog — Macro & market commentary index.
 */
import Link from "next/link";
import { Calendar, Youtube } from "lucide-react";
import { listPosts } from "@/lib/blog";

export const metadata = {
  title: "Macro & Market Commentary — Follio",
  description:
    "Macro analysis, cross-asset takes, and editorial commentary tying the equity research together.",
};

export default async function BlogHome() {
  const posts = await listPosts();
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-10">
        <h1 className="text-4xl font-semibold tracking-tight">Macro & Market</h1>
        <p className="mt-3 max-w-2xl text-zinc-600 dark:text-zinc-400">
          Commentary, theses, and the bigger picture context that the single-stock reports can&rsquo;t cover.
        </p>
      </header>

      {posts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-sm text-zinc-500 dark:border-zinc-700">
          No posts yet. Drop MDX files into <code className="rounded bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800">frontend/content/blog/</code>.
        </div>
      ) : (
        <ul className="space-y-6">
          {posts.map((p) => (
            <li key={p.slug}>
              <Link
                href={`/blog/${p.slug}`}
                className="group block rounded-xl border border-zinc-200 bg-white p-6 transition hover:border-zinc-300 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
              >
                <div className="flex items-center gap-3 text-xs text-zinc-500">
                  <Calendar className="h-3.5 w-3.5" />
                  <time dateTime={p.date}>{p.date}</time>
                  {p.ticker && (
                    <>
                      <span>·</span>
                      <span className="font-mono">${p.ticker}</span>
                    </>
                  )}
                  {p.youtube_id && (
                    <Youtube className="h-3.5 w-3.5 text-red-500" aria-label="Zawiera wideo" />
                  )}
                  {p.tags?.length ? (
                    <>
                      <span>·</span>
                      <div className="flex flex-wrap gap-1.5">
                        {p.tags.map((t) => (
                          <span
                            key={t}
                            className="rounded-md bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </>
                  ) : null}
                </div>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight group-hover:text-emerald-700 dark:group-hover:text-emerald-300">
                  {p.title}
                </h2>
                <p className="mt-2 text-zinc-700 dark:text-zinc-300">{p.summary}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
