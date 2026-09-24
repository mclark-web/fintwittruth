import { STRONG_LINE, WEAK_LINE } from "./scoring";

/** User-facing pill. Does not change how a 0–100 score is computed. */
export type GcGrade = "strong" | "weak" | "provisional" | "exit";

export const GC_GRADE_LABEL: Record<GcGrade, string> = {
  strong: "STRONG",
  weak: "WEAK",
  provisional: "PROVISIONAL",
  exit: "EXIT LIQUIDITY",
};

/**
 * STRONG is 70% or more. WEAK is under 40%. The band between them is PROVISIONAL.
 * EXIT LIQUIDITY is a 0 fill: no closed horizon, or a score of 0.
 * isStrong and isWeak are ignored. The percent decides the pill.
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

/** Board tube. The mean uses the same absolute bands as a single score. */
export function gcBoardGrade(scores: number[]): { fill: number; grade: GcGrade } {
  if (scores.length === 0) return { fill: 0, grade: "exit" };
  const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const fill = gcFill(mean);
  return { fill, grade: gcGrade({ score: mean }) };
}
