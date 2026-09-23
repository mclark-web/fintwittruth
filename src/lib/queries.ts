import { cache } from "react";
import { handleBoardStats } from "./board";
import { FEATURED_COHORT_SLUG } from "./demo-data";
import { prisma } from "./prisma";
import {
  READOUTS,
  isReadoutKind,
  rankPeers,
  type Conviction,
  type Direction,
  type Level,
  type ReadoutKind,
  type Sentiment,
} from "./scoring";

export type Bucket = "watchlist" | "viral";

export type GradeView = {
  readout: ReadoutKind;
  score: number;
  badge: number;
  directionPoints: number;
  levelPoints: number;
  specificityPoints: number;
  vixPoints: number;
  rawMovePct: number;
  signedMovePct: number;
  vixMovePct: number;
  isStrong: boolean;
  isWeak: boolean;
  peerRank: number;
  peerCount: number;
  note: string;
};

export type CallView = {
  id: string;
  handle: string;
  displayName: string;
  accent: string;
  posture: string;
  bio: string;
  bucket: Bucket;
  body: string;
  direction: Direction;
  conviction: Conviction;
  primary: string;
  sentiment: Sentiment;
  engagement: number;
  tickers: string[];
  levels: Level[];
  explicit: boolean;
  postedAt: Date;
  cohortSlug: string;
  cohortTitle: string;
  dataset: "live" | "demo";
  sourceUrl: string;
  toneLabel: string;
  grades: Record<ReadoutKind, GradeView | null>;
};

export type QuoteView = {
  symbol: string;
  name: string;
  ref: number;
  mondayOpen: number | null;
  monday: number | null;
  wednesday: number | null;
  friday: number | null;
};

export type ReadoutView = {
  kind: ReadoutKind;
  status: "published" | "scheduled";
  consensusBullish: number;
  consensusBearish: number;
  consensusDirection: string;
  realizedDirection: string;
  benchmarkSymbol: string;
  benchmarkMovePct: number;
  strongCutoff: number;
  narrative: string;
  at: Date;
};

export type CohortView = {
  slug: string;
  title: string;
  summary: string;
  dataset: string;
  isLatest: boolean;
  collectStart: Date;
  collectEnd: Date;
  mondayAt: Date;
  wednesdayAt: Date;
  fridayAt: Date;
  quotes: QuoteView[];
  readouts: Record<ReadoutKind, ReadoutView>;
  calls: CallView[];
};

export type CohortCard = {
  slug: string;
  title: string;
  summary: string;
  isLatest: boolean;
  dataset: "live" | "demo";
  collectStart: Date;
  collectEnd: Date;
  mondayAt: Date;
  averages: Record<ReadoutKind, number | null>;
  statuses: Record<ReadoutKind, "published" | "scheduled">;
};

export type LeaderRow = {
  handle: string;
  displayName: string;
  accent: string;
  posture: string;
  bio: string;
  callCount: number;
  avgScore: number;
  badge: number;
  strongRate: number;
  weakRate: number;
  hitRate: number;
  isStrong: boolean;
  isWeak: boolean;
  peerRank: number;
  peerCount: number;
  bestScore: number;
  worstScore: number;
};

function asDirection(value: string): Direction {
  if (value !== "bullish" && value !== "bearish") {
    throw new Error(`Unexpected direction: ${value}`);
  }
  return value;
}

function asConviction(value: string): Conviction {
  if (value !== "high" && value !== "medium" && value !== "low") {
    throw new Error(`Unexpected conviction: ${value}`);
  }
  return value;
}

function asReadout(value: string): ReadoutKind {
  if (!isReadoutKind(value)) {
    throw new Error(`Unexpected readout: ${value}`);
  }
  return value;
}

function asBucket(value: string): Bucket {
  if (value !== "watchlist" && value !== "viral") {
    throw new Error(`Unexpected bucket: ${value}`);
  }
  return value;
}

function asSentiment(value: string): Sentiment {
  if (value !== "panic" && value !== "meltup") {
    throw new Error(`Unexpected sentiment: ${value}`);
  }
  return value;
}

function asStatus(value: string): "published" | "scheduled" {
  if (value !== "published" && value !== "scheduled") {
    throw new Error(`Unexpected status: ${value}`);
  }
  return value;
}

function emptyGrades(): Record<ReadoutKind, GradeView | null> {
  return { "monday-gap": null, monday: null, wednesday: null, friday: null };
}

function readoutAt(
  cohort: { mondayAt: Date; wednesdayAt: Date; fridayAt: Date },
  kind: ReadoutKind,
): Date {
  if (kind === "monday-gap") return new Date(cohort.mondayAt.getTime() - 2.5 * 60 * 60 * 1000);
  if (kind === "monday") return cohort.mondayAt;
  if (kind === "wednesday") return cohort.wednesdayAt;
  return cohort.fridayAt;
}

type CallRecord = {
  id: string;
  postedAt: Date;
  body: string;
  direction: string;
  conviction: string;
  primary: string;
  sentiment: string;
  engagement: number;
  tickersJson: string;
  levelsJson: string;
  explicit: boolean;
  sourceUrl: string;
  toneLabel: string;
  account: {
    handle: string;
    displayName: string;
    accent: string;
    posture: string;
    bio: string;
    bucket: string;
  };
  cohort: { slug: string; title: string; dataset: string };
  grades: {
    readout: string;
    score: number;
    badge: number;
    directionPoints: number;
    levelPoints: number;
    specificityPoints: number;
    vixPoints: number;
    rawMovePct: number;
    signedMovePct: number;
    vixMovePct: number;
    isStrong: boolean;
    isWeak: boolean;
    peerRank: number;
    peerCount: number;
    note: string;
  }[];
};

function mapCall(call: CallRecord): CallView {
  const grades = emptyGrades();
  for (const grade of call.grades) {
    const readout = asReadout(grade.readout);
    grades[readout] = {
      readout,
      score: grade.score,
      badge: grade.badge,
      directionPoints: grade.directionPoints,
      levelPoints: grade.levelPoints,
      specificityPoints: grade.specificityPoints,
      vixPoints: grade.vixPoints,
      rawMovePct: grade.rawMovePct,
      signedMovePct: grade.signedMovePct,
      vixMovePct: grade.vixMovePct,
      isStrong: grade.isStrong,
      isWeak: grade.isWeak,
      peerRank: grade.peerRank,
      peerCount: grade.peerCount,
      note: grade.note,
    };
  }
  return {
    id: call.id,
    handle: call.account.handle,
    displayName: call.account.displayName,
    accent: call.account.accent,
    posture: call.account.posture,
    bio: call.account.bio,
    bucket: asBucket(call.account.bucket),
    body: call.body,
    direction: asDirection(call.direction),
    conviction: asConviction(call.conviction),
    primary: call.primary,
    sentiment: asSentiment(call.sentiment),
    engagement: call.engagement,
    tickers: JSON.parse(call.tickersJson) as string[],
    levels: JSON.parse(call.levelsJson) as Level[],
    explicit: call.explicit,
    postedAt: call.postedAt,
    cohortSlug: call.cohort.slug,
    cohortTitle: call.cohort.title,
    dataset: call.cohort.dataset === "live" ? "live" : "demo",
    sourceUrl: call.sourceUrl,
    toneLabel: call.toneLabel,
    grades,
  };
}

const callInclude = {
  account: true,
  cohort: { select: { slug: true, title: true, dataset: true } },
  grades: true,
} as const;

export function matureGrade(call: CallView): GradeView | null {
  return call.grades.friday ?? call.grades.wednesday ?? call.grades.monday ?? call.grades["monday-gap"];
}

export function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export const getCohort = cache(async (slug: string): Promise<CohortView | null> => {
  const cohort = await prisma.cohort.findUnique({
    where: { slug },
    include: {
      quotes: { orderBy: { symbol: "asc" } },
      readouts: true,
      calls: { include: callInclude, orderBy: { postedAt: "asc" } },
    },
  });
  if (!cohort) return null;

  const readouts = {} as Record<ReadoutKind, ReadoutView>;
  for (const readout of cohort.readouts) {
    const kind = asReadout(readout.kind);
    const at = readoutAt(cohort, kind);
    readouts[kind] = {
      kind,
      status: asStatus(readout.status),
      consensusBullish: readout.consensusBullish,
      consensusBearish: readout.consensusBearish,
      consensusDirection: readout.consensusDirection,
      realizedDirection: readout.realizedDirection,
      benchmarkSymbol: readout.benchmarkSymbol,
      benchmarkMovePct: readout.benchmarkMovePct,
      strongCutoff: readout.strongCutoff,
      narrative: readout.narrative,
      at,
    };
  }

  return {
    slug: cohort.slug,
    title: cohort.title,
    summary: cohort.summary,
    dataset: cohort.dataset,
    isLatest: cohort.isLatest,
    collectStart: cohort.collectStart,
    collectEnd: cohort.collectEnd,
    mondayAt: cohort.mondayAt,
    wednesdayAt: cohort.wednesdayAt,
    fridayAt: cohort.fridayAt,
    quotes: cohort.quotes.map((quote) => ({
      symbol: quote.symbol,
      name: quote.name,
      ref: quote.ref,
      mondayOpen: quote.mondayOpen,
      monday: quote.monday,
      wednesday: quote.wednesday,
      friday: quote.friday,
    })),
    readouts,
    calls: cohort.calls.map(mapCall),
  };
});

export const getCohortList = cache(async (): Promise<CohortCard[]> => {
  const cohorts = await prisma.cohort.findMany({
    include: {
      readouts: true,
      calls: { include: { grades: true } },
    },
    orderBy: { mondayAt: "desc" },
  });

  return cohorts.map((cohort) => {
    const averages = {} as Record<ReadoutKind, number | null>;
    const statuses = {} as Record<ReadoutKind, "published" | "scheduled">;
    for (const kind of READOUTS) {
      const readout = cohort.readouts.find((item) => item.kind === kind);
      statuses[kind] = readout ? asStatus(readout.status) : "scheduled";
      const scores = cohort.calls.flatMap((call) =>
        call.grades.filter((grade) => grade.readout === kind).map((grade) => grade.score),
      );
      averages[kind] = average(scores);
    }
    return {
      slug: cohort.slug,
      title: cohort.title,
      summary: cohort.summary,
      isLatest: cohort.isLatest,
      dataset: cohort.dataset === "live" ? "live" : "demo",
      collectStart: cohort.collectStart,
      collectEnd: cohort.collectEnd,
      mondayAt: cohort.mondayAt,
      averages,
      statuses,
    };
  });
});

export const getLatestCohort = cache(async () => {
  const latest = await prisma.cohort.findFirst({ where: { isLatest: true, dataset: "live" } });
  if (!latest) return null;
  return getCohort(latest.slug);
});

export const getFeaturedCohort = cache(async () => getCohort(FEATURED_COHORT_SLUG));

export const getLeaderboard = cache(async (bucket: Bucket, dataset: "live" | "demo" = "demo"): Promise<LeaderRow[]> => {
  const accounts = await prisma.account.findMany({
    where: { bucket },
    include: {
      calls: { include: { grades: true, cohort: { select: { dataset: true } } } },
    },
  });

  const drafts = accounts.flatMap((account) => {
    const calls = account.calls.filter((call) => call.cohort.dataset === dataset);
    const stats = handleBoardStats(calls);
    if (!stats.graded) return [];
    return [
      {
        handle: account.handle,
        displayName: account.displayName,
        accent: account.accent,
        posture: account.posture,
        bio: account.bio,
        callCount: stats.callCount,
        avgScore: stats.avgScore,
        badge: stats.badge,
        strongRate: stats.strongRate,
        weakRate: stats.weakRate,
        hitRate: stats.hitRate,
        bestScore: stats.bestScore,
        worstScore: stats.worstScore,
        score: stats.avgScore,
        tieBreak: account.handle,
      },
    ];
  });

  return rankPeers(drafts).map((row) => ({
    handle: row.handle,
    displayName: row.displayName,
    accent: row.accent,
    posture: row.posture,
    bio: row.bio,
    callCount: row.callCount,
    avgScore: row.avgScore,
    badge: row.badge,
    strongRate: row.strongRate,
    weakRate: row.weakRate,
    hitRate: row.hitRate,
    isStrong: row.isStrong,
    isWeak: row.isWeak,
    peerRank: row.peerRank,
    peerCount: row.peerCount,
    bestScore: row.bestScore,
    worstScore: row.worstScore,
  }));
});

export const getAccount = cache(async (handle: string) => {
  const account = await prisma.account.findUnique({
    where: { handle },
    include: {
      calls: {
        include: callInclude,
        orderBy: { postedAt: "desc" },
      },
    },
  });
  if (!account) return null;
  const bucket = asBucket(account.bucket);
  const dataset = account.calls.some((call) => call.cohort.dataset === "live") ? "live" : "demo";
  const board = await getLeaderboard(bucket, dataset);
  const row = board.find((item) => item.handle === handle) ?? null;
  return {
    handle: account.handle,
    displayName: account.displayName,
    bio: account.bio,
    posture: account.posture,
    accent: account.accent,
    bucket,
    row,
    calls: account.calls.map(mapCall),
  };
});

export const getCall = cache(async (id: string) => {
  const call = await prisma.call.findUnique({
    where: { id },
    include: callInclude,
  });
  if (!call) return null;
  const cohort = await getCohort(call.cohort.slug);
  return { call: mapCall(call), cohort };
});

export async function listCohortSlugs() {
  const cohorts = await prisma.cohort.findMany({ select: { slug: true } });
  return cohorts.map((cohort) => cohort.slug);
}

export async function listHandles() {
  const accounts = await prisma.account.findMany({ select: { handle: true } });
  return accounts.map((account) => account.handle);
}

export async function listCallIds() {
  const calls = await prisma.call.findMany({ select: { id: true } });
  return calls.map((call) => call.id);
}
