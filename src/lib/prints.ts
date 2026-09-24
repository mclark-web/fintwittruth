import { formatPrice, formatSignedPct } from "./format";
import { EQUITY_TAPE, type Direction, type ReadoutKind } from "./scoring";

/** Board order for the index tape. Scoring still equal-weights SPY, QQQ, and DIA. */
export const TAPE_DISPLAY = ["SPY", "DIA", "QQQ", "VIX"] as const;

export type PriceQuote = {
  symbol: string;
  /** Friday regular-session close. Reference for the signed move on a readout bubble. */
  ref?: number | null;
  mondayOpen: number | null;
  monday: number | null;
  wednesday: number | null;
  friday: number | null;
};

/** Same flat band grade notes use when a move is too small to count as with or against. */
const STANCE_BAND = 0.0008;

export type CallStance = "with" | "against" | "flat";

export function callStance(direction: Direction, move: number): CallStance {
  const favorable = direction === "bullish" ? move : -move;
  if (favorable >= STANCE_BAND) return "with";
  if (favorable <= -STANCE_BAND) return "against";
  return "flat";
}

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

/** `NVDA ($225.10)`. Omits the parentheses when that checkpoint has no print. */
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

export type PredictedReadout = {
  symbol: string;
  price: number | null;
  ref: number | null;
  move: number | null;
  stance: CallStance | null;
  /** `NVDA ($225.10) +2.4%`, or the bare ticker when that checkpoint has no print. */
  text: string;
};

function finitePrice(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) ? value : null;
}

/**
 * The symbol the post predicted, that checkpoint's recorded print, and the
 * signed move from the call-time reference. Does not touch tape scoring.
 */
export function predictedReadout(
  quotes: PriceQuote[] | undefined,
  primary: string | undefined,
  kind: ReadoutKind,
  direction?: Direction,
): PredictedReadout | null {
  if (!primary) return null;
  const quote = quotes?.find((item) => item.symbol === primary);
  const price = quote ? finitePrice(priceAt(quote, kind)) : null;
  const ref = finitePrice(quote?.ref);
  const move = price != null && ref != null && ref !== 0 ? (price - ref) / ref : null;
  const stance = move != null && direction ? callStance(direction, move) : null;
  const priced = reportOutLabel(primary, price);
  const text = move == null ? priced : `${priced} ${formatSignedPct(move)}`;
  return { symbol: primary, price, ref, move, stance, text };
}

/** Reference print for the predicted symbol. This book stores Friday's session close. */
export function referencePrint(
  quotes: PriceQuote[] | undefined,
  primary: string | undefined,
): { symbol: string; price: number } | null {
  if (!primary) return null;
  const quote = quotes?.find((item) => item.symbol === primary);
  const price = finitePrice(quote?.ref);
  if (price == null) return null;
  return { symbol: primary, price };
}
