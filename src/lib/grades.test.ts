import assert from "node:assert/strict";
import test from "node:test";
import { gcBoardGrade, gcFill, gcGrade } from "./grades";

test("0% is empty glass and EXIT LIQUIDITY", () => {
  assert.equal(gcFill(0), 0);
  assert.equal(gcFill(null), 0);
  assert.equal(gcGrade({ score: 0, isStrong: false, isWeak: true }), "exit");
  assert.equal(gcGrade({ score: null, isStrong: false, isWeak: false }), "exit");
  assert.deepEqual(gcBoardGrade([]), { fill: 0, grade: "exit" });
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
  assert.deepEqual(gcBoardGrade([80, 60, 40]), { fill: 60, grade: "provisional" });
  assert.equal(gcBoardGrade([80, 90, 70]).grade, "strong");
  assert.equal(gcBoardGrade([10, 20, 30]).grade, "weak");
});
