/**
 * AiRead — the daily AI interpretation strip on /cockpit.
 *
 * Server component: fetches the latest cockpit digest from the engine
 * (generated once a day by engine/services/cockpit_digest.py) and renders it
 * as a short desk-note above the raw numbers — the "what does this mean"
 * layer the raw cockpit lacks. Renders nothing when no digest exists yet or
 * the latest one is older than 48h (stale reads are worse than none).
 */
import { Sparkles } from "lucide-react";

interface DigestResponse {
  available: boolean;
  date?: string;
  generated_at?: string;
  body?: string;
}

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";
const MAX_AGE_MS = 48 * 60 * 60 * 1000;

async function fetchLatestDigest(): Promise<DigestResponse | null> {
  try {
    const resp = await fetch(`${BACKEND_URL}/api/digest/latest`, {
      next: { revalidate: 300 },
    });
    if (!resp.ok) return null;
    return (await resp.json()) as DigestResponse;
  } catch {
    return null;
  }
}

export async function AiRead() {
  const digest = await fetchLatestDigest();
  if (!digest?.available || !digest.body) return null;

  const generatedAt = digest.generated_at ? new Date(digest.generated_at) : null;
  if (generatedAt && Date.now() - generatedAt.getTime() > MAX_AGE_MS) return null;

  const lines = digest.body.split("\n").filter((l) => l.trim().length > 0);

  return (
    <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 dark:border-indigo-900/60 dark:bg-indigo-950/20">
      <div className="mb-2 flex items-center gap-2">
        <span className="rounded-md bg-indigo-500/15 p-1.5 text-indigo-700 dark:text-indigo-300">
          <Sparkles className="h-4 w-4" />
        </span>
        <span className="text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
          AI read
        </span>
        {digest.date && <span className="text-xs text-zinc-500">{digest.date}</span>}
      </div>
      <div className="space-y-1">
        {lines.map((line, i) => (
          <p key={i} className="text-sm text-zinc-800 dark:text-zinc-200">
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}
