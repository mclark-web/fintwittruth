import assert from "node:assert/strict";
import test from "node:test";
import { buildCohortWindow } from "../src/lib/calendar";
import { noonToStore } from "../src/lib/noon-receipt";
import { newestDueMonday } from "./write-noon-receipts";

function cohort(slug: string) {
  const [year, month, day] = slug.split("-").map(Number);
  return { slug, mondayAt: buildCohortWindow({ year, month, day }).mondayAt };
}

test("the receipt step waits until 45 minutes after Monday noon", () => {
  const live = [cohort("2026-10-26"), cohort("2026-10-19")];
  assert.equal(newestDueMonday(live, new Date("2026-10-25T22:00:00.000Z")), "2026-10-19");
  assert.equal(newestDueMonday(live, new Date("2026-10-26T16:30:00.000Z")), "2026-10-19");
  assert.equal(newestDueMonday(live, new Date("2026-10-26T16:45:00.000Z")), "2026-10-26");
});

test("a stored noon print is not replaced", () => {
  assert.deepEqual(noonToStore(null, 17.68), { open: 17.68 });
  assert.deepEqual(noonToStore(17.68000030517578, 17.68), { open: 17.68000030517578 });
  const held = noonToStore(769.0723876953125, 769.45);
  assert.equal("error" in held, true);
});
