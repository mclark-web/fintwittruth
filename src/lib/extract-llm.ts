import { z } from "zod";
import { extractCall, type Extraction } from "./extract-call";
import { isGradableSymbol } from "./gradable";
import type { Conviction, Direction } from "./scoring";

const suggestionSchema = z.object({
  symbol: z.string().nullable(),
  direction: z.enum(["bullish", "bearish"]).nullable(),
  horizon: z.string().nullable(),
  conviction: z.enum(["high", "medium", "low"]).nullable(),
  reasons: z.array(z.string()),
});

export function llmExtractionEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.XAI_API_KEY);
}

function mentioned(text: string, symbol: string): boolean {
  const needle = symbol.toUpperCase();
  return new RegExp(`(^|[^A-Za-z])${needle}([^A-Za-z]|$)`, "i").test(text);
}

/**
 * Optional fill for a rules parse that is still ambiguous.
 * Returns null when XAI_API_KEY is unset. Never confirms a call by itself.
 */
export async function suggestCallWithLlm(text: string, env: NodeJS.ProcessEnv = process.env): Promise<Extraction | null> {
  if (!llmExtractionEnabled(env)) return null;
  const rules = extractCall(text);
  const { generateText, Output } = await import("ai");
  const { xai } = await import("@ai-sdk/xai");
  const modelId = env.XAI_MODEL || "grok-3";
  const result = await generateText({
    model: xai(modelId),
    output: Output.object({
      schema: suggestionSchema,
      name: "call_suggestion",
      description: "Fields a human still has to confirm. Do not invent a ticker that is not in the post.",
    }),
    prompt: [
      "Read this public post and suggest one call.",
      "Use a ticker only if it appears in the post.",
      "Direction is bullish or bearish, or null if the post does not take a side.",
      "Horizon is the window the post names, or null.",
      "Conviction is high, medium, or low, or null.",
      "Do not grade the post.",
      "",
      text,
    ].join("\n"),
  });
  const suggestion = result.output;
  const symbol = suggestion.symbol?.replace(/^\$/, "").toUpperCase() || null;
  const safeSymbol = symbol && mentioned(text, symbol) ? symbol : rules.symbol;
  const direction = (suggestion.direction ?? rules.direction) as Direction | null;
  const horizon = suggestion.horizon?.trim() || rules.horizon;
  const conviction = (suggestion.conviction ?? rules.conviction) as Conviction | null;
  const reasons = [
    "Model suggestion only. Confirm, edit, or reject before any grade.",
    ...suggestion.reasons,
  ];
  return {
    ...rules,
    symbol: safeSymbol,
    direction: direction === "bullish" || direction === "bearish" ? direction : null,
    horizon: horizon || null,
    conviction: conviction === "high" || conviction === "medium" || conviction === "low" ? conviction : null,
    sentiment: direction === "bearish" ? "panic" : direction === "bullish" ? "meltup" : null,
    gradable: safeSymbol != null && isGradableSymbol(safeSymbol),
    ambiguous: true,
    reasons,
    parser: "llm",
  };
}
