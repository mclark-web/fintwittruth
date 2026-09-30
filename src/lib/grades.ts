import { addCalendarDays, marketHoliday, parseCalendarDay, zonedToUtc } from "./calendar";
import { etYmd } from "./format";
import { STRONG_LINE, WEAK_LINE, type ReadoutKind } from "./scoring";

/** User-facing pill. Does not change how a 0–100 score is computed. */
export type GcGrade = "strong" | "weak" | "provisional" | "exit";

export const GC_GRADE_LABEL: Record<GcGrade, string> = {
  strong: "STRONG",
  weak: "WEAK",
  provisional: "PROVISIONAL",
  exit: "EXIT LIQUIDITY",
};

/** Open or unpublished horizons are not a grade. Only a settled 0% is EXIT LIQUIDITY. */
export const UNGRADED_HORIZON = "Not graded yet";
export const UNGRADED_HORIZON_ARIA = "GC Scale, not graded yet";

/** Monday, September 7, 2026 was a full close. Those prints never arrive. */
export const LABOR_DAY_UNGRADED_LINE =
  "Not graded yet · market closed for Labor Day (Mon Sep 7), no Monday open or noon print, so this stays ungraded.";

/** Waiting-line copy. A closed Monday does not promise an open or a noon print. */
export function ungradedHorizonLine(input: {
  kind: ReadoutKind;
  sessionYmd: string;
  time: string;
  role?: string;
}): string {
  const holiday = marketHoliday(input.sessionYmd);
  if ((input.kind === "monday" || input.kind === "monday-gap") && holiday?.includes("Labor Day")) {
    return LABOR_DAY_UNGRADED_LINE;
  }
  const until = `off the board until ${input.time}`;
  return input.role ? `${UNGRADED_HORIZON} · ${input.role} · ${until}` : `${UNGRADED_HORIZON} · ${until}`;
}

/** Name from the holiday note, such as "Labor Day. The cash session is closed." */
export function marketHolidayName(ymd: string): string | null {
  const note = marketHoliday(ymd);
  if (!note) return null;
  const name = note.replace(/\.\s*The cash session is closed\.$/, "").trim();
  return name.length > 0 ? name : null;
}

/** No Monday open or noon print when that Monday is a full close. */
export function mondayTapeClosedLine(mondayAt: Date | string): string | null {
  const name = marketHolidayName(etYmd(mondayAt));
  if (!name) return null;
  return `Market closed (${name}) · no Monday tape`;
}

export function readoutSessionYmd(
  kind: ReadoutKind,
  dates: { mondayAt: Date; wednesdayAt: Date; fridayAt: Date },
): string {
  if (kind === "wednesday") return etYmd(dates.wednesdayAt);
  if (kind === "friday") return etYmd(dates.fridayAt);
  return etYmd(dates.mondayAt);
}

/** Clock dates for a Monday slug, used when a page only has the cohort id. */
export function cohortClockDates(mondayYmd: string): { mondayAt: Date; wednesdayAt: Date; fridayAt: Date } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(mondayYmd)) return null;
  const monday = parseCalendarDay(mondayYmd);
  const wednesday = addCalendarDays(monday, 2);
  const friday = addCalendarDays(monday, 4);
  const at = (day: { year: number; month: number; day: number }, hour: number) =>
    zonedToUtc(day.year, day.month, day.day, hour, 0);
  return {
    mondayAt: at(monday, 12),
    wednesdayAt: at(wednesday, 16),
    fridayAt: at(friday, 16),
  };
}

export type PendingClosure = { closed: number; upcoming: number; name: string | null };

/** Unpublished horizons split into sessions that will never print and sessions that will. */
export function pendingClosure(
  kinds: readonly ReadoutKind[],
  dates: { mondayAt: Date; wednesdayAt: Date; fridayAt: Date },
): PendingClosure {
  let closed = 0;
  let upcoming = 0;
  let name: string | null = null;
  for (const kind of kinds) {
    const holiday = marketHolidayName(readoutSessionYmd(kind, dates));
    if (holiday) {
      closed += 1;
      name ??= holiday;
    } else {
      upcoming += 1;
    }
  }
  return { closed, upcoming, name };
}

export function marketClosedCard(name: string): string {
  return `Market closed (${name}) · Not graded yet`;
}

export function pendingHorizonsClause(waiting: number, closure: PendingClosure): string {
  if (closure.closed > 0 && closure.upcoming === 0 && closure.name) {
    const verb = closure.closed === 1 ? "horizon is" : "horizons are";
    return `${closure.closed} ${verb} not graded: the market was closed for ${closure.name}.`;
  }
  if (closure.closed > 0 && closure.upcoming > 0 && closure.name) {
    const closedVerb = closure.closed === 1 ? "horizon is" : "horizons are";
    const openVerb = closure.upcoming === 1 ? "horizon is" : "horizons are";
    return `${closure.closed} ${closedVerb} not graded: the market was closed for ${closure.name}. ${closure.upcoming} ${openVerb} off this board until the tape prints.`;
  }
  const verb = waiting === 1 ? "horizon is" : "horizons are";
  return `${waiting} ${verb} off this board until the tape prints.`;
}

export function closedHorizonNote(marketClosed: boolean): string {
  return marketClosed
    ? "A horizon on this week is not graded: the market was closed."
    : "A horizon on this week is still off the board.";
}

export function readoutCallsHeading(input: {
  settled: boolean;
  count: number;
  label: string;
  holidayName: string | null;
}): string {
  if (input.settled) return `${input.count} graded calls`;
  if (input.holidayName) return `Market closed for ${input.holidayName} · not graded`;
  return `${input.label} waiting`;
}

export function tapeStatusHeading(holidayName: string | null): string {
  return holidayName ? `Market closed for ${holidayName}` : "Waiting on the clock";
}

/**
 * One rule on every board. The raw percent decides the pill.
 * STRONG is 70 or more. WEAK is under 40. Otherwise PROVISIONAL.
 * EXIT LIQUIDITY is a settled score of 0. A missing score is also exit here;
 * an empty board list is ungraded, not EXIT. See gcBoardGrade.
 * isStrong and isWeak are ignored. peerRank is ordering only.
 */
export function gcGrade(input: {
  score: number | null | undefined;
  isStrong?: boolean;
  isWeak?: boolean;
}): GcGrade {
  if (input.score == null || input.score <= 0) return "exit";
  if (input.score >= STRONG_LINE) return "strong";
  if (input.score < WEAK_LINE) return "weak";
  return "provisional";
}

/** Tube fill. 0% is an empty glass. */
export function gcFill(score: number | null | undefined): number {
  if (score == null || score <= 0) return 0;
  return Math.max(0, Math.min(100, score));
}

export type BoardCalibration =
  | { fill: 0; ungraded: true }
  | { fill: number; grade: GcGrade; ungraded: false };

/** Board tube. No graded rows is ungraded. A mean of 0 from one or more grades is EXIT. */
export function gcBoardGrade(scores: number[]): BoardCalibration {
  if (scores.length === 0) return { fill: 0, ungraded: true };
  const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  return { fill: gcFill(mean), grade: gcGrade({ score: mean }), ungraded: false };
}
