import assert from "node:assert/strict";
import test from "node:test";
import { zonedToUtc } from "./calendar";
import { FEATURED_COHORT_SLUG, LATEST_COHORT_SLUG, SYMBOLS } from "./demo-data";
import { buildDataset } from "./dataset";
import {
  adjustedClose,
  assertHistoricalPrint,
  noonOpen,
  quotesForCohort,
  sessionOpen,
} from "./quotes";
import { CHUD_THRESHOLD, READOUTS, VIX_MAX, scoreToBadge } from "./scoring";

const data = buildDataset();

test("locked calendar for the latest readout week", () => {
  const latest = data.cohorts.find((cohort) => cohort.slug === LATEST_COHORT_SLUG);
  assert.ok(latest);
  assert.equal(latest.collectStart.toISOString(), zonedToUtc(2026, 9, 16, 12, 0).toISOString());
  assert.equal(latest.collectEnd.toISOString(), zonedToUtc(2026, 9, 20, 17, 0).toISOString());
  assert.equal(latest.mondayAt.toISOString(), zonedToUtc(2026, 9, 21, 12, 0).toISOString());
  assert.equal(latest.wednesdayAt.toISOString(), zonedToUtc(2026, 9, 23, 12, 0).toISOString());
  assert.equal(latest.fridayAt.toISOString(), zonedToUtc(2026, 9, 25, 12, 0).toISOString());
});

test("finished weeks publish every readout except the Labor Day Monday", () => {
  const historical = data.cohorts.filter((cohort) => !cohort.isLatest);
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

test("latest cohort publishes the Monday gap and noon and leaves Wednesday and Friday scheduled", () => {
  const latest = data.cohorts.find((cohort) => cohort.isLatest);
  assert.ok(latest);
  assert.equal(latest.slug, LATEST_COHORT_SLUG);
  assert.equal(latest.readouts.find((item) => item.kind === "monday-gap")?.status, "published");
  assert.equal(latest.readouts.find((item) => item.kind === "monday")?.status, "published");
  assert.equal(latest.readouts.find((item) => item.kind === "wednesday")?.status, "scheduled");
  assert.equal(latest.readouts.find((item) => item.kind === "friday")?.status, "scheduled");
  assert.equal(latest.grades.length, latest.calls.length * 2);
  assert.ok(latest.grades.every((grade) => grade.readout === "monday-gap" || grade.readout === "monday"));
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
  for (const cohort of data.cohorts) {
    assert.ok(cohort.calls.some((call) => call.handle === "doomscroll"));
    const viral = cohort.calls.find((call) => call.handle === "doomsiren");
    assert.ok(viral);
    assert.equal(viral.sentiment, "panic");
    assert.equal(viral.engagement, 84000);
    const account = data.accounts.find((item) => item.handle === "doomsiren");
    assert.equal(account?.bucket, "viral");
  }
});

test("Chad requires the top 30% and a score of at least 70", () => {
  for (const cohort of data.cohorts) {
    for (const kind of READOUTS) {
      const grades = cohort.grades.filter((grade) => grade.readout === kind);
      if (grades.length === 0) continue;
      const sorted = [...grades].sort((a, b) => b.score - a.score);
      const slots = Math.ceil(grades.length * 0.3);
      const cutoff = sorted[slots - 1].score;
      for (const grade of grades) {
        assert.ok(grade.score >= 0 && grade.score <= 100);
        assert.equal(grade.badge, scoreToBadge(grade.score));
        assert.ok(grade.vixPoints >= 0 && grade.vixPoints <= VIX_MAX);
        assert.equal(grade.isChudTerritory, grade.score < CHUD_THRESHOLD);
        assert.equal(grade.isChad, grade.score >= cutoff && grade.score >= CHUD_THRESHOLD);
      }
    }
  }
});

test("every published quote is the recorded Yahoo print", () => {
  for (const cohort of data.cohorts) {
    const recorded = quotesForCohort(cohort.slug, SYMBOLS);
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
      assertHistoricalPrint(quote.symbol, expected.refDate, "adjClose", quote.ref);
      for (const level of cohort.calls
        .filter((call) => call.primary === quote.symbol)
        .flatMap((call) => call.levels)) {
        assert.ok(Math.abs(level.price - quote.ref) / quote.ref <= 0.1);
      }
    }
  }
});

test("Labor Day Monday stays ungraded and does not copy Friday's close", () => {
  const week = data.cohorts.find((cohort) => cohort.slug === FEATURED_COHORT_SLUG);
  assert.ok(week);
  for (const quote of week.quotes) {
    assert.equal(quote.ref, adjustedClose(quote.symbol, "2026-09-04"));
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
    assert.equal(quote.wednesday, null);
    assert.equal(quote.friday, null);
  }
  assert.throws(() => noonOpen("SPY", "2026-09-23"), /Refusing to invent/);
  assert.throws(() => sessionOpen("SPY", "2026-09-07"), /Refusing to invent/);
});

test("doomscroll on the September 7 cohort is graded on real SPY prints in the 760s", () => {
  const week = data.cohorts.find((cohort) => cohort.slug === FEATURED_COHORT_SLUG);
  assert.ok(week);
  const spy = week.quotes.find((quote) => quote.symbol === "SPY");
  assert.ok(spy);
  assert.equal(spy.ref, adjustedClose("SPY", "2026-09-04"));
  assert.ok(spy.ref > 740 && spy.ref < 800);
  assert.equal(spy.mondayOpen, null);
  assert.equal(spy.monday, null);
  assert.equal(spy.wednesday, noonOpen("SPY", "2026-09-09"));
  assert.equal(spy.friday, noonOpen("SPY", "2026-09-11"));
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

test("a hand-set price that misses the recorded print is rejected", () => {
  assert.throws(() => assertHistoricalPrint("SPY", "2026-09-18", "adjClose", 552), /Refusing/);
  assert.throws(() => assertHistoricalPrint("NVDA", "2026-08-24", "noonOpen", 126.4), /Refusing/);
});
