const CHART = "https://query1.finance.yahoo.com/v8/finance/chart/";

export const VIX_VENDOR_SYMBOL = "^VIX";

export type ChartResult = {
  timestamp?: number[];
  indicators?: {
    quote?: Array<{ open?: Array<number | null>; close?: Array<number | null> }>;
    adjclose?: Array<{ adjclose?: Array<number | null> }>;
  };
};

export function vendorSymbol(symbol: string): string {
  return symbol === "VIX" ? VIX_VENDOR_SYMBOL : symbol;
}

export function etParts(unixSeconds: number): { date: string; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(unixSeconds * 1000));
  const bag: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") bag[part.type] = part.value;
  }
  const hour = Number(bag.hour) % 24;
  return {
    date: `${bag.year}-${bag.month}-${bag.day}`,
    hour,
    minute: Number(bag.minute),
  };
}

function finiteAt(values: Array<number | null> | undefined, index: number, label: string): number {
  const value = values?.[index];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} Refusing to invent a print.`);
  }
  return value;
}

export function readDailyBar(
  result: ChartResult,
  ymd: string,
): { open: number; close: number; adjClose: number } {
  const timestamps = result.timestamp ?? [];
  const quote = result.indicators?.quote?.[0];
  const adj = result.indicators?.adjclose?.[0]?.adjclose;
  const index = timestamps.findIndex((stamp) => etParts(stamp).date === ymd);
  if (index < 0) {
    throw new Error(`No Yahoo Finance daily bar for ${ymd}. Refusing to invent a print.`);
  }
  const close = finiteAt(quote?.close, index, `No Yahoo Finance close on ${ymd}.`);
  const open = finiteAt(quote?.open, index, `No Yahoo Finance open on ${ymd}.`);
  const adjClose = adj ? finiteAt(adj, index, `No Yahoo Finance adjclose on ${ymd}.`) : close;
  return { open, close, adjClose };
}

/** Open of the 5-minute bar stamped 12:00 PM America/New_York. */
export function readNoonBar(result: ChartResult, ymd: string): { open: number; bar: string } {
  const timestamps = result.timestamp ?? [];
  const quote = result.indicators?.quote?.[0];
  const index = timestamps.findIndex((stamp) => {
    const parts = etParts(stamp);
    return parts.date === ymd && parts.hour === 12 && parts.minute === 0;
  });
  if (index < 0) {
    throw new Error(`No Yahoo Finance 12:00 PM ET bar on ${ymd}. Refusing to invent a print.`);
  }
  const open = finiteAt(quote?.open, index, `No Yahoo Finance noon print on ${ymd}.`);
  const parts = etParts(timestamps[index]);
  const bar = `${parts.date}T${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}:00`;
  return { open, bar };
}

export async function fetchChart(
  symbol: string,
  period1: number,
  period2: number,
  interval: "1d" | "5m",
): Promise<ChartResult> {
  const url = new URL(`${CHART}${encodeURIComponent(vendorSymbol(symbol))}`);
  url.searchParams.set("period1", String(period1));
  url.searchParams.set("period2", String(period2));
  url.searchParams.set("interval", interval);
  url.searchParams.set("includeAdjustedClose", "true");
  url.searchParams.set("events", "div");
  const response = await fetch(url, {
    headers: { "user-agent": "GradedCallsFinTwit/accuracy-guard" },
  });
  if (!response.ok) {
    throw new Error(`Yahoo chart ${symbol} ${interval} returned ${response.status}. Refusing to grade from a gap.`);
  }
  const payload = (await response.json()) as { chart?: { result?: ChartResult[]; error?: { description?: string } } };
  const result = payload.chart?.result?.[0];
  if (!result) {
    throw new Error(
      `Yahoo chart ${symbol} ${interval} had no result. ${payload.chart?.error?.description ?? "Refusing to invent a print."}`,
    );
  }
  return result;
}

/** True when two prints show the same cent on the board. */
export function pricesAgree(displayed: number, fetched: number): boolean {
  return Math.round(displayed * 100) === Math.round(fetched * 100);
}

export function unix(ymd: string, hourUtc = 0): number {
  const [year, month, day] = ymd.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day, hourUtc) / 1000);
}
