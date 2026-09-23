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
  isChad: boolean;
  isChudTerritory: boolean;
  signedMovePct: number;
};

export type GradedCallInput = {
  grades: SettledGrade[];
};

const MATURE_ORDER: ReadoutKind[] = ["friday", "wednesday", "monday", "monday-gap"];

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
  const graded = calls.filter((call) => settledGrades(call).length > 0);
  const grades = graded.flatMap((call) => settledGrades(call));
  const matureScores = graded
    .map((call) => matureSettledGrade(call)?.score)
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
    chadRate: rate((grade) => grade.isChad),
    chudRate: rate((grade) => grade.isChudTerritory),
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
