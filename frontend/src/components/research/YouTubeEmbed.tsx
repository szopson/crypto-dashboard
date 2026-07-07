/**
 * Responsive 16:9 YouTube embed. Server-component safe (plain iframe).
 *
 * Two uses:
 *  - As a post hero, driven by the `youtube_id` blog frontmatter field.
 *  - Inline inside MDX via <YouTube id="..." /> (registered in reportComponents).
 *
 * Accepts either a bare video id ("dQw4w9WgXcQ") or a full/short URL, so authors
 * can paste whatever they have into frontmatter without thinking about it.
 */

/** Extract the 11-char video id from a bare id or any common YouTube URL form. */
export function parseYouTubeId(input?: string | null): string | null {
  if (!input) return null;
  const v = input.trim();
  if (/^[\w-]{11}$/.test(v)) return v;
  const patterns = [
    /[?&]v=([\w-]{11})/, // watch?v=ID
    /youtu\.be\/([\w-]{11})/, // youtu.be/ID
    /youtube\.com\/embed\/([\w-]{11})/, // /embed/ID
    /youtube\.com\/shorts\/([\w-]{11})/, // /shorts/ID
  ];
  for (const p of patterns) {
    const m = v.match(p);
    if (m) return m[1];
  }
  return null;
}

export function YouTubeEmbed({
  id,
  title = "YouTube video",
  start,
  className,
}: {
  id?: string;
  title?: string;
  start?: number | string;
  className?: string;
}) {
  const videoId = parseYouTubeId(id);
  if (!videoId) return null;

  const startParam = start ? `?start=${Number(start) || 0}` : "";
  return (
    <div
      className={`relative aspect-video w-full overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800 ${
        className ?? ""
      }`}
    >
      <iframe
        className="absolute inset-0 h-full w-full"
        src={`https://www.youtube-nocookie.com/embed/${videoId}${startParam}`}
        title={title}
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      />
    </div>
  );
}
