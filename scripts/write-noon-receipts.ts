/**
 * Write the raw Yahoo bodies behind Monday noon.
 * The accuracy guard fails a due Monday that has no committed receipt.
 * This step writes those files, and a 1-minute receipt when the 5-minute
 * open is a possible filled bar, so Monday does not need a hand edit.
 * A stored noon print is not replaced.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildCohortWindow, marketHoliday, settlementIsDue } from "../src/lib/calendar";
import { etYmd, formatPrice, lastTradingDayBeforeWeekend } from "../src/lib/format";
import { liveFile } from "../src/lib/live-book";
import {
  NOON_LIVE_PULLS,
  chartFromRaw,
  expectedMinuteRequest,
  expectedNoonRequest,
  loadMinuteReceipt,
  loadNoonReceipt,
  minuteReceiptPath,
  noonBarStamp,
  noonMajority,
  noonReceiptDocument,
  noonReceiptPath,
  noonToStore,
  readNoonReading,
  resolvedNoonOpen,
  verifyMinuteReceipt,
  verifyNoonReceipt,
  type NoonInterval,
  type NoonReading,
  type NoonReceipt,
  type NoonVote,
} from "../src/lib/noon-receipt";
import { TAPE_DISPLAY } from "../src/lib/prints";
import { fetchChart, fetchChartText, pricesAgree, readDailyBar, readOfficialClose, unix } from "../src/lib/yahoo";

type Session = { date: string; session: "open" | "closed"; reason?: string } | null;

type SymbolHistory = {
  close: Record<string, number>;
  adjClose: Record<string, number>;
  dailyOpen: Record<string, number>;
  noonOpen: Record<string, number>;
  noonBar: Record<string, string>;
};

type HistoryFile = {
  fetchedAt: string;
  symbols: Record<string, SymbolHistory>;
  cohorts: Record<
    string,
    {
      referenceDate: string;
      monday: Session;
      wednesday: Session;
      friday: Session;
    }
  >;
};

const historyPath = path.join(process.cwd(), "src/lib/market-history.json");

export function newestDueMonday(
  live: readonly { slug: string; mondayAt: Date }[],
  now: Date,
): string | null {
  const due = live.filter((cohort) => settlementIsDue(cohort.mondayAt, now));
  due.sort((a, b) => b.mondayAt.getTime() - a.mondayAt.getTime());
  return due[0]?.slug ?? null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function referenceYmd(monday: string): string {
  const [year, month, day] = monday.split("-").map(Number);
  return etYmd(lastTradingDayBeforeWeekend(buildCohortWindow({ year, month, day }).mondayAt));
}

function sortNumbers(record: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)));
}

function sortStrings(record: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)));
}

type Pull = {
  vote: NoonVote;
  raw: string | null;
  reading: NoonReading | null;
};

async function pullMajority(symbol: string, date: string, interval: NoonInterval): Promise<Pull> {
  const request = interval === "1m" ? expectedMinuteRequest(symbol, date) : expectedNoonRequest(symbol, date);
  const opens: number[] = [];
  const pulls: { raw: string; reading: NoonReading }[] = [];
  for (let pull = 1; pull <= NOON_LIVE_PULLS; pull += 1) {
    if (pull > 1) await sleep(400);
    const raw = await fetchChartText(request.url);
    const reading = readNoonReading(chartFromRaw(raw), date);
    opens.push(reading.open);
    pulls.push({ raw, reading });
    if (reading.filled) {
      console.log(
        `advisory ${symbol} ${date} ${interval} pull ${pull} possible filled bar: 12:00 open equals the previous bar close`,
      );
    }
  }
  const vote = noonMajority(opens);
  if (vote.status !== "agree") return { vote, raw: null, reading: null };
  const chosen = pulls.find((item) => pricesAgree(item.reading.open, vote.open));
  return { vote, raw: chosen?.raw ?? null, reading: chosen?.reading ?? null };
}

function writeReceipt(receipt: NoonReceipt) {
  const file = receipt.interval === "1m" ? minuteReceiptPath(receipt.date, receipt.symbol) : noonReceiptPath(receipt.date, receipt.symbol);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(`wrote ${path.relative(process.cwd(), file)}`);
}

function saveReceipt(symbol: string, date: string, interval: NoonInterval, raw: string) {
  writeReceipt(
    noonReceiptDocument({
      symbol,
      date,
      interval,
      fetchedAt: new Date().toISOString(),
      raw,
    }),
  );
}

async function confirmFilled(symbol: string, date: string, committedOpen: number) {
  console.log(`advisory ${symbol} ${date} possible filled bar: 12:00 open equals the previous bar close`);
  const five = await pullMajority(symbol, date, "5m");
  const one = await pullMajority(symbol, date, "1m");
  if (five.vote.status !== "agree" || !five.raw || !five.reading || one.vote.status !== "agree" || !one.raw || !one.reading) {
    throw new Error(`${symbol} ${date} Yahoo unstable. Refusing to invent a noon print.`);
  }
  console.log(
    `advisory ${symbol} ${date} 5-minute majority ${formatPrice(five.vote.open)}; 1-minute majority ${formatPrice(one.vote.open)}`,
  );
  const resolved = resolvedNoonOpen(five.reading, one.reading);
  if (!resolved.ok) throw new Error(`${symbol} ${date} ${resolved.message}`);
  console.log(`advisory ${symbol} ${date} ${resolved.note}`);
  if (pricesAgree(committedOpen, five.reading.open)) {
    saveReceipt(symbol, date, "5m", five.raw);
  } else {
    console.log(
      `advisory ${symbol} ${date} live 5-minute majority ${formatPrice(five.reading.open)} differs from committed ${formatPrice(committedOpen)}. The committed 5-minute receipt stays.`,
    );
  }
  if (!pricesAgree(committedOpen, one.reading.open)) {
    throw new Error(
      `${symbol} ${date} 1-minute majority ${formatPrice(one.reading.open)} does not confirm committed ${formatPrice(committedOpen)}. A filled open is not the grade, and this pull does not replace the stored print.`,
    );
  }
  saveReceipt(symbol, date, "1m", one.raw);
  console.log(
    `advisory ${symbol} ${date} 1-minute 12:00 open ${formatPrice(one.reading.open)} confirms the committed print. The filled flag stays. The grade stays ${formatPrice(committedOpen)}.`,
  );
}

async function ensureAuditReceipt(symbol: string, date: string, storedOpen: number | null) {
  if (!existsSync(noonReceiptPath(date, symbol))) {
    const open = await writeMissingFiveMinute(symbol, date);
    const held = noonToStore(storedOpen, open);
    if ("error" in held) throw new Error(`${symbol} ${date} noon ${held.error}`);
    return;
  }
  const reading = verifyNoonReceipt(loadNoonReceipt(date, symbol));
  if (!reading.filled) {
    console.log(`ok ${symbol} ${date} 5-minute receipt ${formatPrice(reading.open)}`);
    return;
  }
  if (existsSync(minuteReceiptPath(date, symbol))) {
    const minute = verifyMinuteReceipt(loadMinuteReceipt(date, symbol));
    const resolved = resolvedNoonOpen(reading, minute);
    if (!resolved.ok || !resolved.confirmed || !pricesAgree(reading.open, resolved.open)) {
      throw new Error(`${symbol} ${date} 1-minute receipt does not confirm the committed 5-minute open. A filled open is not the grade.`);
    }
    console.log(
      `advisory ${symbol} ${date} possible filled bar: 12:00 open equals the previous bar close`,
    );
    console.log(
      `advisory ${symbol} ${date} 1-minute 12:00 open ${formatPrice(minute.open)} confirms the 5-minute print. The filled flag stays. The grade stays ${formatPrice(resolved.open)}.`,
    );
    return;
  }
  await confirmFilled(symbol, date, reading.open);
}

async function writeMissingFiveMinute(symbol: string, date: string) {
  const five = await pullMajority(symbol, date, "5m");
  if (five.vote.status !== "agree" || !five.raw || !five.reading) {
    throw new Error(`${symbol} ${date} Yahoo unstable. Refusing to invent a noon print.`);
  }
  let minuteReading: NoonReading | null = null;
  let minuteRaw: string | null = null;
  if (five.reading.filled) {
    console.log(`advisory ${symbol} ${date} possible filled bar: 12:00 open equals the previous bar close`);
    const one = await pullMajority(symbol, date, "1m");
    if (one.vote.status !== "agree" || !one.raw || !one.reading) {
      throw new Error(`${symbol} ${date} 1-minute Yahoo unstable. A filled open is not the grade.`);
    }
    minuteReading = one.reading;
    minuteRaw = one.raw;
  }
  const resolved = resolvedNoonOpen(five.reading, minuteReading);
  if (!resolved.ok) throw new Error(`${symbol} ${date} ${resolved.message}`);
  if (resolved.note) console.log(`advisory ${symbol} ${date} ${resolved.note}`);
  saveReceipt(symbol, date, "5m", five.raw);
  if (minuteRaw) saveReceipt(symbol, date, "1m", minuteRaw);
  return resolved.open;
}

async function storeDailyOpen(file: HistoryFile, symbol: string, date: string) {
  const daily = await fetchChart(symbol, unix(date) - 86400, unix(date) + 86400 * 2, "1d");
  const bar = readDailyBar(daily, date);
  const series = file.symbols[symbol];
  const held = noonToStore(series.dailyOpen[date] ?? null, bar.open);
  if ("error" in held) throw new Error(`${symbol} ${date} daily open ${held.error}`);
  if (series.dailyOpen[date] == null) {
    series.dailyOpen[date] = bar.open;
    series.dailyOpen = sortNumbers(series.dailyOpen);
    console.log(`recorded ${symbol} ${date} daily open ${formatPrice(bar.open)}`);
  }
}

async function storeReferenceClose(file: HistoryFile, symbol: string, date: string) {
  const daily = await fetchChart(symbol, unix(date) - 86400, unix(date) + 86400 * 2, "1d");
  const bar = readOfficialClose(daily, date);
  const series = file.symbols[symbol];
  if (series.close[date] == null) {
    series.close[date] = bar.close;
    series.close = sortNumbers(series.close);
    console.log(`recorded ${symbol} ${date} reference close ${formatPrice(bar.close)}`);
  }
  if (series.adjClose[date] == null) {
    series.adjClose[date] = bar.adjClose;
    series.adjClose = sortNumbers(series.adjClose);
  }
}

async function storeNoon(file: HistoryFile, symbol: string, date: string, audit: boolean) {
  const series = file.symbols[symbol];
  let resolvedOpen: number;
  if (existsSync(noonReceiptPath(date, symbol))) {
    const five = verifyNoonReceipt(loadNoonReceipt(date, symbol));
    if (five.filled && !existsSync(minuteReceiptPath(date, symbol))) {
      resolvedOpen = five.open;
    } else {
      const minute = five.filled ? verifyMinuteReceipt(loadMinuteReceipt(date, symbol)) : null;
      const resolved = resolvedNoonOpen(five, minute);
      if (!resolved.ok) throw new Error(`${symbol} ${date} ${resolved.message}`);
      resolvedOpen = resolved.open;
    }
  } else {
    resolvedOpen = await writeMissingFiveMinute(symbol, date);
  }
  const held = noonToStore(series.noonOpen[date] ?? null, resolvedOpen);
  if ("error" in held) throw new Error(`${symbol} ${date} noon ${held.error}`);
  if (!audit && series.noonOpen[date] != null) return;
  if (series.noonOpen[date] == null) {
    series.noonOpen[date] = held.open;
    series.noonOpen = sortNumbers(series.noonOpen);
    series.noonBar[date] = noonBarStamp(date);
    series.noonBar = sortStrings(series.noonBar);
    console.log(`recorded ${symbol} ${date} noon ${formatPrice(held.open)}`);
  }
}

async function recordMonday(file: HistoryFile, date: string, audit: Set<string>): Promise<boolean> {
  const holiday = marketHoliday(date);
  if (holiday) {
    if (file.cohorts[date]?.monday?.session === "closed") {
      console.log(`ok ${date} closed session stays blank`);
      return false;
    }
    file.cohorts[date] = {
      referenceDate: file.cohorts[date]?.referenceDate ?? referenceYmd(date),
      monday: { date, session: "closed", reason: holiday },
      wednesday: file.cohorts[date]?.wednesday ?? null,
      friday: file.cohorts[date]?.friday ?? null,
    };
    console.log(`recorded ${date} Monday closed`);
    return true;
  }
  const reference = file.cohorts[date]?.referenceDate ?? referenceYmd(date);
  let changed = file.cohorts[date] == null;
  for (const symbol of Object.keys(file.symbols)) {
    if (file.symbols[symbol].close[reference] == null) {
      await storeReferenceClose(file, symbol, reference);
      changed = true;
    }
    if (file.symbols[symbol].dailyOpen[date] == null) {
      await storeDailyOpen(file, symbol, date);
      changed = true;
    }
    const before = file.symbols[symbol].noonOpen[date];
    await storeNoon(file, symbol, date, audit.has(symbol));
    if (file.symbols[symbol].noonOpen[date] !== before) changed = true;
    if (audit.has(symbol)) await ensureAuditReceipt(symbol, date, file.symbols[symbol].noonOpen[date] ?? null);
  }
  if (file.cohorts[date]?.monday?.session !== "open" || file.cohorts[date]?.monday?.date !== date) {
    file.cohorts[date] = {
      referenceDate: reference,
      monday: { date, session: "open" },
      wednesday: file.cohorts[date]?.wednesday ?? null,
      friday: file.cohorts[date]?.friday ?? null,
    };
    changed = true;
    console.log(`recorded ${date} Monday noon session`);
  }
  return changed;
}

async function main() {
  const now = new Date();
  const live = liveFile().cohorts.map((cohort) => {
    const [year, month, day] = cohort.slug.split("-").map(Number);
    return {
      slug: cohort.slug,
      mondayAt: buildCohortWindow({ year, month, day }).mondayAt,
      primaries: cohort.calls.map((call) => call.primary),
    };
  });
  const date = newestDueMonday(live, now);
  if (!date) {
    console.log("No Monday noon is due.");
    return;
  }
  const target = live.find((cohort) => cohort.slug === date);
  const file = JSON.parse(readFileSync(historyPath, "utf8")) as HistoryFile;
  const priced = new Set(Object.keys(file.symbols));
  const audit = new Set([...TAPE_DISPLAY, ...(target?.primaries ?? [])].filter((symbol) => priced.has(symbol)));
  if (file.cohorts[date]?.monday?.session === "open" && file.symbols.SPY?.noonOpen[date] != null) {
    for (const symbol of audit) await ensureAuditReceipt(symbol, date, file.symbols[symbol]?.noonOpen[date] ?? null);
    console.log(`Monday noon receipts are committed for ${date}.`);
    return;
  }
  const changed = await recordMonday(file, date, audit);
  if (changed) {
    file.fetchedAt = now.toISOString();
    writeFileSync(historyPath, `${JSON.stringify(file, null, 2)}\n`);
    console.log(`Wrote ${path.relative(process.cwd(), historyPath)}`);
  }
  console.log(`Monday noon receipts are committed for ${date}.`);
}

const isDirectRun = process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
