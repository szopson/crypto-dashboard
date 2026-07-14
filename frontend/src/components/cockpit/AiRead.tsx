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
    <div className="mb-4 rounded-xl glass-card glow-ring-violet p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="rounded-md bg-violet-500/15 p-1.5 text-violet-700 dark:text-violet-300">
          <Sparkles className="h-4 w-4" />
        </span>
        <span className="text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
          AI read
        </span>
        {digest.date && <span className="text-xs text-muted-foreground">{digest.date}</span>}
      </div>
      <div className="space-y-1">
        {lines.map((line, i) => (
          <p key={i} className="text-sm text-foreground/90">
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}
