import { formatScore, formatShortDay } from "./format";
import { GC_GRADE_LABEL, type BoardCalibration, gcGrade } from "./grades";
import { READOUTS, scoreToBadge, tapeDirection, type ReadoutKind } from "./scoring";

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * Board layer over the dataset gate.
 * A readout is graded only when its status is `published`. The scorer writes
 * grade rows at that moment and leaves scheduled horizons empty. Primary
 * rankings use those settled grades and leave the rest off the board.
 */

export const HIT_BAND = 0.0008;

export type SettledGrade = {
  readout: string;
  score: number;
  isStrong: boolean;
  isWeak: boolean;
  signedMovePct: number;
};

export type GradedCallInput = {
  grades: SettledGrade[];
};

const MATURE_ORDER: ReadoutKind[] = ["friday", "wednesday", "monday", "monday-gap"];

/** Pills on every call card, in this order. Monday's open is a tape print, not one of these grades. */
export const CALL_TIMEFRAMES = ["monday", "wednesday", "friday"] as const satisfies readonly ReadoutKind[];
export type CallTimeframe = (typeof CALL_TIMEFRAMES)[number];

type GradeScore = { readout: string; score: number };
type RollupInput = readonly GradeScore[] | Partial<Record<string, { score: number } | null | undefined>>;

function isGradeList(grades: RollupInput): grades is readonly GradeScore[] {
  return Array.isArray(grades);
}

/** Home lead for a closed graded week. The percent is the mean of the call scores. */
export function weekendLead(mondayAt: Date, calibration: BoardCalibration): string {
  if (calibration.ungraded) return "No graded calls yet this week";
  return `Week of ${formatShortDay(mondayAt)} · ${formatScore(calibration.fill)}% ${GC_GRADE_LABEL[calibration.grade]}`;
}

function scoresByKind(grades: RollupInput): Map<string, number> {
  const byKind = new Map<string, number>();
  if (isGradeList(grades)) {
    for (const item of grades) {
      if (Number.isFinite(item.score)) byKind.set(item.readout, item.score);
    }
  } else {
    for (const [kind, grade] of Object.entries(grades)) {
      if (grade != null && Number.isFinite(grade.score)) byKind.set(kind, grade.score);
    }
  }
  return byKind;
}

/**
 * Call score is the furthest settled checkpoint: Friday, else Wednesday, else Monday.
 * It is not the mean of the timeframe pills. A later checkpoint is not filled just because
 * an earlier one was recorded.
 */
export function matureScore(grades: RollupInput): number | null {
  const byKind = scoresByKind(grades);
  for (const kind of MATURE_ORDER) {
    const score = byKind.get(kind);
    if (score != null) return score;
  }
  return null;
}

const LEAD_ORDER: ReadoutKind[] = ["friday", "wednesday", "monday"];

/**
 * Furthest checkpoint that every graded call has settled.
 * The market-move tape under the home lead uses this stamp.
 */
export function leadReadout(gradesList: RollupInput[]): ReadoutKind {
  const settled = gradesList.filter((grades) => matureScore(grades) != null);
  for (const kind of LEAD_ORDER) {
    if (settled.length > 0 && settled.every((grades) => scoresByKind(grades).has(kind))) return kind;
  }
  return "monday";
}

/** Home-lead inputs. Each number is that call's latest settled checkpoint. */
export function leadScores(gradesList: RollupInput[]): number[] {
  return gradesList.flatMap((grades) => {
    const score = matureScore(grades);
    return score == null ? [] : [score];
  });
}

export function isSettledStatus(status: string): boolean {
  return status === "published";
}

/** Tape moved with the call by at least the same band the scorer calls bullish. */
export function isDirectionHit(signedMovePct: number): boolean {
  return tapeDirection(signedMovePct) === "bullish";
}

export function settledGrades(call: GradedCallInput): SettledGrade[] {
  return call.grades.filter((grade) => (READOUTS as readonly string[]).includes(grade.readout));
}

export function matureSettledGrade(call: GradedCallInput): SettledGrade | null {
  const byKind = new Map(call.grades.map((grade) => [grade.readout, grade]));
  for (const kind of MATURE_ORDER) {
    const grade = byKind.get(kind);
    if (grade) return grade;
  }
  return null;
}

export function handleBoardStats(calls: GradedCallInput[]) {
  const graded = calls.filter((call) => matureScore(call.grades) != null);
  const grades = graded.flatMap((call) => settledGrades(call));
  const matureScores = graded
    .map((call) => matureScore(call.grades))
    .filter((score): score is number => score != null);
  const avgScore = average(matureScores) ?? 0;
  const rate = (pick: (grade: SettledGrade) => boolean) =>
    grades.length === 0 ? 0 : grades.filter(pick).length / grades.length;
  return {
    graded: graded.length > 0,
    callCount: graded.length,
    pendingCount: calls.length - graded.length,
    avgScore,
    badge: scoreToBadge(Math.round(avgScore)),
    strongRate: rate((grade) => gcGrade(grade) === "strong"),
    weakRate: rate((grade) => gcGrade(grade) === "weak"),
    hitRate: rate((grade) => isDirectionHit(grade.signedMovePct)),
    bestScore: matureScores.length ? Math.max(...matureScores) : 0,
    worstScore: matureScores.length ? Math.min(...matureScores) : 0,
  };
}

/** Grades that belong on a primary readout board. Scheduled horizons contribute none. */
export function gradesOnPrimaryBoard<T extends { readout: string }>(grades: T[], status: string): T[] {
  if (!isSettledStatus(status)) return [];
  return grades;
}

export function settledReadoutKinds(readouts: { kind: string; status: string }[]): ReadoutKind[] {
  return READOUTS.filter((kind) =>
    readouts.some((readout) => readout.kind === kind && isSettledStatus(readout.status)),
  );
}

export function pendingReadoutKinds(readouts: { kind: string; status: string }[]): ReadoutKind[] {
  return READOUTS.filter((kind) => !settledReadoutKinds(readouts).includes(kind));
}

export function callHasSettledGrade(grades: Partial<Record<ReadoutKind, unknown>>): boolean {
  return READOUTS.some((kind) => grades[kind] != null);
}

export function settledGradeKinds(grades: Partial<Record<ReadoutKind, unknown>>): ReadoutKind[] {
  return READOUTS.filter((kind) => grades[kind] != null);
}
