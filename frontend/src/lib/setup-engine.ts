/**
 * Server-only AI Trade Setup engine.
 *
 * generateSetup(): assembles live market context (Hyperliquid snapshot +
 * best-effort Coinglass/Velo pulse) and asks Claude for a structured setup
 * matching TradeSetupSchema. streamSetupChat(): follow-up Q&A grounded in the
 * generated setup plus a fresh compact snapshot — instructed to diff, not to
 * regenerate.
 *
 * ANTHROPIC_API_KEY must never reach the client; this module is server-only
 * and may only be imported from API routes.
 */
import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { fetchHyperliquidSnapshot, fetchCompactSnapshot } from "@/lib/hyperliquid";
import { fetchCryptoPulse, type CryptoPulseSnapshot } from "@/lib/coinglass";
import { TradeSetupSchema, type SetupCoin, type TradeSetup } from "@/lib/setup-schema";

// Text-only analysis over pre-computed numeric context — Sonnet-tier quality
// is sufficient and keeps the auth-gated quota cheap (~$0.06/generation).
// Single const so a tier change is a one-line edit.
const MODEL = "claude-sonnet-4-6";

export interface SetupChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** Compact, token-cheap digest of the Coinglass/Velo pulse for one coin. */
function pulseDigest(pulse: CryptoPulseSnapshot | null, coin: SetupCoin): string {
  if (!pulse) return "";
  const c = pulse.coins.find((x) => x.symbol === coin);
  if (!c) return "";
  const lines = [
    "CROSS-EXCHANGE CONTEXT (Coinglass aggregate, all venues):",
    `${c.symbol}: price $${c.price.toLocaleString()}, funding ${c.funding_rate_oi.toFixed(4)}%/8h, ` +
      `OI $${(c.oi_usd / 1e9).toFixed(2)}B (Δ 1h ${c.oi_change_1h_pct.toFixed(1)}% / 4h ${c.oi_change_4h_pct.toFixed(1)}% / 24h ${c.oi_change_24h_pct.toFixed(1)}%), ` +
      `L/S 24h ${c.long_short_24h.toFixed(2)}, ` +
      `realized liqs 24h $${(c.liquidation_24h_usd / 1e6).toFixed(0)}M ` +
      `(longs $${(c.long_liq_24h_usd / 1e6).toFixed(0)}M / shorts $${(c.short_liq_24h_usd / 1e6).toFixed(0)}M)` +
      (c.basis_pct != null ? `, basis ${c.basis_pct.toFixed(3)}% vs spot` : ""),
  ];
  if (coin === "BTC" && pulse.etf.btc_24h_flow_usd != null) {
    lines.push(`BTC ETF 24h flow: $${(pulse.etf.btc_24h_flow_usd / 1e6).toFixed(0)}M`);
  }
  if (pulse.velo_funding?.spread_pct_8h != null) {
    lines.push(
      `Venue funding spread (BTC): Binance ${pulse.velo_funding.binance_pct_8h?.toFixed(4)}% vs ` +
        `Hyperliquid ${pulse.velo_funding.hyperliquid_pct_8h?.toFixed(4)}% (Δ ${pulse.velo_funding.spread_pct_8h.toFixed(4)}%/8h)`,
    );
  }
  const devs = pulse.deviations.filter((d) => d.symbol === coin || d.symbol === "MKT");
  if (devs.length) {
    lines.push(
      "Active deviations:",
      ...devs.slice(0, 5).map((d) => `- [${d.severity}] ${d.headline}: ${d.detail}`),
    );
  }
  return lines.join("\n");
}

// Shared analysis rules — the "how to read the data" layer both prompts use.
const ANALYSIS_RULES = `## How to derive signals

- Price vs 24h VWAP: below and trending down = bearish; above and holding = bullish.
- Funding: 7d percentile >= 75 = crowded longs (contrarian bearish fuel); <= 25 or any
  negative hours = shorts paying / capitulation watch. Hyperliquid clamps funding at a
  0.00125%/h floor — a flat series pinned there means NEUTRAL positioning with "no
  squeeze premium" (longs are not paying up), not crowding.
- OI: near range highs while price falls = trapped longs (bearish); OI bleeding on a
  bounce = weak conviction. Use the Coinglass OI deltas (1h/4h/24h) for trend.
- Liquidation clusters: heavier estimated long-liq below price = downside magnet;
  heavier short-liq above = squeeze fuel. Clusters are magnets AND cascade triggers.
- Candle structure: identify the last swing high/low, where volume spikes happened
  (distribution vs absorption), and which liq zones sit inside the recent range.

## Hard rules

- The liquidation map is an ESTIMATE (volume-weighted entries x leverage tiers scaled
  to OI). Always label liq figures "est." — never present them as exchange-reported.
- Be specific: exact price levels, exact conditions. No hedging filler.
- "No clean setup" is a fully valid bottom line — say it plainly and state what to
  wait for. Never invent a trade to have something to say.
- Setups are conditional plans ("evaluate a long IF price reclaims X with volume"),
  with an explicit invalidation and target. Never an instruction to buy/sell now.
- Write all output in English.`;

const SETUP_SYSTEM_PROMPT = `You are Follio's derivatives setup analyst. From live Hyperliquid perp data (plus optional cross-exchange context) you produce ONE structured, decision-ready trade setup filling the provided schema exactly.

${ANALYSIS_RULES}

## Field-specific guidance

- signals: exactly these four rows — "Price (1h HL)", "OI", "Funding (1h)",
  "Liq imbalance (est.)". For liq imbalance, sum the estimated long-liq vs short-liq
  cluster notionals and report the ratio and which side is heavier.
- keyLevels: 4-6 rows ordered from highest price to lowest, mixing liq zones (with
  "est. $XM" in the type), spot, and structural support/resistance from the candles.
- catalysts: name the decisive candles by date/hour and their volume.
- nextSteps: one precise monitoring condition each for derivatives / technical / setup.`;

const CHAT_SYSTEM_PROMPT = `You are Follio's derivatives setup analyst in follow-up chat mode. The user has a generated setup (JSON below) and asks follow-up questions; you also get a FRESH data snapshot taken just now.

${ANALYSIS_RULES}

## Chat mode rules

- DIFF, don't regenerate: compare the fresh snapshot against the setup and report only
  what changed (funding flip, OI delta, price vs the setup's key levels). If nothing
  material changed, say so in 2-3 lines and restate the trigger being waited for.
- If price crossed one of the setup's key levels, lead with that.
- Keep replies short: a few sentences or a tight bullet list. Suggest regenerating the
  setup only when the thesis is invalidated, not for small drift.`;

export interface GenerateSetupResult {
  setup: TradeSetup;
  model: string;
  generated_at: string;
}

export async function generateSetup(coin: SetupCoin): Promise<GenerateSetupResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

  // Hyperliquid is the primary feed — fail loudly. Coinglass/Velo is
  // best-effort enrichment — never block the setup on it (reviewTrade pattern).
  const [snapshot, pulse] = await Promise.all([
    fetchHyperliquidSnapshot(coin),
    fetchCryptoPulse().catch(() => null),
  ]);

  const client = new Anthropic({ apiKey });
  const contextBlock = [
    `LIVE HYPERLIQUID PERP DATA for ${coin} (fetched ${snapshot.fetchedAt}):`,
    JSON.stringify(snapshot, null, 1),
    pulseDigest(pulse, coin),
  ]
    .filter(Boolean)
    .join("\n\n");

  // No extended thinking: the heavy lifting (VWAP, percentiles, liq clusters)
  // is pre-computed in the context, and thinking tokens both eat the budget
  // (truncating the JSON) and multiply latency (~7x in testing: 412s vs 56s).
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 4096,
    system: SETUP_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `${contextBlock}\n\nGenerate the structured trade setup for ${coin}.`,
      },
    ],
    output_config: { format: zodOutputFormat(TradeSetupSchema) },
  });

  const setup = response.parsed_output;
  if (!setup) {
    throw new Error(
      response.stop_reason === "refusal"
        ? "The model declined to analyze this data."
        : "Failed to parse the generated setup.",
    );
  }

  return { setup, model: MODEL, generated_at: new Date().toISOString() };
}

export async function streamSetupChat(params: {
  coin: SetupCoin;
  setup: TradeSetup;
  messages: SetupChatMessage[];
}): Promise<ReadableStream<Uint8Array>> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

  const fresh = await fetchCompactSnapshot(params.coin);
  const client = new Anthropic({ apiKey });

  const system = [
    CHAT_SYSTEM_PROMPT,
    `## The user's current setup (generated earlier)\n${JSON.stringify(params.setup)}`,
    `## Fresh snapshot (just fetched)\n${JSON.stringify(fresh)}`,
  ].join("\n\n");

  // Cap history server-side regardless of what the client sends.
  const history = params.messages.slice(-12);

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 1024,
    system,
    messages: history,
  });

  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      stream.on("text", (delta) => controller.enqueue(encoder.encode(delta)));
      stream.on("end", () => controller.close());
      stream.on("error", (err) => controller.error(err));
    },
    cancel() {
      stream.abort();
    },
  });
}
