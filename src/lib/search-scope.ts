import type { CohortWindow } from "./calendar";
import { formatScopeWhen } from "./format";

/** Graded prints in the written selection rule, in that order. */
export const GRADED_PRINT_LIST =
  "SPY, QQQ, DIA, SPX, NDX, ES, NQ, the S&P 500, the Nasdaq 100, or the Dow";

/** Friday, October 16, 2026 at 10:22 AM ET. Earlier collect windows were not searched on X. */
export const X_SEARCH_START = new Date("2026-10-16T14:22:00.000Z");

/**
 * October 19 scope sentence. Must match cohort_summary in data/calls/calls.csv exactly.
 * The week page strips this sentence from the summary, so do not edit the CSV to match a rewrite.
 */
export const OCT19_X_SCOPE =
  "X was checked only from Friday, October 16 at 10:22 AM ET through Sunday, October 18 at 5:00 PM ET. X posts from Wednesday noon through Friday 10:22 AM ET were out of scope and were not searched. For this week, first means the first forward-looking post inside that searched range.";

/**
 * Recorded search coverage from checked-weeks.csv.
 * `substack` — Substack for the whole window, X not searched.
 * `substack+x` — both sources for the whole window.
 * `substack+x-from-<ISO>` — Substack for the whole window, X only from that instant through the end.
 */
export type WeekCoverage = {
  substack: boolean;
  x: "none" | "full" | "from";
  xFrom?: Date;
};

export function parseWeekCoverage(value: string): WeekCoverage | null {
  const text = value.trim();
  if (text === "substack") return { substack: true, x: "none" };
  if (text === "substack+x") return { substack: true, x: "full" };
  const from = /^substack\+x-from-(\S+)$/.exec(text);
  if (!from) return null;
  const xFrom = new Date(from[1] ?? "");
  if (Number.isNaN(xFrom.getTime())) return null;
  return { substack: true, x: "from", xFrom };
}

/**
 * One sentence for an empty week: which sources were searched, how far back each reached,
 * and the full graded-print list. Coverage comes from checked-weeks.csv.
 * A blank record does not claim X was searched. A window that ended before X search began
 * is Substack only, because that search did not reach it.
 */
export function emptyWeekSearchLine(window: CohortWindow, coverage = ""): string {
  const start = formatScopeWhen(window.collectStart);
  const end = formatScopeWhen(window.collectEnd);
  const tail = `No post read named a direction on ${GRADED_PRINT_LIST}, so there is nothing to grade. This is not a 0% grade.`;
  const recorded = parseWeekCoverage(coverage);
  const reach = recorded ?? (window.collectEnd <= X_SEARCH_START ? { substack: true, x: "none" as const } : null);
  if (!reach) {
    return `No search coverage is recorded for this week. ${tail}`;
  }
  const substack = reach.substack
    ? `Searched Substack from ${start} through ${end}.`
    : "Substack was not searched.";
  const x =
    reach.x === "none"
      ? "X was not searched."
      : reach.x === "full"
        ? `X was searched from ${start} through ${end}.`
        : `X was searched only from ${formatScopeWhen(reach.xFrom ?? X_SEARCH_START)} through ${end}.`;
  return `${substack} ${x} ${tail}`;
}
