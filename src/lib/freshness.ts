import { etYmd } from "./format";

/** A real week older than this many calendar days fails the settle job. */
export const STALE_WEEK_DAYS = 7;

/** Whole America/New_York calendar days from the week Monday to `now`. */
export function realWeekAgeDays(mondayYmd: string, now: Date): number {
  const today = etYmd(now);
  const start = Date.parse(`${mondayYmd}T00:00:00Z`);
  const end = Date.parse(`${today}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    throw new Error(`Cannot compare week ${mondayYmd} with ${today}.`);
  }
  return Math.round((end - start) / 86_400_000);
}

/**
 * Alert when the newest real week is missing or more than 7 days old.
 * Returns null when the week is still inside the window.
 */
export function stalenessMessage(mondayYmd: string | null, now: Date): string | null {
  if (!mondayYmd) return "ALERT: no real week is on the board.";
  const age = realWeekAgeDays(mondayYmd, now);
  if (age > STALE_WEEK_DAYS) {
    return `ALERT: newest real week ${mondayYmd} is ${age} days old, more than ${STALE_WEEK_DAYS}.`;
  }
  return null;
}
