import assert from "node:assert/strict";
import test from "node:test";
import {
  gradesOnPrimaryBoard,
  handleBoardStats,
  isDirectionHit,
  pendingReadoutKinds,
  settledReadoutKinds,
} from "./board";
import { FEATURED_COHORT_SLUG } from "./demo-data";
import { buildDataset } from "./dataset";
import { READOUTS } from "./scoring";

const data = buildDataset();

test("a scheduled readout contributes nothing to the primary board", () => {
  const latest = data.cohorts.find((cohort) => cohort.isLatest);
  assert.ok(latest);
  for (const readout of latest.readouts) {
    const grades = latest.grades.filter((grade) => grade.readout === readout.kind);
    const onBoard = gradesOnPrimaryBoard(grades, readout.status);
    if (readout.kind === "friday") {
      assert.equal(readout.status, "scheduled");
      assert.equal(grades.length, 0);
      assert.equal(onBoard.length, 0);
    } else {
      assert.equal(readout.status, "published");
      assert.equal(onBoard.length, latest.calls.length);
    }
  }
  assert.deepEqual(settledReadoutKinds(latest.readouts), ["monday-gap", "monday", "wednesday"]);
  assert.deepEqual(pendingReadoutKinds(latest.readouts), ["friday"]);
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

test("STRONG, WEAK, and hit rate use every settled grade and skip the mature-only shortcut", () => {
  const stats = handleBoardStats([
    {
      grades: [
        { readout: "monday", score: 40, isStrong: false, isWeak: true, signedMovePct: -0.02 },
        { readout: "friday", score: 80, isStrong: true, isWeak: false, signedMovePct: 0.02 },
      ],
    },
  ]);
  assert.equal(stats.avgScore, 80);
  assert.equal(stats.callCount, 1);
  assert.equal(stats.strongRate, 0.5);
  assert.equal(stats.weakRate, 0.5);
  assert.equal(stats.hitRate, 0.5);
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
