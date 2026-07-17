/**
 * Daily AI quota limits — display copies of the enforcement values.
 *
 * The AUTHORITATIVE limits live in consume_ai_setup_quota() in
 * supabase/migrations/0003_trade_review_quota.sql (generation 10, chat 30,
 * trade_review 5, insight 2). Enforcement is server-side; these constants
 * only feed the header counter UI. Change BOTH places together.
 *
 * Counters reset at 00:00 UTC — the day key is the UTC date.
 */
export const DAILY_QUOTAS = {
  generations: 10,
  chat_messages: 30,
  trade_reviews: 5,
  insights: 2,
} as const;

export type QuotaColumn = keyof typeof DAILY_QUOTAS;

export const QUOTA_LABELS: Record<QuotaColumn, string> = {
  generations: "AI setups",
  chat_messages: "Chat messages",
  trade_reviews: "Trade reviews",
  insights: "AI insights",
};

/**
 * UTC day key matching the SQL `current_date` at UTC. A LOCAL date here would
 * select yesterday's row after local midnight in UTC+ timezones.
 */
export function utcDayKey(): string {
  return new Date().toISOString().slice(0, 10);
}
