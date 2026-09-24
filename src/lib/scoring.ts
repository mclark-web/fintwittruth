/** GC % at or above this line is STRONG. */
export const STRONG_LINE = 70;
/** GC % under this line is WEAK. 0 stays empty and is not WEAK. */
export const WEAK_LINE = 40;
export const DIRECTION_MAX = 50;
export const LEVEL_MAX = 20;
export const SPECIFICITY_MAX = 15;
export const VIX_MAX = 15;

export const EQUITY_TAPE = ["SPY", "QQQ", "DIA"] as const;

export const READOUTS = ["monday-gap", "monday", "wednesday", "friday"] as const;
export type ReadoutKind = (typeof READOUTS)[number];

export function isReadoutKind(value: string): value is ReadoutKind {
  return (READOUTS as readonly string[]).includes(value);
}

export type Direction = "bullish" | "bearish";
export type Conviction = "high" | "medium" | "low";
export type LevelRole = "target" | "invalidation" | "support" | "resistance";
export type Sentiment = "panic" | "meltup";

export type Level = {
  symbol: string;
  price: number;
  role: LevelRole;
};

export type CallDraft = {
  direction: Direction;
  sentiment: Sentiment;
  primary: string;
  tickers: string[];
  levels: Level[];
  explicit: boolean;
};

export const DIRECTION_BANDS: { label: string; points: number }[] = [
  { label: "Tape favorable by 2% or more", points: 50 },
  { label: "Tape favorable by 1% up to 2%", points: 42 },
  { label: "Tape favorable by 0.5% up to 1%", points: 34 },
  { label: "Tape favorable by 0.2% up to 0.5%", points: 26 },
  { label: "Tape favorable by 0.08% up to 0.2%", points: 20 },
  { label: "Tape inside a ±0.08% push", points: 14 },
  { label: "Tape adverse by up to 0.2%", points: 10 },
  { label: "Tape adverse by 0.2% up to 0.5%", points: 6 },
  { label: "Tape adverse by 0.5% up to 1%", points: 3 },
  { label: "Tape adverse by 1% or more", points: 0 },
];

export const VIX_BANDS: { label: string; points: number }[] = [
  { label: "VIX favorable by 10% or more", points: 15 },
  { label: "VIX favorable by 5% up to 10%", points: 12 },
  { label: "VIX favorable by 2% up to 5%", points: 9 },
  { label: "VIX favorable by 0.5% up to 2%", points: 6 },
  { label: "VIX inside ±0.5%", points: 3 },
  { label: "VIX adverse", points: 0 },
];

export const CONVICTION_WEIGHT: Record<Conviction, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

/** 0–9 → 1 … 90–100 → 10. One is the low end of the badge, ten is the high end. */
export function scoreToBadge(score: number): number {
  const clamped = Math.max(0, Math.min(100, score));
  if (clamped >= 90) return 10;
  return Math.floor(clamped / 10) + 1;
}

/** Equal-weight move of SPY, QQQ, and DIA from the Friday regular-session close. */
export function equityTapeMove(moves: Record<(typeof EQUITY_TAPE)[number], number>): number {
  return (moves.SPY + moves.QQQ + moves.DIA) / 3;
}

export function directionPoints(signedMove: number): number {
  if (signedMove >= 0.02) return 50;
  if (signedMove >= 0.01) return 42;
  if (signedMove >= 0.005) return 34;
  if (signedMove >= 0.002) return 26;
  if (signedMove >= 0.0008) return 20;
  if (signedMove > -0.0008) return 14;
  if (signedMove > -0.002) return 10;
  if (signedMove > -0.005) return 6;
  if (signedMove > -0.01) return 3;
  return 0;
}

/**
 * Panic and selloff calls want VIX higher. Melt-up calls want VIX lower.
 * `vixMove` is the raw change from Friday's VIX close.
 */
export function vixPoints(sentiment: Sentiment, vixMove: number): number {
  const favorable = sentiment === "panic" ? vixMove : -vixMove;
  if (favorable >= 0.1) return 15;
  if (favorable >= 0.05) return 12;
  if (favorable >= 0.02) return 9;
  if (favorable >= 0.005) return 6;
  if (favorable > -0.005) return 3;
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
  const band = call.levels.some((level) => level.role === "support" || level.role === "resistance")
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
  if (reached && !alreadyThere) return 20;
  if (reached && alreadyThere) return 14;
  const dist = distance(now, price);
  if (dist <= 0.006) return 16;
  if (dist <= 0.012) return 12;
  if (dist <= 0.02) return 8;
  return 4;
}

export function levelPoints(call: CallDraft, ref: number, now: number): number {
  const relevant = call.levels.filter((level) => level.symbol === call.primary);
  if (relevant.length === 0) return 4;

  const busted = relevant.some((level) => {
    if (level.role !== "invalidation") return false;
    return call.direction === "bullish" ? now <= level.price : now >= level.price;
  });
  if (busted) return 2;

  const scores = relevant.map((level) => {
    if (level.role === "target") return targetPoints(call.direction, ref, now, level.price);
    if (level.role === "invalidation") return 16;
    const held = level.role === "support" ? now >= level.price : now <= level.price;
    const tagged = distance(now, level.price) <= 0.008;
    if (tagged && held) return 16;
    if (held) return 10;
    return 3;
  });
  return Math.min(LEVEL_MAX, Math.max(...scores));
}

export type ScoreInput = {
  tapeMove: number;
  primaryRef: number;
  primaryNow: number;
  vixMove: number;
};

export type ScoreParts = {
  score: number;
  badge: number;
  directionPoints: number;
  levelPoints: number;
  specificityPoints: number;
  vixPoints: number;
  rawMovePct: number;
  signedMovePct: number;
  vixMovePct: number;
  isWeak: boolean;
};

export function scoreCall(call: CallDraft, input: ScoreInput): ScoreParts {
  const signedMovePct = call.direction === "bullish" ? input.tapeMove : -input.tapeMove;
  const direction = directionPoints(signedMovePct);
  const levels = levelPoints(call, input.primaryRef, input.primaryNow);
  const specificity = specificityParts(call).total;
  const vix = vixPoints(call.sentiment, input.vixMove);
  const score = Math.max(0, Math.min(100, direction + levels + specificity + vix));
  return {
    score,
    badge: scoreToBadge(score),
    directionPoints: direction,
    levelPoints: levels,
    specificityPoints: specificity,
    vixPoints: vix,
    rawMovePct: input.tapeMove,
    signedMovePct,
    vixMovePct: input.vixMove,
    isWeak: score > 0 && score < WEAK_LINE,
  };
}

export type Ranked<T> = T & {
  peerRank: number;
  peerCount: number;
  isStrong: boolean;
  isWeak: boolean;
};

/**
 * Order is by score. peerRank is that order only.
 * 70 or more is STRONG, under 40 is WEAK, and the band between is neither.
 * A 0 is neither mark.
 */
export function rankPeers<T extends { score: number; tieBreak: string }>(
  rows: T[],
): Ranked<T>[] {
  const sorted = [...rows].sort(
    (a, b) => b.score - a.score || a.tieBreak.localeCompare(b.tieBreak),
  );
  const peerCount = sorted.length;
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
      isStrong: row.score >= STRONG_LINE,
      isWeak: row.score > 0 && row.score < WEAK_LINE,
    };
  });
}

export function weekendNoise(
  tags: Sentiment[],
  engagement?: number[],
): { panicShare: number; meltupShare: number; engagementPanicShare: number } {
  const total = tags.length || 1;
  const panicShare = tags.filter((tag) => tag === "panic").length / total;
  const weights = engagement ?? tags.map(() => 1);
  const weightSum = weights.reduce((sum, value) => sum + value, 0) || 1;
  const engagementPanicShare =
    tags.reduce((sum, tag, index) => sum + (tag === "panic" ? (weights[index] ?? 0) : 0), 0) / weightSum;
  return { panicShare, meltupShare: 1 - panicShare, engagementPanicShare };
}

export function gradeNote(input: {
  kind: ReadoutKind;
  direction: Direction;
  rawMovePct: number;
  vixMovePct: number;
  score: number;
}): string {
  const when = {
    "monday-gap": "Monday gap, from Friday's regular-session close to the regular-session open",
    monday: "Monday 12:00 PM ET, the open of the 5-minute bar",
    wednesday: "Wednesday noon, same weekend cohort",
    friday: "Friday noon, same weekend cohort",
  }[input.kind];
  const pct = `${input.rawMovePct >= 0 ? "+" : ""}${(input.rawMovePct * 100).toFixed(2)}%`;
  const vix = `${input.vixMovePct >= 0 ? "+" : ""}${(input.vixMovePct * 100).toFixed(2)}%`;
  const helped =
    (input.direction === "bullish" && input.rawMovePct >= 0.0008) ||
    (input.direction === "bearish" && input.rawMovePct <= -0.0008);
  const hurt =
    (input.direction === "bullish" && input.rawMovePct <= -0.0008) ||
    (input.direction === "bearish" && input.rawMovePct >= 0.0008);
  const relation = helped ? "with" : hurt ? "against" : "flat versus";
  const territory =
    input.score <= 0
      ? " GC Scale is 0%: EXIT LIQUIDITY."
      : input.score >= STRONG_LINE
        ? " That score is STRONG."
        : input.score < WEAK_LINE
          ? " That score is WEAK."
          : " That score is PROVISIONAL.";
  return `${when}: equal-weight SPY, QQQ, and DIA are ${pct} from Friday's regular-session close, ${relation} this ${input.direction} call. VIX is ${vix} from Friday's close.${territory} This is a scorecard, not a signal.`;
}

export function tapeDirection(rawMovePct: number): "bullish" | "bearish" | "flat" {
  if (rawMovePct >= 0.0008) return "bullish";
  if (rawMovePct <= -0.0008) return "bearish";
  return "flat";
}

export function consensusDirection(bullishShare: number): "bullish" | "bearish" | "split" {
  if (bullishShare >= 0.55) return "bullish";
  if (bullishShare <= 0.45) return "bearish";
  return "split";
}
