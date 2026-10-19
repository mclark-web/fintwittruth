import { readFileSync } from "node:fs";
import { join } from "node:path";
import { addCalendarDays, buildCohortWindow, calendarDayString, parseCalendarDay } from "./calendar";
import { liveFile } from "./live-book";

export type EmptyWeek = {
  slug: string;
  window: ReturnType<typeof buildCohortWindow>;
};

const CHECKED_WEEKS_PATH = join(process.cwd(), "data/calls/checked-weeks.csv");

/**
 * Mondays whose collect window was read and had no qualifying call.
 * A trailing empty week has to be listed here so freshness can see it.
 * Gaps between recorded Mondays are derived from the calendar.
 */
export function parseCheckedWeeks(text: string): string[] {
  const slugs: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("week,")) continue;
    const slug = trimmed.split(",")[0]?.trim() ?? "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(slug)) slugs.push(slug);
  }
  return slugs;
}

export function checkedWeekSlugs(): string[] {
  try {
    return parseCheckedWeeks(readFileSync(CHECKED_WEEKS_PATH, "utf8"));
  } catch {
    return [];
  }
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
export function emptyWeeksFromSlugs(callSlugs: string[], checkedSlugs: string[], now: Date): EmptyWeek[] {
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
    if (window.collectEnd <= now && !calls.has(slug)) out.push({ slug, window });
    day = addCalendarDays(day, 7);
  }
  return out;
}

export function emptyLiveWeeks(now: Date = new Date()): EmptyWeek[] {
  const callSlugs = liveFile().cohorts.map((cohort) => cohort.slug);
  return emptyWeeksFromSlugs(callSlugs, checkedWeekSlugs(), now);
}

/**
 * The next readout Monday after the last recorded week, while its collect window is still open.
 * A closed week with no calls is an empty week, not a future week.
 */
export function futureWeekFromSlugs(callSlugs: string[], checkedSlugs: string[], now: Date): EmptyWeek | null {
  const anchors = [...callSlugs, ...checkedSlugs].filter((slug) => /^\d{4}-\d{2}-\d{2}$/.test(slug)).sort();
  const last = anchors.at(-1);
  if (!last) return null;
  const next = addCalendarDays(parseCalendarDay(last), 7);
  const window = buildCohortWindow(next);
  if (window.collectEnd <= now) return null;
  return { slug: calendarDayString(next), window };
}

export function futureLiveWeek(now: Date = new Date()): EmptyWeek | null {
  const callSlugs = liveFile().cohorts.map((cohort) => cohort.slug);
  return futureWeekFromSlugs(callSlugs, checkedWeekSlugs(), now);
}
