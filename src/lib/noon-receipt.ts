import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { YAHOO_CHART_ENDPOINT, etParts, readNoonBar, unix, vendorSymbol, type ChartResult } from "./yahoo";

/** Live Monday-noon re-check. A flip inside this band is still the same print. */
export const NOON_LIVE_TOLERANCE = 0.05;

/** Advisory pulls. Fewer than this, or a spread wider than the tolerance, is Yahoo unstable. */
export const NOON_LIVE_PULLS = 3;

export type NoonSettings = {
  period1: number;
  period2: number;
  interval: "5m";
  includeAdjustedClose: true;
  events: "div";
};

/** The raw Yahoo chart response behind one Monday noon print. */
export type NoonReceipt = {
  symbol: string;
  date: string;
  interval: "5m";
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

/** Checksum, endpoint, and the 12:00 open. A filled bar is reported by the caller and is not a checksum failure. */
export function verifyNoonReceipt(receipt: NoonReceipt): NoonReading {
  if (sha256Text(receipt.raw) !== receipt.checksum) {
    throw new Error(`Noon receipt checksum for ${receipt.symbol} ${receipt.date} does not match the raw Yahoo body.`);
  }
  const expected = expectedNoonRequest(receipt.symbol, receipt.date);
  if (receipt.url !== expected.url || receipt.interval !== "5m") {
    throw new Error(`Noon receipt URL for ${receipt.symbol} ${receipt.date} does not match the chart endpoint.`);
  }
  const settings = receipt.settings;
  if (
    settings.period1 !== expected.settings.period1 ||
    settings.period2 !== expected.settings.period2 ||
    settings.interval !== "5m" ||
    settings.includeAdjustedClose !== true ||
    settings.events !== "div"
  ) {
    throw new Error(`Noon receipt settings for ${receipt.symbol} ${receipt.date} do not match the chart request.`);
  }
  return readNoonReading(chartFromRaw(receipt.raw), receipt.date);
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
