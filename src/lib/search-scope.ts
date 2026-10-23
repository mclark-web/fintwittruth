import type { CohortWindow } from "./calendar";
import { formatScopeWhen } from "./format";

/** Graded prints in the written selection rule, in that order. */
export const GRADED_PRINT_LIST =
  "SPY, QQQ, DIA, SPX, NDX, ES, NQ, the S&P 500, the Nasdaq 100, or the Dow";

/** Friday, October 16, 2026 at 10:22 AM ET. The first October 19 X pass started then. */
export const X_SEARCH_START = new Date("2026-10-16T14:22:00.000Z");

/**
 * October 19 scope sentence. Must match cohort_summary in data/calls/calls.csv exactly.
 * The week page strips this sentence from the summary, so do not edit the CSV to match a rewrite.
 */
export const OCT19_X_SCOPE =
  "X was first checked from Friday, October 16 at 10:22 AM ET through Sunday, October 18 at 5:00 PM ET. A later backfill added public X posts from earlier in this Wednesday-to-Sunday window. For this week, first means the first forward-looking post inside the range searched at that time.";

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

function monthDay(slug: string): string {
  const [year, month, day] = slug.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "long",
    day: "numeric",
  }).format(new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1, 16)));
}

/** Methodology lead built from checked-weeks.csv. The October 19 phrase appears once. */
export function methodologySourceLead(rows: { slug: string; coverage: string }[]): string {
  const substack = rows
    .filter((row) => row.coverage === "substack")
    .map((row) => row.slug)
    .sort()
    .map(monthDay);
  const partial = rows.find((row) => parseWeekCoverage(row.coverage)?.x === "from");
  const list =
    substack.length <= 1
      ? substack.join("")
      : substack.length === 2
        ? `${substack[0]} and ${substack[1]}`
        : `${substack.slice(0, -1).join(", ")}, and ${substack.at(-1)}`;
  const parts: string[] = [];
  if (list) parts.push(`The weeks of ${list} are Substack only (X not searched).`);
  if (partial) {
    const year = partial.slug.slice(0, 4);
    parts.push(
      `For the week of ${monthDay(partial.slug)}, ${year}, Substack covers the whole Wednesday noon to Sunday 5:00 PM ET window.`,
    );
  }
  return parts.join(" ");
}

/**
 * One sentence for an empty week: which sources were searched, how far back each reached,
 * and the full graded-print list. Coverage comes from checked-weeks.csv.
 * A blank record says no search coverage is recorded. It does not claim any post was read.
 */
/** Heading for an empty week. It names a search result only when search coverage is recorded. */
export function emptyWeekHeading(coverage = ""): string {
  return parseWeekCoverage(coverage) ? "No qualifying calls" : "No search on record";
}

export function emptyWeekSearchLine(window: CohortWindow, coverage = ""): string {
  const start = formatScopeWhen(window.collectStart);
  const end = formatScopeWhen(window.collectEnd);
  const tail = `No post read named a direction on ${GRADED_PRINT_LIST}, so there is nothing to grade. This is not a 0% grade.`;
  const reach = parseWeekCoverage(coverage);
  if (!reach) {
    return "No search coverage is recorded for this week, so there is nothing to grade. This is not a 0% grade.";
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
