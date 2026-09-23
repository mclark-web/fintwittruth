import assert from "node:assert/strict";
import test from "node:test";
import { gcBoardGrade, gcFill, gcGrade } from "./grades";

test("0% is empty glass and EXIT LIQUIDITY", () => {
  assert.equal(gcFill(0), 0);
  assert.equal(gcFill(null), 0);
  assert.equal(gcGrade({ score: 0, isChad: false, isChudTerritory: true }), "exit");
  assert.equal(gcGrade({ score: null, isChad: false, isChudTerritory: false }), "exit");
  assert.deepEqual(gcBoardGrade([]), { fill: 0, grade: "exit" });
});

test("peer cut is STRONG, under 70 is WEAK, 70 outside the cut is PROVISIONAL", () => {
  assert.equal(gcGrade({ score: 88, isChad: true, isChudTerritory: false }), "strong");
  assert.equal(gcGrade({ score: 40, isChad: false, isChudTerritory: true }), "weak");
  assert.equal(gcGrade({ score: 74, isChad: false, isChudTerritory: false }), "provisional");
  assert.equal(gcFill(68), 68);
});

test("a board mean uses the same line without promoting the average to STRONG", () => {
  assert.deepEqual(gcBoardGrade([80, 60, 40]), { fill: 60, grade: "weak" });
  assert.equal(gcBoardGrade([80, 90, 70]).grade, "provisional");
});
