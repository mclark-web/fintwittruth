import { CHUD_THRESHOLD } from "./scoring";

/** User-facing pill. Does not change how a score is computed. */
export type GcGrade = "strong" | "weak" | "provisional" | "exit";

export const GC_GRADE_LABEL: Record<GcGrade, string> = {
  strong: "Strong",
  weak: "Weak",
  provisional: "Provisional",
  exit: "Exit liquidity",
};

/**
 * STRONG is the existing peer cut (top 30% and at least 70).
 * WEAK is any positive score under 70.
 * PROVISIONAL is 70 or more that missed the peer cut.
 * EXIT LIQUIDITY is a 0 fill: no closed horizon, or a score of 0.
 */
export function gcGrade(input: {
  score: number | null | undefined;
  isChad: boolean;
  isChudTerritory: boolean;
}): GcGrade {
  if (input.score == null || input.score <= 0) return "exit";
  if (input.isChad) return "strong";
  if (input.isChudTerritory || input.score < CHUD_THRESHOLD) return "weak";
  return "provisional";
}

/** Tube fill. 0% is an empty glass. */
export function gcFill(score: number | null | undefined): number {
  if (score == null || score <= 0) return 0;
  return Math.max(0, Math.min(100, score));
}

/** Board tube. A mean is not a peer rank, so 70+ stays PROVISIONAL and under 70 is WEAK. */
export function gcBoardGrade(scores: number[]): { fill: number; grade: GcGrade } {
  if (scores.length === 0) return { fill: 0, grade: "exit" };
  const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const fill = gcFill(mean);
  return {
    fill,
    grade: gcGrade({
      score: mean,
      isChad: false,
      isChudTerritory: mean < CHUD_THRESHOLD,
    }),
  };
}
