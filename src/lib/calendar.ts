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

export type CohortWindow = {
  collectStart: Date;
  collectEnd: Date;
  mondayAt: Date;
  wednesdayAt: Date;
  fridayAt: Date;
};

/**
 * One cohort, keyed by its readout Monday.
 * Collect: the previous Wednesday 12:00 PM ET through Sunday 5:00 PM ET.
 * Readouts: Monday, Wednesday, and Friday of that week, each at 12:00 PM ET.
 */
export function buildCohortWindow(monday: {
  year: number;
  month: number;
  day: number;
}): CohortWindow {
  const mondayNoon = zonedToUtc(monday.year, monday.month, monday.day, 12, 0);
  const mondayFive = zonedToUtc(monday.year, monday.month, monday.day, 17, 0);
  return {
    mondayAt: mondayNoon,
    wednesdayAt: addDays(mondayNoon, 2),
    fridayAt: addDays(mondayNoon, 4),
    collectStart: addDays(mondayNoon, -5),
    collectEnd: addDays(mondayFive, -1),
  };
}
