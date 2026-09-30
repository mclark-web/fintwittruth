import { buildCohortWindow } from "./calendar";
import file from "./live-calls.json";
import { SYMBOLS } from "./demo-data";
import type { Conviction, Direction, Level, LevelRole, Sentiment } from "./scoring";

export type LiveCallRecord = {
  id: string;
  handle: string;
  displayName: string;
  bio: string;
  posture: string;
  accent: string;
  bucket: "watchlist" | "viral";
  postedAt: string;
  sourceUrl: string;
  direction: Direction;
  conviction: Conviction;
  primary: string;
  sentiment: Sentiment;
  toneLabel: string;
  engagement: number;
  tickers: string[];
  explicit: boolean;
  levels: Level[];
  body: string;
  verification: string;
};

export type LiveCohortRecord = {
  slug: string;
  historySlug: string;
  title: string;
  summary: string;
  monday: { year: number; month: number; day: number };
  calls: LiveCallRecord[];
};

export type LiveFile = {
  version: number;
  cohorts: LiveCohortRecord[];
};

const LEVEL_ROLES: LevelRole[] = ["target", "invalidation", "support", "resistance"];

export function liveFile(): LiveFile {
  return file as LiveFile;
}

export function assertLiveFile(data: LiveFile = liveFile()): LiveCohortRecord[] {
  if (data.version !== 1 || !Array.isArray(data.cohorts)) {
    throw new Error("live-calls.json is not a version 1 book. Refusing to seed it.");
  }
  const seenUrls = new Set<string>();
  const seenHandles = new Set<string>();
  for (const cohort of data.cohorts) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cohort.slug)) {
      throw new Error(`Live cohort slug ${cohort.slug} must be the readout Monday.`);
    }
    const window = buildCohortWindow(cohort.monday);
    const [year, month, day] = cohort.slug.split("-").map(Number);
    if (cohort.monday.year !== year || cohort.monday.month !== month || cohort.monday.day !== day) {
      throw new Error(`Live cohort ${cohort.slug} does not match its Monday date.`);
    }
    for (const call of cohort.calls) {
      assertLiveCall(call, window, seenUrls);
      if (seenHandles.has(call.handle) && data.cohorts.some((other) => other !== cohort && other.calls.some((item) => item.handle === call.handle))) {
        throw new Error(`Handle @${call.handle} is repeated across live cohorts.`);
      }
      seenHandles.add(call.handle);
    }
  }
  return data.cohorts;
}

export function assertLiveCall(
  call: LiveCallRecord,
  window: { collectStart: Date; collectEnd: Date },
  seenUrls: Set<string> = new Set(),
): void {
  if (!/^https:\/\/\S+$/.test(call.sourceUrl)) {
    throw new Error(`Call ${call.id} needs an https source URL. Refusing to invent one.`);
  }
  if (seenUrls.has(call.sourceUrl)) {
    throw new Error(`Source URL already in the book: ${call.sourceUrl}`);
  }
  seenUrls.add(call.sourceUrl);
  if (!/^[A-Za-z0-9_]{2,30}$/.test(call.handle)) {
    throw new Error(`Handle @${call.handle} is not a public handle token.`);
  }
  if (!call.displayName.trim() || !call.body.trim()) {
    throw new Error(`Call ${call.id} is missing a name or the post text.`);
  }
  if (call.body.length < 40) {
    throw new Error(`Call ${call.id} body is too short to be the public post.`);
  }
  if (call.direction !== "bullish" && call.direction !== "bearish") {
    throw new Error(`Call ${call.id} direction must be bullish or bearish.`);
  }
  if (call.sentiment !== "panic" && call.sentiment !== "meltup") {
    throw new Error(`Call ${call.id} sentiment must be panic or meltup.`);
  }
  if (!["high", "medium", "low"].includes(call.conviction)) {
    throw new Error(`Call ${call.id} conviction is not high, medium, or low.`);
  }
  if (!SYMBOLS.includes(call.primary)) {
    throw new Error(`Call ${call.id} primary ${call.primary} has no Yahoo print in this book.`);
  }
  const postedAt = new Date(call.postedAt);
  if (Number.isNaN(postedAt.getTime())) {
    throw new Error(`Call ${call.id} postedAt is not a timestamp. Refusing to invent one.`);
  }
  if (postedAt < window.collectStart || postedAt > window.collectEnd) {
    throw new Error(
      `Call ${call.id} at ${call.postedAt} is outside the Wednesday 12:00 PM ET to Sunday 5:00 PM ET collect window.`,
    );
  }
  if (!call.verification.trim()) {
    throw new Error(`Call ${call.id} has no verification note. Refusing to store an undocumented post.`);
  }
  if (call.explicit && call.tickers.length === 0) {
    throw new Error(`Call ${call.id} is marked explicit without a named ticker.`);
  }
  if (!call.explicit && call.tickers.length > 0) {
    throw new Error(`Call ${call.id} names tickers but is not marked explicit.`);
  }
  for (const level of call.levels) {
    if (!SYMBOLS.includes(level.symbol) || !LEVEL_ROLES.includes(level.role)) {
      throw new Error(`Call ${call.id} has a level that is not a recorded symbol and role.`);
    }
    if (typeof level.price !== "number" || !Number.isFinite(level.price)) {
      throw new Error(`Call ${call.id} level is missing a price. Refusing to invent one.`);
    }
  }
  if (call.engagement !== 0) {
    throw new Error(`Call ${call.id} engagement must be 0. This book does not invent reach.`);
  }
}
