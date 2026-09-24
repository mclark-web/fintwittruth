/** America/New_York wall time → UTC. DST-safe for the collect and readout clocks. */
export function zonedToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone = "America/New_York",
): Date {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const offset = zoneOffset(utcGuess, timeZone);
  let result = new Date(utcGuess.getTime() - offset);
  const offset2 = zoneOffset(result, timeZone);
  if (offset !== offset2) {
    result = new Date(utcGuess.getTime() - offset2);
  }
  return result;
}

function zoneOffset(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const bag: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") bag[part.type] = part.value;
  }
  const asUTC = Date.UTC(
    Number(bag.year),
    Number(bag.month) - 1,
    Number(bag.day),
    Number(bag.hour) % 24,
    Number(bag.minute),
    Number(bag.second),
  );
  return asUTC - date.getTime();
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export type CalendarDay = { year: number; month: number; day: number };

export type CohortWindow = {
  collectStart: Date;
  collectEnd: Date;
  mondayAt: Date;
  wednesdayAt: Date;
  fridayAt: Date;
};

/**
 * Wait this long after the official cash close before grading Wednesday or Friday.
 * The equity close is 4:00 PM ET. The VIX official print is 4:15 PM ET. Yahoo's daily
 * bar is often still the last trade until those auctions post, so 45 minutes covers
 * both and leaves a short gap for the daily bar to show up. The retry in CI is later.
 */
export const SETTLE_BUFFER_MINUTES = 45;

/**
 * NYSE full closes in 2026. A holiday has no regular-session open and no official close.
 * A vendor bar that exists only for VIX is not a cash session.
 */
const HOLIDAYS: Record<string, string> = {
  "2026-01-01": "New Year's Day. The cash session is closed.",
  "2026-01-19": "Martin Luther King Jr. Day. The cash session is closed.",
  "2026-02-16": "Washington's Birthday. The cash session is closed.",
  "2026-04-03": "Good Friday. The cash session is closed.",
  "2026-05-25": "Memorial Day. The cash session is closed.",
  "2026-06-19": "Juneteenth. The cash session is closed.",
  "2026-07-03": "Independence Day observed. The cash session is closed.",
  "2026-09-07": "Labor Day. The cash session is closed.",
  "2026-11-26": "Thanksgiving Day. The cash session is closed.",
  "2026-12-25": "Christmas Day. The cash session is closed.",
};

/**
 * NYSE 1:00 PM ET early closes in 2026. The official close is that day's daily bar.
 * There is no 4:00 PM print, so a 16:00 lookup would leave the grade blank.
 */
const EARLY_CLOSES: Record<string, string> = {
  "2026-11-27": "The day after Thanksgiving is an early close. The official close is 1:00 PM ET.",
  "2026-12-24": "Christmas Eve is an early close. The official close is 1:00 PM ET.",
};

export function calendarDayString(day: CalendarDay): string {
  return `${day.year}-${String(day.month).padStart(2, "0")}-${String(day.day).padStart(2, "0")}`;
}

export function parseCalendarDay(ymd: string): CalendarDay {
  const [year, month, day] = ymd.split("-").map(Number);
  return { year, month, day };
}

/** Calendar addition. This does not use a 24-hour step, so a DST weekend stays on the right wall date. */
export function addCalendarDays(day: CalendarDay, days: number): CalendarDay {
  const utc = new Date(Date.UTC(day.year, day.month - 1, day.day + days));
  return { year: utc.getUTCFullYear(), month: utc.getUTCMonth() + 1, day: utc.getUTCDate() };
}

export function marketHoliday(ymd: string): string | null {
  return HOLIDAYS[ymd] ?? null;
}

export function earlyCloseNote(ymd: string): string | null {
  return EARLY_CLOSES[ymd] ?? null;
}

/** Official cash-close clock, or null when the session does not exist. */
export function officialCloseClock(ymd: string): { hour: number; minute: number } | null {
  if (marketHoliday(ymd)) return null;
  if (earlyCloseNote(ymd)) return { hour: 13, minute: 0 };
  return { hour: 16, minute: 0 };
}

export function settlementDueAt(checkpoint: Date, bufferMinutes = SETTLE_BUFFER_MINUTES): Date {
  return new Date(checkpoint.getTime() + bufferMinutes * 60 * 1000);
}

export function settlementIsDue(checkpoint: Date, now: Date, bufferMinutes = SETTLE_BUFFER_MINUTES): boolean {
  return now.getTime() >= settlementDueAt(checkpoint, bufferMinutes).getTime();
}

/** Monday stays at 12:00 PM ET. Wednesday and Friday are the official cash close. */
export function readoutCheckpoint(day: CalendarDay, kind: "monday" | "wednesday" | "friday"): Date {
  if (kind === "monday") return zonedToUtc(day.year, day.month, day.day, 12, 0);
  const ymd = calendarDayString(day);
  const clock = officialCloseClock(ymd) ?? { hour: 16, minute: 0 };
  return zonedToUtc(day.year, day.month, day.day, clock.hour, clock.minute);
}

/**
 * One cohort, keyed by its readout Monday.
 * Collect: the previous Wednesday 12:00 PM ET through Sunday 5:00 PM ET.
 * Readouts: Monday 12:00 PM ET, then Wednesday and Friday at the official cash close.
 */
export function buildCohortWindow(monday: CalendarDay): CohortWindow {
  const wednesday = addCalendarDays(monday, 2);
  const friday = addCalendarDays(monday, 4);
  const prevWednesday = addCalendarDays(monday, -5);
  const sunday = addCalendarDays(monday, -1);
  return {
    mondayAt: readoutCheckpoint(monday, "monday"),
    wednesdayAt: readoutCheckpoint(wednesday, "wednesday"),
    fridayAt: readoutCheckpoint(friday, "friday"),
    collectStart: zonedToUtc(prevWednesday.year, prevWednesday.month, prevWednesday.day, 12, 0),
    collectEnd: zonedToUtc(sunday.year, sunday.month, sunday.day, 17, 0),
  };
}
