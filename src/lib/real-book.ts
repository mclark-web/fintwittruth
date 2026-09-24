import { buildCohortWindow } from "./calendar";
import { isGradableSymbol } from "./gradable";
import type { IntakePost, ReviewedCall } from "./intake-types";
import history from "./market-history.json";
import { quotesForCohort, sessionClose, sessionFor, type CohortQuotePrint } from "./quotes";
import {
  EQUITY_TAPE,
  STRONG_LINE,
  WEAK_LINE,
  equityTapeMove,
  rankPeers,
  scoreCall,
  type Direction,
  type Level,
  type ReadoutKind,
} from "./scoring";

type HistoryFile = { cohorts: Record<string, unknown> };
const COHORT_SLUGS = Object.keys((history as HistoryFile).cohorts);

export type RealGradeView = {
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

export type RealCallView = {
  id: string;
  handle: string;
  authorName: string;
  text: string;
  sourceUrl: string;
  postedAt: string;
  postedAtLabel: string;
  symbol: string;
  direction: ReviewedCall["direction"];
  conviction: ReviewedCall["conviction"];
  horizon: string;
  sentiment: ReviewedCall["sentiment"];
  levels: Level[];
  cohortSlug: string | null;
  status: "confirmed" | "not_gradable";
  label: "Verified real call" | "Not gradable yet";
  ungradedReason: string | null;
  grades: Partial<Record<ReadoutKind, RealGradeView>>;
};

export function cohortSlugForPostedAt(iso: string): string | null {
  const posted = new Date(iso);
  if (Number.isNaN(posted.getTime())) return null;
  for (const slug of COHORT_SLUGS) {
    const [year, month, day] = slug.split("-").map(Number);
    if (!year || !month || !day) continue;
    const window = buildCohortWindow({ year, month, day });
    if (posted >= window.collectStart && posted <= window.collectEnd) return slug;
  }
  return null;
}

/** Same checkpoints as the demo book. Monday is the noon bar. Wednesday and Friday are the official close. */
const REAL_READOUTS = ["monday", "wednesday", "friday"] as const;
type RealReadout = (typeof REAL_READOUTS)[number];

export const REAL_READOUT_META: Record<RealReadout, { label: string; role: string }> = {
  monday: { label: "Monday 12:00 PM ET", role: "Open of the 12:00 PM ET 5-minute bar" },
  wednesday: { label: "Wednesday close", role: "4:00 PM ET regular-session close" },
  friday: { label: "Friday close", role: "4:00 PM ET regular-session close" },
};

function sessionCloseOrNull(slug: string, kind: "wednesday" | "friday", symbol: string): number | null {
  let session;
  try {
    session = sessionFor(slug, kind);
  } catch {
    return null;
  }
  if (!session || session.session !== "open" || !session.date) return null;
  try {
    return sessionClose(symbol, session.date);
  } catch {
    return null;
  }
}

function realPrice(slug: string, quote: CohortQuotePrint, kind: RealReadout): number | null {
  if (kind === "monday") return quote.monday;
  return sessionCloseOrNull(slug, kind, quote.symbol);
}

function realCheckpointNote(input: {
  kind: RealReadout;
  direction: Direction;
  rawMovePct: number;
  vixMovePct: number;
  score: number;
}): string {
  const when = {
    monday: "Monday 12:00 PM ET, the open of the 5-minute bar",
    wednesday: "Wednesday 4:00 PM ET regular-session close",
    friday: "Friday 4:00 PM ET regular-session close",
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

type Ready = {
  post: IntakePost;
  review: ReviewedCall;
  cohortSlug: string | null;
};

function readyPosts(posts: IntakePost[]): Ready[] {
  return posts.flatMap((post) => {
    if ((post.status !== "confirmed" && post.status !== "not_gradable") || !post.review) return [];
    return [
      {
        post,
        review: post.review,
        cohortSlug: cohortSlugForPostedAt(post.review.postedAt),
      },
    ];
  });
}

/**
 * Grade confirmed real calls against recorded Yahoo prints.
 * Demo rows are not in this peer set. A missing print stays blank.
 */
export function gradeRealPosts(posts: IntakePost[]): RealCallView[] {
  const ready = readyPosts(posts);
  const gradesById = new Map<string, Partial<Record<ReadoutKind, RealGradeView>>>();

  const byCohort = new Map<string, Ready[]>();
  for (const item of ready) {
    if (!item.cohortSlug || !item.review.gradable || item.post.status !== "confirmed") continue;
    const list = byCohort.get(item.cohortSlug) ?? [];
    list.push(item);
    byCohort.set(item.cohortSlug, list);
  }

  for (const [slug, group] of byCohort) {
    let quotes: CohortQuotePrint[];
    try {
      const symbols = [...new Set([...EQUITY_TAPE, "VIX", ...group.map((item) => item.review.symbol)])];
      quotes = quotesForCohort(slug, symbols);
    } catch {
      continue;
    }
    const quoteFor = (symbol: string) => quotes.find((quote) => quote.symbol === symbol);

    for (const kind of REAL_READOUTS) {
      const needed = [...EQUITY_TAPE, "VIX", ...group.map((item) => item.review.symbol)];
      if (needed.some((symbol) => {
        const quote = quoteFor(symbol);
        return !quote || realPrice(slug, quote, kind) == null;
      })) {
        continue;
      }
      const moveOf = (symbol: string) => {
        const quote = quoteFor(symbol);
        const now = quote ? realPrice(slug, quote, kind) : null;
        if (!quote || now == null) throw new Error(`Missing ${kind} print for ${symbol}`);
        return (now - quote.ref) / quote.ref;
      };
      const tapeMove = equityTapeMove({
        SPY: moveOf("SPY"),
        QQQ: moveOf("QQQ"),
        DIA: moveOf("DIA"),
      });
      const vixMove = moveOf("VIX");
      const scored = group.map((item) => {
        const quote = quoteFor(item.review.symbol);
        const now = quote ? realPrice(slug, quote, kind) : null;
        if (!quote || now == null) throw new Error(`Missing ${kind} price for ${item.review.symbol}`);
        const parts = scoreCall(
          {
            direction: item.review.direction,
            sentiment: item.review.sentiment,
            primary: item.review.symbol,
            tickers: [item.review.symbol],
            levels: item.review.levels,
            explicit: true,
          },
          { tapeMove, primaryRef: quote.ref, primaryNow: now, vixMove },
        );
        return { item, parts, score: parts.score, tieBreak: item.post.handle };
      });
      const ranked = rankPeers(scored);
      for (const row of ranked) {
        const bag = gradesById.get(row.item.post.id) ?? {};
        bag[kind] = {
          readout: kind,
          score: row.parts.score,
          badge: row.parts.badge,
          directionPoints: row.parts.directionPoints,
          levelPoints: row.parts.levelPoints,
          specificityPoints: row.parts.specificityPoints,
          vixPoints: row.parts.vixPoints,
          rawMovePct: row.parts.rawMovePct,
          signedMovePct: row.parts.signedMovePct,
          vixMovePct: row.parts.vixMovePct,
          isStrong: row.isStrong,
          isWeak: row.isWeak,
          peerRank: row.peerRank,
          peerCount: row.peerCount,
          note: realCheckpointNote({
            kind,
            direction: row.item.review.direction,
            rawMovePct: row.parts.rawMovePct,
            vixMovePct: row.parts.vixMovePct,
            score: row.parts.score,
          }),
        };
        gradesById.set(row.item.post.id, bag);
      }
    }
  }

  return ready.map((item) => {
    const grades = gradesById.get(item.post.id) ?? {};
    const graded = Object.keys(grades).length > 0;
    let ungradedReason: string | null = null;
    let label: RealCallView["label"] = "Verified real call";
    if (item.post.status === "not_gradable" || !item.review.gradable || !isGradableSymbol(item.review.symbol)) {
      label = "Not gradable yet";
      ungradedReason = `${item.review.symbol} is not a symbol this board grades.`;
    } else if (!item.cohortSlug) {
      ungradedReason = "This post is outside the weeks with recorded Yahoo prints, so it is not graded.";
    } else if (!graded) {
      ungradedReason = "No Yahoo print is recorded for a settled horizon on this readout week yet.";
    }
    return {
      id: item.post.id,
      handle: item.post.handle,
      authorName: item.post.authorName,
      text: item.post.text,
      sourceUrl: item.post.sourceUrl,
      postedAt: item.review.postedAt,
      postedAtLabel: item.post.postedAtLabel,
      symbol: item.review.symbol,
      direction: item.review.direction,
      conviction: item.review.conviction,
      horizon: item.review.horizon,
      sentiment: item.review.sentiment,
      levels: item.review.levels,
      cohortSlug: item.cohortSlug,
      status: item.post.status === "not_gradable" || label === "Not gradable yet" ? "not_gradable" : "confirmed",
      label,
      ungradedReason: graded ? null : ungradedReason,
      grades,
    };
  });
}

export function realCallsForHandle(calls: RealCallView[], handle: string): RealCallView[] {
  const key = handle.toLowerCase();
  return calls.filter((call) => call.handle.toLowerCase() === key);
}
