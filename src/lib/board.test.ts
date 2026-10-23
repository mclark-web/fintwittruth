import assert from "node:assert/strict";
import test from "node:test";
import {
  gradesOnPrimaryBoard,
  handleBoardStats,
  isDirectionHit,
  pendingReadoutKinds,
  settledReadoutKinds,
  weekendLead,
} from "./board";
import { buildCohortWindow } from "./calendar";
import { FEATURED_COHORT_SLUG, LATEST_COHORT_SLUG } from "./demo-data";
import { buildDataset } from "./dataset";
import { formatWeekday } from "./format";
import { gcBoardGrade } from "./grades";
import { READOUTS } from "./scoring";

const data = buildDataset();

test("the closed October 19 lead is the Monday noon board grade", () => {
  const week = data.cohorts.find((cohort) => cohort.slug === "2026-10-19" && cohort.dataset === "live");
  assert.ok(week);
  const scores = week.calls.map((call) => {
    const grade = week.grades.find((item) => item.callId === call.id && item.readout === "monday");
    assert.ok(grade);
    return grade.score;
  });
  assert.equal(scores.length, 10);
  assert.equal(weekendLead(week.mondayAt, gcBoardGrade(scores)), "Week of Oct 19 · 52% PROVISIONAL");
  const open = buildCohortWindow({ year: 2026, month: 10, day: 26 });
  assert.equal(formatWeekday(open.collectEnd), "Sun Oct 25");
});

test("a scheduled readout contributes nothing to the primary board", () => {
  const latest = data.cohorts.find((cohort) => cohort.slug === LATEST_COHORT_SLUG);
  assert.ok(latest);
  assert.equal(latest.isLatest, false);
  const friday = latest.readouts.find((item) => item.kind === "friday");
  assert.equal(friday?.status, "published");
  const fridayGrades = latest.grades.filter((grade) => grade.readout === "friday");
  assert.equal(gradesOnPrimaryBoard(fridayGrades, "scheduled").length, 0);
  assert.equal(gradesOnPrimaryBoard(fridayGrades, "published").length, latest.calls.length);
  for (const readout of latest.readouts) {
    const grades = latest.grades.filter((grade) => grade.readout === readout.kind);
    assert.equal(readout.status, "published");
    assert.equal(gradesOnPrimaryBoard(grades, readout.status).length, latest.calls.length);
  }
  assert.deepEqual(settledReadoutKinds(latest.readouts), ["monday-gap", "monday", "wednesday", "friday"]);
  assert.deepEqual(pendingReadoutKinds(latest.readouts), []);
});

test("Labor Day Monday stays off the primary board", () => {
  const week = data.cohorts.find((cohort) => cohort.slug === FEATURED_COHORT_SLUG);
  assert.ok(week);
  for (const kind of ["monday-gap", "monday"] as const) {
    const readout = week.readouts.find((item) => item.kind === kind);
    assert.equal(readout?.status, "scheduled");
    const grades = week.grades.filter((grade) => grade.readout === kind);
    assert.equal(gradesOnPrimaryBoard(grades, readout?.status ?? "scheduled").length, 0);
  }
  assert.deepEqual(settledReadoutKinds(week.readouts), ["wednesday", "friday"]);
  assert.ok(pendingReadoutKinds(week.readouts).includes("monday-gap"));
});

test("finished published readouts stay on the board", () => {
  for (const cohort of data.cohorts) {
    for (const kind of READOUTS) {
      const readout = cohort.readouts.find((item) => item.kind === kind);
      assert.ok(readout);
      const grades = cohort.grades.filter((grade) => grade.readout === kind);
      const onBoard = gradesOnPrimaryBoard(grades, readout.status);
      assert.equal(onBoard.length, readout.status === "published" ? cohort.calls.length : 0);
    }
  }
});

test("handle stats ignore calls that have no settled grade", () => {
  const stats = handleBoardStats([
    {
      grades: [
        { readout: "monday", score: 90, isStrong: true, isWeak: false, signedMovePct: 0.02 },
      ],
    },
    { grades: [] },
  ]);
  assert.equal(stats.graded, true);
  assert.equal(stats.callCount, 1);
  assert.equal(stats.pendingCount, 1);
  assert.equal(stats.avgScore, 90);
  assert.equal(stats.strongRate, 1);
  assert.equal(stats.weakRate, 0);
  assert.equal(stats.hitRate, 1);
  assert.equal(stats.bestScore, 90);
  assert.equal(stats.worstScore, 90);
});

test("an account with only unscored calls is not a graded handle", () => {
  const stats = handleBoardStats([{ grades: [] }, { grades: [] }]);
  assert.equal(stats.graded, false);
  assert.equal(stats.callCount, 0);
  assert.equal(stats.pendingCount, 2);
  assert.equal(stats.avgScore, 0);
  assert.equal(stats.strongRate, 0);
  assert.equal(stats.weakRate, 0);
  assert.equal(stats.hitRate, 0);
});

test("the call score is the furthest settled checkpoint, and account grade averages those", () => {
  const one = handleBoardStats([
    {
      grades: [
        { readout: "monday", score: 40, isStrong: false, isWeak: true, signedMovePct: -0.02 },
        { readout: "friday", score: 80, isStrong: true, isWeak: false, signedMovePct: 0.02 },
      ],
    },
  ]);
  assert.equal(one.avgScore, 80);
  assert.equal(one.callCount, 1);
  assert.equal(one.bestScore, 80);
  assert.equal(one.worstScore, 80);
  assert.equal(one.strongRate, 0.5);
  assert.equal(one.weakRate, 0);
  assert.equal(one.hitRate, 0.5);

  const account = handleBoardStats([
    { grades: [{ readout: "monday", score: 90, isStrong: true, isWeak: false, signedMovePct: 0.02 }] },
    { grades: [{ readout: "wednesday", score: 30, isStrong: false, isWeak: true, signedMovePct: -0.02 }] },
    { grades: [] },
  ]);
  assert.equal(account.callCount, 2);
  assert.equal(account.pendingCount, 1);
  assert.equal(account.avgScore, 60);
  assert.equal(account.bestScore, 90);
  assert.equal(account.worstScore, 30);
});

test("a flat tape is not a hit", () => {
  assert.equal(isDirectionHit(0.0001), false);
  assert.equal(isDirectionHit(0.0008), true);
  assert.equal(isDirectionHit(-0.01), false);
  const stats = handleBoardStats([
    {
      grades: [
        { readout: "monday", score: 55, isStrong: false, isWeak: true, signedMovePct: 0.0001 },
      ],
    },
  ]);
  assert.equal(stats.hitRate, 0);
});
