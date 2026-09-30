import { isGradableSymbol } from "./gradable";
import type { Conviction, Direction, Level, LevelRole, Sentiment } from "./scoring";

export type Extraction = {
  symbol: string | null;
  direction: Direction | null;
  horizon: string | null;
  conviction: Conviction | null;
  sentiment: Sentiment | null;
  levels: Level[];
  ambiguous: boolean;
  gradable: boolean;
  reasons: string[];
  parser: "rules" | "llm";
};

const BEARISH =
  /\b(crash|doomed|doom|sell the open|selloff|sell-off|bearish|pullback|breakdown|short the|puts|dump|fade the|going lower)\b/i;
const BULLISH =
  /\b(melt-?up|bullish|moon|all-time high|ath|rip higher|going higher|rally|breakout|squeeze)\b/i;

const HIGH =
  /\b(high conviction|all in|slam dunk|pounding the table|max size|certain|100%)\b/i;
const LOW = /\b(low conviction|small size|lotto|nibble|maybe|might|could|slight)\b/i;
const MEDIUM = /\b(medium conviction|base case|leaning)\b/i;

const HORIZONS: { pattern: RegExp; label: string }[] = [
  { pattern: /\b(0\s*dte|zero\s*dte|this expiry|into the close|this morning|this session|today)\b/i, label: "this session" },
  { pattern: /\b(next week)\b/i, label: "next week" },
  { pattern: /\b(mid-?week|wednesday)\b/i, label: "Wednesday" },
  { pattern: /\b(by friday|into friday|this week|end of (?:the )?week|through friday)\b/i, label: "this week" },
  { pattern: /\b(monday|into the open|gap up|gap down)\b/i, label: "Monday" },
];

const CASHTAG = /\$([A-Za-z]{1,5})\b/g;
const BARE = /\b(SPY|QQQ|DIA|IWM|VIX|NVDA|AAPL|MSFT|TLT|SPX|NDX|DJI|RUT)\b/g;

function unique(values: Iterable<string>): string[] {
  return [...new Set([...values].map((value) => value.toUpperCase()))];
}

function symbolsIn(text: string): { symbols: string[]; reasons: string[] } {
  const cashtags = unique([...text.matchAll(CASHTAG)].map((match) => match[1] ?? ""));
  const bare = unique([...text.matchAll(BARE)].map((match) => match[1] ?? ""));
  const symbols = unique([...cashtags, ...bare]);
  const reasons: string[] = [];
  const nonVix = symbols.filter((symbol) => symbol !== "VIX");
  if (symbols.length === 0) {
    reasons.push("No ticker in the post.");
    return { symbols: [], reasons };
  }
  if (nonVix.length > 1) {
    reasons.push(`More than one ticker (${symbols.join(", ")}).`);
    return { symbols, reasons };
  }
  if (nonVix.length === 1) return { symbols: [nonVix[0] ?? ""], reasons };
  return { symbols: ["VIX"], reasons };
}

function directionOf(text: string): { direction: Direction | null; reasons: string[] } {
  const bear = BEARISH.test(text);
  const bull = BULLISH.test(text);
  if (bear && bull) return { direction: null, reasons: ["The post argues both ways."] };
  if (bear === bull) return { direction: null, reasons: ["Direction is not bullish or bearish."] };
  return { direction: bear ? "bearish" : "bullish", reasons: [] };
}

function horizonOf(text: string): { horizon: string | null; reasons: string[] } {
  const hits = HORIZONS.filter((item) => item.pattern.test(text)).map((item) => item.label);
  const uniqueHits = [...new Set(hits)];
  if (uniqueHits.length === 1) return { horizon: uniqueHits[0] ?? null, reasons: [] };
  if (uniqueHits.length > 1) {
    return { horizon: null, reasons: [`More than one window (${uniqueHits.join(", ")}).`] };
  }
  return { horizon: null, reasons: ["No window or horizon in the post."] };
}

function convictionOf(text: string): { conviction: Conviction | null; reasons: string[] } {
  const high = HIGH.test(text);
  const low = LOW.test(text);
  const medium = MEDIUM.test(text);
  const hits = [high ? "high" : null, medium ? "medium" : null, low ? "low" : null].filter(Boolean);
  if (hits.length > 1) return { conviction: null, reasons: ["Conviction language conflicts."] };
  if (hits.length === 1) return { conviction: hits[0] as Conviction, reasons: [] };
  return { conviction: null, reasons: ["No conviction language."] };
}

function levelsOf(text: string, symbol: string | null): Level[] {
  if (!symbol) return [];
  const levels: Level[] = [];
  const add = (role: LevelRole, raw: string | undefined) => {
    if (!raw) return;
    const price = Number(raw);
    if (!Number.isFinite(price)) return;
    levels.push({ symbol, price, role });
  };
  add("target", text.match(/\btarget\s+\$?(\d{2,5}(?:\.\d+)?)/i)?.[1]);
  add("invalidation", text.match(/\binvalid(?:ation)?(?:\s+(?:below|above|at))?\s+\$?(\d{2,5}(?:\.\d+)?)/i)?.[1]);
  add("support", text.match(/\bsupport\s+\$?(\d{2,5}(?:\.\d+)?)/i)?.[1]);
  add("resistance", text.match(/\bresistance\s+\$?(\d{2,5}(?:\.\d+)?)/i)?.[1]);
  return levels;
}

/** True when a required field is blank. An unsupported ticker can still be complete. */
export function needsModelHelp(extraction: Extraction): boolean {
  return (
    extraction.symbol == null ||
    extraction.direction == null ||
    extraction.horizon == null ||
    extraction.conviction == null
  );
}

/** Deterministic parse. Missing or conflicting fields stay null and the post stays in review. */
export function extractCall(text: string): Extraction {
  const body = text.trim();
  const symbolResult = symbolsIn(body);
  const directionResult = directionOf(body);
  const horizonResult = horizonOf(body);
  const convictionResult = convictionOf(body);
  const reasons = [
    ...symbolResult.reasons,
    ...directionResult.reasons,
    ...horizonResult.reasons,
    ...convictionResult.reasons,
  ];
  const symbol = symbolResult.reasons.length === 0 ? (symbolResult.symbols[0] ?? null) : null;
  const direction = directionResult.direction;
  const sentiment: Sentiment | null =
    direction === "bearish" ? "panic" : direction === "bullish" ? "meltup" : null;
  const gradable = symbol != null && isGradableSymbol(symbol);
  if (symbol && !gradable) reasons.push(`${symbol} is not a symbol this board grades.`);
  return {
    symbol,
    direction,
    horizon: horizonResult.horizon,
    conviction: convictionResult.conviction,
    sentiment,
    levels: levelsOf(body, symbol),
    ambiguous: reasons.length > 0,
    gradable,
    reasons,
    parser: "rules",
  };
}
