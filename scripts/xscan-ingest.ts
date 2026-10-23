/**
 * Turn a dated X scan into ledger rows.
 * Clear FinTwit rows become calls. Ambiguous rows stay in the approval queue.
 * A checkpoint that is not due stays PENDING. Nothing here invents a price.
 */
import { readFileSync } from "node:fs";
import { zonedToUtc } from "../src/lib/calendar";
import { mentionedSymbols } from "../src/lib/extract-call";
import { loadWatchlist } from "../src/lib/watchlist";
import {
  INDEX_PRINT,
  checkpointCalendar,
  classifyCall,
  expectedFlags,
  parseCsv,
  type CallRow,
} from "./calls-ledger";

export const XSCAN_COHORT = "2026-10-26";

const COHORT_TITLE = "Verified weekend book";
const COHORT_SUMMARY =
  "Public X posts from October 22, 2026, inside the Wednesday, October 21, 12:00 PM ET through Sunday, October 25, 5:00 PM ET collect window. Each card quotes the scan text and links the status. Monday, October 26 at noon is not graded yet. This is not a complete scrape.";

export type PendingApprovalRow = {
  handle: string;
  display_name: string;
  post_url: string;
  posted_at_ET: string;
  ticker: string;
  direction: string;
  quote: string;
  reason: string;
};

export type XScanIngest = {
  calls: CallRow[];
  pending: PendingApprovalRow[];
  counts: {
    scanRows: number;
    fintwitRows: number;
    clearRows: number;
    calls: number;
    quotedCalls: number;
    unquotedCalls: number;
    ambiguousRows: number;
    pendingRows: number;
    bankRows: number;
  };
};

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

export function etLabelToIso(label: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2}) ET$/.exec(label);
  if (!match) throw new Error(`Refusing to invent a timestamp for ${label || "(blank)"}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const at = zonedToUtc(year, month, day, hour, minute);
  return new Date(at.getTime() + second * 1000).toISOString();
}

function statusId(url: string): string | null {
  const match = /\/status\/(\d+)/.exec(url);
  return match?.[1] ?? null;
}

function blank(existing: CallRow): CallRow {
  const row = { ...existing };
  for (const key of Object.keys(row) as (keyof CallRow)[]) row[key] = "";
  return row;
}

export function ingestXScan(scanText: string, template: CallRow): XScanIngest {
  const rows = scanRows(scanText);
  const watch = new Set(loadWatchlist().map((account) => account.handle.toLowerCase()));
  const dates = checkpointCalendar(XSCAN_COHORT);
  const pending: PendingApprovalRow[] = [];
  const chosen: ScanRow[] = [];
  let fintwitRows = 0;
  let clearRows = 0;
  let ambiguousRows = 0;
  let bankRows = 0;

  for (const row of rows) {
    if (row.type === "bank_analyst") {
      bankRows += 1;
      continue;
    }
    if (row.type !== "fintwit") continue;
    fintwitRows += 1;
    if (row.ambiguous === "true") {
      ambiguousRows += 1;
      pending.push({
        handle: row.handle,
        display_name: row.display_name,
        post_url: row.post_url,
        posted_at_ET: row.posted_at_ET,
        ticker: row.ticker,
        direction: row.direction,
        quote: row.quote,
        reason: "ambiguous=true. Not graded.",
      });
      continue;
    }
    if (row.ambiguous !== "false") continue;
    clearRows += 1;
    if (!/^[A-Z]{1,5}$/.test(row.ticker)) {
      pending.push({ ...pendingShape(row), reason: "Ticker is not a single symbol token. Not graded." });
      continue;
    }
    if (row.direction !== "long" && row.direction !== "short") {
      pending.push({ ...pendingShape(row), reason: "Direction is not long or short. Not graded." });
      continue;
    }
    if (!row.quote || !/^https:\/\/x\.com\/[^/]+\/status\/\d+$/.test(row.post_url)) {
      pending.push({ ...pendingShape(row), reason: "Missing a verbatim quote or a public status URL. Not graded." });
      continue;
    }
    chosen.push(row);
  }

  const byHandle = new Map<string, ScanRow[]>();
  for (const row of chosen) {
    const list = byHandle.get(row.handle) ?? [];
    list.push(row);
    byHandle.set(row.handle, list);
  }

  const calls: CallRow[] = [];
  const seenQuotes = new Set<string>();
  let quotedCalls = 0;
  let unquotedCalls = 0;
  for (const [handle, list] of byHandle) {
    const used = new Map<string, number>();
    list.forEach((row, index) => {
      const status = statusId(row.post_url);
      if (!status) return;
      const named = mentionedSymbols(row.quote).includes(row.ticker);
      const primary = named ? (INDEX_PRINT[row.ticker] ?? row.ticker) : row.ticker;
      const direction = row.direction === "long" ? "bullish" : "bearish";
      let id = list.length === 1 ? `${XSCAN_COHORT}__${handle}` : `${XSCAN_COHORT}__${handle}__${status}__${row.ticker}`;
      const seen = used.get(id) ?? 0;
      used.set(id, seen + 1);
      if (seen > 0) id = `${XSCAN_COHORT}__${handle}__${status}__${row.ticker}__${seen + 1}`;
      void index;
      const call = blank(template);
      call.call_id = id;
      call.cohort_slug = XSCAN_COHORT;
      call.history_slug = XSCAN_COHORT;
      call.cohort_title = COHORT_TITLE;
      call.cohort_summary = COHORT_SUMMARY;
      call.monday_year = "2026";
      call.monday_month = "10";
      call.monday_day = "26";
      call.handle = handle;
      call.display_name = row.display_name || handle;
      call.bio = "Public X post. The card quotes the scan text and links the status.";
      call.posture = row.timeframe || "Not stated";
      call.accent = "#9a9aa3";
      call.bucket = watch.has(handle.toLowerCase()) ? "watchlist" : "viral";
      call.posted_at = etLabelToIso(row.posted_at_ET);
      call.source_url = row.post_url;
      call.direction = direction;
      call.conviction = "medium";
      call.primary = primary;
      call.sentiment = direction === "bearish" ? "panic" : "meltup";
      call.tone_label = row.timeframe || "Not stated";
      call.engagement = "0";
      call.tickers = named ? row.ticker : "";
      call.explicit = named ? "true" : "false";
      call.levels = "[]";
      call.body = row.quote;
      call.verification = named
        ? `Scan row. Status ${row.post_url}. Posted ${row.posted_at_ET}. The quote names ${row.ticker}. Direction is the scan value ${row.direction}. No conviction word is stored; conviction is the ledger's unset value, medium. Engagement is 0.`
        : `Scan row. Status ${row.post_url}. Posted ${row.posted_at_ET}. The scan ticker is ${row.ticker}. The verbatim quote does not name it, so this call is not graded. Direction is the scan value ${row.direction}. Engagement is 0.`;
      call.ref_price = "";
      call.monday_date = dates.monday;
      call.monday_status = "PENDING";
      call.wednesday_date = dates.wednesday;
      call.wednesday_status = "PENDING";
      call.friday_date = dates.friday;
      call.friday_status = "PENDING";
      call.graded_at = "";
      call.grade_method = "";
      call.notes = `scan-ticker=${row.ticker}`;
      call.data_source = "public";
      call.flags = expectedFlags(call);
      const quoteKey = `${call.source_url}\n${call.body}\n${call.primary}`;
      if (seenQuotes.has(quoteKey)) {
        pending.push({
          ...pendingShape(row),
          reason: "The same status, quote, and ticker are already a call. Not graded again.",
        });
        return;
      }
      const issues = classifyCall(call);
      if (issues.errors.length > 0) {
        pending.push({
          ...pendingShape(row),
          reason: `Ledger refused the row (${issues.errors.join("; ")}). Not graded.`,
        });
        return;
      }
      if (named) quotedCalls += 1;
      else unquotedCalls += 1;
      seenQuotes.add(quoteKey);
      calls.push(call);
    });
  }

  return {
    calls,
    pending,
    counts: {
      scanRows: rows.length,
      fintwitRows,
      clearRows,
      calls: calls.length,
      quotedCalls,
      unquotedCalls,
      ambiguousRows,
      pendingRows: pending.length,
      bankRows,
    },
  };
}

function pendingShape(row: ScanRow): PendingApprovalRow {
  return {
    handle: row.handle,
    display_name: row.display_name,
    post_url: row.post_url,
    posted_at_ET: row.posted_at_ET,
    ticker: row.ticker,
    direction: row.direction,
    quote: row.quote,
    reason: "",
  };
}

export function readScanFile(path: string): string {
  return readFileSync(path, "utf8");
}

function escapeField(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}

export function serializePending(rows: PendingApprovalRow[]): string {
  const header = ["handle", "display_name", "post_url", "posted_at_ET", "ticker", "direction", "quote", "reason"];
  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push(
      [row.handle, row.display_name, row.post_url, row.posted_at_ET, row.ticker, row.direction, row.quote, row.reason]
        .map(escapeField)
        .join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}
