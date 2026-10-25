/**
 * Graded-book selection.
 * The README keeps one call per handle: the first forward-looking post on a graded print.
 * Graded prints that have a tape are SPY, QQQ, and DIA. SPX, NDX, DJI, ES, and NQ stay
 * on the book when that is the print the post named; SPX is not proxied to SPY.
 * IWM is priced in the symbol list and is not on the graded-print list, so it is queued.
 * A same-day or 0DTE trade is queued instead of graded at the week's later checkpoints.
 */
import { addCalendarDays, calendarDayString, parseCalendarDay } from "../src/lib/calendar";
import type { CallRow } from "./calls-ledger";

export type PolicyPendingRow = {
  handle: string;
  display_name: string;
  post_url: string;
  posted_at_ET: string;
  ticker: string;
  direction: string;
  quote: string;
  reason: string;
};

/** Index prints the tape can grade. IWM is not in the README graded-print list. */
export const GRADED_INDEX = new Set(["SPY", "QQQ", "DIA"]);

/** Named index prints with no stored price. They stay on the book and are not graded. */
export const UNPRICED_INDEX = new Set(["SPX", "NDX", "DJI", "ES", "NQ"]);

export const LATER_CALL_REASON = "Later than the first index call from this handle in the week. Not graded.";

export type QueuedCall = { row: CallRow; reason: string };

/** One verbatim quote that states both a long trigger and a short trigger. */
export function twoSidedQuote(quote: string): boolean {
  const text = quote.toLowerCase();
  const longSide = /\blong\s*:/.test(text) || /\bcalls?\s+above\b/.test(text);
  const shortSide = /\bshort\s*:/.test(text) || /\bputs?\s+below\b/.test(text);
  return longSide && shortSide;
}

/**
 * True when the quote's horizon is the session itself or an expiry on or before readout Monday.
 * A bare "Friday" is the Friday of the collect window, which is before readout Monday.
 * "Next Friday" is the Friday of the readout week, so that call stays on the book.
 */
export function sameDayHorizon(quote: string, cohortMonday: string): boolean {
  const text = quote.toLowerCase();
  if (/\b0\s*-?\s*dte\b/.test(text)) return true;
  if (/\bodt\b/.test(text)) return true;
  if (/\bfor today\b/.test(text)) return true;
  if (/\bcalls today\b/.test(text)) return true;
  if (/\binto the close today\b/.test(text)) return true;
  if (/\btomorrow'?s exp\b/.test(text)) return true;
  if (/\bfridays exp\b/.test(text)) return true;
  if (/\bfor tomorrow\b/.test(text)) return true;
  if (/\bfriday\b/.test(text) && !/\bnext\s+friday\b/.test(text)) return true;
  return expiryOnOrBeforeMonday(quote, cohortMonday);
}

function etCalendarDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/**
 * One expired-trade rule for the graded book.
 * The body can say 0DTE, today, or a bare Friday.
 * The stored tone can say 0DTE when the body omits the word (the call side of a queued put).
 * An intraday label posted on the collect-window Friday expires that session, before Monday.
 * An intraday label from earlier in the window is not expired by the label alone.
 */
export function expiresBeforeReadout(
  row: Pick<CallRow, "body" | "cohort_slug"> & Partial<Pick<CallRow, "tone_label" | "posture" | "posted_at">>,
): boolean {
  const tone = `${row.tone_label ?? ""} ${row.posture ?? ""}`;
  if (/\b0\s*-?\s*dte\b/i.test(tone)) return true;
  if (sameDayHorizon(row.body, row.cohort_slug)) return true;
  if (!/\bintraday\b/i.test(tone) || !row.posted_at) return false;
  const friday = calendarDayString(addCalendarDays(parseCalendarDay(row.cohort_slug), -3));
  return etCalendarDate(row.posted_at) === friday;
}

function expiryOnOrBeforeMonday(quote: string, monday: string): boolean {
  const [year, month, day] = monday.split("-").map(Number);
  if (!year || !month || !day) return false;
  const mondayUtc = Date.UTC(year, month - 1, day);
  const re = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(quote))) {
    const after = quote.slice(match.index + match[0].length);
    if (!/^\s*(?:exp\b|\d)/i.test(after)) continue;
    const mo = Number(match[1]);
    const da = Number(match[2]);
    if (mo < 1 || mo > 12 || da < 1 || da > 31) continue;
    let y = year;
    if (match[3]) {
      const raw = Number(match[3]);
      y = raw < 100 ? 2000 + raw : raw;
    }
    if (Date.UTC(y, mo - 1, da) <= mondayUtc) return true;
  }
  return false;
}

function firstTicker(row: Pick<CallRow, "tickers" | "primary">): string {
  const named = row.tickers
    .split(";")
    .map((ticker) => ticker.trim().toUpperCase())
    .filter((ticker) => ticker !== "");
  return named[0] ?? row.primary.toUpperCase();
}

/**
 * Why this published row leaves the graded book.
 * Null means it is an index call that can compete for the one slot.
 */
export function exclusionReason(
  row: Pick<CallRow, "body" | "primary" | "tickers" | "cohort_slug"> &
    Partial<Pick<CallRow, "tone_label" | "posture" | "posted_at">>,
): string | null {
  const ticker = firstTicker(row);
  const primary = row.primary.toUpperCase();
  if (ticker === "DASH" || primary === "DASH") return "DASH here is the Dash coin, not DoorDash. Not graded.";
  if (ticker === "VVV" || primary === "VVV") return "VVV is not the equity print on the graded list. Not graded.";
  const gradedPrint = GRADED_INDEX.has(primary) || UNPRICED_INDEX.has(primary);
  if (gradedPrint && expiresBeforeReadout(row)) {
    return "Same-day or 0DTE trade. It is not graded at this week's checkpoints. Not graded.";
  }
  if (twoSidedQuote(row.body)) return "The post states both a long and a short. Not graded.";
  if (GRADED_INDEX.has(primary) || UNPRICED_INDEX.has(primary)) return null;
  if (primary === "IWM" || ticker === "IWM") return "IWM is not on the graded-print list. Not graded.";
  if (primary === "VIX" || ticker === "VIX") return "VIX is not a graded index print. Not graded.";
  return "Single-name call. Graded prints are SPY, QQQ, and DIA. Not graded.";
}

function byPosted(a: CallRow, b: CallRow): number {
  if (a.posted_at < b.posted_at) return -1;
  if (a.posted_at > b.posted_at) return 1;
  if (a.call_id < b.call_id) return -1;
  if (a.call_id > b.call_id) return 1;
  return 0;
}

/** Keep the earliest index call per handle per week. Everything else is queued. */
export function partitionBook(rows: CallRow[]): { keep: CallRow[]; queue: QueuedCall[] } {
  const queue: QueuedCall[] = [];
  const candidates: CallRow[] = [];
  for (const row of rows) {
    const reason = exclusionReason(row);
    if (reason) queue.push({ row, reason });
    else candidates.push(row);
  }
  const groups = new Map<string, CallRow[]>();
  for (const row of candidates) {
    const key = `${row.cohort_slug}\n${row.handle.toLowerCase()}`;
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }
  const keep: CallRow[] = [];
  for (const list of groups.values()) {
    list.sort(byPosted);
    const [first, ...rest] = list;
    if (first) keep.push(first);
    for (const extra of rest) queue.push({ row: extra, reason: LATER_CALL_REASON });
  }
  const keptPosts = new Set(keep.map((row) => `${row.source_url}\n${row.body}`));
  return {
    keep,
    queue: queue.filter((item) => !keptPosts.has(`${item.row.source_url}\n${item.row.body}`)),
  };
}

export function stampPending(row: PolicyPendingRow): PolicyPendingRow {
  if (!twoSidedQuote(row.quote)) return row;
  const reason = row.reason.startsWith("Two-sided.") ? row.reason : `Two-sided. ${row.reason}`;
  return { ...row, direction: "two-sided", reason };
}

export function isoToEtLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")} ${hour}:${get("minute")}:${get("second")} ET`;
}

export function pendingFromCall(row: CallRow, reason: string): PolicyPendingRow {
  const direction = row.direction === "bearish" ? "short" : row.direction === "bullish" ? "long" : row.direction;
  return stampPending({
    handle: row.handle,
    display_name: row.display_name,
    post_url: row.source_url,
    posted_at_ET: isoToEtLabel(row.posted_at),
    ticker: firstTicker(row),
    direction,
    quote: row.body,
    reason,
  });
}

export function pendingKey(row: { post_url?: string; postUrl?: string; ticker: string; direction: string }): string {
  const url = row.post_url ?? row.postUrl ?? "";
  return `${url}\n${row.ticker}\n${row.direction}`;
}
