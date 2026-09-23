import type { Conviction, Direction, Level, LevelRole, Sentiment } from "./scoring";

export const FEATURED_COHORT_SLUG = "2026-09-07";
/** Readout Monday of the open week. The verified book uses this slug. Fiction for the same week is `demo-2026-09-21`. */
export const LATEST_COHORT_SLUG = "2026-09-21";
export const DEMO_OPEN_COHORT_SLUG = "demo-2026-09-21";

export const SYMBOL_NAMES: Record<string, string> = {
  SPY: "S&P 500 ETF",
  QQQ: "Nasdaq 100 ETF",
  IWM: "Russell 2000 ETF",
  NVDA: "NVIDIA",
  AAPL: "Apple",
  MSFT: "Microsoft",
  TLT: "20+ Year Treasury ETF",
  DIA: "Dow Jones ETF",
  VIX: "CBOE Volatility Index",
};

export const SYMBOLS = Object.keys(SYMBOL_NAMES);

export type AccountSpec = {
  handle: string;
  displayName: string;
  bio: string;
  posture: string;
  accent: string;
  bucket?: "watchlist" | "viral";
};

export const ACCOUNTS: AccountSpec[] = [
  {
    handle: "gammagoblin",
    displayName: "Gamma Goblin",
    bio: "Demo account. Weekend gamma maps and call-wall stories.",
    posture: "Short-dated gamma",
    accent: "#0f766e",
  },
  {
    handle: "macromoth",
    displayName: "Macro Moth",
    bio: "Demo account. Slow macro, real yields, and leadership rolls.",
    posture: "Macro bear bias",
    accent: "#9a3412",
  },
  {
    handle: "tapeworm",
    displayName: "Tape Worm",
    bio: "Demo account. Opening drive and single-name supply.",
    posture: "Tape reader",
    accent: "#1d4ed8",
  },
  {
    handle: "dividenddruid",
    displayName: "Dividend Druid",
    bio: "Demo account. Adds quality on flushes and grinds.",
    posture: "Quality dip buyer",
    accent: "#3f6212",
  },
  {
    handle: "gapfade",
    displayName: "Gap Fade",
    bio: "Demo account. Fades the weekend gap back toward Friday.",
    posture: "Weekend fade",
    accent: "#6d28d9",
  },
  {
    handle: "volwidow",
    displayName: "Vol Widow",
    bio: "Demo account. Hedges first, direction second.",
    posture: "Convexity hedge",
    accent: "#9f1239",
  },
  {
    handle: "nasdaqnun",
    displayName: "Nasdaq Nun",
    bio: "Demo account. Megacap trend and leader targets.",
    posture: "Megacap long",
    accent: "#0e7490",
  },
  {
    handle: "creditcrab",
    displayName: "Credit Crab",
    bio: "Demo account. Sideways credit, cautious index risk.",
    posture: "Credit cautious",
    accent: "#b45309",
  },
  {
    handle: "futuresfox",
    displayName: "Futures Fox",
    bio: "Demo account. Cash levels mapped from the index future.",
    posture: "Index levels",
    accent: "#c2410c",
  },
  {
    handle: "yieldyak",
    displayName: "Yield Yak",
    bio: "Demo account. Rates path expressed through the long bond ETF.",
    posture: "Rates",
    accent: "#0369a1",
  },
  {
    handle: "smallcapsam",
    displayName: "Smallcap Sam",
    bio: "Demo account. Russell breadth and catch-up calls.",
    posture: "Small-cap beta",
    accent: "#4d7c0f",
  },
  {
    handle: "permapump",
    displayName: "Perma Pump",
    bio: "Demo account. Weekend melt-up calls. Always long the index.",
    posture: "Melt-up",
    accent: "#a16207",
  },
  {
    handle: "doomscroll",
    displayName: "Doom Scroll",
    bio: "Demo account. Weekend crash posts, war panic, and sell-the-open calls.",
    posture: "Doom",
    accent: "#be123c",
  },
  {
    handle: "levellena",
    displayName: "Level Lena",
    bio: "Demo account. Magnet, shelf, and invalidation on every call.",
    posture: "Precise levels",
    accent: "#115e59",
  },
  {
    handle: "narrativened",
    displayName: "Narrative Ned",
    bio: "Demo account. Mood and narrative, rarely a number.",
    posture: "Vague narrative",
    accent: "#57534e",
  },
  {
    handle: "doomsiren",
    displayName: "Doom Siren",
    bio: "Demo viral bucket. Keyword spike on crash, war, and sell-the-open posts.",
    posture: "Viral panic",
    accent: "#7f1d1d",
    bucket: "viral",
  },
  {
    handle: "openselloff",
    displayName: "Open Selloff",
    bio: "Demo viral bucket. Engagement spike on sell-the-open wording.",
    posture: "Viral selloff",
    accent: "#9f1239",
    bucket: "viral",
  },
  {
    handle: "hypespike",
    displayName: "Hype Spike",
    bio: "Demo viral bucket. Melt-up and squeeze wording with a high engagement count.",
    posture: "Viral melt-up",
    accent: "#a16207",
    bucket: "viral",
  },
  {
    handle: "callwall",
    displayName: "Call Wall",
    bio: "Demo viral bucket. Euphoric squeeze posts that travel on engagement.",
    posture: "Viral squeeze",
    accent: "#0f766e",
    bucket: "viral",
  },
];

/** A fictional stated level, as a fraction of that week's real Friday regular-session close. */
export type LevelOffset = {
  symbol: string;
  role: LevelRole;
  pct: number;
};

export type CallSpec = {
  handle: string;
  direction: Direction;
  conviction: Conviction;
  primary: string;
  explicit: boolean;
  sentiment?: Sentiment;
  engagement?: number;
  /** Placeholders {target} {invalidation} {support} {resistance} fill from the real reference. */
  body: string;
  levels?: LevelOffset[];
  tickers?: string[];
};

export type CohortSpec = {
  slug: string;
  /** Market-history key when the public slug is a quarantined demo copy. */
  historySlug?: string;
  title: string;
  summary: string;
  monday: { year: number; month: number; day: number };
  isLatest?: boolean;
  calls: CallSpec[];
};

const target = (symbol: string, pct: number): LevelOffset => ({ symbol, role: "target", pct });
const invalidation = (symbol: string, pct: number): LevelOffset => ({
  symbol,
  role: "invalidation",
  pct,
});
const support = (symbol: string, pct: number): LevelOffset => ({ symbol, role: "support", pct });
const resistance = (symbol: string, pct: number): LevelOffset => ({
  symbol,
  role: "resistance",
  pct,
});

/** Round a fictional offset onto the real reference. The reference itself is never invented. */
export function priceFromRef(ref: number, pct: number): number {
  return Math.round(ref * (1 + pct) * 100) / 100;
}

export function materializeLevels(
  levels: LevelOffset[] | undefined,
  refs: Record<string, number>,
): Level[] {
  return (levels ?? []).map((level) => {
    const ref = refs[level.symbol];
    if (ref == null) {
      throw new Error(`No reference print for ${level.symbol}. Refusing to price a level.`);
    }
    if (Math.abs(level.pct) > 0.1) {
      throw new Error(
        `${level.symbol} ${level.role} offset ${level.pct} is too far from the recorded reference.`,
      );
    }
    return { symbol: level.symbol, role: level.role, price: priceFromRef(ref, level.pct) };
  });
}

export function renderBody(template: string, levels: Level[]): string {
  const named: Record<string, string> = {};
  for (const level of levels) {
    if (!named[level.role]) named[level.role] = level.price.toFixed(2);
  }
  return template.replace(/\{(target|invalidation|support|resistance)\}/g, (match, role: string) => {
    const value = named[role];
    if (!value) throw new Error(`Call body placeholder ${match} has no stated level.`);
    return value;
  });
}

/**
 * Handles and wording are fictional. Stated levels are offsets from the real
 * Friday regular-session close in src/lib/market-history.json. Market outcomes are not
 * stored here.
 */
export const COHORTS: CohortSpec[] = [
  {
    slug: "2026-08-24",
    title: "Doom versus melt-up",
    summary:
      "A demo weekend book: crash and sell-the-open posts beside euphoric melt-up calls. Grades use the Friday, August 21 cash close and the real noon prints.",
    monday: { year: 2026, month: 8, day: 24 },
    calls: [
      {
        handle: "doomscroll",
        direction: "bearish",
        conviction: "high",
        primary: "SPY",
        explicit: true,
        body: "Markets are doomed. Sell the open. SPY {target} is the crash magnet, {support} is the shelf. I cover only if {invalidation} sticks.",
        levels: [target("SPY", -0.025), support("SPY", -0.028), invalidation("SPY", 0.01)],
      },
      {
        handle: "macromoth",
        direction: "bearish",
        conviction: "high",
        primary: "QQQ",
        explicit: true,
        body: "Real yields do the work. Nasdaq gives the bid back toward {target}. Out above {invalidation}.",
        levels: [target("QQQ", -0.022), invalidation("QQQ", 0.012)],
      },
      {
        handle: "yieldyak",
        direction: "bearish",
        conviction: "medium",
        primary: "TLT",
        explicit: true,
        body: "The long bond leaks toward {target} before anyone says slowdown. Invalid above {invalidation}.",
        levels: [target("TLT", -0.015), invalidation("TLT", 0.01)],
      },
      {
        handle: "levellena",
        direction: "bearish",
        conviction: "high",
        primary: "SPY",
        explicit: true,
        body: "{target} is the magnet. I want {support} tested as a shelf. The short is dead above {invalidation}.",
        levels: [target("SPY", -0.012), support("SPY", -0.016), invalidation("SPY", 0.006)],
      },
      {
        handle: "futuresfox",
        direction: "bearish",
        conviction: "high",
        primary: "SPY",
        explicit: true,
        body: "Sellers live above Friday's settle. Cash SPY rejects {resistance} and trades {target}. Stop {invalidation}.",
        levels: [target("SPY", -0.014), resistance("SPY", 0.003), invalidation("SPY", 0.008)],
      },
      {
        handle: "volwidow",
        direction: "bearish",
        conviction: "medium",
        primary: "SPY",
        explicit: true,
        body: "Own the downside convexity. Spot does not need a crash, just a trip through {target}. Hedge dies above {invalidation}.",
        levels: [target("SPY", -0.01), invalidation("SPY", 0.007)],
      },
      {
        handle: "creditcrab",
        direction: "bearish",
        conviction: "medium",
        primary: "IWM",
        explicit: true,
        body: "Credit is quieter than equities admit. Small caps wear it first. IWM {target}, wrong above {invalidation}.",
        levels: [target("IWM", -0.02), invalidation("IWM", 0.01)],
      },
      {
        handle: "permapump",
        direction: "bullish",
        conviction: "high",
        primary: "SPY",
        explicit: true,
        body: "Euphoric melt-up. Weekend doom is the fuel. {target} is still the upside magnet. I am out only if {invalidation} goes.",
        levels: [target("SPY", 0.02), invalidation("SPY", -0.015)],
      },
      {
        handle: "nasdaqnun",
        direction: "bullish",
        conviction: "high",
        primary: "NVDA",
        explicit: true,
        body: "Leaders do not die on one weekend. NVDA {target} this week. Wrong under {invalidation}.",
        levels: [target("NVDA", 0.03), invalidation("NVDA", -0.02)],
      },
      {
        handle: "gammagoblin",
        direction: "bullish",
        conviction: "medium",
        primary: "QQQ",
        explicit: true,
        body: "Call-wall squeeze into {target} if the Sunday reopen is firm. Cut under {invalidation}.",
        levels: [target("QQQ", 0.016), invalidation("QQQ", -0.01)],
      },
      {
        handle: "dividenddruid",
        direction: "bullish",
        conviction: "medium",
        primary: "AAPL",
        explicit: true,
        body: "Buy quality on the flush. Apple holds {support} and grinds to {target}. I leave under {invalidation}.",
        levels: [target("AAPL", 0.012), support("AAPL", -0.008), invalidation("AAPL", -0.015)],
      },
      {
        handle: "smallcapsam",
        direction: "bullish",
        conviction: "medium",
        primary: "IWM",
        explicit: true,
        body: "Breadth catch-up. IWM {target} if the weekend was already priced. Invalid under {invalidation}.",
        levels: [target("IWM", 0.018), invalidation("IWM", -0.012)],
      },
      {
        handle: "narrativened",
        direction: "bullish",
        conviction: "low",
        primary: "SPY",
        explicit: false,
        body: "Feels like they want to buy any weakness. The soft-landing crowd is not leaving.",
      },
      {
        handle: "gapfade",
        direction: "bullish",
        conviction: "medium",
        primary: "SPY",
        explicit: true,
        body: "A Monday gap down gets faded back toward Friday. Target {target}, resistance {resistance}. I bail under {invalidation}.",
        levels: [target("SPY", 0.004), resistance("SPY", 0.0015), invalidation("SPY", -0.01)],
      },
      {
        handle: "tapeworm",
        direction: "bearish",
        conviction: "medium",
        primary: "MSFT",
        explicit: true,
        body: "Supply sits in megacap software. Microsoft {target} if the open cannot reclaim. Stop {invalidation}.",
        levels: [target("MSFT", -0.018), invalidation("MSFT", 0.008)],
      },
    ],
  },
  {
    slug: "2026-08-31",
    title: "Panic with a pin",
    summary:
      "Demo weekend posts that mix crash calls with melt-up calls and tight levels. The noon prints are the recorded tape.",
    monday: { year: 2026, month: 8, day: 31 },
    calls: [
      {
        handle: "levellena",
        direction: "bullish",
        conviction: "high",
        primary: "SPY",
        explicit: true,
        body: "Pin just over Friday. Long against {support}, resistance {resistance}, target a tag of {target}. Out under {invalidation}.",
        levels: [
          target("SPY", 0.004),
          support("SPY", -0.002),
          resistance("SPY", 0.005),
          invalidation("SPY", -0.006),
        ],
      },
      {
        handle: "futuresfox",
        direction: "bearish",
        conviction: "medium",
        primary: "SPY",
        explicit: true,
        body: "Fail at {resistance} and rotate back to {target}. This is not a breakdown call. Stop {invalidation}.",
        levels: [target("SPY", -0.004), resistance("SPY", 0.003), invalidation("SPY", 0.006)],
      },
      {
        handle: "gapfade",
        direction: "bearish",
        conviction: "medium",
        primary: "QQQ",
        explicit: true,
        body: "Fade a Monday pop back to {target} on QQQ. Resistance {resistance}. Wrong above {invalidation}.",
        levels: [target("QQQ", -0.002), resistance("QQQ", 0.004), invalidation("QQQ", 0.008)],
      },
      {
        handle: "permapump",
        direction: "bullish",
        conviction: "high",
        primary: "SPY",
        explicit: true,
        body: "Melt-up after the quiet posts. {target} is still the number. I am wrong under {invalidation}.",
        levels: [target("SPY", 0.02), invalidation("SPY", -0.018)],
      },
      {
        handle: "doomscroll",
        direction: "bearish",
        conviction: "high",
        primary: "SPY",
        explicit: true,
        body: "This calm is the crash setup. {target} is in play. I am wrong above {invalidation}.",
        levels: [target("SPY", -0.03), invalidation("SPY", 0.012)],
      },
      {
        handle: "nasdaqnun",
        direction: "bullish",
        conviction: "medium",
        primary: "NVDA",
        explicit: true,
        body: "NVDA bases and pushes {target}. Leave it under {invalidation}.",
        levels: [target("NVDA", 0.025), invalidation("NVDA", -0.018)],
      },
      {
        handle: "macromoth",
        direction: "bearish",
        conviction: "medium",
        primary: "QQQ",
        explicit: true,
        body: "Leadership rolls. {target} on QQQ if the range breaks down. Invalid above {invalidation}.",
        levels: [target("QQQ", -0.02), invalidation("QQQ", 0.012)],
      },
      {
        handle: "narrativened",
        direction: "bearish",
        conviction: "low",
        primary: "SPY",
        explicit: false,
        body: "Something about this tape feels tired. I would not chase strength.",
      },
      {
        handle: "yieldyak",
        direction: "bullish",
        conviction: "medium",
        primary: "TLT",
        explicit: true,
        body: "Yields stall here. TLT back to {target}. Out if {invalidation} breaks.",
        levels: [target("TLT", 0.012), invalidation("TLT", -0.01)],
      },
      {
        handle: "smallcapsam",
        direction: "bullish",
        conviction: "medium",
        primary: "IWM",
        explicit: true,
        body: "IWM holds {support} and squeezes toward {target}. Invalid under {invalidation}.",
        levels: [target("IWM", 0.014), support("IWM", -0.006), invalidation("IWM", -0.012)],
      },
      {
        handle: "volwidow",
        direction: "bearish",
        conviction: "low",
        primary: "SPY",
        explicit: true,
        body: "Realized stays quiet, but a drift under {target} pays the hedge. Stop {invalidation}.",
        levels: [target("SPY", -0.012), invalidation("SPY", 0.008)],
      },
      {
        handle: "gammagoblin",
        direction: "bullish",
        conviction: "medium",
        primary: "SPY",
        explicit: true,
        body: "Gamma pins, then releases higher toward {target}. I am out under {invalidation}.",
        levels: [target("SPY", 0.012), invalidation("SPY", -0.008)],
      },
      {
        handle: "dividenddruid",
        direction: "bullish",
        conviction: "medium",
        primary: "AAPL",
        explicit: true,
        body: "Apple respects {support} and tags {target}. I leave the add under {invalidation}.",
        levels: [target("AAPL", 0.01), support("AAPL", -0.006), invalidation("AAPL", -0.012)],
      },
      {
        handle: "creditcrab",
        direction: "bearish",
        conviction: "low",
        primary: "IWM",
        explicit: true,
        body: "No credit stress, but I do not want small-cap beta. {target} if it slips. Stop {invalidation}.",
        levels: [target("IWM", -0.016), invalidation("IWM", 0.01)],
      },
      {
        handle: "tapeworm",
        direction: "bullish",
        conviction: "medium",
        primary: "MSFT",
        explicit: true,
        body: "Microsoft is a {target} magnet. Long into that print, out through {invalidation}. Resistance sits at {resistance}.",
        levels: [target("MSFT", 0.006), resistance("MSFT", 0.008), invalidation("MSFT", -0.01)],
      },
    ],
  },
  {
    slug: "2026-09-07",
    title: "Weekend doom",
    summary:
      "Fictional weekend posts: war panic, sell-the-open, and melt-up calls. Monday, September 7, 2026 was Labor Day, so the gap and the noon grade stay blank. Wednesday and Friday use the real noon prints.",
    monday: { year: 2026, month: 9, day: 7 },
    calls: [
      {
        handle: "permapump",
        direction: "bullish",
        conviction: "high",
        primary: "SPY",
        explicit: true,
        body: "Euphoric melt-up. Weekend bears are exit liquidity. {target} SPY. I trail out only if {invalidation} fails.",
        levels: [target("SPY", 0.022), invalidation("SPY", -0.016)],
      },
      {
        handle: "nasdaqnun",
        direction: "bullish",
        conviction: "high",
        primary: "NVDA",
        explicit: true,
        body: "Leaders melt up through the panic posts. NVDA {target}. Wrong under {invalidation}.",
        levels: [target("NVDA", 0.028), invalidation("NVDA", -0.018)],
      },
      {
        handle: "gammagoblin",
        direction: "bullish",
        conviction: "high",
        primary: "QQQ",
        explicit: true,
        body: "The doom timeline is fuel for the call wall. QQQ {target} if Sunday holds a bid. Cut under {invalidation}.",
        levels: [target("QQQ", 0.018), invalidation("QQQ", -0.01)],
      },
      {
        handle: "dividenddruid",
        direction: "bullish",
        conviction: "medium",
        primary: "AAPL",
        explicit: true,
        body: "Add Apple through the weekend. {support} holds, {target} is the ask. Leave under {invalidation}.",
        levels: [target("AAPL", 0.014), support("AAPL", -0.008), invalidation("AAPL", -0.016)],
      },
      {
        handle: "smallcapsam",
        direction: "bullish",
        conviction: "medium",
        primary: "IWM",
        explicit: true,
        body: "Breadth finally confirms. IWM {target}. Invalid under {invalidation}.",
        levels: [target("IWM", 0.016), invalidation("IWM", -0.014)],
      },
      {
        handle: "tapeworm",
        direction: "bullish",
        conviction: "medium",
        primary: "MSFT",
        explicit: true,
        body: "Opening drive continuation. Microsoft {target}. I am wrong under {invalidation}.",
        levels: [target("MSFT", 0.012), invalidation("MSFT", -0.01)],
      },
      {
        handle: "narrativened",
        direction: "bullish",
        conviction: "low",
        primary: "SPY",
        explicit: false,
        body: "The weekend timeline is loud and wrong. Melt-up. The tape wants higher prices.",
      },
      {
        handle: "doomscroll",
        direction: "bearish",
        conviction: "high",
        primary: "SPY",
        explicit: true,
        body: "WWIII weekend. Markets are doomed. Sell the open. SPY {target} is the crash magnet, {support} is the shelf. I cover only if {invalidation} sticks.",
        levels: [target("SPY", -0.024), support("SPY", -0.026), invalidation("SPY", 0.012)],
      },
      {
        handle: "macromoth",
        direction: "bearish",
        conviction: "high",
        primary: "QQQ",
        explicit: true,
        body: "This is a crash, not a dip. QQQ back to {target}. Wrong above {invalidation}.",
        levels: [target("QQQ", -0.018), invalidation("QQQ", 0.012)],
      },
      {
        handle: "levellena",
        direction: "bearish",
        conviction: "high",
        primary: "SPY",
        explicit: true,
        body: "Sell the open into {resistance}. Crash target {target}, shelf {support}, invalid through {invalidation}.",
        levels: [
          target("SPY", -0.01),
          support("SPY", -0.012),
          resistance("SPY", 0.008),
          invalidation("SPY", 0.012),
        ],
      },
      {
        handle: "futuresfox",
        direction: "bearish",
        conviction: "medium",
        primary: "SPY",
        explicit: true,
        body: "Sell the open. {target} cash is the crash retrace. Stop {invalidation}.",
        levels: [target("SPY", -0.008), invalidation("SPY", 0.01)],
      },
      {
        handle: "gapfade",
        direction: "bearish",
        conviction: "high",
        primary: "QQQ",
        explicit: true,
        body: "Classic weekend gap fade. QQQ back through {target}. Resistance {resistance}. Stop {invalidation}.",
        levels: [target("QQQ", -0.006), resistance("QQQ", 0.008), invalidation("QQQ", 0.014)],
      },
      {
        handle: "volwidow",
        direction: "bearish",
        conviction: "medium",
        primary: "SPY",
        explicit: true,
        body: "Own the crash. Spot to {target} pays for the weekend panic. Hedge dies above {invalidation}.",
        levels: [target("SPY", -0.012), invalidation("SPY", 0.01)],
      },
      {
        handle: "creditcrab",
        direction: "bearish",
        conviction: "medium",
        primary: "IWM",
        explicit: true,
        body: "Small caps do not survive a war open. {target} IWM. I am wrong above {invalidation}.",
        levels: [target("IWM", -0.02), invalidation("IWM", 0.012)],
      },
      {
        handle: "yieldyak",
        direction: "bullish",
        conviction: "medium",
        primary: "TLT",
        explicit: true,
        body: "If the doom bid is real, bonds catch it toward {target}. Cut {invalidation}.",
        levels: [target("TLT", 0.014), invalidation("TLT", -0.012)],
      },
    ],
  },
  {
    slug: "2026-09-14",
    title: "Same noise, next week",
    summary:
      "Another fictional weekend of crash calls and melt-up calls, graded on the real September 14 prints.",
    monday: { year: 2026, month: 9, day: 14 },
    calls: [
      {
        handle: "nasdaqnun",
        direction: "bullish",
        conviction: "high",
        primary: "NVDA",
        explicit: true,
        body: "Back to trend. NVDA {target}. Out below {invalidation}.",
        levels: [target("NVDA", 0.026), invalidation("NVDA", -0.02)],
      },
      {
        handle: "gammagoblin",
        direction: "bullish",
        conviction: "high",
        primary: "QQQ",
        explicit: true,
        body: "Dip gamma is long. QQQ {target}. I leave it under {invalidation}.",
        levels: [target("QQQ", 0.016), invalidation("QQQ", -0.01)],
      },
      {
        handle: "permapump",
        direction: "bullish",
        conviction: "high",
        primary: "SPY",
        explicit: true,
        body: "Melt-up, same trade as the weekend. SPY {target}. Wrong under {invalidation}.",
        levels: [target("SPY", 0.02), invalidation("SPY", -0.016)],
      },
      {
        handle: "dividenddruid",
        direction: "bullish",
        conviction: "medium",
        primary: "AAPL",
        explicit: true,
        body: "Apple grinds to {target}. {support} is the add. I am out under {invalidation}.",
        levels: [target("AAPL", 0.012), support("AAPL", -0.008), invalidation("AAPL", -0.016)],
      },
      {
        handle: "levellena",
        direction: "bullish",
        conviction: "high",
        primary: "SPY",
        explicit: true,
        body: "Accept above the reference. Target {target}, supply at {resistance}, invalid under {invalidation}.",
        levels: [target("SPY", 0.01), resistance("SPY", 0.012), invalidation("SPY", -0.008)],
      },
      {
        handle: "futuresfox",
        direction: "bullish",
        conviction: "medium",
        primary: "SPY",
        explicit: true,
        body: "Hold the Sunday settle and auction to {target}. Cut under {invalidation}.",
        levels: [target("SPY", 0.008), invalidation("SPY", -0.008)],
      },
      {
        handle: "smallcapsam",
        direction: "bullish",
        conviction: "medium",
        primary: "IWM",
        explicit: true,
        body: "IWM participates this time. {target}, with support at {support}. Invalid under {invalidation}.",
        levels: [target("IWM", 0.014), support("IWM", -0.008), invalidation("IWM", -0.014)],
      },
      {
        handle: "tapeworm",
        direction: "bullish",
        conviction: "medium",
        primary: "MSFT",
        explicit: true,
        body: "Microsoft reclaim. Target {target}. Wrong under {invalidation}.",
        levels: [target("MSFT", 0.014), invalidation("MSFT", -0.012)],
      },
      {
        handle: "yieldyak",
        direction: "bearish",
        conviction: "medium",
        primary: "TLT",
        explicit: true,
        body: "Stocks up, bonds down. TLT {target}. I cover above {invalidation}.",
        levels: [target("TLT", -0.012), invalidation("TLT", 0.01)],
      },
      {
        handle: "doomscroll",
        direction: "bearish",
        conviction: "high",
        primary: "SPY",
        explicit: true,
        body: "Last-chance crash call. Markets are doomed into {target}, or I am done above {invalidation}.",
        levels: [target("SPY", -0.028), invalidation("SPY", 0.01)],
      },
      {
        handle: "macromoth",
        direction: "bearish",
        conviction: "high",
        primary: "QQQ",
        explicit: true,
        body: "Fade the grind. QQQ {target}. Wrong above {invalidation}.",
        levels: [target("QQQ", -0.02), invalidation("QQQ", 0.012)],
      },
      {
        handle: "gapfade",
        direction: "bearish",
        conviction: "medium",
        primary: "SPY",
        explicit: true,
        body: "Monday strength is a fade back to {target}. Resistance {resistance}. Stop {invalidation}.",
        levels: [target("SPY", -0.006), resistance("SPY", 0.004), invalidation("SPY", 0.008)],
      },
      {
        handle: "volwidow",
        direction: "bearish",
        conviction: "low",
        primary: "QQQ",
        explicit: true,
        body: "Hedge the grind. QQQ {target} pays for the puts. Hedge off above {invalidation}.",
        levels: [target("QQQ", -0.012), invalidation("QQQ", 0.01)],
      },
      {
        handle: "creditcrab",
        direction: "bullish",
        conviction: "low",
        primary: "SPY",
        explicit: true,
        body: "Not brave, just long the index into {target} with a tight line at {invalidation}.",
        levels: [target("SPY", 0.006), invalidation("SPY", -0.008)],
      },
      {
        handle: "narrativened",
        direction: "bullish",
        conviction: "medium",
        primary: "QQQ",
        explicit: false,
        body: "Tech wants to be bought. You can feel it in the timeline.",
      },
    ],
  },
  {
    slug: "demo-2026-09-21",
    historySlug: "2026-09-21",
    title: "DEMO weekend book",
    summary:
      "DEMO. Fictional doom and melt-up posts, quarantined off the live board. Monday's real open and noon prints are in, and Wednesday noon is the recorded 12:00 PM ET bar. Friday, September 25 had not printed when this history was fetched, so that grade stays scheduled.",
    monday: { year: 2026, month: 9, day: 21 },
    calls: [
      {
        handle: "levellena",
        direction: "bullish",
        conviction: "high",
        primary: "SPY",
        explicit: true,
        body: "Sunday settle holds. Target {target}, support {support}, invalid under {invalidation}.",
        levels: [target("SPY", 0.006), support("SPY", -0.004), invalidation("SPY", -0.008)],
      },
      {
        handle: "futuresfox",
        direction: "bullish",
        conviction: "medium",
        primary: "SPY",
        explicit: true,
        body: "Auction toward {target}. Cut the long under {invalidation}.",
        levels: [target("SPY", 0.008), invalidation("SPY", -0.01)],
      },
      {
        handle: "nasdaqnun",
        direction: "bullish",
        conviction: "high",
        primary: "NVDA",
        explicit: true,
        body: "NVDA {target} this week. I am wrong under {invalidation}.",
        levels: [target("NVDA", 0.03), invalidation("NVDA", -0.02)],
      },
      {
        handle: "gammagoblin",
        direction: "bullish",
        conviction: "high",
        primary: "QQQ",
        explicit: true,
        body: "QQQ pushes {target} if the call wall stays bid. Out under {invalidation}.",
        levels: [target("QQQ", 0.016), invalidation("QQQ", -0.01)],
      },
      {
        handle: "permapump",
        direction: "bullish",
        conviction: "high",
        primary: "SPY",
        explicit: true,
        body: "Melt-up. {target}. Same weekend call as always. Only a break of {invalidation} changes it.",
        levels: [target("SPY", 0.022), invalidation("SPY", -0.018)],
      },
      {
        handle: "dividenddruid",
        direction: "bullish",
        conviction: "medium",
        primary: "AAPL",
        explicit: true,
        body: "Apple holds {support} and works toward {target}. I leave under {invalidation}.",
        levels: [target("AAPL", 0.012), support("AAPL", -0.006), invalidation("AAPL", -0.012)],
      },
      {
        handle: "smallcapsam",
        direction: "bullish",
        conviction: "medium",
        primary: "IWM",
        explicit: true,
        body: "Small caps tag along to {target}. Invalid under {invalidation}.",
        levels: [target("IWM", 0.016), invalidation("IWM", -0.012)],
      },
      {
        handle: "tapeworm",
        direction: "bullish",
        conviction: "medium",
        primary: "MSFT",
        explicit: true,
        body: "Microsoft is a {target} print. I am wrong back through {invalidation}.",
        levels: [target("MSFT", 0.012), invalidation("MSFT", -0.008)],
      },
      {
        handle: "yieldyak",
        direction: "bearish",
        conviction: "medium",
        primary: "TLT",
        explicit: true,
        body: "The reopen bid leaks into bonds. TLT {target}. Cover above {invalidation}.",
        levels: [target("TLT", -0.014), invalidation("TLT", 0.01)],
      },
      {
        handle: "doomscroll",
        direction: "bearish",
        conviction: "high",
        primary: "SPY",
        explicit: true,
        body: "Sell the open. Markets are doomed. SPY {target}. I cover only if {invalidation} sticks.",
        levels: [target("SPY", -0.024), invalidation("SPY", 0.012)],
      },
      {
        handle: "macromoth",
        direction: "bearish",
        conviction: "high",
        primary: "QQQ",
        explicit: true,
        body: "Leadership is tired. QQQ back to {target}. Wrong above {invalidation}.",
        levels: [target("QQQ", -0.018), invalidation("QQQ", 0.012)],
      },
      {
        handle: "gapfade",
        direction: "bearish",
        conviction: "medium",
        primary: "SPY",
        explicit: true,
        body: "Fade the Monday bid back to {target}. Resistance {resistance}. Stop {invalidation}.",
        levels: [target("SPY", -0.006), resistance("SPY", 0.004), invalidation("SPY", 0.008)],
      },
      {
        handle: "volwidow",
        direction: "bearish",
        conviction: "low",
        primary: "QQQ",
        explicit: true,
        body: "Keep the hedge on. QQQ {target} is enough to pay for it. Off above {invalidation}.",
        levels: [target("QQQ", -0.008), invalidation("QQQ", 0.012)],
      },
      {
        handle: "creditcrab",
        direction: "bullish",
        conviction: "low",
        primary: "SPY",
        explicit: true,
        body: "Small long. Target {target}, stop {invalidation}. Nothing heroic.",
        levels: [target("SPY", 0.005), invalidation("SPY", -0.008)],
      },
      {
        handle: "narrativened",
        direction: "bullish",
        conviction: "medium",
        primary: "SPY",
        explicit: false,
        body: "Bulls look in control again. I would not fade a tape that feels this firm.",
      },
    ],
  },
];

/** Viral doom / hype spike posts. Appended to every cohort. Engagement is a demo count. */
export const VIRAL_CALLS: CallSpec[] = [
  {
    handle: "doomsiren",
    direction: "bearish",
    sentiment: "panic",
    conviction: "high",
    primary: "SPY",
    explicit: true,
    engagement: 84000,
    body: "WWIII weekend. Markets are doomed. Sell the open. SPY crash magnet {target}, shelf {support}. Cover only through {invalidation}.",
    levels: [target("SPY", -0.03), support("SPY", -0.034), invalidation("SPY", 0.012)],
  },
  {
    handle: "openselloff",
    direction: "bearish",
    sentiment: "panic",
    conviction: "high",
    primary: "DIA",
    explicit: true,
    engagement: 41000,
    body: "Selloff spike. The Dow proxy gaps and does not bounce. DIA {target}. Wrong above {invalidation}.",
    levels: [target("DIA", -0.02), invalidation("DIA", 0.01)],
  },
  {
    handle: "hypespike",
    direction: "bullish",
    sentiment: "meltup",
    conviction: "high",
    primary: "QQQ",
    explicit: true,
    engagement: 67000,
    body: "Melt-up spike. Weekend doom is the squeeze. QQQ {target}. Leave it under {invalidation}.",
    levels: [target("QQQ", 0.02), invalidation("QQQ", -0.012)],
  },
  {
    handle: "callwall",
    direction: "bullish",
    sentiment: "meltup",
    conviction: "medium",
    primary: "SPY",
    explicit: true,
    engagement: 29000,
    body: "Complacency bid. The panic posts are the fuel. SPY {target}, invalid under {invalidation}.",
    levels: [target("SPY", 0.015), invalidation("SPY", -0.01)],
  },
];
