/**
 * Server-only Supabase helpers for API route handlers.
 *
 * This repo intentionally has no service-role key (anon + RLS model, see
 * supabase/migrations/0001_trade_reviews.sql). Routes authenticate by
 * validating the caller's JWT (sent as `Authorization: Bearer <token>` — the
 * pattern established by PortfolioChat) against Supabase Auth, and perform
 * writes through security-definer RPCs that read auth.uid() from that JWT.
 */
import "server-only";

import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

export interface AuthedRequest {
  user: User;
  /** Request-scoped client carrying the user's JWT — RPCs see auth.uid(). */
  supabase: SupabaseClient;
}

/**
 * Validate the request's bearer token against Supabase Auth. Returns null on
 * any failure (missing header, expired/forged token, Supabase unreachable) —
 * the route should respond 401.
 */
export async function verifyRequestUser(req: Request): Promise<AuthedRequest | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  const auth = req.headers.get("authorization");
  const token = auth?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;

  const supabase = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return null;
    return { user: data.user, supabase };
  } catch {
    return null;
  }
}

export type QuotaKind = "generation" | "chat";

export interface QuotaResult {
  allowed: boolean;
  remaining: number;
}

/**
 * Atomically consume one unit of daily quota for the authenticated user.
 * Fails CLOSED: any RPC error (e.g. migration not applied) returns null and
 * the route must respond 503 without making a billed Anthropic call.
 */
export async function consumeQuota(
  supabase: SupabaseClient,
  kind: QuotaKind,
): Promise<QuotaResult | null> {
  try {
    const { data, error } = await supabase.rpc("consume_ai_setup_quota", { p_kind: kind });
    if (error || data == null) return null;
    const parsed = data as { allowed?: boolean; remaining?: number };
    if (typeof parsed.allowed !== "boolean") return null;
    return { allowed: parsed.allowed, remaining: parsed.remaining ?? 0 };
  } catch {
    return null;
  }
}
