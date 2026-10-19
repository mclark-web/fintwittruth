import assert from "node:assert/strict";
import test from "node:test";
import { realWeekAgeDays, stalenessMessage } from "./freshness";

test("a real week more than 7 days old raises an alert", () => {
  const now = new Date("2026-10-19T16:00:00Z");
  assert.equal(realWeekAgeDays("2026-09-21", now), 28);
  assert.match(stalenessMessage("2026-09-21", now) ?? "", /ALERT: newest real week 2026-09-21 is 28 days old/);
  assert.equal(stalenessMessage("2026-10-19", now), null);
  assert.equal(stalenessMessage("2026-10-12", now), null);
  assert.match(stalenessMessage("2026-10-11", now) ?? "", /8 days old/);
  assert.match(stalenessMessage(null, now) ?? "", /no real week/);
});
