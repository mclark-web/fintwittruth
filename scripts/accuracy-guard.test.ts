import assert from "node:assert/strict";
import test from "node:test";
import { buildCohortWindow } from "../src/lib/calendar";
import { selectAccuracyCohort, symbolsOnTheGradeTape, type AccuracyCohort } from "./accuracy-guard";

function cohort(slug: string): AccuracyCohort {
  const [year, month, day] = slug.split("-").map(Number);
  const window = buildCohortWindow({ year, month, day });
  return { slug, mondayAt: window.mondayAt, wednesdayAt: window.wednesdayAt, fridayAt: window.fridayAt };
}

test("an open week with no history is skipped until a checkpoint is due", () => {
  const history = new Set(["2026-10-19"]);
  const beforeMonday = new Date("2026-10-25T16:38:00.000Z");
  const selected = selectAccuracyCohort([cohort("2026-10-26"), cohort("2026-10-19")], history, beforeMonday);
  assert.equal(selected.audit.slug, "2026-10-19");
  assert.equal(selected.openWithoutHistory, "2026-10-26");
});

test("a due checkpoint with no history is a refusal", () => {
  const history = new Set(["2026-10-19"]);
  const afterMondayNoon = new Date("2026-10-26T17:00:00.000Z");
  assert.throws(
    () => selectAccuracyCohort([cohort("2026-10-26")], history, afterMondayNoon),
    /No market history for live cohort 2026-10-26/,
  );
});

test("the newest week is audited when its history is already recorded", () => {
  const selected = selectAccuracyCohort(
    [cohort("2026-10-19")],
    new Set(["2026-10-19"]),
    new Date("2026-10-25T16:38:00.000Z"),
  );
  assert.equal(selected.audit.slug, "2026-10-19");
  assert.equal(selected.openWithoutHistory, null);
});

test("single-name opens that are not a graded call stay off the accuracy check", () => {
  const symbols = symbolsOnTheGradeTape(
    ["SPY", "QQQ", "DIA", "VIX", "NVDA", "AAPL", "MSFT", "IWM", "TLT"],
    ["SPY", "QQQ"],
  );
  assert.deepEqual(symbols, ["SPY", "QQQ", "DIA", "VIX"]);
});

test("a graded primary that is not on the index tape is still checked", () => {
  const symbols = symbolsOnTheGradeTape(["SPY", "QQQ", "DIA", "VIX", "IWM"], ["IWM"]);
  assert.deepEqual(symbols, ["SPY", "QQQ", "DIA", "VIX", "IWM"]);
});
