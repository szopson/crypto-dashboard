/**
 * POST /api/ai-setup/chat
 *
 * Auth-gated follow-up chat about a generated setup. The setup is client-held
 * state (validated here with zod); replies stream as plain text chunks the
 * client consumes with response.body.getReader() (PortfolioChat pattern).
 *
 * NOTE: this path must be listed in the tcc-next-api Traefik router rule in
 * docker-compose.yml, or the backend's PathPrefix(`/api`) swallows it.
 */
import { NextRequest, NextResponse } from "next/server";
import { streamSetupChat, type SetupChatMessage } from "@/lib/setup-engine";
import { isSetupCoin, TradeSetupSchema } from "@/lib/setup-schema";
import { verifyRequestUser, consumeQuota } from "@/lib/supabase-server";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const MAX_MESSAGES = 20;
const MAX_MESSAGE_LEN = 2_000;

function validMessages(v: unknown): v is SetupChatMessage[] {
  return (
    Array.isArray(v) &&
    v.length > 0 &&
    v.length <= MAX_MESSAGES &&
    v.every(
      (m) =>
        m &&
        typeof m === "object" &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.length > 0 &&
        m.content.length <= MAX_MESSAGE_LEN,
    ) &&
    v[v.length - 1].role === "user"
  );
}

export async function POST(req: NextRequest) {
  let body: { coin?: unknown; setup?: unknown; messages?: unknown };
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
  const setupParsed = TradeSetupSchema.safeParse(body.setup);
  if (!setupParsed.success) {
    return NextResponse.json({ error: "Invalid setup payload." }, { status: 400 });
  }
  if (!validMessages(body.messages)) {
    return NextResponse.json({ error: "Invalid messages payload." }, { status: 400 });
  }

  const authed = await verifyRequestUser(req);
  if (!authed) {
    return NextResponse.json({ error: "Sign in to chat about setups." }, { status: 401 });
  }

  const quota = await consumeQuota(authed.supabase, "chat");
  if (!quota) {
    return NextResponse.json(
      { error: "Setup chat is temporarily unavailable." },
      { status: 503 },
    );
  }
  if (!quota.allowed) {
    return NextResponse.json(
      { error: "Daily chat limit reached — resets 00:00 UTC.", remaining: 0 },
      { status: 429 },
    );
  }

  try {
    const stream = await streamSetupChat({
      coin: body.coin,
      setup: setupParsed.data,
      messages: body.messages,
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Remaining-Chat": String(quota.remaining),
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Chat failed.";
    const isConfig =
      message.includes("ANTHROPIC_API_KEY") || message.includes("Hyperliquid API");
    return NextResponse.json(
      { error: isConfig ? "Setup chat is temporarily unavailable." : message },
      { status: isConfig ? 503 : 500 },
    );
  }
}
