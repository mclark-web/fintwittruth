import fs from "node:fs";
import path from "node:path";
import {
  SETTLE_BUFFER_MINUTES,
  addCalendarDays,
  calendarDayString,
  earlyCloseNote,
  marketHoliday,
  parseCalendarDay,
  readoutCheckpoint,
} from "../src/lib/calendar";
import { planCheckpoint } from "../src/lib/settlement";
import { fetchChart, pricesAgree, readOfficialClose, unix } from "../src/lib/yahoo";

type Session = {
  date: string;
  session: "open" | "closed";
  reason?: string;
};

type SymbolHistory = {
  close: Record<string, number>;
  adjClose: Record<string, number>;
  dailyOpen: Record<string, number>;
  noonOpen: Record<string, number>;
  noonBar: Record<string, string>;
};

type HistoryFile = {
  source: string;
  fetchedAt: string;
  adjustment: string;
  closedMarketRule: string;
  futureRule: string;
  settleBufferMinutes?: number;
  checkpointRule?: string;
  symbols: Record<string, SymbolHistory>;
  cohorts: Record<
    string,
    {
      referenceDate: string;
      monday: Session | null;
      wednesday: Session | null;
      friday: Session | null;
    }
  >;
};

const historyPath = path.join(process.cwd(), "src/lib/market-history.json");

const ADJUSTMENT =
  "Weekend reference is the prior Friday regular-session close (Yahoo close) for SPY, QQQ, DIA, and VIX. That close is stored next to Yahoo adjclose for audit. Grades measure against the session close, not retrospectively dividend-rewritten adjclose, because the Monday open and the Monday 12:00 PM ET 5-minute open are not dividend-adjusted. Monday gap is Friday session close versus the regular-session daily open. Monday noon is the open of the 5-minute bar stamped 12:00 America/New_York. Wednesday and Friday grades use Yahoo's daily close, which is the official regular-session close: 4:00 PM ET, or 1:00 PM ET on an early-close day. A holiday has no equity daily bar and stays ungraded. No prior close is copied in.";

const CLOSED_RULE =
  "A closed cash session has no open, no Monday noon print, and no official close. The readout stays ungraded. No prior close is copied in to stand for the missing session. A Yahoo VIX bar on an equity holiday is ignored.";

const CHECKPOINT_RULE = `Monday grades use the 12:00 PM ET 5-minute open. Wednesday and Friday grades use the Yahoo daily close. Settlement waits ${SETTLE_BUFFER_MINUTES} minutes after the official cash close so the equity close and the VIX print are posted. An early close uses that day's 1:00 PM ET daily close. A missing bar is left blank.`;

type Print = { close: number; adjClose: number };

function sortNumbers(record: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)));
}

async function loadCloses(symbol: string, dates: string[]): Promise<Map<string, Print | null>> {
  const sorted = [...dates].sort();
  const daily = await fetchChart(symbol, unix(sorted[0]) - 86400, unix(sorted[sorted.length - 1]) + 86400 * 2, "1d");
  const map = new Map<string, Print | null>();
  for (const ymd of dates) {
    try {
      map.set(ymd, readOfficialClose(daily, ymd));
    } catch {
      map.set(ymd, null);
    }
  }
  return map;
}

function sessionOpen(current: Session | null, ymd: string, reason?: string): boolean {
  if (current?.session !== "open" || current.date !== ymd) return false;
  return (current.reason ?? undefined) === reason;
}

async function main() {
  const now = new Date();
  const file = JSON.parse(fs.readFileSync(historyPath, "utf8")) as HistoryFile;
  const symbols = Object.keys(file.symbols);
  const jobs: { slug: string; kind: "wednesday" | "friday"; ymd: string; at: Date }[] = [];
  for (const slug of Object.keys(file.cohorts)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(slug)) continue;
    const monday = parseCalendarDay(slug);
    for (const kind of ["wednesday", "friday"] as const) {
      const day = addCalendarDays(monday, kind === "wednesday" ? 2 : 4);
      const ymd = calendarDayString(day);
      jobs.push({ slug, kind, ymd, at: readoutCheckpoint(day, kind) });
    }
  }

  const dates = [...new Set(jobs.filter((job) => !marketHoliday(job.ymd)).map((job) => job.ymd))];
  const prints = new Map<string, Map<string, Print | null>>();
  for (const symbol of symbols) {
    prints.set(symbol, await loadCloses(symbol, dates));
  }

  const flags: string[] = [];
  let changed = false;
  const settled: string[] = [];
  const waiting: string[] = [];

  for (const job of jobs) {
    const cohort = file.cohorts[job.slug];
    const holiday = marketHoliday(job.ymd);
    const spy = prints.get("SPY")?.get(job.ymd) ?? null;
    const plan = planCheckpoint({
      ymd: job.ymd,
      checkpointAt: job.at,
      now,
      officialClose: holiday ? null : spy?.close ?? null,
    });
    const label = `${job.kind} ${job.ymd}`;

    if (plan === "closed") {
      const reason = holiday ?? "The cash session is closed.";
      const current = cohort[job.kind];
      if (current?.session !== "closed" || current.reason !== reason) {
        cohort[job.kind] = { date: job.ymd, session: "closed", reason };
        changed = true;
      }
      continue;
    }

    if (plan === "wait") {
      waiting.push(label);
      if (cohort[job.kind]?.session === "open") {
        flags.push(`${job.slug} ${label} is marked open before the ${SETTLE_BUFFER_MINUTES}-minute post-close buffer. Refusing to treat a live bar as the close.`);
      }
      continue;
    }

    if (plan === "flag") {
      flags.push(`${label} is due and Yahoo has no official equity close. Refusing to invent a print.`);
      continue;
    }

    const missing = symbols.filter((symbol) => prints.get(symbol)?.get(job.ymd) == null);
    if (missing.length > 0) {
      flags.push(`${label} is due but Yahoo has no official close for ${missing.join(", ")}. Refusing to invent a print.`);
      continue;
    }

    for (const symbol of symbols) {
      const bar = prints.get(symbol)?.get(job.ymd);
      if (!bar) continue;
      const series = file.symbols[symbol];
      const stored = series.close[job.ymd];
      if (stored == null || !pricesAgree(stored, bar.close)) {
        series.close[job.ymd] = bar.close;
        changed = true;
      }
      const storedAdj = series.adjClose[job.ymd];
      if (storedAdj == null || !pricesAgree(storedAdj, bar.adjClose)) {
        series.adjClose[job.ymd] = bar.adjClose;
        changed = true;
      }
      console.log(`ok ${symbol} ${job.ymd} official close ${bar.close}`);
    }

    const early = earlyCloseNote(job.ymd) ?? undefined;
    if (!sessionOpen(cohort[job.kind], job.ymd, early)) {
      cohort[job.kind] = early
        ? { date: job.ymd, session: "open", reason: early }
        : { date: job.ymd, session: "open" };
      changed = true;
    }
    settled.push(label);
  }

  if (flags.length > 0) {
    console.error("FLAG: settlement did not invent prices:");
    for (const line of flags) console.error(`- ${line}`);
    process.exit(1);
  }

  if (changed) {
    for (const series of Object.values(file.symbols)) {
      series.close = sortNumbers(series.close);
      series.adjClose = sortNumbers(series.adjClose);
    }
    file.fetchedAt = now.toISOString();
    file.adjustment = ADJUSTMENT;
    file.closedMarketRule = CLOSED_RULE;
    file.settleBufferMinutes = SETTLE_BUFFER_MINUTES;
    file.checkpointRule = CHECKPOINT_RULE;
    file.futureRule =
      waiting.length > 0
        ? `${waiting.join(", ")} had not reached the ${SETTLE_BUFFER_MINUTES}-minute post-close buffer at fetch time. Those readouts stay ungraded. Settled from the official daily close: ${settled.join(", ")}.`
        : `Every stored Wednesday and Friday checkpoint is the official daily close. Settlement waits ${SETTLE_BUFFER_MINUTES} minutes after the cash close.`;
    fs.writeFileSync(historyPath, `${JSON.stringify(file, null, 2)}\n`);
    console.log(`Wrote ${path.relative(process.cwd(), historyPath)}`);
  } else {
    console.log("No checkpoint changes. Due closes already match Yahoo.");
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
