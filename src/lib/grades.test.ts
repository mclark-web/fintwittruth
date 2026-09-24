import assert from "node:assert/strict";
import test from "node:test";
import { zonedToUtc } from "./calendar";
import { etYmd } from "./format";
import {
  gcBoardGrade,
  gcFill,
  gcGrade,
  GC_GRADE_LABEL,
  LABOR_DAY_UNGRADED_LINE,
  UNGRADED_HORIZON,
  UNGRADED_HORIZON_ARIA,
  ungradedHorizonLine,
} from "./grades";

test("0% is empty glass and EXIT LIQUIDITY", () => {
  assert.equal(gcFill(0), 0);
  assert.equal(gcFill(null), 0);
  assert.equal(gcGrade({ score: 0, isStrong: false, isWeak: true }), "exit");
  assert.equal(gcGrade({ score: null, isStrong: false, isWeak: false }), "exit");
});

test("an empty board is ungraded and a graded zero stays EXIT", () => {
  assert.deepEqual(gcBoardGrade([]), { fill: 0, ungraded: true });
  const oneZero = gcBoardGrade([0]);
  assert.equal(oneZero.ungraded, false);
  if (!oneZero.ungraded) {
    assert.equal(oneZero.grade, "exit");
    assert.equal(oneZero.fill, 0);
  }
  const allZero = gcBoardGrade([0, 0]);
  assert.equal(allZero.ungraded, false);
  if (!allZero.ungraded) assert.equal(allZero.grade, "exit");
});

test("an open horizon is not graded yet and is never EXIT", () => {
  assert.equal(UNGRADED_HORIZON, "Not graded yet");
  assert.equal(UNGRADED_HORIZON_ARIA, "GC Scale, not graded yet");
  assert.equal(UNGRADED_HORIZON.includes("EXIT"), false);
  assert.equal(UNGRADED_HORIZON_ARIA.includes("EXIT"), false);
  assert.equal(gcGrade({ score: 0 }), "exit");
  assert.equal(GC_GRADE_LABEL.exit, "EXIT LIQUIDITY");
});

test("70 or more is STRONG, under 40 is WEAK, the rest is PROVISIONAL", () => {
  assert.equal(gcGrade({ score: 70, isStrong: false, isWeak: true }), "strong");
  assert.equal(gcGrade({ score: 88, isStrong: false, isWeak: true }), "strong");
  assert.equal(gcGrade({ score: 100, isStrong: false, isWeak: false }), "strong");
  assert.equal(gcGrade({ score: 69, isStrong: true, isWeak: false }), "provisional");
  assert.equal(gcGrade({ score: 40, isStrong: false, isWeak: true }), "provisional");
  assert.equal(gcGrade({ score: 39, isStrong: true, isWeak: false }), "weak");
  assert.equal(gcGrade({ score: 1, isStrong: false, isWeak: false }), "weak");
  assert.equal(gcFill(68), 68);
});

test("a board mean uses the same bands", () => {
  assert.deepEqual(gcBoardGrade([80, 60, 40]), { fill: 60, grade: "provisional", ungraded: false });
  const strong = gcBoardGrade([80, 90, 70]);
  const weak = gcBoardGrade([10, 20, 30]);
  assert.equal(strong.ungraded, false);
  assert.equal(weak.ungraded, false);
  if (!strong.ungraded) assert.equal(strong.grade, "strong");
  if (!weak.ungraded) assert.equal(weak.grade, "weak");
});

test("Labor Day Monday does not promise an open or a noon print", () => {
  const ymd = etYmd(zonedToUtc(2026, 9, 7, 12, 0));
  assert.equal(ymd, "2026-09-07");
  for (const kind of ["monday-gap", "monday"] as const) {
    const line = ungradedHorizonLine({
      kind,
      sessionYmd: ymd,
      time: kind === "monday" ? "12:00 PM ET" : "9:30 AM ET",
      role: "Friday close to the open",
    });
    assert.equal(line, LABOR_DAY_UNGRADED_LINE);
    assert.equal(line.includes("until"), false);
    assert.equal(line.includes("9:30"), false);
    assert.equal(line.includes("12:00"), false);
  }
  assert.equal(
    ungradedHorizonLine({ kind: "friday", sessionYmd: "2026-09-25", time: "4:00 PM ET" }),
    "Not graded yet · off the board until 4:00 PM ET",
  );
});
