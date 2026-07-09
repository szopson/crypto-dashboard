/**
 * Shared shape of an AI-generated trade setup.
 *
 * Deliberately NOT server-only: the zod schema drives the model's structured
 * output on the server (setup-engine.ts) and validates client-held state on
 * the chat route, while the inferred type renders the setup card in the
 * browser. Keep this file free of secrets and server imports.
 */
import { z } from "zod";

export const SETUP_COINS = ["BTC", "ETH", "SOL"] as const;
export type SetupCoin = (typeof SETUP_COINS)[number];

export function isSetupCoin(v: unknown): v is SetupCoin {
  return typeof v === "string" && (SETUP_COINS as readonly string[]).includes(v);
}

export const BiasSchema = z.enum(["bullish", "bearish", "neutral", "elevated"]);
export type Bias = z.infer<typeof BiasSchema>;

export const TradeSetupSchema = z.object({
  coin: z.string().describe("The analyzed coin symbol, e.g. 'BTC'."),
  bias: BiasSchema.describe("Overall structural bias for the TL;DR header badge."),
  tldr: z
    .string()
    .describe("One-sentence structural read naming the critical zone. No 'TL;DR:' prefix."),
  priceLine: z
    .string()
    .describe("'$X (1h HL perp) — one-line trend context.' Current price and drift."),
  watchLine: z
    .string()
    .describe("The single reclaim/breakdown level pair that flips the read."),
  signals: z
    .array(
      z.object({
        name: z.string().describe("e.g. 'Price (1h HL)', 'OI', 'Funding (1h)', 'Liq imbalance (est.)'"),
        value: z.string().describe("The number(s), compact: '$62,969', '$2.42B', '+0.00125%'."),
        read: z.string().describe("One-line interpretation of the value in context."),
        bias: BiasSchema,
      }),
    )
    .describe("The signal table: price vs VWAP, OI, funding, liq imbalance."),
  catalysts: z
    .array(z.string())
    .describe("2-3 bullets: decisive candles/volume events and what funding/OI imply."),
  story: z
    .string()
    .describe("Short paragraph: how price got here, where liq magnets sit, cascade/squeeze triggers."),
  keyLevels: z
    .array(
      z.object({
        level: z.string().describe("Price or range, e.g. '$61,550–$61,087'."),
        type: z.string().describe("e.g. 'Short-liq zone (est. $99M)', 'Spot (1h)', 'Support'."),
        note: z.string().describe("What happens there: reclaim = squeeze trigger toward X, etc."),
      }),
    )
    .describe("Key levels table, ordered top (highest price) to bottom."),
  bottomLine: z
    .string()
    .describe(
      "Actionable verdict: long/short/no-trade, exact entry condition, invalidation, target. " +
        "'No clean setup' is a valid verdict — then state what to wait for.",
    ),
  nextSteps: z.object({
    derivatives: z.string().describe("What funding/OI change to monitor and what it would mean."),
    technical: z.string().describe("The level whose reclaim/loss flips the bias."),
    setup: z.string().describe("The precise conditional trade to evaluate next."),
  }),
});

export type TradeSetup = z.infer<typeof TradeSetupSchema>;
