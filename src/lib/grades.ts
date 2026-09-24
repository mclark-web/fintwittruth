import { marketHoliday } from "./calendar";
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
