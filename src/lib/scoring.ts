export const CHUD_THRESHOLD = 70;
export const CHAD_FRACTION = 0.3;
export const DIRECTION_MAX = 60;
export const LEVEL_MAX = 25;
export const SPECIFICITY_MAX = 15;

export const READOUTS = ["monday", "wednesday", "friday"] as const;
export type ReadoutKind = (typeof READOUTS)[number];

export type Direction = "bullish" | "bearish";
export type Conviction = "high" | "medium" | "low";
export type LevelRole = "target" | "invalidation" | "support" | "resistance";

export type Level = {
  symbol: string;
  price: number;
  role: LevelRole;
};

export type CallDraft = {
  direction: Direction;
  primary: string;
  tickers: string[];
  levels: Level[];
  explicit: boolean;
};

export const DIRECTION_BANDS: { label: string; points: number }[] = [
  { label: "Favorable by 2% or more", points: 60 },
  { label: "Favorable by 1% up to 2%", points: 54 },
  { label: "Favorable by 0.5% up to 1%", points: 46 },
  { label: "Favorable by 0.2% up to 0.5%", points: 36 },
  { label: "Favorable by 0.08% up to 0.2%", points: 30 },
  { label: "Inside a ±0.08% push", points: 22 },
  { label: "Adverse by up to 0.2%", points: 14 },
  { label: "Adverse by 0.2% up to 0.5%", points: 8 },
  { label: "Adverse by 0.5% up to 1%", points: 4 },
  { label: "Adverse by 1% or more", points: 0 },
];

export const CONVICTION_WEIGHT: Record<Conviction, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

/** 0–9 → 1 … 90–100 → 10. One is the Chud end of the badge, ten is the Chad end. */
export function scoreToBadge(score: number): number {
  const clamped = Math.max(0, Math.min(100, score));
  if (clamped >= 90) return 10;
  return Math.floor(clamped / 10) + 1;
}

export function directionPoints(signedMove: number): number {
  if (signedMove >= 0.02) return 60;
  if (signedMove >= 0.01) return 54;
  if (signedMove >= 0.005) return 46;
  if (signedMove >= 0.002) return 36;
  if (signedMove >= 0.0008) return 30;
  if (signedMove > -0.0008) return 22;
  if (signedMove > -0.002) return 14;
  if (signedMove > -0.005) return 8;
  if (signedMove > -0.01) return 4;
  return 0;
}

export function specificityParts(call: CallDraft): {
  ticker: number;
  target: number;
  invalidation: number;
  band: number;
  total: number;
} {
  const ticker = call.explicit && call.tickers.length > 0 ? 5 : 0;
  const target = call.levels.some((level) => level.role === "target") ? 4 : 0;
  const invalidation = call.levels.some((level) => level.role === "invalidation") ? 3 : 0;
  const band = call.levels.some(
    (level) => level.role === "support" || level.role === "resistance",
  )
    ? 3
    : 0;
  return {
    ticker,
    target,
    invalidation,
    band,
    total: Math.min(SPECIFICITY_MAX, ticker + target + invalidation + band),
  };
}

function distance(now: number, price: number): number {
  return Math.abs(now - price) / price;
}

function targetPoints(direction: Direction, ref: number, now: number, price: number): number {
  const reached = direction === "bullish" ? now >= price : now <= price;
  const alreadyThere = direction === "bullish" ? ref >= price : ref <= price;
  if (reached && !alreadyThere) return 25;
  if (reached && alreadyThere) return 16;
  const dist = distance(now, price);
  if (dist <= 0.006) return 22;
  if (dist <= 0.012) return 16;
  if (dist <= 0.02) return 11;
  return 5;
}

/**
 * Level points reward a stated target and a respected invalidation.
 * A busted invalidation caps the component — a distant target cannot hide it.
 * Unspecified calls keep a low floor so vibes cannot fill the 25-point bucket.
 */
export function levelPoints(call: CallDraft, ref: number, now: number): number {
  const relevant = call.levels.filter((level) => level.symbol === call.primary);
  if (relevant.length === 0) return 6;

  const busted = relevant.some((level) => {
    if (level.role !== "invalidation") return false;
    return call.direction === "bullish" ? now <= level.price : now >= level.price;
  });
  if (busted) return 2;

  const scores = relevant.map((level) => {
    if (level.role === "target") return targetPoints(call.direction, ref, now, level.price);
    if (level.role === "invalidation") return 20;
    const held =
      level.role === "support" ? now >= level.price : now <= level.price;
    const tagged = distance(now, level.price) <= 0.008;
    if (tagged && held) return 22;
    if (held) return 12;
    return 4;
  });
  return Math.min(LEVEL_MAX, Math.max(...scores));
}

export type ScoreParts = {
  score: number;
  badge: number;
  directionPoints: number;
  levelPoints: number;
  specificityPoints: number;
  rawMovePct: number;
  signedMovePct: number;
  isChudTerritory: boolean;
};

export function scoreCall(
  call: CallDraft,
  ref: number,
  now: number,
): ScoreParts {
  const rawMovePct = (now - ref) / ref;
  const signedMovePct = call.direction === "bullish" ? rawMovePct : -rawMovePct;
  const direction = directionPoints(signedMovePct);
  const levels = levelPoints(call, ref, now);
  const specificity = specificityParts(call).total;
  const score = Math.max(0, Math.min(100, direction + levels + specificity));
  return {
    score,
    badge: scoreToBadge(score),
    directionPoints: direction,
    levelPoints: levels,
    specificityPoints: specificity,
    rawMovePct,
    signedMovePct,
    isChudTerritory: score < CHUD_THRESHOLD,
  };
}

export type Ranked<T> = T & {
  peerRank: number;
  peerCount: number;
  isChad: boolean;
  isChudTerritory: boolean;
};

/** Top 30% of the peer set, with ties at the cutoff included. */
export function rankPeers<T extends { score: number; tieBreak: string }>(
  rows: T[],
): Ranked<T>[] {
  const sorted = [...rows].sort(
    (a, b) => b.score - a.score || a.tieBreak.localeCompare(b.tieBreak),
  );
  const peerCount = sorted.length;
  const slots = peerCount === 0 ? 0 : Math.max(1, Math.ceil(peerCount * CHAD_FRACTION));
  const cutoff = slots === 0 ? Number.POSITIVE_INFINITY : sorted[slots - 1].score;
  let lastScore: number | null = null;
  let lastRank = 0;
  return sorted.map((row, index) => {
    const peerRank = row.score === lastScore ? lastRank : index + 1;
    lastScore = row.score;
    lastRank = peerRank;
    return {
      ...row,
      peerRank,
      peerCount,
      isChad: peerCount > 0 && row.score >= cutoff,
      isChudTerritory: row.score < CHUD_THRESHOLD,
    };
  });
}

export function gradeNote(input: {
  kind: ReadoutKind;
  direction: Direction;
  symbol: string;
  rawMovePct: number;
  score: number;
}): string {
  const when = {
    monday: "Monday 12:00 PM ET weekend-noise grade",
    wednesday: "Wednesday 12:00 PM ET, same weekend cohort",
    friday: "Friday 12:00 PM ET, same weekend cohort",
  }[input.kind];
  const pct = `${input.rawMovePct >= 0 ? "+" : ""}${(input.rawMovePct * 100).toFixed(2)}%`;
  const helped =
    (input.direction === "bullish" && input.rawMovePct >= 0.0008) ||
    (input.direction === "bearish" && input.rawMovePct <= -0.0008);
  const hurt =
    (input.direction === "bullish" && input.rawMovePct <= -0.0008) ||
    (input.direction === "bearish" && input.rawMovePct >= 0.0008);
  const relation = helped ? "with" : hurt ? "against" : "flat versus";
  const territory = input.score < CHUD_THRESHOLD ? " That score is in Chud territory." : "";
  return `${when}: ${input.symbol} is ${pct} from the Sunday reference, ${relation} this ${input.direction} call.${territory}`;
}

export function tapeDirection(rawMovePct: number): "bullish" | "bearish" | "flat" {
  if (rawMovePct >= 0.0008) return "bullish";
  if (rawMovePct <= -0.0008) return "bearish";
  return "flat";
}

export function consensusDirection(
  bullishShare: number,
): "bullish" | "bearish" | "split" {
  if (bullishShare >= 0.55) return "bullish";
  if (bullishShare <= 0.45) return "bearish";
  return "split";
}
