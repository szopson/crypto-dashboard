/**
 * Server-only trade screenshot analysis ("analiza zagrania").
 *
 * Takes a screenshot of a trade (TradingView chart, position, setup) and returns
 * a structured scorecard grading the QUALITY OF THE DECISION — not the outcome,
 * and never a buy/sell signal (club rule: "bez sygnałów kup/sprzedaj").
 *
 * The moat vs. a generic "analyze my chart" prompt: the analysis is enriched with
 * Follio's own live crypto-derivatives context (Coinglass funding/OI/ETF flows),
 * so a BTC trade is judged against the funding regime and positioning that were
 * actually in play. Equity context wiring comes later (crypto-first, per
 * docs/research/PRODUCT_VISION.md).
 *
 * ANTHROPIC_API_KEY must never reach the client; this module is server-only and
 * may only be imported from API routes or server components.
 */
import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { fetchCryptoPulse, type CryptoPulseSnapshot } from "@/lib/coinglass";

// Opus 4.8 — strongest vision + reasoning; this is the flagship decision-quality
// feature, so we don't downgrade for cost.
const MODEL = "claude-opus-4-8";

export type SupportedMedia =
  | "image/png"
  | "image/jpeg"
  | "image/gif"
  | "image/webp";

/** One graded dimension of the trade process. */
const DimensionSchema = z.object({
  key: z.enum([
    "thesis_clarity",
    "risk_definition",
    "reward_risk",
    "htf_alignment",
    "entry_execution",
    "discipline",
  ]),
  label: z.string().describe("Human-readable dimension name, in Polish."),
  score: z
    .number()
    .int()
    .describe("Integer 0-5. 0 = absent/unknowable, 5 = textbook."),
  verdict: z
    .string()
    .describe("One short phrase, in Polish, e.g. 'brak zdefiniowanego SL'."),
});

const ScorecardSchema = z.object({
  detected_symbol: z
    .string()
    .describe("Ticker/pair read from the chart, e.g. 'BTCUSDT'. Empty if unclear."),
  detected_direction: z
    .enum(["long", "short", "unclear"])
    .describe("Trade direction inferred from the screenshot."),
  detected_timeframe: z
    .string()
    .describe("Chart timeframe if visible, e.g. '15m', '4H'. Empty if unclear."),
  process_score: z
    .number()
    .int()
    .describe("Overall DECISION-QUALITY score, integer 0-100. Independent of P&L."),
  outcome: z
    .enum(["win", "loss", "open", "unclear"])
    .describe("Did the trade make money? Reported SEPARATELY from process_score."),
  outcome_note: z
    .string()
    .describe("One line, in Polish, on process-vs-outcome (e.g. good process, lost)."),
  dimensions: z.array(DimensionSchema),
  what_went_well: z.array(z.string()).describe("Concrete strengths, in Polish."),
  what_to_improve: z.array(z.string()).describe("Concrete fixes, in Polish."),
  key_lesson: z
    .string()
    .describe("The single most important takeaway, in Polish. One or two sentences."),
  market_context_note: z
    .string()
    .describe(
      "How the live Coinglass context relates to this setup, in Polish. " +
        "Empty string if no relevant crypto context was provided.",
    ),
});

export type TradeScorecard = z.infer<typeof ScorecardSchema>;

export interface TradeReviewResult {
  scorecard: TradeScorecard;
  /** The derivatives snapshot used to enrich the review, if available. */
  market_context: CryptoPulseSnapshot | null;
  model: string;
  generated_at: string;
}

/** Compact, token-cheap summary of the live pulse for the prompt. */
function pulseSummary(pulse: CryptoPulseSnapshot | null): string {
  if (!pulse) return "";
  const coins = pulse.coins
    .map(
      (c) =>
        `${c.symbol}: price $${c.price.toLocaleString()}, ` +
        `funding ${c.funding_rate_oi.toFixed(4)}%/8h, ` +
        `OI 24h ${c.oi_change_24h_pct.toFixed(1)}%, ` +
        `L/S ${c.long_short_24h.toFixed(2)}, ` +
        `24h ${c.price_change_24h_pct.toFixed(1)}%`,
    )
    .join("\n");
  const etf =
    pulse.etf.btc_24h_flow_usd != null
      ? `BTC ETF 24h flow: $${(pulse.etf.btc_24h_flow_usd / 1e6).toFixed(0)}M`
      : "";
  const pos =
    pulse.positioning.divergence_pct != null
      ? `Top-trader vs retail long divergence: ${pulse.positioning.divergence_pct.toFixed(1)}pp`
      : "";
  const signals = pulse.signals.length
    ? `Heuristic signals:\n- ${pulse.signals.join("\n- ")}`
    : "";
  return [
    "LIVE CRYPTO DERIVATIVES CONTEXT (Coinglass, as of now):",
    coins,
    etf,
    pos,
    signals,
  ]
    .filter(Boolean)
    .join("\n");
}

const SYSTEM_PROMPT = `You are Follio's trade-review analyst for a small, serious traders' club.

Hard rules (these define the product — never break them):
- NEVER give a buy/sell/hold signal, price target, or "what to do next" trade call.
  This is a retrospective REVIEW, not a recommendation.
- Grade the QUALITY OF THE DECISION (process), NOT whether it made money. A winning
  trade can be a bad process (FOMO, no stop, luck); a losing trade can be a good
  process. Report the outcome SEPARATELY from the process score.
- Judge only against what was knowable AT THE TIME of the trade, from the screenshot.
- Be specific and concrete. No generic platitudes. If something is not visible in the
  screenshot (e.g. no stop-loss shown), say so and score that dimension accordingly.
- Write all human-facing text (labels, verdicts, lessons) in POLISH.

Score each dimension 0-5:
- thesis_clarity: was there a discernible, coherent setup/reason for the entry?
- risk_definition: is a stop-loss defined and visible? Is risk bounded?
- reward_risk: is the reward-to-risk ratio reasonable given the structure?
- htf_alignment: does the entry align with higher-timeframe structure/context?
- entry_execution: entry timing relative to structure (chase vs. patient level)?
- discipline: signs of FOMO, revenge, oversizing, or clean rule-following?

process_score (0-100) is a holistic decision-quality grade, weighting risk_definition
and discipline heavily. It is INDEPENDENT of the trade's P&L.

If live crypto-derivatives context is provided and the traded symbol matches, use it to
enrich market_context_note — e.g. entering a long into hot funding + crowded longs is a
worse-timed decision regardless of outcome. If the symbol doesn't match the context or
none is relevant, leave market_context_note empty.`;

export async function reviewTrade(params: {
  imageBase64: string;
  mediaType: SupportedMedia;
  notes?: string;
}): Promise<TradeReviewResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

  // Best-effort: enrich with live derivatives context. Never block the review on it.
  let pulse: CryptoPulseSnapshot | null = null;
  try {
    pulse = await fetchCryptoPulse();
  } catch {
    pulse = null;
  }

  const client = new Anthropic({ apiKey });

  const contextBlock = pulseSummary(pulse);
  const userText = [
    "Przeanalizuj to zagranie ze screenshota. Oceń jakość DECYZJI, nie wynik.",
    params.notes ? `\nNotatka tradera: ${params.notes}` : "",
    contextBlock ? `\n\n${contextBlock}` : "",
  ]
    .filter(Boolean)
    .join("");

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: params.mediaType,
              data: params.imageBase64,
            },
          },
          { type: "text", text: userText },
        ],
      },
    ],
    output_config: { format: zodOutputFormat(ScorecardSchema) },
  });

  const scorecard = response.parsed_output;
  if (!scorecard) {
    throw new Error(
      response.stop_reason === "refusal"
        ? "Model odmówił analizy tego obrazu."
        : "Nie udało się sparsować analizy zagrania.",
    );
  }

  return {
    scorecard,
    market_context: pulse,
    model: MODEL,
    generated_at: new Date().toISOString(),
  };
}
