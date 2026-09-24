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
  /** Yahoo regular-session close. Weekend reference, and the Wednesday and Friday checkpoint. */
  close: Record<string, number>;
  /** Yahoo adjclose for the same dates. Stored for audit. Not used for gap, noon, or close grades. */
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
  "Weekend reference is the prior Friday Yahoo Finance regular-session close for SPY, QQQ, DIA, and VIX. Monday's gap uses the regular-session open. Monday noon is the open of the 12:00 PM ET 5-minute bar. Wednesday and Friday use the official daily close (4:00 PM ET, or 1:00 PM ET on an early close). A closed session or a close that is not due yet is left blank.";

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

/** Prior Friday regular-session close. This is the weekend reference for every graded move. */
export function sessionClose(symbol: string, date: string): number {
  const value = finite(
    seriesFor(symbol).close[date],
    `No Yahoo Finance regular-session close for ${symbol} on ${date}.`,
  );
  if (symbol === "SPY" && value < 700) {
    throw new Error(`Refusing SPY session close ${value} on ${date}. That is not a 2026 print.`);
  }
  return value;
}

/** Yahoo adjclose for audit. Do not use this against unadjusted opens, noon bars, or official closes. */
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
  field: "dailyOpen" | "noonOpen" | "close",
): number | null {
  if (spec == null) return null;
  if (spec.session === "closed") return null;
  if (field === "dailyOpen") return sessionOpen(symbol, spec.date);
  if (field === "noonOpen") return noonOpen(symbol, spec.date);
  return sessionClose(symbol, spec.date);
}

/** Quotes for one cohort. Every number comes from market-history.json. */
export function quotesForCohort(slug: string, symbols: readonly string[]): CohortQuotePrint[] {
  const cohort = file.cohorts[slug];
  if (!cohort) {
    throw new Error(`No market history for cohort ${slug}. Refusing to invent a price path.`);
  }
  return symbols.map((symbol) => ({
    symbol,
    ref: sessionClose(symbol, cohort.referenceDate),
    refDate: cohort.referenceDate,
    mondayOpen: sessionPrice(symbol, cohort.monday, "dailyOpen"),
    monday: sessionPrice(symbol, cohort.monday, "noonOpen"),
    wednesday: sessionPrice(symbol, cohort.wednesday, "close"),
    friday: sessionPrice(symbol, cohort.friday, "close"),
  }));
}

export function assertHistoricalPrint(
  symbol: string,
  date: string,
  field: "close" | "adjClose" | "dailyOpen" | "noonOpen",
  price: number,
): void {
  const expected =
    field === "close"
      ? sessionClose(symbol, date)
      : field === "adjClose"
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
