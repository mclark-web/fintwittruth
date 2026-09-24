import assert from "node:assert/strict";
import test from "node:test";
import type { IntakePost } from "./intake-types";
import { cohortSlugForPostedAt, gradeRealPosts } from "./real-book";
import { disputeHref } from "./dispute";
import { scoreCall } from "./scoring";
import { quotesForCohort, sessionClose, sessionFor } from "./quotes";

function post(overrides: Partial<IntakePost> = {}): IntakePost {
  return {
    id: "status_1700000000000000001",
    sourceUrl: "https://x.com/unusual_whales/status/1700000000000000001",
    statusId: "1700000000000000001",
    handle: "unusual_whales",
    authorName: "Unusual Whales",
    text: "High conviction bearish $SPY this week. Sell the open.",
    postedAtLabel: "September 18, 2026",
    fetchedAt: "2026-09-18T16:05:00.000Z",
    status: "confirmed",
    extraction: {
      symbol: "SPY",
      direction: "bearish",
      horizon: "this week",
      conviction: "high",
      sentiment: "panic",
      levels: [],
      ambiguous: false,
      gradable: true,
      reasons: [],
      parser: "rules",
    },
    suggestion: null,
    llmNote: "",
    review: {
      symbol: "SPY",
      direction: "bearish",
      horizon: "this week",
      conviction: "high",
      sentiment: "panic",
      postedAt: "2026-09-18T16:00:00.000Z",
      levels: [],
      gradable: true,
    },
    rejectNote: "",
    ...overrides,
  };
}

test("a Friday post in the collect window belongs to the following Monday", () => {
  assert.equal(cohortSlugForPostedAt("2026-09-18T16:00:00.000Z"), "2026-09-21");
  assert.equal(cohortSlugForPostedAt("2020-01-01T16:00:00.000Z"), null);
});

test("a confirmed SPY call uses Monday 12:00 and the Wednesday close, and keeps Friday blank", () => {
  const [call] = gradeRealPosts([post()]);
  assert.ok(call);
  assert.equal(call.label, "Verified real call");
  assert.equal(call.cohortSlug, "2026-09-21");
  assert.equal(call.grades["monday-gap"], undefined);
  assert.ok(call.grades.monday);
  assert.ok(call.grades.wednesday);
  assert.equal(call.grades.friday, undefined);
  assert.match(call.grades.monday?.note ?? "", /Monday 12:00 PM ET, the open of that bar/);
  assert.match(call.grades.wednesday?.note ?? "", /Wednesday 4:00 PM ET regular-session close/);
  const quotes = quotesForCohort("2026-09-21", ["SPY", "QQQ", "DIA", "VIX"]);
  const quote = (symbol: string) => quotes.find((item) => item.symbol === symbol);
  const move = (symbol: string, now: number) => {
    const ref = quote(symbol)?.ref;
    if (ref == null) throw new Error(symbol);
    return (now - ref) / ref;
  };
  const monday = quote("SPY")?.monday;
  const qqq = quote("QQQ")?.monday;
  const dia = quote("DIA")?.monday;
  const vix = quote("VIX")?.monday;
  assert.ok(monday != null && qqq != null && dia != null && vix != null);
  const expected = scoreCall(
    {
      direction: "bearish",
      sentiment: "panic",
      primary: "SPY",
      tickers: ["SPY"],
      levels: [],
      explicit: true,
    },
    {
      tapeMove: (move("SPY", monday) + move("QQQ", qqq) + move("DIA", dia)) / 3,
      primaryRef: quote("SPY")?.ref ?? 0,
      primaryNow: monday,
      vixMove: move("VIX", vix),
    },
  );
  assert.equal(call.grades.monday?.score, expected.score);
  assert.equal(call.grades.monday?.peerCount, 1);
  const wednesday = sessionFor("2026-09-21", "wednesday");
  assert.ok(wednesday);
  const closeMove = (symbol: string) => {
    const ref = quote(symbol)?.ref;
    if (ref == null || !wednesday) throw new Error(symbol);
    return (sessionClose(symbol, wednesday.date) - ref) / ref;
  };
  const wednesdayScore = scoreCall(
    {
      direction: "bearish",
      sentiment: "panic",
      primary: "SPY",
      tickers: ["SPY"],
      levels: [],
      explicit: true,
    },
    {
      tapeMove: (closeMove("SPY") + closeMove("QQQ") + closeMove("DIA")) / 3,
      primaryRef: quote("SPY")?.ref ?? 0,
      primaryNow: sessionClose("SPY", wednesday.date),
      vixMove: closeMove("VIX"),
    },
  );
  assert.equal(call.grades.wednesday?.score, wednesdayScore.score);
  const noonWednesday = quote("SPY")?.wednesday;
  assert.notEqual(sessionClose("SPY", wednesday.date), noonWednesday);
  const href = disputeHref({ id: call.id, handle: call.handle, sourceUrl: call.sourceUrl });
  assert.match(href, /^mailto:/);
  assert.match(href, /Dispute%20this%20grade/);
  assert.match(href, /unusual_whales/);
});

test("an unsupported symbol is stored without a grade", () => {
  const [call] = gradeRealPosts([
    post({
      status: "not_gradable",
      review: {
        symbol: "TSLA",
        direction: "bearish",
        horizon: "this week",
        conviction: "high",
        sentiment: "panic",
        postedAt: "2026-09-18T16:00:00.000Z",
        levels: [],
        gradable: false,
      },
    }),
  ]);
  assert.equal(call?.label, "Not gradable yet");
  assert.deepEqual(call?.grades, {});
  assert.match(call?.ungradedReason ?? "", /TSLA/);
});
