/**
 * POST /api/ai-setup/generate
 *
 * Auth-gated (Supabase JWT) structured trade-setup generation. Flow:
 * verify token → consume daily quota (atomic RPC, fail closed) → generate.
 * See src/lib/setup-engine.ts for the analysis logic.
 *
 * NOTE: this path must be listed in the tcc-next-api Traefik router rule in
 * docker-compose.yml, or the backend's PathPrefix(`/api`) swallows it.
 */
import { NextRequest, NextResponse } from "next/server";
import { isSetupCoin } from "@/lib/setup-schema";
import { generateSetup } from "@/lib/setup-engine";
import { verifyRequestUser, consumeQuota } from "@/lib/supabase-server";

// Generation runs ~30-60s (structured output over ~11K context tokens).
export const maxDuration = 120;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { coin?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (!isSetupCoin(body.coin)) {
    return NextResponse.json(
      { error: "Unsupported coin. Use BTC, ETH or SOL." },
      { status: 400 },
    );
  }

  const authed = await verifyRequestUser(req);
  if (!authed) {
    return NextResponse.json({ error: "Sign in to generate setups." }, { status: 401 });
  }

  // Quota BEFORE the billed call; fail closed if the RPC is unavailable.
  const quota = await consumeQuota(authed.supabase, "generation");
  if (!quota) {
    return NextResponse.json(
      { error: "Setup generation is temporarily unavailable." },
      { status: 503 },
    );
  }
  if (!quota.allowed) {
    return NextResponse.json(
      { error: "Daily generation limit reached — resets 00:00 UTC.", remaining: 0 },
      { status: 429 },
    );
  }

  try {
    const result = await generateSetup(body.coin);
    return NextResponse.json({ ...result, remaining_generations: quota.remaining });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Setup generation failed.";
    // Missing key / upstream feed issues shouldn't leak details to the client.
    const isConfig =
      message.includes("ANTHROPIC_API_KEY") || message.includes("Hyperliquid API");
    return NextResponse.json(
      { error: isConfig ? "Setup generation is temporarily unavailable." : message },
      { status: isConfig ? 503 : 500 },
    );
  }
}
