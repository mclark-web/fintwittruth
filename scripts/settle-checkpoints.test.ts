import assert from "node:assert/strict";
import test from "node:test";
import { adjCloseIfMissing } from "./settle-checkpoints";

test("adjClose is written only when the stored value is missing", () => {
  assert.equal(adjCloseIfMissing(null, 514.3), 514.3);
  assert.equal(adjCloseIfMissing(undefined, 514.3), 514.3);
  assert.equal(adjCloseIfMissing(533.00146484375, 520), null);
  assert.equal(adjCloseIfMissing(533.00146484375, 533.00146484375), null);
});
