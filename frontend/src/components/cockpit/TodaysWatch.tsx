/**
 * TodaysWatch — the daily opportunity watch cards on /cockpit.
 *
 * Server component: fetches the latest card set from the engine (generated
 * once a day by engine/services/opportunity_engine.py, same cadence as the
 * digest) and renders ranked cards — top card expanded, rest collapsed.
 * Hidden entirely when no cards exist, all scores are near baseline, or the
 * set is older than 48h (same staleness policy as AiRead).
 */
import { Crosshair } from "lucide-react";
import { AffiliateDisclosure } from "./AffiliateDisclosure";
import { OpportunityCard, type OpportunityCardData } from "./OpportunityCard";

interface OpportunitiesResponse {
  available: boolean;
  date?: string;
  generated_at?: string;
  cards?: OpportunityCardData[];
}

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";
const MAX_AGE_MS = 48 * 60 * 60 * 1000;
// Below this top score the whole day is "nothing unusual" — showing cards
// would manufacture urgency out of baseline noise.
const MIN_TOP_SCORE = 20;

async function fetchLatestCards(): Promise<OpportunitiesResponse | null> {
  try {
    const resp = await fetch(`${BACKEND_URL}/api/opportunities/latest`, {
      next: { revalidate: 300 },
    });
    if (!resp.ok) return null;
    return (await resp.json()) as OpportunitiesResponse;
  } catch {
    return null;
  }
}

export async function TodaysWatch() {
  const data = await fetchLatestCards();
  if (!data?.available || !data.cards?.length) return null;

  const generatedAt = data.generated_at ? new Date(data.generated_at) : null;
  if (generatedAt && Date.now() - generatedAt.getTime() > MAX_AGE_MS) return null;

  const cards = [...data.cards].sort((a, b) => b.score - a.score);
  if ((cards[0]?.score ?? 0) < MIN_TOP_SCORE) return null;

  return (
    <section className="mb-4 space-y-2">
      <div className="flex items-center gap-2">
        <span className="rounded-md bg-muted/400/15 p-1.5 text-muted-foreground">
          <Crosshair className="h-4 w-4" />
        </span>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Today&apos;s watch
        </h2>
        {data.date && <span className="text-xs text-muted-foreground">{data.date}</span>}
      </div>
      <div className="space-y-2">
        {cards.map((card, i) => (
          <OpportunityCard key={card.symbol} card={card} defaultExpanded={i === 0} />
        ))}
      </div>
      <AffiliateDisclosure />
    </section>
  );
}
