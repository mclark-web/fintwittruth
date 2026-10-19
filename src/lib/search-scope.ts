import type { CohortWindow } from "./calendar";
import { formatWhen } from "./format";

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
 * One sentence for an empty week: which sources were searched, how far back each reached,
 * and the full graded-print list. The same string is rendered on the week page and the index.
 */
export function emptyWeekSearchLine(window: CohortWindow): string {
  const start = formatWhen(window.collectStart);
  const end = formatWhen(window.collectEnd);
  const substack = `Searched Substack from ${start} through ${end}.`;
  const tail = `No post read named a direction on ${GRADED_PRINT_LIST}, so there is nothing to grade. This is not a 0% grade.`;
  if (window.collectEnd <= X_SEARCH_START) {
    return `${substack} X was not searched. ${tail}`;
  }
  if (window.collectStart < X_SEARCH_START) {
    return `${substack} X was searched only from Friday, October 16 at 10:22 AM ET through ${end}. ${tail}`;
  }
  return `${substack} X was searched from ${start} through ${end}. ${tail}`;
}
