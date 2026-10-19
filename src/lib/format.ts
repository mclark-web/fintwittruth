import { addCalendarDays, calendarDayString, marketHoliday, parseCalendarDay, zonedToUtc } from "./calendar";

const TIME_ZONE = "America/New_York";

export function formatWhen(date: Date | string): string {
  const value = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(value);
}

/**
 * Same clock style as the October 19 scope sentence: "Friday, October 16 at 10:22 AM ET".
 * The zone is written ET. It does not switch to EDT or EST.
 */
export function formatScopeWhen(date: Date | string): string {
  const value = typeof date === "string" ? new Date(date) : date;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h12",
  }).formatToParts(value);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("weekday")}, ${get("month")} ${get("day")} at ${get("hour")}:${get("minute")} ${get("dayPeriod")} ET`;
}

/** Clock in Eastern Time with the zone written ET, plus the calendar date. */
export function formatEtStamp(date: Date | string): string {
  const value = typeof date === "string" ? new Date(date) : date;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h12",
  }).formatToParts(value);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("month")} ${get("day")}, ${get("year")} at ${get("hour")}:${get("minute")} ${get("dayPeriod")} ET`;
}

export function formatDay(date: Date | string): string {
  const value = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(value);
}

/** America/New_York calendar date, YYYY-MM-DD. */
export function etYmd(date: Date | string): string {
  const value = typeof date === "string" ? new Date(date) : date;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function formatShortDay(date: Date | string): string {
  const value = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    month: "short",
    day: "numeric",
  }).format(value);
}

export function formatPct(value: number, digits = 2): string {
  const pct = value * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(digits)}%`;
}

/** Unsigned share, for rates such as "Hit 50%". A plus sign is never added. */
export function formatRate(value: number, digits = 0): string {
  return `${(Math.abs(value) * 100).toFixed(digits)}%`;
}

export function formatAsOf(date: Date | string): string {
  const value = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(value);
}

/** One decimal from the call-time reference. Positive uses `+`; negative uses a minus sign. */
export function formatSignedPct(value: number): string {
  const rounded = Math.round(value * 1000) / 10;
  const body = Math.abs(rounded).toFixed(1);
  if (rounded > 0) return `+${body}%`;
  if (rounded < 0) return `\u2212${body}%`;
  return "0.0%";
}

/** ▲ when the rounded move is up, ▼ when it is down. The hue is decided separately. */
export function moveArrow(value: number): "▲" | "▼" | "" {
  const rounded = Math.round(value * 1000) / 10;
  if (rounded > 0) return "▲";
  if (rounded < 0) return "▼";
  return "";
}

export function formatPrice(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * GC percent for display. Floors so 39.5 reads 39 and stays in the WEAK band.
 * A positive score under 1 reads "<1", so the UI shows "<1%" rather than "0%".
 * The grade itself still uses the unfloored score.
 */
export function formatScore(score: number, _digits = 0): string {
  if (!Number.isFinite(score) || score <= 0) return "0";
  if (score < 1) return "<1";
  return String(Math.floor(score));
}

/** "Mon Sep 21, 12:00 PM ET". The zone label stays ET. */
export function formatCheckpointStamp(date: Date | string): string {
  const value = typeof date === "string" ? new Date(date) : date;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(value);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("weekday")} ${get("month")} ${get("day")}, ${get("hour")}:${get("minute")} ${get("dayPeriod")} ET`;
}

/** "Fri Sep 18". */
export function formatWeekday(date: Date | string): string {
  const value = typeof date === "string" ? new Date(date) : date;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).formatToParts(value);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("weekday")} ${get("month")} ${get("day")}`;
}

function weekdayIndex(day: { year: number; month: number; day: number }): number {
  return new Date(Date.UTC(day.year, day.month - 1, day.day)).getUTCDay();
}

/** A cash session exists on this calendar day. Weekends and full holidays do not. */
export function isTradingDay(ymd: string): boolean {
  const day = parseCalendarDay(ymd);
  const dow = weekdayIndex(day);
  return dow >= 1 && dow <= 5 && marketHoliday(ymd) == null;
}

function closeOn(ymd: string): Date {
  const day = parseCalendarDay(ymd);
  return zonedToUtc(day.year, day.month, day.day, 16, 0);
}

/**
 * Last cash session before the weekend that follows this readout Monday.
 * Friday is the usual day. A Friday holiday, such as Good Friday, steps back to Thursday.
 */
export function lastTradingDayBeforeWeekend(mondayAt: Date): Date {
  const monday = parseCalendarDay(etYmd(mondayAt));
  let day = addCalendarDays(monday, -3);
  for (let i = 0; i < 7; i++) {
    const ymd = calendarDayString(day);
    if (isTradingDay(ymd)) return closeOn(ymd);
    day = addCalendarDays(day, -1);
  }
  return closeOn(calendarDayString(day));
}

/**
 * The close the label should name. A recorded reference date wins when that day traded.
 * Otherwise walk back from Friday so a market holiday is not labeled as the close.
 */
export function referenceCloseDay(mondayAt: Date, recordedYmd?: string | null): Date {
  if (recordedYmd && isTradingDay(recordedYmd)) return closeOn(recordedYmd);
  return lastTradingDayBeforeWeekend(mondayAt);
}

export function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
