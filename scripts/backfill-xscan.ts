/**
 * Append the July 27–October 21 backfill.
 * Clear rows inside a collect window become calls. Ambiguous rows stay in the queue.
 * A closed week is graded only when the existing scorer has a real Yahoo print.
 * Monday noon before the 60-day Yahoo 5-minute window stays pending.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { addCalendarDays, buildCohortWindow, calendarDayString, marketHoliday, parseCalendarDay } from "../src/lib/calendar";
import { mentionedSymbols } from "../src/lib/extract-call";
import { hasMarketHistory, sessionFor } from "../src/lib/quotes";
import { OCT19_X_SCOPE } from "../src/lib/search-scope";
import { SYMBOLS } from "../src/lib/demo-data";
import { loadWatchlist } from "../src/lib/watchlist";
import {
  CHECKPOINTS,
  INDEX_PRINT,
  CALLS_CSV_PATH,
  checkpointCalendar,
  checkpointDue,
  classifyCall,
  considerCheckpoint,
  expectedFlags,
  loadTape,
  parseCallCsv,
  parseCsv,
  serializeCallCsv,
  type CallRow,
  type Checkpoint,
} from "./calls-ledger";
import { LATER_CALL_REASON, exclusionReason, stampPending } from "../src/lib/book-policy";
import { etLabelToIso, serializePending, type PendingApprovalRow } from "./xscan-ingest";

const SOURCE_PATH = join(process.cwd(), "data/calls/sources/x-call-backfill-2026-07-27_10-21.csv");
const PENDING_PATH = join(process.cwd(), "data/calls/pending-approval.csv");

const OLD_X_SCOPE =
  "X was checked only from Friday, October 16 at 10:22 AM ET through Sunday, October 18 at 5:00 PM ET. X posts from Wednesday noon through Friday 10:22 AM ET were out of scope and were not searched. For this week, first means the first forward-looking post inside that searched range.";

const RECAP =
  /\b(stopped out|i exited|we exited|exited (my|the|at)|took profit|closed (my|the|out) (trade|position)|sold (my|the) (calls|puts|position))\b/i;

type ScanRow = {
  handle: string;
  display_name: string;
  post_url: string;
  posted_at_ET: string;
  ticker: string;
  direction: string;
  quote: string;
  type: string;
  ambiguous: string;
  timeframe: string;
};

export type BackfillPlan = {
  calls: CallRow[];
  pending: PendingApprovalRow[];
  counts: {
    scanRows: number;
    clearRows: number;
    ambiguousRows: number;
    calls: number;
    gradedCalls: number;
    deduped: number;
    outsideWindow: number;
    recaps: number;
    unnamed: number;
    notGradeable: number;
  };
};

function scanRows(text: string): ScanRow[] {
  const [header, ...records] = parseCsv(text);
  const index = new Map((header ?? []).map((name, place) => [name, place]));
  const cell = (record: string[], name: string) => record[index.get(name) ?? -1] ?? "";
  return records
    .filter((record) => record.some((value) => value !== ""))
    .map((record) => ({
      handle: cell(record, "handle").trim(),
      display_name: cell(record, "display_name").trim(),
      post_url: cell(record, "post_url").trim(),
      posted_at_ET: cell(record, "posted_at_ET").trim(),
      ticker: cell(record, "ticker").trim().toUpperCase(),
      direction: cell(record, "direction").trim().toLowerCase(),
      quote: cell(record, "quote").trim(),
      type: cell(record, "type").trim(),
      ambiguous: cell(record, "ambiguous").trim().toLowerCase(),
      timeframe: cell(record, "timeframe").trim(),
    }));
}

function pendingShape(row: ScanRow, reason: string): PendingApprovalRow {
  return {
    handle: row.handle,
    display_name: row.display_name,
    post_url: row.post_url,
    posted_at_ET: row.posted_at_ET,
    ticker: row.ticker,
    direction: row.direction,
    quote: row.quote,
    reason,
  };
}

function statusId(url: string): string | null {
  return /\/status\/(\d+)/.exec(url)?.[1] ?? null;
}

function ledgerDirection(value: string): "bullish" | "bearish" | null {
  if (value === "bullish" || value === "long") return "bullish";
  if (value === "bearish" || value === "short") return "bearish";
  return null;
}

function cohortMondays(): string[] {
  const slugs: string[] = [];
  let day = parseCalendarDay("2026-07-27");
  const last = parseCalendarDay("2026-10-26");
  while (calendarDayString(day) <= calendarDayString(last)) {
    slugs.push(calendarDayString(day));
    day = addCalendarDays(day, 7);
  }
  return slugs;
}

function cohortFor(iso: string): string | null {
  const posted = new Date(iso);
  for (const slug of cohortMondays()) {
    const window = buildCohortWindow(parseCalendarDay(slug));
    if (posted >= window.collectStart && posted <= window.collectEnd) return slug;
  }
  return null;
}

function longDate(slug: string): string {
  const [year, month, day] = slug.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day, 16)));
}

function freshSummary(slug: string): string {
  const monday = parseCalendarDay(slug);
  const prevWednesday = addCalendarDays(monday, -5);
  const sunday = addCalendarDays(monday, -1);
  const wednesday = addCalendarDays(monday, 2);
  const friday = addCalendarDays(monday, 4);
  const holiday = marketHoliday(calendarDayString(monday));
  const mondayLine = holiday
    ? `Monday, ${longDate(slug)} was a market holiday, so that checkpoint stays closed.`
    : hasMarketHistory(slug) && sessionFor(slug, "monday") == null
      ? `Monday noon is not stored. Yahoo Finance no longer serves the 12:00 PM ET 5-minute bar for ${longDate(slug)}, so that checkpoint stays ungraded.`
      : "Monday noon is recorded.";
  return [
    `Public X posts from ${longDate(calendarDayString(prevWednesday))} at 12:00 PM ET through ${longDate(calendarDayString(sunday))} at 5:00 PM ET.`,
    "Each card quotes the post and links the status. This is not a complete scrape.",
    mondayLine,
    `Wednesday, ${longDate(calendarDayString(wednesday))} and Friday, ${longDate(calendarDayString(friday))} are those days' official closes.`,
  ].join(" ");
}

export function reviseCohortSummary(slug: string, summary: string): string {
  let next = summary.replace("X watchlist not covered this week; Substack only. ", "");
  next = next.replace(OLD_X_SCOPE, OCT19_X_SCOPE);
  next = next.replace(
    "Wednesday, October 21 and Friday, October 23 are not graded yet.",
    "Wednesday, October 21 is the official close. Friday, October 23 is not graded yet.",
  );
  if (slug === "2026-10-26") {
    next = next.replace("Public X posts from October 22, 2026, inside the ", "Public X posts inside the ");
  }
  return next;
}

function blank(template: CallRow): CallRow {
  const row = { ...template };
  for (const key of Object.keys(row) as (keyof CallRow)[]) row[key] = "";
  return row;
}

function sourceKey(url: string, body: string, primary: string, direction: string): string {
  return `${url}\n${body}\n${primary}\n${direction}`;
}

function settleClosedWeek(row: CallRow, now: Date): { row: CallRow; ok: boolean; reason: string } {
  let current = row;
  let graded = 0;
  for (const kind of CHECKPOINTS) {
    const result = considerCheckpoint(current, kind, {
      now,
      due: checkpointDue(current.cohort_slug, kind, now),
      tape: loadTape(current.history_slug, current.primary, kind, current[`${kind}_date`]),
    });
    if (result.action === "graded" || result.action === "closed" || result.action === "unchanged") {
      if (result.action === "graded") graded += 1;
      current = result.row;
      continue;
    }
    if (result.action === "flagged" && result.detail.includes("print is missing")) {
      let session: ReturnType<typeof sessionFor> = null;
      try {
        session = sessionFor(current.history_slug, kind);
      } catch {
        session = null;
      }
      if (session == null) {
        current = result.row;
        continue;
      }
    }
    return { row: current, ok: false, reason: `${result.detail} Not graded.` };
  }
  if (graded === 0) return { row: current, ok: false, reason: "No checkpoint could be graded from a recorded print. Not graded." };
  return { row: current, ok: true, reason: "" };
}

export function planBackfill(scanText: string, existing: CallRow[], now: Date): BackfillPlan {
  const template = existing[0];
  if (!template) throw new Error("calls.csv has no template row.");
  const watch = new Set(loadWatchlist().map((account) => account.handle.toLowerCase()));
  const seen = new Set(existing.map((row) => sourceKey(row.source_url, row.body, row.primary, row.direction)));
  const usedIds = new Set(existing.map((row) => row.call_id));
  const pending: PendingApprovalRow[] = [];
  const chosen: { row: ScanRow; cohort: string; posted: string; direction: "bullish" | "bearish" }[] = [];
  let clearRows = 0;
  let ambiguousRows = 0;
  let deduped = 0;
  let outsideWindow = 0;
  let recaps = 0;
  let unnamed = 0;
  let notGradeable = 0;
  const rows = scanRows(scanText);

  for (const row of rows) {
    if (row.type !== "fintwit") continue;
    if (row.ambiguous === "true") {
      ambiguousRows += 1;
      pending.push(pendingShape(row, "ambiguous=true. Not graded."));
      continue;
    }
    if (row.ambiguous !== "false") continue;
    clearRows += 1;
    if (!/^[A-Za-z0-9_]{2,30}$/.test(row.handle)) {
      pending.push(pendingShape(row, "Handle is not a public token. Not graded."));
      continue;
    }
    if (!/^[A-Z]{1,5}$/.test(row.ticker)) {
      pending.push(pendingShape(row, "Ticker is not a single symbol token. Not graded."));
      continue;
    }
    const direction = ledgerDirection(row.direction);
    if (!direction) {
      pending.push(pendingShape(row, "Direction is not bullish or bearish. Not graded."));
      continue;
    }
    if (!row.quote || !/^https:\/\/x\.com\/[^/]+\/status\/\d+$/.test(row.post_url)) {
      pending.push(pendingShape(row, "Missing a verbatim quote or a public status URL. Not graded."));
      continue;
    }
    if (RECAP.test(row.quote)) {
      recaps += 1;
      pending.push(pendingShape(row, "Closed-trade recap, not a forward call. Not graded."));
      continue;
    }
    let posted = "";
    try {
      posted = etLabelToIso(row.posted_at_ET);
    } catch (error) {
      pending.push(pendingShape(row, error instanceof Error ? `${error.message} Not graded.` : "Missing a timestamp. Not graded."));
      continue;
    }
    const cohort = cohortFor(posted);
    if (!cohort) {
      outsideWindow += 1;
      pending.push(
        pendingShape(row, "Posted outside the Wednesday 12:00 PM ET through Sunday 5:00 PM ET collect window. Not graded."),
      );
      continue;
    }
    if (!mentionedSymbols(row.quote).includes(row.ticker)) {
      unnamed += 1;
      pending.push(pendingShape(row, "The verbatim quote does not name the ticker. Not graded."));
      continue;
    }
    const primary = INDEX_PRINT[row.ticker] ?? row.ticker;
    if (seen.has(sourceKey(row.post_url, row.quote, primary, direction))) {
      deduped += 1;
      continue;
    }
    chosen.push({ row, cohort, posted, direction });
  }

  const handleCount = new Map<string, number>();
  for (const row of existing) handleCount.set(`${row.cohort_slug}\n${row.handle}`, (handleCount.get(`${row.cohort_slug}\n${row.handle}`) ?? 0) + 1);
  for (const item of chosen) {
    const key = `${item.cohort}\n${item.row.handle}`;
    handleCount.set(key, (handleCount.get(key) ?? 0) + 1);
  }

  const calls: CallRow[] = [];
  for (const item of chosen) {
    const status = statusId(item.row.post_url);
    if (!status) {
      pending.push(pendingShape(item.row, "Missing a public status URL. Not graded."));
      continue;
    }
    const primary = INDEX_PRINT[item.row.ticker] ?? item.row.ticker;
    const many = (handleCount.get(`${item.cohort}\n${item.row.handle}`) ?? 0) > 1;
    let id = many ? `${item.cohort}__${item.row.handle}__${status}__${item.row.ticker}` : `${item.cohort}__${item.row.handle}`;
    const base = `${item.cohort}__${item.row.handle}__${status}__${item.row.ticker}`;
    let n = 2;
    while (usedIds.has(id)) {
      id = `${base}__${n}`;
      n += 1;
    }
    const [year, month, day] = item.cohort.split("-");
    const dates = checkpointCalendar(item.cohort);
    const prior = existing.find((row) => row.cohort_slug === item.cohort);
    const call = blank(template);
    call.call_id = id;
    call.cohort_slug = item.cohort;
    call.history_slug = item.cohort;
    call.cohort_title = prior?.cohort_title || "Verified weekend book";
    call.cohort_summary = prior?.cohort_summary || freshSummary(item.cohort);
    call.monday_year = String(Number(year));
    call.monday_month = String(Number(month));
    call.monday_day = String(Number(day));
    call.handle = item.row.handle;
    call.display_name = item.row.display_name || item.row.handle;
    call.bio = "Public X post. The card quotes the post and links the status.";
    call.posture = item.row.timeframe || "Not stated";
    call.accent = "#9a9aa3";
    call.bucket = watch.has(item.row.handle.toLowerCase()) ? "watchlist" : "viral";
    call.posted_at = item.posted;
    call.source_url = item.row.post_url;
    call.direction = item.direction;
    call.conviction = "medium";
    call.primary = primary;
    call.sentiment = item.direction === "bearish" ? "panic" : "meltup";
    call.tone_label = item.row.timeframe || "Not stated";
    call.engagement = "0";
    call.tickers = item.row.ticker;
    call.explicit = "true";
    call.levels = "[]";
    call.body = item.row.quote;
    call.verification = `Backfill row. Status ${item.row.post_url}. Posted ${item.row.posted_at_ET}. The quote names ${item.row.ticker}. Direction is ${item.direction}. No conviction word is stored; conviction is the ledger's unset value, medium. Engagement is 0.`;
    if (primary !== item.row.ticker) {
      call.verification += ` The board print is ${primary}.`;
    }
    call.ref_price = "";
    call.monday_date = dates.monday;
    call.monday_status = "PENDING";
    call.wednesday_date = dates.wednesday;
    call.wednesday_status = "PENDING";
    call.friday_date = dates.friday;
    call.friday_status = "PENDING";
    call.graded_at = "";
    call.grade_method = "";
    call.notes = `backfill-ticker=${item.row.ticker}`;
    call.data_source = "public";
    call.flags = expectedFlags(call);
    const issues = classifyCall(call);
    if (issues.errors.length > 0) {
      pending.push(pendingShape(item.row, `Ledger refused the row (${issues.errors.join("; ")}). Not graded.`));
      continue;
    }
    const policy = exclusionReason(call);
    if (policy) {
      notGradeable += 1;
      pending.push(pendingShape(item.row, policy));
      continue;
    }
    const open = buildCohortWindow(parseCalendarDay(item.cohort)).collectEnd.getTime() > now.getTime();
    let settled = call;
    if (!open) {
      if (!issues.autoPrint || !SYMBOLS.includes(primary)) {
        notGradeable += 1;
        const why = issues.ambiguous
          ? "post names more than one print"
          : !SYMBOLS.includes(primary)
            ? "symbol is not on the whitelist"
            : "the post does not name one whitelist print";
        pending.push(pendingShape(item.row, `${why}. Not graded.`));
        continue;
      }
      const result = settleClosedWeek(call, now);
      if (!result.ok) {
        notGradeable += 1;
        pending.push(pendingShape(item.row, result.reason));
        continue;
      }
      settled = result.row;
    }
    const key = sourceKey(settled.source_url, settled.body, settled.primary, settled.direction);
    if (seen.has(key) || usedIds.has(settled.call_id)) {
      deduped += 1;
      continue;
    }
    const earlier = [...existing, ...calls].some(
      (row) =>
        row.cohort_slug === settled.cohort_slug &&
        row.handle.toLowerCase() === settled.handle.toLowerCase() &&
        exclusionReason(row) == null &&
        (row.posted_at < settled.posted_at || (row.posted_at === settled.posted_at && row.call_id < settled.call_id)),
    );
    if (earlier) {
      notGradeable += 1;
      pending.push(pendingShape(item.row, LATER_CALL_REASON));
      continue;
    }
    seen.add(key);
    usedIds.add(settled.call_id);
    calls.push(settled);
  }

  return {
    calls,
    pending: pending.map(stampPending),
    counts: {
      scanRows: rows.length,
      clearRows,
      ambiguousRows,
      calls: calls.length,
      gradedCalls: calls.filter((row) => CHECKPOINTS.some((kind) => row[`${kind}_status`] === "GRADED")).length,
      deduped,
      outsideWindow,
      recaps,
      unnamed,
      notGradeable,
    },
  };
}

function byId(a: { call_id: string }, b: { call_id: string }): number {
  return a.call_id < b.call_id ? -1 : a.call_id > b.call_id ? 1 : 0;
}

function main() {
  const existing = parseCallCsv(readFileSync(CALLS_CSV_PATH, "utf8"));
  const before = new Map(existing.map((row) => [row.call_id, JSON.stringify(row)]));
  const plan = planBackfill(readFileSync(SOURCE_PATH, "utf8"), existing, new Date());
  const touched = new Set(plan.calls.map((row) => row.cohort_slug));
  for (const row of existing) {
    if (!touched.has(row.cohort_slug)) continue;
    row.cohort_summary = reviseCohortSummary(row.cohort_slug, row.cohort_summary);
  }
  for (const row of plan.calls) {
    const prior = existing.find((item) => item.cohort_slug === row.cohort_slug);
    if (!prior) continue;
    row.cohort_title = prior.cohort_title;
    row.cohort_summary = prior.cohort_summary;
    row.monday_year = prior.monday_year;
    row.monday_month = prior.monday_month;
    row.monday_day = prior.monday_day;
  }
  for (const row of existing) {
    const previous = before.get(row.call_id);
    const current = { ...row };
    if (!previous) continue;
    const restored = JSON.parse(previous) as CallRow;
    for (const key of Object.keys(restored) as (keyof CallRow)[]) {
      if (key === "cohort_summary") continue;
      if (row[key] !== restored[key]) {
        throw new Error(`Refusing to rewrite ${row.call_id} ${key}.`);
      }
    }
    void current;
  }
  const used = new Set(existing.map((row) => Number(row.export_index)));
  const total = existing.length + plan.calls.length;
  const free: number[] = [];
  for (let index = 0; index < total; index += 1) {
    if (!used.has(index)) free.push(index);
  }
  if (free.length !== plan.calls.length) {
    throw new Error(`export_index has ${free.length} open slots for ${plan.calls.length} backfill rows.`);
  }
  plan.calls.forEach((row, index) => {
    row.export_index = String(free[index]);
  });
  const merged = [...existing, ...plan.calls].sort(byId);
  writeFileSync(CALLS_CSV_PATH, serializeCallCsv(merged));
  const pendingText = readFileSync(PENDING_PATH, "utf8");
  const [header, ...records] = parseCsv(pendingText);
  const index = new Map((header ?? []).map((name, place) => [name, place]));
  const queued = new Set(
    records.map((record) => `${record[index.get("post_url") ?? -1] ?? ""}\n${record[index.get("ticker") ?? -1] ?? ""}\n${record[index.get("direction") ?? -1] ?? ""}`),
  );
  const extra = plan.pending.filter((row) => {
    const key = `${row.post_url}\n${row.ticker}\n${row.direction}`;
    if (queued.has(key)) return false;
    queued.add(key);
    return true;
  });
  const previousPending = records
    .filter((record) => record.some((value) => value !== ""))
    .map((record) => ({
      handle: record[index.get("handle") ?? 0] ?? "",
      display_name: record[index.get("display_name") ?? 1] ?? "",
      post_url: record[index.get("post_url") ?? 2] ?? "",
      posted_at_ET: record[index.get("posted_at_ET") ?? 3] ?? "",
      ticker: record[index.get("ticker") ?? 4] ?? "",
      direction: record[index.get("direction") ?? 5] ?? "",
      quote: record[index.get("quote") ?? 6] ?? "",
      reason: record[index.get("reason") ?? 7] ?? "",
    }));
  writeFileSync(PENDING_PATH, serializePending([...previousPending, ...extra]));
  console.log(JSON.stringify({ ...plan.counts, pendingAdded: extra.length, rows: merged.length }, null, 2));
}

const isDirectRun = process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) main();
