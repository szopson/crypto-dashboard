/**
 * Client-side listing/deletion of saved AI Insights (meta-reviews).
 *
 * Reads go through the browser Supabase client (anon key), isolated by RLS
 * (auth.uid() = user_id) — see supabase/migrations/0004_trade_review_insights.sql.
 * Generation happens server-side only (/api/trade-review/insights).
 */
import { getSupabaseClient } from "@/lib/supabase";
import type { TradeInsight } from "@/lib/trade-insights";

export interface SavedInsight {
  id: string;
  user_id: string;
  created_at: string;
  period_kind: "last_n" | "last_7d";
  period_n: number | null;
  review_ids: string[];
  insight: TradeInsight;
  model: string;
}

/** Error thrown when the insights table is missing (migration not applied). */
export class InsightsNotProvisionedError extends Error {}

function isMissingTable(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("trade_review_insights") &&
    (m.includes("does not exist") || m.includes("not find") || m.includes("schema cache"))
  );
}

export async function listInsights(limit = 20): Promise<SavedInsight[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("trade_review_insights")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingTable(error.message)) throw new InsightsNotProvisionedError(error.message);
    throw new Error(error.message);
  }
  return (data ?? []) as SavedInsight[];
}

export async function deleteInsight(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("trade_review_insights").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
