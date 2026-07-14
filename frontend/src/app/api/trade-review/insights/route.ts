/**
 * POST /api/trade-review/insights
 *
 * Generates an AI Insight (meta-review) over the caller's saved trade reviews.
 * Flow: validate body → verify token → select eligible reviews (server-side,
 * RLS-scoped — the client never supplies scorecards, so it cannot feed
 * fabricated data) → require ≥3 → consume 'insight' quota (2/day, atomic RPC,
 * fail closed) → generate → persist → respond.
 *
 * Eligibility is checked BEFORE the quota so an insufficient-data request
 * doesn't burn one of only two daily slots. After the consume, quota is
 * attempt-based (an upstream failure still costs the attempt — same semantics
 * as /api/ai-setup/*).
 *
 * Routed by Traefik via PathPrefix(`/api/trade-review`) in docker-compose.yml —
 * the parent prefix covers this subpath; verify on deploy (the engine's
 * PathPrefix(`/api`) rule has swallowed Next.js API paths before).
 */
import { NextRequest, NextResponse } from "next/server";
import { generateTradeInsight, type ReviewForInsight } from "@/lib/trade-insights";
import { verifyRequestUser, consumeQuota } from "@/lib/supabase-server";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const LAST_N_CHOICES = [3, 5, 10] as const;
/** Bound the prompt when a busy week produces many reviews. */
const LAST_7D_CAP = 20;

type PeriodRequest =
  | { period_kind: "last_n"; n: 3 | 5 | 10 }
  | { period_kind: "last_7d" };

function parsePeriod(body: unknown): PeriodRequest | null {
  if (!body || typeof body !== "object") return null;
  const b = body as { period_kind?: unknown; n?: unknown };
  if (b.period_kind === "last_7d") return { period_kind: "last_7d" };
  if (
    b.period_kind === "last_n" &&
    typeof b.n === "number" &&
    (LAST_N_CHOICES as readonly number[]).includes(b.n)
  ) {
    return { period_kind: "last_n", n: b.n as 3 | 5 | 10 };
  }
  return null;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const period = parsePeriod(body);
  if (!period) {
    return NextResponse.json(
      { error: "Invalid period. Use {period_kind:'last_n', n:3|5|10} or {period_kind:'last_7d'}." },
      { status: 400 },
    );
  }

  const authed = await verifyRequestUser(req);
  if (!authed) {
    return NextResponse.json({ error: "Sign in to generate insights." }, { status: 401 });
  }

  // Select the reviews server-side through the user's JWT-scoped client (RLS
  // isolates rows) — eligibility BEFORE quota.
  let query = authed.supabase
    .from("trade_reviews")
    .select("id, created_at, symbol, direction, timeframe, process_score, outcome, notes, scorecard")
    .order("created_at", { ascending: false });

  if (period.period_kind === "last_n") {
    query = query.limit(period.n);
  } else {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    query = query.gte("created_at", since).limit(LAST_7D_CAP);
  }

  const { data: reviews, error: selectError } = await query;
  if (selectError) {
    return NextResponse.json(
      { error: "Insights are temporarily unavailable." },
      { status: 503 },
    );
  }
  if (!reviews || reviews.length < 3) {
    return NextResponse.json(
      { error: "Save at least 3 trade reviews first.", reviews_found: reviews?.length ?? 0 },
      { status: 400 },
    );
  }

  // Quota AFTER eligibility, BEFORE the billed call; fail closed.
  const quota = await consumeQuota(authed.supabase, "insight");
  if (!quota) {
    return NextResponse.json(
      { error: "Insights are temporarily unavailable." },
      { status: 503 },
    );
  }
  if (!quota.allowed) {
    return NextResponse.json(
      { error: "Daily insight limit reached — resets 00:00 UTC.", remaining: 0 },
      { status: 429 },
    );
  }

  // Most recent previous insight, if any, for the progress comparison.
  const { data: prevRows } = await authed.supabase
    .from("trade_review_insights")
    .select("insight")
    .order("created_at", { ascending: false })
    .limit(1);
  const previousInsight = prevRows?.[0]?.insight ?? null;

  const periodLabel =
    period.period_kind === "last_n"
      ? `last ${period.n} trades`
      : `last 7 days (${reviews.length} trades)`;

  try {
    const result = await generateTradeInsight({
      reviews: reviews as ReviewForInsight[],
      periodLabel,
      previousInsight,
    });

    const { data: saved, error: insertError } = await authed.supabase
      .from("trade_review_insights")
      .insert({
        user_id: authed.user.id,
        period_kind: period.period_kind,
        period_n: period.period_kind === "last_n" ? period.n : null,
        review_ids: reviews.map((r) => r.id),
        insight: result.insight,
        model: result.model,
      })
      .select("id, created_at")
      .single();

    // The insight was generated either way; persistence failure shouldn't
    // discard it (the attempt is already paid for).
    return NextResponse.json({
      insight: result.insight,
      id: saved?.id ?? null,
      created_at: saved?.created_at ?? result.generated_at,
      persisted: !insertError,
      trades_analyzed: reviews.length,
      date_range: {
        from: reviews[reviews.length - 1].created_at,
        to: reviews[0].created_at,
      },
      model: result.model,
      remaining_insights: quota.remaining,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Insight generation failed.";
    const isConfig = message.includes("ANTHROPIC_API_KEY");
    return NextResponse.json(
      { error: isConfig ? "Insights are temporarily unavailable." : message },
      { status: isConfig ? 503 : 500 },
    );
  }
}
