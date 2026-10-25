import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { zonedToUtc } from "./calendar";
import { YAHOO_CHART_ENDPOINT, etParts, pricesAgree, readNoonBar, unix, vendorSymbol, type ChartResult } from "./yahoo";

/** Live Monday-noon re-check. A flip inside this band is still the same print. */
export const NOON_LIVE_TOLERANCE = 0.05;

/** Advisory pulls. Fewer than this, or a spread wider than the tolerance, is Yahoo unstable. */
export const NOON_LIVE_PULLS = 3;

export type NoonInterval = "5m" | "1m";

export type NoonSettings = {
  period1: number;
  period2: number;
  interval: NoonInterval;
  includeAdjustedClose: true;
  events: "div";
};

/** The raw Yahoo chart response behind one Monday noon print. */
export type NoonReceipt = {
  symbol: string;
  date: string;
  interval: NoonInterval;
  url: string;
  settings: NoonSettings;
  fetchedAt: string;
  checksum: string;
  raw: string;
};

export type NoonReading = {
  open: number;
  bar: string;
  previousClose: number | null;
  filled: boolean;
};

export type NoonVote =
  | { status: "agree"; open: number }
  | { status: "unstable"; open: number | null };

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

export function sha256Text(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/** Chart request the accuracy guard uses for the 12:00 PM ET 5-minute bar. */
export function expectedNoonRequest(symbol: string, date: string): { url: string; settings: NoonSettings } {
  const settings: NoonSettings = {
    period1: unix(date, 13),
    period2: unix(date, 22),
    interval: "5m",
    includeAdjustedClose: true,
    events: "div",
  };
  const url = new URL(`${YAHOO_CHART_ENDPOINT}${encodeURIComponent(vendorSymbol(symbol))}`);
  url.searchParams.set("period1", String(settings.period1));
  url.searchParams.set("period2", String(settings.period2));
  url.searchParams.set("interval", settings.interval);
  url.searchParams.set("includeAdjustedClose", "true");
  url.searchParams.set("events", settings.events);
  return { url: url.toString(), settings };
}

export function noonReceiptPath(date: string, symbol: string): string {
  return join(ROOT, "data/yahoo/noon", date, `${symbol}.json`);
}

/** 1-minute chart for the same window. It confirms a 5-minute open that looks filled. */
export function expectedMinuteRequest(symbol: string, date: string): { url: string; settings: NoonSettings } {
  const five = expectedNoonRequest(symbol, date);
  const settings: NoonSettings = { ...five.settings, interval: "1m" };
  const url = new URL(five.url);
  url.searchParams.set("interval", "1m");
  return { url: url.toString(), settings };
}

export function minuteReceiptPath(date: string, symbol: string): string {
  return join(ROOT, "data/yahoo/noon", date, `${symbol}-1m.json`);
}

/** 12:00 PM ET with the zone offset, matching the stamps already in the price file. */
export function noonBarStamp(ymd: string): string {
  const [year, month, day] = ymd.split("-").map(Number);
  const utc = zonedToUtc(year, month, day, 12, 0);
  const offsetMinutes = Math.round((Date.UTC(year, month - 1, day, 12, 0) - utc.getTime()) / 60000);
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const hours = String(Math.floor(abs / 60)).padStart(2, "0");
  const minutes = String(abs % 60).padStart(2, "0");
  return `${ymd}T12:00:00${sign}${hours}:${minutes}`;
}

export function noonReceiptDocument(input: {
  symbol: string;
  date: string;
  interval: NoonInterval;
  fetchedAt: string;
  raw: string;
}): NoonReceipt {
  const request = input.interval === "1m" ? expectedMinuteRequest(input.symbol, input.date) : expectedNoonRequest(input.symbol, input.date);
  return {
    symbol: input.symbol,
    date: input.date,
    interval: input.interval,
    url: request.url,
    settings: request.settings,
    fetchedAt: input.fetchedAt,
    checksum: sha256Text(input.raw),
    raw: input.raw,
  };
}

export function chartFromRaw(raw: string): ChartResult {
  const payload = JSON.parse(raw) as { chart?: { result?: ChartResult[]; error?: { description?: string } } };
  const result = payload.chart?.result?.[0];
  if (!result) {
    throw new Error(`Yahoo chart body had no result. ${payload.chart?.error?.description ?? "Refusing to invent a print."}`);
  }
  return result;
}

/**
 * Open of the 12:00 PM ET bar, plus the previous bar's close.
 * A filled bar copies that previous close into the 12:00 open.
 */
export function readNoonReading(result: ChartResult, ymd: string): NoonReading {
  const noon = readNoonBar(result, ymd);
  const timestamps = result.timestamp ?? [];
  const quote = result.indicators?.quote?.[0];
  const index = timestamps.findIndex((stamp) => {
    const parts = etParts(stamp);
    return parts.date === ymd && parts.hour === 12 && parts.minute === 0;
  });
  const previous = index > 0 ? quote?.close?.[index - 1] : null;
  const previousClose = typeof previous === "number" && Number.isFinite(previous) ? previous : null;
  return {
    open: noon.open,
    bar: noon.bar,
    previousClose,
    filled: previousClose != null && noon.open === previousClose,
  };
}

export function loadNoonReceipt(date: string, symbol: string): NoonReceipt {
  const path = noonReceiptPath(date, symbol);
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    throw new Error(`No committed Yahoo noon receipt for ${symbol} on ${date}.`);
  }
  const receipt = JSON.parse(text) as NoonReceipt;
  if (receipt.symbol !== symbol || receipt.date !== date) {
    throw new Error(`Noon receipt ${path} is not ${symbol} on ${date}.`);
  }
  return receipt;
}

function verifyIntervalReceipt(receipt: NoonReceipt, interval: NoonInterval): NoonReading {
  if (sha256Text(receipt.raw) !== receipt.checksum) {
    throw new Error(`Noon receipt checksum for ${receipt.symbol} ${receipt.date} does not match the raw Yahoo body.`);
  }
  const expected = interval === "1m" ? expectedMinuteRequest(receipt.symbol, receipt.date) : expectedNoonRequest(receipt.symbol, receipt.date);
  if (receipt.url !== expected.url || receipt.interval !== interval) {
    throw new Error(`Noon receipt URL for ${receipt.symbol} ${receipt.date} does not match the chart endpoint.`);
  }
  const settings = receipt.settings;
  if (
    settings.period1 !== expected.settings.period1 ||
    settings.period2 !== expected.settings.period2 ||
    settings.interval !== interval ||
    settings.includeAdjustedClose !== true ||
    settings.events !== "div"
  ) {
    throw new Error(`Noon receipt settings for ${receipt.symbol} ${receipt.date} do not match the chart request.`);
  }
  return readNoonReading(chartFromRaw(receipt.raw), receipt.date);
}

/** Checksum, endpoint, and the 12:00 open. A filled bar is reported by the caller and is not a checksum failure. */
export function verifyNoonReceipt(receipt: NoonReceipt): NoonReading {
  return verifyIntervalReceipt(receipt, "5m");
}

export function loadMinuteReceipt(date: string, symbol: string): NoonReceipt {
  const path = minuteReceiptPath(date, symbol);
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    throw new Error(`No committed Yahoo 1-minute noon receipt for ${symbol} on ${date}.`);
  }
  const receipt = JSON.parse(text) as NoonReceipt;
  if (receipt.symbol !== symbol || receipt.date !== date) {
    throw new Error(`Noon receipt ${path} is not ${symbol} on ${date}.`);
  }
  return receipt;
}

export function verifyMinuteReceipt(receipt: NoonReceipt): NoonReading {
  return verifyIntervalReceipt(receipt, "1m");
}

export type ResolvedNoon =
  | { ok: true; open: number; filled: boolean; confirmed: boolean; note: string }
  | { ok: false; message: string };

/**
 * A 5-minute open that copies the previous close is not the grade when the
 * 1-minute 12:00 open is a different print. When both opens are the same cent,
 * the flag stays and that print is the grade.
 */
export function resolvedNoonOpen(five: NoonReading, minute: NoonReading | null): ResolvedNoon {
  if (!five.filled) {
    return { ok: true, open: five.open, filled: false, confirmed: false, note: "" };
  }
  const flag = "possible filled bar: 12:00 open equals the previous bar close";
  if (minute == null) {
    return {
      ok: false,
      message: `${flag}. A filled open is not the grade until the 1-minute 12:00 open is committed.`,
    };
  }
  if (!pricesAgree(five.open, minute.open)) {
    return {
      ok: true,
      open: minute.open,
      filled: true,
      confirmed: false,
      note: `${flag}. The filled 5-minute open is not the grade. The 1-minute 12:00 open is the grade.`,
    };
  }
  return {
    ok: true,
    open: five.open,
    filled: true,
    confirmed: true,
    note: `${flag}. The 1-minute 12:00 open confirms the print. The filled flag stays. The grade stays this print.`,
  };
}

/** Keep a stored noon print. A new print is recorded only when the cell is empty. */
export function noonToStore(stored: number | null, resolvedOpen: number): { open: number } | { error: string } {
  if (stored == null) return { open: resolvedOpen };
  if (!pricesAgree(stored, resolvedOpen)) {
    return { error: `refusing to replace stored noon ${stored} with ${resolvedOpen}` };
  }
  return { open: stored };
}

/**
 * Three or more pulls. Unanimous within $0.05 agrees.
 * A wider spread, or too few pulls, is Yahoo unstable. A majority is reported with that flag and is not a pass.
 */
export function noonMajority(opens: readonly number[], tolerance = NOON_LIVE_TOLERANCE): NoonVote {
  if (opens.length < NOON_LIVE_PULLS) return { status: "unstable", open: null };
  let bestOpen = opens[0];
  let bestCount = 0;
  for (const candidate of opens) {
    const count = opens.filter((value) => Math.abs(value - candidate) <= tolerance).length;
    if (count > bestCount) {
      bestOpen = candidate;
      bestCount = count;
    }
  }
  const span = Math.max(...opens) - Math.min(...opens);
  if (span > tolerance) {
    return { status: "unstable", open: bestCount > opens.length / 2 ? bestOpen : null };
  }
  return { status: "agree", open: bestOpen };
}
