import { readFileSync } from "node:fs";
import { join } from "node:path";
import { addCalendarDays, buildCohortWindow, calendarDayString, parseCalendarDay, zonedToUtc } from "./calendar";
import { liveFile } from "./live-book";

export type EmptyWeek = {
  slug: string;
  window: ReturnType<typeof buildCohortWindow>;
  /** Recorded search coverage. Blank means the week has no coverage row. */
  coverage: string;
};

export type CheckedWeek = {
  slug: string;
  note: string;
  coverage: string;
};

const CHECKED_WEEKS_PATH = join(process.cwd(), "data/calls/checked-weeks.csv");

/**
 * Mondays whose collect window was read and had no qualifying call.
 * A trailing empty week has to be listed here so freshness can see it.
 * Gaps between recorded Mondays are derived from the calendar.
 */
const COVERAGE_TAIL = /,(substack(?:\+x(?:-from-\S+)?)?)\s*$/;

/** `week,note,coverage`. Coverage is the trailing token so a note may contain commas. */
export function parseCheckedWeekRows(text: string): CheckedWeek[] {
  const rows: CheckedWeek[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("week,")) continue;
    const comma = trimmed.indexOf(",");
    const slug = (comma === -1 ? trimmed : trimmed.slice(0, comma)).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(slug)) continue;
    const rest = comma === -1 ? "" : trimmed.slice(comma + 1).trim();
    const found = COVERAGE_TAIL.exec(rest);
    const coverage = found?.[1] ?? "";
    const note = (found ? rest.slice(0, found.index) : rest).replace(/,\s*$/, "").trim();
    rows.push({ slug, note, coverage });
  }
  return rows;
}

export function parseCheckedWeeks(text: string): string[] {
  return parseCheckedWeekRows(text).map((row) => row.slug);
}

export function checkedWeekRows(): CheckedWeek[] {
  try {
    return parseCheckedWeekRows(readFileSync(CHECKED_WEEKS_PATH, "utf8"));
  } catch {
    return [];
  }
}

export function checkedWeekSlugs(): string[] {
  return checkedWeekRows().map((row) => row.slug);
}

function coverageMap(rows: CheckedWeek[]): Map<string, string> {
  return new Map(rows.map((row) => [row.slug, row.coverage]));
}

/** Newest readout Monday among stored calls and explicitly checked empty weeks. */
export function newestRealWeekSlug(callSlugs: string[], checkedSlugs: string[]): string | null {
  const slugs = [...callSlugs, ...checkedSlugs].filter((slug) => /^\d{4}-\d{2}-\d{2}$/.test(slug)).sort();
  return slugs.at(-1) ?? null;
}

/**
 * Closed collect windows from the first recorded Monday through the last recorded Monday
 * that have no stored call. Weeks with calls are omitted. A week whose window is still
 * open is omitted. Nothing here is a hard-coded slug.
 */
export function emptyWeeksFromSlugs(
  callSlugs: string[],
  checkedSlugs: string[],
  now: Date,
  coverageBySlug: ReadonlyMap<string, string> = new Map(),
): EmptyWeek[] {
  const calls = new Set(callSlugs);
  const anchors = [...callSlugs, ...checkedSlugs].filter((slug) => /^\d{4}-\d{2}-\d{2}$/.test(slug)).sort();
  const first = anchors[0];
  const last = anchors.at(-1);
  if (!first || !last) return [];
  const out: EmptyWeek[] = [];
  let day = parseCalendarDay(first);
  const end = calendarDayString(parseCalendarDay(last));
  for (let i = 0; i < 104; i += 1) {
    const slug = calendarDayString(day);
    if (slug > end) break;
    const window = buildCohortWindow(day);
    if (window.collectEnd <= now && !calls.has(slug)) {
      out.push({ slug, window, coverage: coverageBySlug.get(slug) ?? "" });
    }
    day = addCalendarDays(day, 7);
  }
  return out;
}

export function emptyLiveWeeks(now: Date = new Date()): EmptyWeek[] {
  const callSlugs = liveFile().cohorts.map((cohort) => cohort.slug);
  const rows = checkedWeekRows();
  return emptyWeeksFromSlugs(
    callSlugs,
    rows.map((row) => row.slug),
    now,
    coverageMap(rows),
  );
}

/**
 * The first Monday after the last recorded week whose collect window is still open.
 * Mondays in between, once their windows have closed and they have no calls, are closed-pending.
 */
export function futureWeekFromSlugs(callSlugs: string[], checkedSlugs: string[], now: Date): EmptyWeek | null {
  const anchors = [...callSlugs, ...checkedSlugs].filter((slug) => /^\d{4}-\d{2}-\d{2}$/.test(slug)).sort();
  const last = anchors.at(-1);
  if (!last) return null;
  // Step past closed Mondays. The open week is the first one whose collect window has not closed.
  let next = addCalendarDays(parseCalendarDay(last), 7);
  for (let i = 0; i < 104; i += 1) {
    const window = buildCohortWindow(next);
    if (window.collectEnd > now) return { slug: calendarDayString(next), window, coverage: "" };
    next = addCalendarDays(next, 7);
  }
  return null;
}

export function futureLiveWeek(now: Date = new Date()): EmptyWeek | null {
  const callSlugs = liveFile().cohorts.map((cohort) => cohort.slug);
  return futureWeekFromSlugs(callSlugs, checkedWeekSlugs(), now);
}

/**
 * Mondays after the last recorded week whose collect window has closed,
 * with no calls loaded and no checked-empty row. These are not a finished search.
 */
export function closedPendingFromSlugs(callSlugs: string[], checkedSlugs: string[], now: Date): EmptyWeek[] {
  const calls = new Set(callSlugs);
  const checked = new Set(checkedSlugs);
  const anchors = [...callSlugs, ...checkedSlugs].filter((slug) => /^\d{4}-\d{2}-\d{2}$/.test(slug)).sort();
  const last = anchors.at(-1);
  if (!last) return [];
  const out: EmptyWeek[] = [];
  let day = addCalendarDays(parseCalendarDay(last), 7);
  for (let i = 0; i < 104; i += 1) {
    const slug = calendarDayString(day);
    const window = buildCohortWindow(day);
    if (window.collectEnd > now) break;
    if (!calls.has(slug) && !checked.has(slug)) out.push({ slug, window, coverage: "" });
    day = addCalendarDays(day, 7);
  }
  return out;
}

export function closedPendingLiveWeeks(now: Date = new Date()): EmptyWeek[] {
  const callSlugs = liveFile().cohorts.map((cohort) => cohort.slug);
  return closedPendingFromSlugs(callSlugs, checkedWeekSlugs(), now);
}

/** A readout Monday on the collect calendar. Other slugs are not week pages. */
export function isCollectMonday(slug: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(slug)) return false;
  const [year, month, day] = slug.split("-").map(Number);
  if (!year || !month || !day) return false;
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() + 1 !== month || utc.getUTCDate() !== day) return false;
  const noon = zonedToUtc(year, month, day, 12, 0);
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short" }).format(noon);
  return weekday === "Mon";
}

export type ResolvedWeek =
  | { status: 200; kind: "future" | "closed" | "empty"; week: EmptyWeek }
  | { status: 404 };

/**
 * Closed and still-open weeks that have no cohort page.
 * A slug that is not a collect Monday is 404. A collect Monday outside the recorded span is 404.
 */
export function resolveWeekSlug(
  slug: string,
  callSlugs: string[],
  checkedSlugs: string[],
  now: Date,
  coverageBySlug: ReadonlyMap<string, string> = new Map(),
): ResolvedWeek {
  if (!isCollectMonday(slug)) return { status: 404 };
  const future = futureWeekFromSlugs(callSlugs, checkedSlugs, now);
  if (future?.slug === slug) return { status: 200, kind: "future", week: future };
  const empty = emptyWeeksFromSlugs(callSlugs, checkedSlugs, now, coverageBySlug).find((week) => week.slug === slug);
  if (empty) return { status: 200, kind: "empty", week: empty };
  const closed = closedPendingFromSlugs(callSlugs, checkedSlugs, now).find((week) => week.slug === slug);
  if (closed) return { status: 200, kind: "closed", week: closed };
  return { status: 404 };
}

export function resolveLiveWeek(slug: string, now: Date = new Date()): ResolvedWeek {
  const callSlugs = liveFile().cohorts.map((cohort) => cohort.slug);
  const rows = checkedWeekRows();
  return resolveWeekSlug(
    slug,
    callSlugs,
    rows.map((row) => row.slug),
    now,
    coverageMap(rows),
  );
}
