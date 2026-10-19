import assert from "node:assert/strict";
import test from "node:test";
import { BEST_WORST_MIN, bestWorst } from "./lanes";

test("too few graded calls leave both lanes empty", () => {
  const split = bestWorst([{ id: "a", score: 12 }, { id: "b", score: 7 }], (item) => item.score);
  assert.equal(BEST_WORST_MIN, 10);
  assert.deepEqual(split, { ready: false, count: 2, minimum: 10 });
});

test("ten or more calls split the top and bottom 30 percent without overlap", () => {
  const items = Array.from({ length: 10 }, (_, index) => ({ id: String(index), score: index }));
  const split = bestWorst(items, (item) => item.score);
  assert.equal(split.ready, true);
  if (!split.ready) return;
  assert.deepEqual(split.best.map((item) => item.id), ["9", "8", "7"]);
  assert.deepEqual(split.worst.map((item) => item.id), ["0", "1", "2"]);
});
