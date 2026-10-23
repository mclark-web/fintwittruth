/**
 * Add the August 3, 10, and 17 cohorts from Yahoo daily bars.
 * Monday noon is not stored: Yahoo only serves 5-minute bars for 60 days.
 * An existing close is left as stored. A disagreement is a refusal.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { fetchChart, pricesAgree, readDailyBar, unix } from "../src/lib/yahoo";

type Series = {
  close: Record<string, number>;
  adjClose: Record<string, number>;
  dailyOpen: Record<string, number>;
  noonOpen: Record<string, number>;
  noonBar: Record<string, string>;
};

type HistoryFile = {
  fetchedAt: string;
  symbols: Record<string, Series>;
  cohorts: Record<
    string,
    {
      referenceDate: string;
      monday: { date: string; session: string; reason?: string } | null;
      wednesday: { date: string; session: string; reason?: string } | null;
      friday: { date: string; session: string; reason?: string } | null;
    }
  >;
};

const historyPath = join(process.cwd(), "src/lib/market-history.json");

const DATES = [
  "2026-07-31",
  "2026-08-03",
  "2026-08-05",
  "2026-08-07",
  "2026-08-10",
  "2026-08-12",
  "2026-08-14",
  "2026-08-17",
  "2026-08-19",
  "2026-08-21",
];

const COHORTS = {
  "2026-08-03": { referenceDate: "2026-07-31", wednesday: "2026-08-05", friday: "2026-08-07" },
  "2026-08-10": { referenceDate: "2026-08-07", wednesday: "2026-08-12", friday: "2026-08-14" },
  "2026-08-17": { referenceDate: "2026-08-14", wednesday: "2026-08-19", friday: "2026-08-21" },
} as const;

function sortRecord<T>(record: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)));
}

function keepOrFill(stored: number | undefined, incoming: number, label: string): number {
  if (stored == null) return incoming;
  if (!pricesAgree(stored, incoming)) {
    throw new Error(`Refusing ${label}. Stored ${stored} and Yahoo ${incoming} are not the same cent.`);
  }
  return stored;
}

async function main() {
  const file = JSON.parse(readFileSync(historyPath, "utf8")) as HistoryFile;
  const symbols = Object.keys(file.symbols);
  const daily = new Map<string, Awaited<ReturnType<typeof fetchChart>>>();
  const period1 = unix(DATES[0]) - 86400;
  const period2 = unix(DATES[DATES.length - 1]) + 86400 * 2;
  for (const symbol of symbols) {
    daily.set(symbol, await fetchChart(symbol, period1, period2, "1d"));
  }

  for (const symbol of symbols) {
    const chart = daily.get(symbol);
    if (!chart) throw new Error(`No Yahoo chart for ${symbol}.`);
    const series = file.symbols[symbol];
    for (const date of DATES) {
      const bar = readDailyBar(chart, date);
      series.close[date] = keepOrFill(series.close[date], bar.close, `${symbol} ${date} close`);
      // A stored adjclose stays. Yahoo rewrites it after dividends; grades do not use it.
      if (series.adjClose[date] == null) series.adjClose[date] = bar.adjClose;
      series.dailyOpen[date] = keepOrFill(series.dailyOpen[date], bar.open, `${symbol} ${date} open`);
    }
    series.close = sortRecord(series.close);
    series.adjClose = sortRecord(series.adjClose);
    series.dailyOpen = sortRecord(series.dailyOpen);
  }

  const added: string[] = [];
  const cohorts = { ...file.cohorts };
  for (const [slug, spec] of Object.entries(COHORTS)) {
    const next = {
      referenceDate: spec.referenceDate,
      monday: null,
      wednesday: { date: spec.wednesday, session: "open" },
      friday: { date: spec.friday, session: "open" },
    };
    const current = cohorts[slug];
    if (current) {
      if (
        current.referenceDate !== next.referenceDate ||
        current.monday != null ||
        current.wednesday?.date !== spec.wednesday ||
        current.friday?.date !== spec.friday
      ) {
        throw new Error(`Cohort ${slug} is already stored with a different calendar.`);
      }
    } else {
      added.push(slug);
    }
    cohorts[slug] = next;
  }
  const ordered = Object.fromEntries(Object.entries(cohorts).sort(([a], [b]) => a.localeCompare(b)));
  file.cohorts = ordered;
  file.fetchedAt = new Date().toISOString();
  writeFileSync(historyPath, `${JSON.stringify(file, null, 2)}\n`);
  console.log(JSON.stringify({ added, dates: DATES.length, symbols: symbols.length, fetchedAt: file.fetchedAt }));
}

const isDirectRun = process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
