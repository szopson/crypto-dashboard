/**
 * Client-side persistence for trade-review scorecards ("dziennik zagrań").
 *
 * Writes go through the browser Supabase client (anon key). Row isolation is
 * enforced by RLS (auth.uid() = user_id) — see supabase/migrations/0001_trade_reviews.sql.
 * There is no server route and no service-role key: the logged-in user's session
 * cookie authorizes the insert/select/delete directly.
 *
 * This is the accountability layer under "analiza zagrania": every saved review
 * is a dated record of a DECISION, so process quality can be tracked over time.
 */
import { getSupabaseClient } from "@/lib/supabase";
import type { TradeScorecard } from "@/lib/trade-review";

export interface SavedTradeReview {
  id: string;
  user_id: string;
  created_at: string;
  symbol: string | null;
  direction: string | null;
  timeframe: string | null;
  process_score: number | null;
  outcome: string | null;
  notes: string | null;
  scorecard: TradeScorecard;
}

/** Error thrown when the trade_reviews table is missing (migration not applied). */
export class JournalNotProvisionedError extends Error {}

function isMissingTable(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("trade_reviews") &&
    (m.includes("does not exist") || m.includes("not find") || m.includes("schema cache"))
  );
}

export async function saveTradeReview(params: {
  userId: string;
  scorecard: TradeScorecard;
  notes?: string;
}): Promise<SavedTradeReview> {
  const supabase = getSupabaseClient();
  const s = params.scorecard;
  const { data, error } = await supabase
    .from("trade_reviews")
    .insert({
      user_id: params.userId,
      symbol: s.detected_symbol || null,
      direction: s.detected_direction || null,
      timeframe: s.detected_timeframe || null,
      process_score: s.process_score ?? null,
      outcome: s.outcome || null,
      notes: params.notes?.trim() || null,
      scorecard: s,
    })
    .select()
    .single();

  if (error) {
    if (isMissingTable(error.message)) throw new JournalNotProvisionedError(error.message);
    throw new Error(error.message);
  }
  return data as SavedTradeReview;
}

export async function listTradeReviews(limit = 50): Promise<SavedTradeReview[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("trade_reviews")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingTable(error.message)) throw new JournalNotProvisionedError(error.message);
    throw new Error(error.message);
  }
  return (data ?? []) as SavedTradeReview[];
}

export async function deleteTradeReview(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("trade_reviews").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Average process score across saved reviews, or null if none. */
export function averageProcessScore(reviews: SavedTradeReview[]): number | null {
  const scored = reviews.filter((r) => typeof r.process_score === "number");
  if (!scored.length) return null;
  return Math.round(
    scored.reduce((sum, r) => sum + (r.process_score as number), 0) / scored.length,
  );
}
