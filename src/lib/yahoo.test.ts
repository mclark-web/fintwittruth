import assert from "node:assert/strict";
import test from "node:test";
import { etParts, pricesAgree, readDailyBar, readNoonBar, readOfficialClose, type ChartResult } from "./yahoo";

const daily: ChartResult = {
  timestamp: [Date.parse("2026-09-18T13:30:00Z") / 1000, Date.parse("2026-09-21T13:30:00Z") / 1000],
  indicators: {
    quote: [
      {
        open: [761.3099975585938, 766.25],
        close: [761.6900024414062, 773.5],
      },
    ],
    adjclose: [{ adjclose: [761.6900024414062, 773.5] }],
  },
};

const intraday: ChartResult = {
  timestamp: [Date.parse("2026-09-21T16:00:00Z") / 1000],
  indicators: {
    quote: [{ open: [770.7349853515625], close: [771.0449829101562] }],
  },
};

test("daily bar is the regular-session open and close", () => {
  const friday = readDailyBar(daily, "2026-09-18");
  assert.equal(friday.close, 761.6900024414062);
  assert.equal(friday.open, 761.3099975585938);
  const monday = readDailyBar(daily, "2026-09-21");
  assert.equal(monday.open, 766.25);
});

test("official close is the daily close, including an early-close session", () => {
  const close = readOfficialClose(daily, "2026-09-18");
  assert.equal(close.close, 761.6900024414062);
  assert.equal(close.adjClose, 761.6900024414062);
  assert.throws(() => readOfficialClose(daily, "2026-09-07"), /Refusing to invent/);
});

test("noon bar is the 12:00 PM ET 5-minute open", () => {
  const noon = readNoonBar(intraday, "2026-09-21");
  assert.equal(noon.open, 770.7349853515625);
  assert.match(noon.bar, /T12:00:00/);
  const parts = etParts(Date.parse("2026-09-21T16:00:00Z") / 1000);
  assert.equal(parts.date, "2026-09-21");
  assert.equal(parts.hour, 12);
});

test("a missing print is a refusal", () => {
  assert.throws(() => readDailyBar(daily, "2026-09-23"), /Refusing to invent/);
  assert.throws(() => readNoonBar(intraday, "2026-09-23"), /Refusing to invent/);
  assert.throws(() => readNoonBar({ timestamp: [], indicators: { quote: [{ open: [] }] } }, "2026-09-21"), /Refusing to invent/);
});

test("displayed cents have to match the fetched print", () => {
  assert.equal(pricesAgree(761.6900024414062, 761.6900024414062), true);
  assert.equal(pricesAgree(770.7349853515625, 770.7349), true);
  assert.equal(pricesAgree(766.25, 770.73), false);
});
