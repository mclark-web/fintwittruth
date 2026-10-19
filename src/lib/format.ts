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
 * The grade itself still uses the unfloored score.
 */
export function formatScore(score: number, digits = 0): string {
  if (!Number.isFinite(score)) return digits > 0 ? (0).toFixed(digits) : "0";
  const floored = Math.floor(score);
  return digits > 0 ? floored.toFixed(digits) : String(floored);
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

/** Noon on the Monday of the week, back three calendar days, is the prior Friday close's day. */
export function priorFridayClose(mondayAt: Date): Date {
  return new Date(mondayAt.getTime() - 3 * 24 * 60 * 60 * 1000);
}

export function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
