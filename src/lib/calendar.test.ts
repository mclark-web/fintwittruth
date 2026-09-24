import assert from "node:assert/strict";
import test from "node:test";
import {
  SETTLE_BUFFER_MINUTES,
  buildCohortWindow,
  marketHoliday,
  officialCloseClock,
  readoutCheckpoint,
  settlementDueAt,
  settlementIsDue,
  zonedToUtc,
} from "./calendar";
import { planCheckpoint } from "./settlement";

const auditNow = new Date("2026-09-24T15:02:00.000Z");

test("Monday stays at noon and Wednesday and Friday are the 4:00 PM ET close", () => {
  const window = buildCohortWindow({ year: 2026, month: 9, day: 21 });
  assert.equal(window.mondayAt.toISOString(), zonedToUtc(2026, 9, 21, 12, 0).toISOString());
  assert.equal(window.wednesdayAt.toISOString(), zonedToUtc(2026, 9, 23, 16, 0).toISOString());
  assert.equal(window.fridayAt.toISOString(), zonedToUtc(2026, 9, 25, 16, 0).toISOString());
  assert.equal(window.collectStart.toISOString(), zonedToUtc(2026, 9, 16, 12, 0).toISOString());
  assert.equal(window.collectEnd.toISOString(), zonedToUtc(2026, 9, 20, 17, 0).toISOString());
});

test("settlement waits 45 minutes after the official close", () => {
  const close = zonedToUtc(2026, 9, 23, 16, 0);
  const due = settlementDueAt(close);
  assert.equal(due.toISOString(), "2026-09-23T20:45:00.000Z");
  assert.equal(settlementIsDue(close, new Date("2026-09-23T20:30:00.000Z")), false);
  assert.equal(settlementIsDue(close, due), true);
  assert.equal(SETTLE_BUFFER_MINUTES, 45);
});

test("the Thursday audit settles Wednesday and leaves Friday waiting", () => {
  const wednesday = readoutCheckpoint({ year: 2026, month: 9, day: 23 }, "wednesday");
  const friday = readoutCheckpoint({ year: 2026, month: 9, day: 25 }, "friday");
  assert.equal(
    planCheckpoint({ ymd: "2026-09-23", checkpointAt: wednesday, now: auditNow, officialClose: 767.81 }),
    "settle",
  );
  assert.equal(
    planCheckpoint({ ymd: "2026-09-25", checkpointAt: friday, now: auditNow, officialClose: 770 }),
    "wait",
  );
  assert.equal(
    planCheckpoint({ ymd: "2026-09-23", checkpointAt: wednesday, now: auditNow, officialClose: null }),
    "flag",
  );
});

test("a daily bar before the buffer is not the close", () => {
  const wednesday = readoutCheckpoint({ year: 2026, month: 9, day: 23 }, "wednesday");
  const duringSession = new Date("2026-09-23T18:00:00.000Z");
  assert.equal(
    planCheckpoint({ ymd: "2026-09-23", checkpointAt: wednesday, now: duringSession, officialClose: 768.2 }),
    "wait",
  );
});

test("an early close is 1:00 PM ET and a holiday has no close", () => {
  assert.deepEqual(officialCloseClock("2026-11-27"), { hour: 13, minute: 0 });
  assert.equal(officialCloseClock("2026-09-07"), null);
  assert.match(marketHoliday("2026-09-07") ?? "", /Labor Day/);
  const friday = readoutCheckpoint({ year: 2026, month: 11, day: 27 }, "friday");
  assert.equal(friday.toISOString(), zonedToUtc(2026, 11, 27, 13, 0).toISOString());
  const beforeEarlyDue = new Date(friday.getTime() + 30 * 60 * 1000);
  const atEarlyDue = settlementDueAt(friday);
  assert.equal(
    planCheckpoint({ ymd: "2026-11-27", checkpointAt: friday, now: beforeEarlyDue, officialClose: 100 }),
    "wait",
  );
  assert.equal(
    planCheckpoint({ ymd: "2026-11-27", checkpointAt: friday, now: atEarlyDue, officialClose: 100 }),
    "settle",
  );
  assert.equal(
    planCheckpoint({ ymd: "2026-09-07", checkpointAt: friday, now: atEarlyDue, officialClose: 15.3 }),
    "closed",
  );
});
