import history from "./market-history.json";
import type { ReadoutKind } from "./scoring";

type Session = "open" | "closed";

export type ReadoutPrint = {
  date: string;
  session: Session;
  carriedFrom?: string;
  reason?: string;
};

type CohortHistory = {
  referenceDate: string;
  monday: ReadoutPrint | null;
  wednesday: ReadoutPrint | null;
  friday: ReadoutPrint | null;
};

type SymbolHistory = {
  dailyClose: Record<string, number>;
  adjClose: Record<string, number>;
  noonOpen: Record<string, number>;
  noonBar: Record<string, string>;
};

type HistoryFile = {
  source: string;
  endpoint: string;
  fetchedAt: string;
  currency: string;
  adjustment: string;
  closedMarketRule: string;
  futureRule: string;
  symbols: Record<string, SymbolHistory>;
  cohorts: Record<string, CohortHistory>;
};

const file = history as HistoryFile;

export const PRICE_SOURCE = file.source;
export const PRICE_ENDPOINT = file.endpoint;
export const PRICE_FETCHED_AT = file.fetchedAt;
export const PRICE_ADJUSTMENT = file.adjustment;
export const PRICE_CLOSED_RULE = file.closedMarketRule;

export const PRICE_SOURCE_SHORT =
  "Market prints are Yahoo Finance unadjusted prices: the Friday regular-session close is the Sunday reference, and each grade is the open of the 12:00 PM ET 5-minute bar. A closed session repeats the prior official close. Nothing here is a drawn path.";

function finite(value: number | undefined, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} Refusing to invent a print.`);
  }
  return value;
}

/** Official unadjusted cash close. Throws when Yahoo has no session for that date. */
export function officialClose(symbol: string, date: string): number {
  const series = file.symbols[symbol];
  if (!series) {
    throw new Error(`No Yahoo Finance history for ${symbol}. Refusing to invent a print.`);
  }
  return finite(
    series.dailyClose[date],
    `No Yahoo Finance official close for ${symbol} on ${date}.`,
  );
}

/** Open of the 5-minute bar stamped 12:00 America/New_York. Throws when that bar is absent. */
export function noonOpen(symbol: string, date: string): number {
  const series = file.symbols[symbol];
  if (!series) {
    throw new Error(`No Yahoo Finance history for ${symbol}. Refusing to invent a print.`);
  }
  const bar = series.noonBar[date];
  if (!bar || !bar.includes("T12:00:00")) {
    throw new Error(
      `No Yahoo Finance 12:00 PM ET bar for ${symbol} on ${date}. Refusing to invent a print.`,
    );
  }
  return finite(series.noonOpen[date], `No Yahoo Finance noon print for ${symbol} on ${date}.`);
}

export function sessionFor(slug: string, kind: ReadoutKind): ReadoutPrint | null {
  const cohort = file.cohorts[slug];
  if (!cohort) {
    throw new Error(`No market history for cohort ${slug}.`);
  }
  return cohort[kind];
}

export type CohortQuotePrint = {
  symbol: string;
  ref: number;
  refDate: string;
  monday: number | null;
  wednesday: number | null;
  friday: number | null;
};

function readoutPrice(symbol: string, spec: ReadoutPrint | null): number | null {
  if (spec == null) return null;
  if (spec.session === "closed") {
    if (!spec.carriedFrom) {
      throw new Error(`Closed session on ${spec.date} has no prior official close.`);
    }
    return officialClose(symbol, spec.carriedFrom);
  }
  return noonOpen(symbol, spec.date);
}

/** Quotes for one cohort. Every number comes from market-history.json. */
export function quotesForCohort(slug: string, symbols: readonly string[]): CohortQuotePrint[] {
  const cohort = file.cohorts[slug];
  if (!cohort) {
    throw new Error(`No market history for cohort ${slug}. Refusing to invent a price path.`);
  }
  return symbols.map((symbol) => ({
    symbol,
    ref: officialClose(symbol, cohort.referenceDate),
    refDate: cohort.referenceDate,
    monday: readoutPrice(symbol, cohort.monday),
    wednesday: readoutPrice(symbol, cohort.wednesday),
    friday: readoutPrice(symbol, cohort.friday),
  }));
}

/**
 * Reject a price that is not the recorded print. Tolerance is one cent of
 * float noise, not a license to substitute a path.
 */
export function assertHistoricalPrint(
  symbol: string,
  date: string,
  field: "dailyClose" | "noonOpen",
  price: number,
): void {
  const expected = field === "noonOpen" ? noonOpen(symbol, date) : officialClose(symbol, date);
  if (Math.abs(price - expected) > 0.02) {
    throw new Error(
      `Refusing ${symbol} ${date} ${field} ${price}. Recorded Yahoo Finance print is ${expected}.`,
    );
  }
}
