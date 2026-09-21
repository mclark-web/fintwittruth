import { buildCohortWindow } from "./calendar";
import {
  ACCOUNTS,
  COHORTS,
  SYMBOLS,
  SYMBOL_NAMES,
  VIRAL_CALLS,
  materializeLevels,
  renderBody,
  type CallSpec,
  type CohortSpec,
} from "./demo-data";
import { quotesForCohort, sessionFor } from "./quotes";
import {
  CONVICTION_WEIGHT,
  EQUITY_TAPE,
  READOUTS,
  consensusDirection,
  equityTapeMove,
  gradeNote,
  rankPeers,
  scoreCall,
  tapeDirection,
  weekendNoise,
  type Conviction,
  type Direction,
  type Level,
  type ReadoutKind,
  type Sentiment,
} from "./scoring";

const POST_HOURS = [2, 6, 14, 22, 28, 36, 44, 52, 60, 68, 76, 84, 90, 96, 100, 10, 30, 50, 80];

export type BuiltAccount = {
  id: string;
  handle: string;
  displayName: string;
  bio: string;
  posture: string;
  accent: string;
  bucket: "watchlist" | "viral";
};

export type BuiltQuote = {
  id: string;
  cohortId: string;
  symbol: string;
  name: string;
  ref: number;
  mondayOpen: number | null;
  monday: number | null;
  wednesday: number | null;
  friday: number | null;
};

export type BuiltCall = {
  id: string;
  cohortId: string;
  accountId: string;
  handle: string;
  postedAt: Date;
  body: string;
  direction: Direction;
  conviction: Conviction;
  primary: string;
  sentiment: Sentiment;
  engagement: number;
  tickers: string[];
  levels: Level[];
  explicit: boolean;
};

export type BuiltGrade = {
  id: string;
  callId: string;
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
  isChad: boolean;
  isChudTerritory: boolean;
  peerRank: number;
  peerCount: number;
  note: string;
};

export type BuiltReadout = {
  id: string;
  cohortId: string;
  kind: ReadoutKind;
  status: "published" | "scheduled";
  consensusBullish: number;
  consensusBearish: number;
  consensusDirection: "bullish" | "bearish" | "split";
  realizedDirection: "bullish" | "bearish" | "flat" | "pending";
  benchmarkSymbol: string;
  benchmarkMovePct: number;
  chadCutoff: number;
  narrative: string;
};

export type BuiltCohort = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  collectStart: Date;
  collectEnd: Date;
  mondayAt: Date;
  wednesdayAt: Date;
  fridayAt: Date;
  isLatest: boolean;
  dataset: "demo";
  quotes: BuiltQuote[];
  calls: BuiltCall[];
  grades: BuiltGrade[];
  readouts: BuiltReadout[];
};

export type BuiltDataset = {
  accounts: BuiltAccount[];
  cohorts: BuiltCohort[];
};

function quoteAt(quote: BuiltQuote, kind: ReadoutKind): number | null {
  if (kind === "monday-gap") return quote.mondayOpen;
  return quote[kind];
}

function readoutNarrative(input: {
  kind: ReadoutKind;
  status: "published" | "scheduled";
  whenLabel: string;
  consensus: "bullish" | "bearish" | "split";
  bullishShare: number;
  realized: "bullish" | "bearish" | "flat" | "pending";
  move: number;
  sessionReason?: string;
  panicShare?: number;
}): string {
  const lean = `${Math.round(input.bullishShare * 100)}% conviction-weighted bullish`;
  if (input.status === "scheduled") {
    const closed = input.sessionReason ? ` ${input.sessionReason}` : "";
    return `${input.whenLabel} is not published.${closed} The book is already ${lean}. No new calls are added between readouts.`;
  }
  const pct = `${input.move >= 0 ? "+" : ""}${(input.move * 100).toFixed(2)}%`;
  const sessionNote = input.sessionReason ? ` ${input.sessionReason}` : "";
  const aligned =
    (input.consensus === "bullish" && input.realized === "bullish") ||
    (input.consensus === "bearish" && input.realized === "bearish");
  const relation =
    input.consensus === "split"
      ? "The cohort was split, so the tape is the whole story."
      : aligned
        ? "The crowd and the tape agree so far."
        : "The crowd is fighting the tape so far.";
  const mondayNote =
    input.kind === "monday"
      ? " Monday noon is the primary read on whether the weekend doom and melt-up noise survived the cash session."
      : input.kind === "monday-gap"
        ? " The gap is Friday's adjusted close to the regular-session open."
        : "";
  const noise =
    input.panicShare == null
      ? ""
      : ` Weekend Noise Index is ${Math.round(input.panicShare * 100)}% panic posts.`;
  return `${input.whenLabel}: equal-weight SPY, QQQ, and DIA are ${pct} from Friday's adjusted close. The cohort was ${lean}. Realized tape is ${input.realized}.${noise} ${relation}${mondayNote}${sessionNote} Descriptive only. Not a signal.`;
}

function buildCalls(
  spec: CohortSpec,
  cohortId: string,
  collectStart: Date,
  refs: Record<string, number>,
): BuiltCall[] {
  const handleOrder = ACCOUNTS.map((account) => account.handle);
  return [...spec.calls, ...VIRAL_CALLS].map((call) => {
    const index = handleOrder.indexOf(call.handle);
    const hours = POST_HOURS[index] ?? 12;
    const postedAt = new Date(collectStart.getTime() + hours * 60 * 60 * 1000);
    const tickers = call.tickers ?? (call.explicit ? [call.primary] : []);
    const levels = materializeLevels(call.levels, refs);
    const account = ACCOUNTS.find((item) => item.handle === call.handle);
    return {
      id: `${spec.slug}__${call.handle}`,
      cohortId,
      accountId: `acct_${call.handle}`,
      handle: call.handle,
      postedAt,
      body: renderBody(call.body, levels),
      direction: call.direction,
      conviction: call.conviction,
      primary: call.primary,
      sentiment: call.sentiment ?? (call.direction === "bearish" ? "panic" : "meltup"),
      engagement: call.engagement ?? (account?.bucket === "viral" ? 20000 : 800),
      tickers,
      levels,
      explicit: call.explicit,
    };
  });
}

function consensus(calls: CallSpec[] | BuiltCall[]) {
  let bull = 0;
  let bear = 0;
  for (const call of calls) {
    const weight = CONVICTION_WEIGHT[call.conviction];
    if (call.direction === "bullish") bull += weight;
    else bear += weight;
  }
  const total = bull + bear || 1;
  const bullishShare = bull / total;
  return {
    consensusBullish: bullishShare,
    consensusBearish: bear / total,
    consensusDirection: consensusDirection(bullishShare),
  };
}

export function buildDataset(): BuiltDataset {
  const accounts: BuiltAccount[] = ACCOUNTS.map((account) => ({
    id: `acct_${account.handle}`,
    handle: account.handle,
    displayName: account.displayName,
    bio: account.bio,
    posture: account.posture,
    accent: account.accent,
    bucket: account.bucket ?? "watchlist",
  }));

  const cohorts = COHORTS.map((spec) => {
    const window = buildCohortWindow(spec.monday);
    const id = `cohort_${spec.slug}`;
    const quotes: BuiltQuote[] = quotesForCohort(spec.slug, SYMBOLS).map((quote) => ({
      id: `${spec.slug}__${quote.symbol}`,
      cohortId: id,
      symbol: quote.symbol,
      name: SYMBOL_NAMES[quote.symbol] ?? quote.symbol,
      ref: quote.ref,
      mondayOpen: quote.mondayOpen,
      monday: quote.monday,
      wednesday: quote.wednesday,
      friday: quote.friday,
    }));
    for (const quote of quotes) {
      if (quote.symbol !== "SPY") continue;
      for (const price of [quote.ref, quote.mondayOpen, quote.monday, quote.wednesday, quote.friday]) {
        if (price != null && price < 700) {
          throw new Error(
            `Refusing SPY ${price} on ${spec.slug}. That is not a 2026 historical print.`,
          );
        }
      }
    }
    const refs = Object.fromEntries(quotes.map((quote) => [quote.symbol, quote.ref]));
    const calls = buildCalls(spec, id, window.collectStart, refs);
    const lean = consensus(calls);
    const grades: BuiltGrade[] = [];
    const readouts: BuiltReadout[] = READOUTS.map((kind) => {
      const whenLabel = {
        "monday-gap": "Monday gap, Friday adjusted close to the 9:30 AM ET open",
        monday: "Monday 12:00 PM ET weekend-noise grade",
        wednesday: "Wednesday 12:00 PM ET update on the same weekend cohort",
        friday: "Friday 12:00 PM ET final grade on the same weekend cohort",
      }[kind];
      const priceOf = (symbol: string) => {
        const quote = quotes.find((item) => item.symbol === symbol);
        return quote ? quoteAt(quote, kind) : null;
      };
      const needed = [...EQUITY_TAPE, "VIX", ...calls.map((call) => call.primary)];
      const published = needed.every((symbol) => priceOf(symbol) != null);
      const sessionKind = kind === "monday-gap" ? "monday" : kind;
      const session = sessionFor(spec.slug, sessionKind);
      const sessionReason = session?.session === "closed" ? session.reason : undefined;
      const noise = weekendNoise(calls.map((call) => call.sentiment));

      if (!published) {
        return {
          id: `${spec.slug}__${kind}`,
          cohortId: id,
          kind,
          status: "scheduled" as const,
          ...lean,
          realizedDirection: "pending" as const,
          benchmarkSymbol: "SPY+QQQ+DIA",
          benchmarkMovePct: 0,
          chadCutoff: 0,
          narrative: readoutNarrative({
            kind,
            status: "scheduled",
            whenLabel,
            consensus: lean.consensusDirection,
            bullishShare: lean.consensusBullish,
            realized: "pending",
            move: 0,
            sessionReason,
            panicShare: noise.panicShare,
          }),
        };
      }

      const moveOf = (symbol: string) => {
        const quote = quotes.find((item) => item.symbol === symbol);
        const now = quote ? quoteAt(quote, kind) : null;
        if (!quote || now == null) {
          throw new Error(`Missing ${kind} print for ${symbol} on ${spec.slug}`);
        }
        return (now - quote.ref) / quote.ref;
      };
      const tapeMove = equityTapeMove({
        SPY: moveOf("SPY"),
        QQQ: moveOf("QQQ"),
        DIA: moveOf("DIA"),
      });
      const vixMove = moveOf("VIX");

      const scored = calls.map((call) => {
        const quote = quotes.find((item) => item.symbol === call.primary);
        if (!quote) {
          throw new Error(`Missing ${call.primary} quote on ${spec.slug}`);
        }
        const now = quoteAt(quote, kind);
        if (now == null) {
          throw new Error(`Missing ${kind} price for ${call.primary} on ${spec.slug}`);
        }
        const parts = scoreCall(
          {
            direction: call.direction,
            sentiment: call.sentiment,
            primary: call.primary,
            tickers: call.tickers,
            levels: call.levels,
            explicit: call.explicit,
          },
          {
            tapeMove,
            primaryRef: quote.ref,
            primaryNow: now,
            vixMove,
          },
        );
        return { call, parts, tieBreak: call.handle };
      });

      const ranked = rankPeers(
        scored.map((row) => ({
          ...row,
          score: row.parts.score,
        })),
      );
      const chadScores = ranked.filter((row) => row.isChad).map((row) => row.score);
      const chadCutoff = chadScores.length ? Math.min(...chadScores) : 0;

      for (const row of ranked) {
        grades.push({
          id: `${row.call.id}__${kind}`,
          callId: row.call.id,
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
          isChad: row.isChad,
          isChudTerritory: row.isChudTerritory,
          peerRank: row.peerRank,
          peerCount: row.peerCount,
          note: gradeNote({
            kind,
            direction: row.call.direction,
            rawMovePct: row.parts.rawMovePct,
            vixMovePct: row.parts.vixMovePct,
            score: row.parts.score,
          }),
        });
      }

      const realized = tapeDirection(tapeMove);
      return {
        id: `${spec.slug}__${kind}`,
        cohortId: id,
        kind,
        status: "published" as const,
        ...lean,
        realizedDirection: realized,
        benchmarkSymbol: "SPY+QQQ+DIA",
        benchmarkMovePct: tapeMove,
        chadCutoff,
        narrative: readoutNarrative({
          kind,
          status: "published",
          whenLabel,
          consensus: lean.consensusDirection,
          bullishShare: lean.consensusBullish,
          realized,
          move: tapeMove,
          sessionReason,
          panicShare: noise.panicShare,
        }),
      };
    });

    return {
      id,
      slug: spec.slug,
      title: spec.title,
      summary: spec.summary,
      ...window,
      isLatest: Boolean(spec.isLatest),
      dataset: "demo" as const,
      quotes,
      calls,
      grades,
      readouts,
    };
  });

  return { accounts, cohorts };
}
