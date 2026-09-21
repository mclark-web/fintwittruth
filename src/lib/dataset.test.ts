import assert from "node:assert/strict";
import test from "node:test";
import { zonedToUtc } from "./calendar";
import { FEATURED_COHORT_SLUG, LATEST_COHORT_SLUG, SYMBOLS } from "./demo-data";
import { buildDataset } from "./dataset";
import {
  assertHistoricalPrint,
  noonOpen,
  officialClose,
  quotesForCohort,
} from "./quotes";
import { CHUD_THRESHOLD, scoreToBadge } from "./scoring";

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

test("one cohort ages across Monday, Wednesday, and Friday", () => {
  const historical = data.cohorts.filter((cohort) => !cohort.isLatest);
  assert.equal(historical.length, 4);
  for (const cohort of historical) {
    for (const kind of ["monday", "wednesday", "friday"] as const) {
      const readout = cohort.readouts.find((item) => item.kind === kind);
      assert.equal(readout?.status, "published");
      const grades = cohort.grades.filter((grade) => grade.readout === kind);
      assert.equal(grades.length, cohort.calls.length);
      assert.deepEqual(
        grades.map((grade) => grade.callId).sort(),
        cohort.calls.map((call) => call.id).sort(),
      );
    }
  }
});

test("latest cohort publishes Monday and leaves Wednesday and Friday scheduled", () => {
  const latest = data.cohorts.find((cohort) => cohort.isLatest);
  assert.ok(latest);
  assert.equal(latest.slug, LATEST_COHORT_SLUG);
  assert.equal(latest.readouts.find((item) => item.kind === "monday")?.status, "published");
  assert.equal(latest.readouts.find((item) => item.kind === "wednesday")?.status, "scheduled");
  assert.equal(latest.readouts.find((item) => item.kind === "friday")?.status, "scheduled");
  assert.equal(latest.grades.length, latest.calls.length);
  assert.ok(latest.grades.every((grade) => grade.readout === "monday"));
});

test("every demo post sits inside the Wednesday-to-Sunday collect window", () => {
  for (const cohort of data.cohorts) {
    for (const call of cohort.calls) {
      assert.ok(call.postedAt >= cohort.collectStart);
      assert.ok(call.postedAt <= cohort.collectEnd);
    }
  }
});

test("scores stay on 0-100 with a 1-10 badge, Chad cut, and Chud line", () => {
  for (const cohort of data.cohorts) {
    for (const kind of ["monday", "wednesday", "friday"] as const) {
      const grades = cohort.grades.filter((grade) => grade.readout === kind);
      if (grades.length === 0) continue;
      for (const grade of grades) {
        assert.ok(grade.score >= 0 && grade.score <= 100);
        assert.equal(grade.badge, scoreToBadge(grade.score));
        assert.ok(grade.badge >= 1 && grade.badge <= 10);
        assert.equal(grade.isChudTerritory, grade.score < CHUD_THRESHOLD);
      }
      const chads = grades.filter((grade) => grade.isChad);
      const slots = Math.ceil(grades.length * 0.3);
      assert.ok(chads.length >= slots);
      const cutoff = Math.min(...chads.map((grade) => grade.score));
      assert.ok(grades.filter((grade) => !grade.isChad).every((grade) => grade.score < cutoff));
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
      assert.equal(quote.monday, expected.monday);
      assert.equal(quote.wednesday, expected.wednesday);
      assert.equal(quote.friday, expected.friday);
      assertHistoricalPrint(quote.symbol, expected.refDate, "dailyClose", quote.ref);
      for (const level of cohort.calls.filter((call) => call.primary === quote.symbol).flatMap((call) => call.levels)) {
        assert.ok(Math.abs(level.price - quote.ref) / quote.ref <= 0.1);
      }
    }
  }
});

test("Labor Day Monday repeats Friday's official close and does not invent a session", () => {
  const week = data.cohorts.find((cohort) => cohort.slug === FEATURED_COHORT_SLUG);
  assert.ok(week);
  for (const quote of week.quotes) {
    const prior = officialClose(quote.symbol, "2026-09-04");
    assert.equal(quote.ref, prior);
    assert.equal(quote.monday, prior);
    assert.throws(() => noonOpen(quote.symbol, "2026-09-07"), /Refusing to invent/);
  }
  const monday = week.readouts.find((item) => item.kind === "monday");
  assert.equal(monday?.status, "published");
  assert.equal(monday?.benchmarkMovePct, 0);
  assert.match(monday?.narrative ?? "", /Labor Day/);
});

test("the open week keeps future readouts empty", () => {
  const latest = data.cohorts.find((cohort) => cohort.slug === LATEST_COHORT_SLUG);
  assert.ok(latest);
  for (const quote of latest.quotes) {
    assert.equal(quote.monday, noonOpen(quote.symbol, "2026-09-21"));
    assert.equal(quote.wednesday, null);
    assert.equal(quote.friday, null);
  }
  assert.throws(() => noonOpen("SPY", "2026-09-23"), /Refusing to invent/);
  assert.throws(() => officialClose("SPY", "2026-09-07"), /Refusing to invent/);
});

test("a hand-set price that misses the recorded print is rejected", () => {
  assert.throws(() => assertHistoricalPrint("SPY", "2026-09-18", "dailyClose", 557), /Refusing/);
  assert.throws(() => assertHistoricalPrint("NVDA", "2026-08-24", "noonOpen", 126.4), /Refusing/);
});
