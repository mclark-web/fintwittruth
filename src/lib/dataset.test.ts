import assert from "node:assert/strict";
import test from "node:test";
import { zonedToUtc } from "./calendar";
import { FEATURED_COHORT_SLUG, DEMO_OPEN_COHORT_SLUG, LATEST_COHORT_SLUG, SYMBOLS } from "./demo-data";
import { buildDataset } from "./dataset";
import {
  adjustedClose,
  assertHistoricalPrint,
  noonOpen,
  quotesForCohort,
  sessionClose,
  sessionOpen,
} from "./quotes";
import { WEAK_LINE, CONVICTION_WEIGHT, EQUITY_TAPE, READOUTS, VIX_MAX, equityTapeMove, scoreToBadge } from "./scoring";

const data = buildDataset();

test("locked calendar for the latest readout week", () => {
  const latest = data.cohorts.find((cohort) => cohort.slug === LATEST_COHORT_SLUG);
  assert.ok(latest);
  assert.equal(latest.collectStart.toISOString(), zonedToUtc(2026, 9, 16, 12, 0).toISOString());
  assert.equal(latest.collectEnd.toISOString(), zonedToUtc(2026, 9, 20, 17, 0).toISOString());
  assert.equal(latest.mondayAt.toISOString(), zonedToUtc(2026, 9, 21, 12, 0).toISOString());
  assert.equal(latest.wednesdayAt.toISOString(), zonedToUtc(2026, 9, 23, 16, 0).toISOString());
  assert.equal(latest.fridayAt.toISOString(), zonedToUtc(2026, 9, 25, 16, 0).toISOString());
});

test("finished weeks publish every readout except the Labor Day Monday", () => {
  const historical = data.cohorts.filter(
    (cohort) => cohort.dataset === "demo" && cohort.slug !== DEMO_OPEN_COHORT_SLUG,
  );
  assert.equal(historical.length, 4);
  for (const cohort of historical) {
    for (const kind of READOUTS) {
      const board = cohort.readouts.find((item) => item.kind === kind);
      const holidayMonday = cohort.slug === FEATURED_COHORT_SLUG && (kind === "monday-gap" || kind === "monday");
      assert.equal(board?.status, holidayMonday ? "scheduled" : "published");
      const grades = cohort.grades.filter((grade) => grade.readout === kind);
      assert.equal(grades.length, holidayMonday ? 0 : cohort.calls.length);
    }
  }
});

test("latest cohort publishes Monday and Wednesday and leaves Friday scheduled", () => {
  const latest = data.cohorts.find((cohort) => cohort.isLatest);
  assert.ok(latest);
  assert.equal(latest.dataset, "live");
  assert.equal(latest.slug, LATEST_COHORT_SLUG);
  assert.equal(latest.historySlug, LATEST_COHORT_SLUG);
  assert.ok(latest.calls.length > 0);
  assert.ok(latest.calls.every((call) => call.sourceUrl.startsWith("https://")));
  assert.equal(latest.calls.some((call) => call.handle === "doomscroll"), false);
  assert.equal(latest.readouts.find((item) => item.kind === "monday-gap")?.status, "published");
  assert.equal(latest.readouts.find((item) => item.kind === "monday")?.status, "published");
  assert.equal(latest.readouts.find((item) => item.kind === "wednesday")?.status, "published");
  assert.equal(latest.readouts.find((item) => item.kind === "friday")?.status, "scheduled");
  assert.equal(latest.grades.length, latest.calls.length * 3);
  assert.ok(
    latest.grades.every(
      (grade) => grade.readout === "monday-gap" || grade.readout === "monday" || grade.readout === "wednesday",
    ),
  );
});

test("every demo post sits inside the Wednesday-to-Sunday collect window", () => {
  for (const cohort of data.cohorts) {
    for (const call of cohort.calls) {
      assert.ok(call.postedAt >= cohort.collectStart);
      assert.ok(call.postedAt <= cohort.collectEnd);
    }
  }
});

test("watchlist and viral posts share the weekly board", () => {
  const demo = data.cohorts.filter((cohort) => cohort.dataset === "demo");
  assert.ok(demo.length >= 4);
  for (const cohort of demo) {
    assert.ok(cohort.calls.some((call) => call.handle === "doomscroll"));
    const viral = cohort.calls.find((call) => call.handle === "doomsiren");
    assert.ok(viral);
    assert.equal(viral.sentiment, "panic");
    assert.equal(viral.engagement, 84000);
    const account = data.accounts.find((item) => item.handle === "doomsiren");
    assert.equal(account?.bucket, "viral");
  }
});

test("STRONG requires the top 30% and a score of at least 70", () => {
  for (const cohort of data.cohorts) {
    for (const kind of READOUTS) {
      const grades = cohort.grades.filter((grade) => grade.readout === kind);
      if (grades.length === 0) continue;
      const sorted = [...grades].sort((a, b) => b.score - a.score);
      const slots = Math.ceil(grades.length * 0.3);
      const cutoff = sorted[slots - 1]?.score ?? Number.POSITIVE_INFINITY;
      for (const grade of grades) {
        const expected = grade.score >= cutoff && grade.score >= WEAK_LINE;
        assert.equal(grade.isStrong, expected);
        if (grade.score < WEAK_LINE) assert.equal(grade.isStrong, false);
      }
    }
  }
});

test("every published quote is the recorded Yahoo print", () => {
  for (const cohort of data.cohorts) {
    const recorded = quotesForCohort(cohort.historySlug, SYMBOLS);
    assert.equal(cohort.quotes.length, recorded.length);
    for (const quote of cohort.quotes) {
      const expected = recorded.find((item) => item.symbol === quote.symbol);
      assert.ok(expected);
      assert.equal(quote.ref, expected.ref);
      assert.equal(quote.mondayOpen, expected.mondayOpen);
      assert.equal(quote.monday, expected.monday);
      assert.equal(quote.wednesday, expected.wednesday);
      assert.equal(quote.friday, expected.friday);
      assert.notEqual(quote.ref, 552);
      assertHistoricalPrint(quote.symbol, expected.refDate, "close", quote.ref);
      for (const level of cohort.calls
        .filter((call) => call.primary === quote.symbol)
        .flatMap((call) => call.levels)) {
        assert.ok(Math.abs(level.price - quote.ref) / quote.ref <= 0.1);
      }
    }
  }
});

test("weekend reference is the Friday session close, not retrospectively rewritten adjclose", () => {
  for (const symbol of EQUITY_TAPE) {
    // Aug 21 has a dividend gap between Yahoo close and adjclose.
    const close = sessionClose(symbol, "2026-08-21");
    const adj = adjustedClose(symbol, "2026-08-21");
    if (symbol === "SPY" || symbol === "DIA") {
      assert.ok(Math.abs(close - adj) > 0.5, `${symbol} should show a close/adjclose gap on 2026-08-21`);
    }
  }
  const week = data.cohorts.find((cohort) => cohort.slug === "2026-08-24");
  assert.ok(week);
  const spy = week.quotes.find((quote) => quote.symbol === "SPY");
  assert.ok(spy);
  assert.equal(spy.ref, sessionClose("SPY", "2026-08-21"));
  assert.notEqual(spy.ref, adjustedClose("SPY", "2026-08-21"));
  assert.ok(spy.mondayOpen != null);
  const gap = (spy.mondayOpen! - spy.ref) / spy.ref;
  // Against the session close the Aug 24 open is slightly down, not a fake green gap.
  assert.ok(gap < 0, `expected SPY Aug 24 gap from session close to be negative, got ${gap}`);
});

test("Labor Day Monday stays ungraded and does not copy Friday's close", () => {
  const week = data.cohorts.find((cohort) => cohort.slug === FEATURED_COHORT_SLUG);
  assert.ok(week);
  for (const quote of week.quotes) {
    assert.equal(quote.ref, sessionClose(quote.symbol, "2026-09-04"));
    assert.equal(quote.mondayOpen, null);
    assert.equal(quote.monday, null);
    assert.throws(() => sessionOpen(quote.symbol, "2026-09-07"), /Refusing to invent/);
    assert.throws(() => noonOpen(quote.symbol, "2026-09-07"), /Refusing to invent/);
  }
  const mondayGap = week.readouts.find((item) => item.kind === "monday-gap");
  const mondayNoon = week.readouts.find((item) => item.kind === "monday");
  assert.equal(mondayGap?.status, "scheduled");
  assert.equal(mondayNoon?.status, "scheduled");
  assert.match(mondayGap?.narrative ?? "", /Labor Day/);
  assert.match(mondayNoon?.narrative ?? "", /Labor Day/);
});

test("the open week keeps future readouts empty and uses real Monday prints", () => {
  const latest = data.cohorts.find((cohort) => cohort.slug === LATEST_COHORT_SLUG);
  assert.ok(latest);
  for (const quote of latest.quotes) {
    assert.equal(quote.mondayOpen, sessionOpen(quote.symbol, "2026-09-21"));
    assert.equal(quote.monday, noonOpen(quote.symbol, "2026-09-21"));
    assert.equal(quote.wednesday, sessionClose(quote.symbol, "2026-09-23"));
    assert.notEqual(quote.wednesday, noonOpen(quote.symbol, "2026-09-23"));
    assert.equal(quote.friday, null);
  }
  assert.throws(() => noonOpen("SPY", "2026-09-25"), /Refusing to invent/);
  assert.throws(() => sessionOpen("SPY", "2026-09-07"), /Refusing to invent/);
});

test("doomscroll on the September 7 cohort is graded on real SPY prints in the 760s", () => {
  const week = data.cohorts.find((cohort) => cohort.slug === FEATURED_COHORT_SLUG);
  assert.ok(week);
  const spy = week.quotes.find((quote) => quote.symbol === "SPY");
  assert.ok(spy);
  assert.equal(spy.ref, sessionClose("SPY", "2026-09-04"));
  assert.ok(spy.ref > 740 && spy.ref < 800);
  assert.equal(spy.mondayOpen, null);
  assert.equal(spy.monday, null);
  assert.equal(spy.wednesday, sessionClose("SPY", "2026-09-09"));
  assert.equal(spy.friday, sessionClose("SPY", "2026-09-11"));
  assert.notEqual(spy.wednesday, noonOpen("SPY", "2026-09-09"));
  assert.notEqual(spy.friday, noonOpen("SPY", "2026-09-11"));
  for (const price of [spy.wednesday, spy.friday]) {
    assert.ok(price != null && price > 740 && price < 800);
  }
  const call = week.calls.find((item) => item.handle === "doomscroll");
  assert.ok(call);
  assert.equal(call.sentiment, "panic");
  assert.match(call.body, /WWIII|doomed|sell the open/i);
  assert.doesNotMatch(call.body, /\b552\b|\b547\b|\b546\b|\b558\b/);
  for (const level of call.levels) {
    assert.ok(level.price > 740 && level.price < 820);
  }
  const mondayBoard = week.readouts.find((item) => item.kind === "monday");
  assert.match(mondayBoard?.narrative ?? "", /Labor Day/);
  const friday = week.readouts.find((item) => item.kind === "friday");
  assert.match(friday?.narrative ?? "", /Weekend Noise Index/);
  assert.match(friday?.narrative ?? "", /Not a signal/);
});

test("September 23 Wednesday grades use the official close, not the noon bar", () => {
  const latest = data.cohorts.find((cohort) => cohort.slug === LATEST_COHORT_SLUG);
  assert.ok(latest);
  const expected = {
    SPY: 767.8099975585938,
    QQQ: 741.2100219726562,
    DIA: 514.2999877929688,
    VIX: 15.180000305175781,
  };
  for (const [symbol, close] of Object.entries(expected)) {
    const quote = latest.quotes.find((item) => item.symbol === symbol);
    assert.ok(quote);
    assert.equal(quote.wednesday, close);
    assert.equal(sessionClose(symbol, "2026-09-23"), close);
    assert.notEqual(close, noonOpen(symbol, "2026-09-23"));
  }
  const wednesday = latest.readouts.find((item) => item.kind === "wednesday");
  assert.equal(wednesday?.status, "published");
  assert.match(wednesday?.narrative ?? "", /Wednesday close/);
  const friday = latest.readouts.find((item) => item.kind === "friday");
  assert.equal(friday?.status, "scheduled");
  assert.match(friday?.narrative ?? "", /45 minutes after the official close/);
});

test("September 21 Monday open and noon are distinct recorded prints", () => {
  const latest = data.cohorts.find((cohort) => cohort.slug === LATEST_COHORT_SLUG);
  assert.ok(latest);
  const spy = latest.quotes.find((quote) => quote.symbol === "SPY");
  assert.ok(spy);
  assert.ok(spy.ref > 740 && spy.ref < 800);
  assert.ok(spy.mondayOpen != null && spy.monday != null);
  assert.notEqual(spy.mondayOpen, spy.monday);
  assert.ok(spy.mondayOpen > 740 && spy.monday > 740);
  const gapBoard = latest.readouts.find((item) => item.kind === "monday-gap");
  assert.equal(gapBoard?.status, "published");
  assert.equal(gapBoard?.benchmarkSymbol, "SPY+QQQ+DIA");
  assert.notEqual(gapBoard?.benchmarkMovePct, 0);
});

test("selloff calls are not STRONG on a 1%+ up Monday", () => {
  const latest = data.cohorts.find((cohort) => cohort.slug === LATEST_COHORT_SLUG);
  assert.ok(latest);
  const bySymbol = Object.fromEntries(latest.quotes.map((quote) => [quote.symbol, quote]));
  for (const kind of ["monday-gap", "monday"] as const) {
    const moves = Object.fromEntries(
      EQUITY_TAPE.map((symbol) => {
        const quote = bySymbol[symbol];
        const now = kind === "monday-gap" ? quote.mondayOpen : quote.monday;
        assert.ok(now != null);
        return [symbol, (now! - quote.ref) / quote.ref];
      }),
    ) as Record<(typeof EQUITY_TAPE)[number], number>;
    const tape = equityTapeMove(moves);
    if (kind === "monday") {
      assert.ok(tape >= 0.01, `expected Sep 21 noon tape >= +1%, got ${(tape * 100).toFixed(2)}%`);
    } else {
      assert.ok(tape > 0, `expected Sep 21 gap tape up, got ${(tape * 100).toFixed(2)}%`);
    }
    const grades = latest.grades.filter((grade) => grade.readout === kind);
    for (const grade of grades) {
      const call = latest.calls.find((item) => item.id === grade.callId);
      assert.ok(call);
      if (call.direction === "bearish") {
        assert.equal(grade.isStrong, false, `${call.handle} bearish call is not STRONG on ${kind}`);
        assert.ok(grade.score < WEAK_LINE, `${call.handle} score ${grade.score} on up ${kind}`);
        assert.ok(grade.directionPoints <= 3, `${call.handle} direction points ${grade.directionPoints}`);
        assert.ok(grade.signedMovePct < 0);
      }
      if (call.direction === "bullish" && tape >= 0.01 && grade.score >= WEAK_LINE) {
        assert.ok(grade.directionPoints >= 34);
      }
    }
  }
});

test("the verified weekend book and the fictional doom book are both graded", () => {
  const live = data.cohorts.filter((cohort) => cohort.dataset === "live");
  const demo = data.cohorts.find((cohort) => cohort.slug === DEMO_OPEN_COHORT_SLUG);
  assert.equal(live.length, 1);
  assert.ok(demo);
  assert.equal(demo.dataset, "demo");
  assert.equal(demo.isLatest, false);
  assert.equal(demo.historySlug, LATEST_COHORT_SLUG);
  assert.ok(demo.calls.some((call) => call.handle === "doomscroll"));
  assert.ok(demo.calls.every((call) => call.sourceUrl === ""));
  assert.equal(demo.calls.length, 19);
  const handles = new Set(data.accounts.map((account) => account.handle));
  assert.equal(handles.size, 21);
  assert.ok(handles.has("smtraderca"));
  assert.ok(handles.has("piggostradingdesk"));
  assert.ok(handles.has("doomscroll"));
  assert.deepEqual(CONVICTION_WEIGHT, { high: 3, medium: 2, low: 1 });
  assert.deepEqual([...EQUITY_TAPE], ["SPY", "QQQ", "DIA"]);
  const monday = live[0].grades.filter((grade) => grade.readout === "monday");
  assert.equal(monday.length, live[0].calls.length);
  for (const grade of monday) {
    const call = live[0].calls.find((item) => item.id === grade.callId);
    assert.equal(call?.direction, "bearish");
    assert.equal(grade.isStrong, false);
    assert.ok(grade.score < WEAK_LINE);
    assert.ok(grade.vixPoints >= 0 && grade.vixPoints <= VIX_MAX);
    assert.match(grade.note, /SPY, QQQ, and DIA/);
    assert.match(grade.note, /VIX/);
  }
  const spy = live[0].quotes.find((quote) => quote.symbol === "SPY");
  assert.ok(spy);
  assert.ok(spy.ref > 740);
  assert.equal(spy.ref, demo.quotes.find((quote) => quote.symbol === "SPY")?.ref);
});

test("direction matches the tape on every published readout", () => {
  for (const cohort of data.cohorts) {
    for (const kind of READOUTS) {
      const board = cohort.readouts.find((item) => item.kind === kind);
      if (board?.status !== "published") continue;
      const grades = cohort.grades.filter((grade) => grade.readout === kind);
      assert.ok(grades.length > 0);
      const tape = grades[0].rawMovePct;
      for (const grade of grades) {
        assert.equal(grade.rawMovePct, tape);
        const call = cohort.calls.find((item) => item.id === grade.callId);
        assert.ok(call);
        const expectedSigned = call.direction === "bullish" ? tape : -tape;
        assert.ok(Math.abs(grade.signedMovePct - expectedSigned) < 1e-12);
        if (tape >= 0.01 && call.direction === "bearish") {
          assert.equal(grade.isStrong, false);
          assert.ok(grade.score < WEAK_LINE);
        }
        if (tape <= -0.01 && call.direction === "bullish") {
          assert.equal(grade.isStrong, false);
          assert.ok(grade.score < WEAK_LINE);
        }
      }
    }
  }
});

test("a hand-set price that misses the recorded print is rejected", () => {
  assert.throws(() => assertHistoricalPrint("SPY", "2026-09-18", "close", 552), /Refusing/);
  assert.throws(() => assertHistoricalPrint("SPY", "2026-09-18", "adjClose", 552), /Refusing/);
  assert.throws(() => assertHistoricalPrint("NVDA", "2026-08-24", "noonOpen", 126.4), /Refusing/);
});

test("badge maps stay on 1-10 and VIX stays inside its cap", () => {
  assert.equal(scoreToBadge(0), 1);
  assert.equal(scoreToBadge(89), 9);
  assert.equal(scoreToBadge(90), 10);
  assert.equal(VIX_MAX, 15);
});
