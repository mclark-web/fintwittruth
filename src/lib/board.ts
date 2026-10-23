import { gcGrade } from "./grades";
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

/** Mean of the graded timeframe pills. No graded pill is ungraded, not a zero. */
export function callRollupScore(grades: RollupInput): number | null {
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
  const scores = CALL_TIMEFRAMES.flatMap((kind) => {
    const score = byKind.get(kind);
    return score != null ? [score] : [];
  });
  return average(scores);
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
  const graded = calls.filter((call) => callRollupScore(call.grades) != null);
  const grades = graded.flatMap((call) => settledGrades(call));
  const rollups = graded
    .map((call) => callRollupScore(call.grades))
    .filter((score): score is number => score != null);
  const avgScore = average(rollups) ?? 0;
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
    bestScore: rollups.length ? Math.max(...rollups) : 0,
    worstScore: rollups.length ? Math.min(...rollups) : 0,
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
