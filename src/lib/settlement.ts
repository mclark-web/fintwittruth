import { marketHoliday, settlementIsDue } from "./calendar";

/**
 * What to do with a Wednesday or Friday checkpoint.
 *
 * "wait"  — the official close is not due yet. A Yahoo daily bar can already
 *           exist as the last trade. That number is not the close.
 * "settle"— the buffer has passed and Yahoo has an official daily close.
 * "flag"  — the buffer has passed and Yahoo has no close. Leave the grade blank.
 * "closed"— equity holiday. Ignore a VIX-only bar. Do not copy a prior close.
 */
export type CheckpointPlan = "closed" | "wait" | "flag" | "settle";

export function planCheckpoint(input: {
  ymd: string;
  checkpointAt: Date;
  now: Date;
  officialClose: number | null;
}): CheckpointPlan {
  if (marketHoliday(input.ymd)) return "closed";
  if (!settlementIsDue(input.checkpointAt, input.now)) return "wait";
  if (input.officialClose == null || !Number.isFinite(input.officialClose)) return "flag";
  return "settle";
}
