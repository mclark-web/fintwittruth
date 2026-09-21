import history from "./market-history.json";
import type { ReadoutKind } from "./scoring";

type Session = "open" | "closed";

export type ReadoutPrint = {
  date: string;
  session: Session;
  reason?: string;
};

type CohortHistory = {
  referenceDate: string;
  monday: ReadoutPrint | null;
  wednesday: ReadoutPrint | null;
  friday: ReadoutPrint | null;
};

type SymbolHistory = {
  adjClose: Record<string, number>;
  dailyOpen: Record<string, number>;
  noonOpen: Record<string, number>;
  noonBar: Record<string, string>;
};

type HistoryFile = {
  source: string;
  endpoint: string;
  vixSymbol: string;
  fetchedAt: string;
  adjustment: string;
  closedMarketRule: string;
  futureRule: string;
  symbols: Record<string, SymbolHistory>;
  cohorts: Record<string, CohortHistory>;
};

const file = history as HistoryFile;

export const PRICE_SOURCE = file.source;
export const PRICE_FETCHED_AT = file.fetchedAt;
export const PRICE_ADJUSTMENT = file.adjustment;
export const PRICE_CLOSED_RULE = file.closedMarketRule;
export const VIX_VENDOR_SYMBOL = file.vixSymbol;

export const PRICE_SOURCE_SHORT =
  "Weekend reference is the prior Friday Yahoo Finance adjusted close for SPY, QQQ, DIA, and VIX. Monday's gap uses the regular-session open. Noon grades use the open of the 12:00 PM ET 5-minute bar. A closed or future session is left blank.";

function finite(value: number | undefined, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} Refusing to invent a print.`);
  }
  return value;
}

function seriesFor(symbol: string): SymbolHistory {
  const series = file.symbols[symbol];
  if (!series) {
    throw new Error(`No Yahoo Finance history for ${symbol}. Refusing to invent a print.`);
  }
  return series;
}

export function adjustedClose(symbol: string, date: string): number {
  const value = finite(
    seriesFor(symbol).adjClose[date],
    `No Yahoo Finance adjusted close for ${symbol} on ${date}.`,
  );
  if (symbol === "SPY" && value < 700) {
    throw new Error(`Refusing SPY adjusted close ${value} on ${date}. That is not a 2026 print.`);
  }
  return value;
}

export function sessionOpen(symbol: string, date: string): number {
  const value = finite(
    seriesFor(symbol).dailyOpen[date],
    `No Yahoo Finance regular-session open for ${symbol} on ${date}.`,
  );
  if (symbol === "SPY" && value < 700) {
    throw new Error(`Refusing SPY open ${value} on ${date}. That is not a 2026 print.`);
  }
  return value;
}

export function noonOpen(symbol: string, date: string): number {
  const series = seriesFor(symbol);
  const bar = series.noonBar[date];
  if (!bar || !bar.includes("T12:00:00")) {
    throw new Error(
      `No Yahoo Finance 12:00 PM ET bar for ${symbol} on ${date}. Refusing to invent a print.`,
    );
  }
  const value = finite(series.noonOpen[date], `No Yahoo Finance noon print for ${symbol} on ${date}.`);
  if (symbol === "SPY" && value < 700) {
    throw new Error(`Refusing SPY noon print ${value} on ${date}. That is not a 2026 print.`);
  }
  return value;
}

export function sessionFor(slug: string, kind: "monday" | "wednesday" | "friday"): ReadoutPrint | null {
  const cohort = file.cohorts[slug];
  if (!cohort) throw new Error(`No market history for cohort ${slug}.`);
  return cohort[kind];
}

export type CohortQuotePrint = {
  symbol: string;
  ref: number;
  refDate: string;
  mondayOpen: number | null;
  monday: number | null;
  wednesday: number | null;
  friday: number | null;
};

function sessionPrice(
  symbol: string,
  spec: ReadoutPrint | null,
  field: "dailyOpen" | "noonOpen",
): number | null {
  if (spec == null) return null;
  if (spec.session === "closed") return null;
  return field === "dailyOpen" ? sessionOpen(symbol, spec.date) : noonOpen(symbol, spec.date);
}

/** Quotes for one cohort. Every number comes from market-history.json. */
export function quotesForCohort(slug: string, symbols: readonly string[]): CohortQuotePrint[] {
  const cohort = file.cohorts[slug];
  if (!cohort) {
    throw new Error(`No market history for cohort ${slug}. Refusing to invent a price path.`);
  }
  return symbols.map((symbol) => ({
    symbol,
    ref: adjustedClose(symbol, cohort.referenceDate),
    refDate: cohort.referenceDate,
    mondayOpen: sessionPrice(symbol, cohort.monday, "dailyOpen"),
    monday: sessionPrice(symbol, cohort.monday, "noonOpen"),
    wednesday: sessionPrice(symbol, cohort.wednesday, "noonOpen"),
    friday: sessionPrice(symbol, cohort.friday, "noonOpen"),
  }));
}

export function assertHistoricalPrint(
  symbol: string,
  date: string,
  field: "adjClose" | "dailyOpen" | "noonOpen",
  price: number,
): void {
  const expected =
    field === "adjClose"
      ? adjustedClose(symbol, date)
      : field === "dailyOpen"
        ? sessionOpen(symbol, date)
        : noonOpen(symbol, date);
  if (Math.abs(price - expected) > 0.02) {
    throw new Error(
      `Refusing ${symbol} ${date} ${field} ${price}. Recorded Yahoo Finance print is ${expected}.`,
    );
  }
}
