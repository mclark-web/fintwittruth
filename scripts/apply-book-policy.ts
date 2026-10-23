/**
 * Move single-name, same-day, and extra calls off the graded book.
 * Grade cells on a kept row stay as they are. export_index is renumbered.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { addCalendarDays, calendarDayString, parseCalendarDay } from "../src/lib/calendar";
import { partitionBook, pendingFromCall, pendingKey, stampPending, type PolicyPendingRow } from "./book-policy";
import { CALLS_CSV_PATH, parseCallCsv, parseCsv, serializeCallCsv, type CallRow } from "./calls-ledger";
import { planBackfill } from "./backfill-xscan";
import { ingestXScan, readScanFile, serializePending } from "./xscan-ingest";

const PENDING_PATH = join(process.cwd(), "data/calls/pending-approval.csv");
const CHECKED_PATH = join(process.cwd(), "data/calls/checked-weeks.csv");
const BACKFILL_PATH = join(process.cwd(), "data/calls/sources/x-call-backfill-2026-07-27_10-21.csv");
const SCAN_PATH = join(process.cwd(), "data/calls/sources/x-call-scan-2026-10-22.csv");

function pendingRows(text: string): PolicyPendingRow[] {
  const [header, ...records] = parseCsv(text);
  const index = new Map((header ?? []).map((name, place) => [name, place]));
  const cell = (record: string[], name: string) => record[index.get(name) ?? -1] ?? "";
  return records
    .filter((record) => record.some((value) => value !== ""))
    .map((record) => ({
      handle: cell(record, "handle"),
      display_name: cell(record, "display_name"),
      post_url: cell(record, "post_url"),
      posted_at_ET: cell(record, "posted_at_ET"),
      ticker: cell(record, "ticker"),
      direction: cell(record, "direction"),
      quote: cell(record, "quote"),
      reason: cell(record, "reason"),
    }));
}

function upsert(rows: PolicyPendingRow[], row: PolicyPendingRow) {
  const key = pendingKey(row);
  const found = rows.find((item) => pendingKey(item) === key);
  if (!found) {
    rows.push(row);
    return;
  }
  found.reason = row.reason;
  found.direction = row.direction;
  if (!found.quote) found.quote = row.quote;
  if (!found.display_name) found.display_name = row.display_name;
  if (!found.posted_at_ET) found.posted_at_ET = row.posted_at_ET;
}

function emptiedWeeks(before: CallRow[], keep: CallRow[]): string[] {
  const had = new Set(before.map((row) => row.cohort_slug));
  const still = new Set(keep.map((row) => row.cohort_slug));
  return [...had].filter((slug) => !still.has(slug)).sort();
}

function coverageLines(slugs: string[], existing: string): string[] {
  const present = new Set(
    existing
      .split(/\r?\n/)
      .map((line) => line.split(",")[0]?.trim())
      .filter((slug) => slug && slug !== "week"),
  );
  return slugs
    .filter((slug) => !present.has(slug))
    .map(
      (slug) =>
        `${slug},Public X posts in this window were read in the backfill. None remain on a graded print. Not a complete scrape.,x`,
    );
}

function mondaysBetween(slugs: string[]): string[] {
  if (slugs.length === 0) return [];
  const sorted = [...slugs].sort();
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (!first || !last) return [];
  const out: string[] = [];
  let day = parseCalendarDay(first);
  for (let i = 0; i < 104; i += 1) {
    const slug = calendarDayString(day);
    if (slug > last) break;
    out.push(slug);
    day = addCalendarDays(day, 7);
  }
  return out;
}

function main() {
  const before = parseCallCsv(readFileSync(CALLS_CSV_PATH, "utf8"));
  const snapshot = new Map(before.map((row) => [row.call_id, { ...row }]));
  const { keep, queue } = partitionBook(before);
  const ordered = keep
    .slice()
    .sort((a, b) => Number(a.export_index) - Number(b.export_index))
    .map((row, index) => ({ ...row, export_index: String(index) }));
  for (const row of ordered) {
    const prev = snapshot.get(row.call_id);
    if (!prev) throw new Error(`Kept a row that was not in the book: ${row.call_id}`);
    for (const key of Object.keys(prev) as (keyof CallRow)[]) {
      if (key === "export_index") continue;
      if (row[key] !== prev[key]) throw new Error(`Refusing to rewrite ${row.call_id} ${key}.`);
    }
  }
  const written = ordered.slice().sort((a, b) => (a.call_id < b.call_id ? -1 : a.call_id > b.call_id ? 1 : 0));
  writeFileSync(CALLS_CSV_PATH, serializeCallCsv(written));

  const pending = pendingRows(readFileSync(PENDING_PATH, "utf8")).map(stampPending);
  for (const item of queue) upsert(pending, pendingFromCall(item.row, item.reason));

  const ingested = ingestXScan(readScanFile(SCAN_PATH), written[0]);
  const plan = planBackfill(readFileSync(BACKFILL_PATH, "utf8"), written, new Date("2026-10-23T03:00:00.000Z"));
  for (const row of plan.pending) upsert(pending, row);
  for (const row of ingested.pending) upsert(pending, row);
  if (plan.calls.length !== 0) {
    throw new Error(`Backfill would republish ${plan.calls.length} calls after the trim.`);
  }
  for (const call of ingested.calls) {
    if (!written.some((row) => row.call_id === call.call_id && row.source_url === call.source_url)) {
      throw new Error(`Scan call ${call.call_id} is not on the trimmed book.`);
    }
  }
  writeFileSync(PENDING_PATH, serializePending(pending));

  const keptSlugs = written.map((row) => row.cohort_slug);
  const gaps = mondaysBetween(keptSlugs).filter((slug) => !keptSlugs.includes(slug));
  const emptied = emptiedWeeks(before, written);
  const checked = readFileSync(CHECKED_PATH, "utf8").replace(/\s*$/, "");
  const extra = coverageLines([...new Set([...emptied, ...gaps])], checked);
  if (extra.length) writeFileSync(CHECKED_PATH, `${checked}\n${extra.join("\n")}\n`);

  const graded = written.filter((row) =>
    (["monday", "wednesday", "friday"] as const).some((kind) => row[`${kind}_status`] === "GRADED"),
  );
  const byWeek: Record<string, { calls: number; graded: number; checkpoints: number }> = {};
  for (const row of written) {
    const bucket = byWeek[row.cohort_slug] ?? { calls: 0, graded: 0, checkpoints: 0 };
    bucket.calls += 1;
    const checkpoints = (["monday", "wednesday", "friday"] as const).filter((kind) => row[`${kind}_status`] === "GRADED").length;
    if (checkpoints > 0) bucket.graded += 1;
    bucket.checkpoints += checkpoints;
    byWeek[row.cohort_slug] = bucket;
  }
  console.log(
    JSON.stringify(
      {
        before: before.length,
        kept: written.length,
        queued: queue.length,
        pending: pending.length,
        gradedCalls: graded.length,
        gradedCheckpoints: graded.reduce(
          (sum, row) =>
            sum + (["monday", "wednesday", "friday"] as const).filter((kind) => row[`${kind}_status`] === "GRADED").length,
          0,
        ),
        accounts: new Set(graded.map((row) => row.handle)).size,
        backfillCalls: plan.counts.calls,
        backfillDeduped: plan.counts.deduped,
        backfillNotGradeable: plan.counts.notGradeable,
        scanCalls: ingested.counts.calls,
        emptied,
        gaps,
        byWeek,
      },
      null,
      2,
    ),
  );
}

const isDirectRun = process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) main();
