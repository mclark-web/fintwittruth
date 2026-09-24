import history from "./market-history.json";

const symbols = Object.keys((history as { symbols: Record<string, unknown> }).symbols);

/** Symbols with a recorded Yahoo print in market-history.json. Anything else is not graded. */
export const GRADABLE_SYMBOLS: readonly string[] = symbols;

export function isGradableSymbol(symbol: string): boolean {
  return GRADABLE_SYMBOLS.includes(symbol.toUpperCase());
}
