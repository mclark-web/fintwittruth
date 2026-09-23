import { formatPrice } from "./format";
import { EQUITY_TAPE, type ReadoutKind } from "./scoring";

/** Board order for the index tape. Scoring still equal-weights SPY, QQQ, and DIA. */
export const TAPE_DISPLAY = ["SPY", "DIA", "QQQ", "VIX"] as const;

export type PriceQuote = {
  symbol: string;
  mondayOpen: number | null;
  monday: number | null;
  wednesday: number | null;
  friday: number | null;
};

export type CheckpointPrint = {
  symbol: string;
  price: number;
};

/**
 * Price used at a grading checkpoint.
 * Monday's gap is the regular-session open. Noon grades are the noon print.
 */
export function priceAt(quote: PriceQuote, kind: ReadoutKind): number | null {
  if (kind === "monday-gap") return quote.mondayOpen;
  return quote[kind];
}

/** Index tape, then the call's own ticker when level scoring uses a different symbol. */
export function checkpointSymbols(primary?: string | null): string[] {
  const symbols: string[] = [...TAPE_DISPLAY];
  if (primary && !symbols.includes(primary)) symbols.push(primary);
  return symbols;
}

/** Recorded prints for one checkpoint. Missing sessions are omitted, never invented. */
export function checkpointPrints(
  quotes: PriceQuote[],
  kind: ReadoutKind,
  symbols: readonly string[] = TAPE_DISPLAY,
): CheckpointPrint[] {
  const prints: CheckpointPrint[] = [];
  for (const symbol of symbols) {
    const quote = quotes.find((item) => item.symbol === symbol);
    if (!quote) continue;
    const price = priceAt(quote, kind);
    if (price == null) continue;
    prints.push({ symbol, price });
  }
  return prints;
}

export function tapeSymbols(): readonly string[] {
  return [...EQUITY_TAPE, "VIX"];
}

/** `Gap ($766.25)`. Omits the parentheses when that checkpoint has no print. */
export function reportOutLabel(label: string, price: number | null | undefined): string {
  if (price == null || !Number.isFinite(price)) return label;
  return `${label} ($${formatPrice(price)})`;
}

/** Share price the call's ticker printed at this checkpoint, labeled for the report-out card. */
export function callCheckpointLabel(
  label: string,
  quotes: PriceQuote[] | undefined,
  primary: string | undefined,
  kind: ReadoutKind,
): string {
  const quote = primary ? quotes?.find((item) => item.symbol === primary) : undefined;
  const price = quote ? priceAt(quote, kind) : null;
  return reportOutLabel(label, price);
}
