import assert from "node:assert/strict";
import test from "node:test";
import { formatPrice } from "./format";
import {
  chartFromRaw,
  expectedMinuteRequest,
  expectedNoonRequest,
  loadMinuteReceipt,
  loadNoonReceipt,
  noonBarStamp,
  noonMajority,
  readNoonReading,
  resolvedNoonOpen,
  sha256Text,
  verifyMinuteReceipt,
  verifyNoonReceipt,
} from "./noon-receipt";
import { noonOpen } from "./quotes";
import { pricesAgree, type ChartResult } from "./yahoo";

const filled: ChartResult = {
  timestamp: [Date.parse("2026-10-19T15:55:00Z") / 1000, Date.parse("2026-10-19T16:00:00Z") / 1000],
  indicators: {
    quote: [{ open: [769.77, 769.4500122070312], close: [769.4500122070312, 768.49] }],
  },
};

const unfilled: ChartResult = {
  timestamp: [Date.parse("2026-10-19T15:55:00Z") / 1000, Date.parse("2026-10-19T16:00:00Z") / 1000],
  indicators: {
    quote: [{ open: [769.77, 769.0723876953125], close: [769.4500122070312, 768.49] }],
  },
};

test("a 12:00 open that copies the previous close is a filled bar", () => {
  const reading = readNoonReading(filled, "2026-10-19");
  assert.equal(reading.filled, true);
  assert.equal(reading.open, reading.previousClose);
  assert.equal(reading.bar, "2026-10-19T12:00:00");
});

test("the unfilled 12:00 open stays off the previous close", () => {
  const reading = readNoonReading(unfilled, "2026-10-19");
  assert.equal(reading.filled, false);
  assert.equal(reading.open, 769.0723876953125);
  assert.equal(reading.previousClose, 769.4500122070312);
});

test("live noon vote needs three pulls inside five cents", () => {
  assert.equal(noonMajority([769.07, 769.07]).status, "unstable");
  assert.deepEqual(noonMajority([769.07, 769.09, 769.11]), { status: "agree", open: 769.07 });
  const split = noonMajority([769.07, 769.07, 769.45]);
  assert.equal(split.status, "unstable");
  assert.equal(split.open, 769.07);
  assert.equal(noonMajority([769.07, 770.5, 768.1]).open, null);
});

test("a receipt checksum covers the raw body", () => {
  const raw = JSON.stringify({ chart: { result: [unfilled] } });
  const request = expectedNoonRequest("SPY", "2026-10-19");
  const checked = verifyNoonReceipt({
    symbol: "SPY",
    date: "2026-10-19",
    interval: "5m",
    url: request.url,
    settings: request.settings,
    fetchedAt: "2026-10-25T18:15:22.214Z",
    checksum: sha256Text(raw),
    raw,
  });
  assert.equal(checked.open, 769.0723876953125);
  assert.equal(checked.filled, false);
  assert.throws(
    () =>
      verifyNoonReceipt({
        symbol: "SPY",
        date: "2026-10-19",
        interval: "5m",
        url: request.url,
        settings: request.settings,
        fetchedAt: "2026-10-25T18:15:22.214Z",
        checksum: "0".repeat(64),
        raw,
      }),
    /checksum/,
  );
});

test("a noon stamp keeps the ET offset", () => {
  assert.equal(noonBarStamp("2026-10-19"), "2026-10-19T12:00:00-04:00");
  assert.equal(noonBarStamp("2026-01-05"), "2026-01-05T12:00:00-05:00");
});

test("a filled 5-minute open is not the grade when the 1-minute open differs", () => {
  const five = readNoonReading(filled, "2026-10-19");
  const minuteChart: ChartResult = {
    timestamp: [Date.parse("2026-10-19T15:59:00Z") / 1000, Date.parse("2026-10-19T16:00:00Z") / 1000],
    indicators: { quote: [{ open: [769.45, 769.0723876953125], close: [769.45, 768.9] }] },
  };
  const minute = readNoonReading(minuteChart, "2026-10-19");
  const resolved = resolvedNoonOpen(five, minute);
  assert.equal(resolved.ok, true);
  if (!resolved.ok) return;
  assert.equal(resolved.confirmed, false);
  assert.equal(resolved.open, 769.0723876953125);
  assert.match(resolved.note, /possible filled bar/);
  assert.match(resolved.note, /not the grade/);
  const missing = resolvedNoonOpen(five, null);
  assert.equal(missing.ok, false);
});

test("a filled open that matches the 1-minute open stays the grade and keeps the flag", () => {
  const five = readNoonReading(
    {
      timestamp: [Date.parse("2026-10-19T15:55:00Z") / 1000, Date.parse("2026-10-19T16:00:00Z") / 1000],
      indicators: { quote: [{ open: [17.53, 17.68000030517578], close: [17.68000030517578, 17.95] }] },
    },
    "2026-10-19",
  );
  const minute = readNoonReading(
    {
      timestamp: [Date.parse("2026-10-19T15:59:00Z") / 1000, Date.parse("2026-10-19T16:00:00Z") / 1000],
      indicators: { quote: [{ open: [17.66, 17.68000030517578], close: [17.68000030517578, 17.71] }] },
    },
    "2026-10-19",
  );
  assert.equal(five.filled, true);
  assert.equal(minute.filled, true);
  const resolved = resolvedNoonOpen(five, minute);
  assert.equal(resolved.ok, true);
  if (!resolved.ok) return;
  assert.equal(resolved.confirmed, true);
  assert.equal(resolved.filled, true);
  assert.equal(resolved.open, 17.68000030517578);
  assert.match(resolved.note, /filled flag stays/);
});

test("committed October 19 noon receipts match the price file", () => {
  const held = {
    SPY: { open: 769.0723876953125, filled: false },
    QQQ: { open: 723.3200073242188, filled: false },
    DIA: { open: 519.70751953125, filled: false },
    VIX: { open: 17.68000030517578, filled: true },
  } as const;
  for (const symbol of ["SPY", "QQQ", "DIA", "VIX"] as const) {
    const receipt = loadNoonReceipt("2026-10-19", symbol);
    const checked = verifyNoonReceipt(receipt);
    const stored = noonOpen(symbol, "2026-10-19");
    assert.equal(checked.open, held[symbol].open);
    assert.equal(checked.filled, held[symbol].filled);
    assert.equal(pricesAgree(stored, checked.open), true);
    assert.equal(formatPrice(stored), formatPrice(checked.open));
    assert.equal(chartFromRaw(receipt.raw).timestamp?.includes(1792425600), true);
  }
});

test("October 19 VIX noon stays 17.68 and the filled flag stays", () => {
  const five = verifyNoonReceipt(loadNoonReceipt("2026-10-19", "VIX"));
  const minuteReceipt = loadMinuteReceipt("2026-10-19", "VIX");
  const minute = verifyMinuteReceipt(minuteReceipt);
  assert.equal(minuteReceipt.interval, "1m");
  assert.equal(minuteReceipt.url, expectedMinuteRequest("VIX", "2026-10-19").url);
  assert.equal(five.filled, true);
  assert.equal(minute.filled, true);
  assert.equal(five.open, 17.68000030517578);
  assert.equal(minute.open, 17.68000030517578);
  assert.equal(minute.previousClose, 17.68000030517578);
  const resolved = resolvedNoonOpen(five, minute);
  assert.equal(resolved.ok, true);
  if (!resolved.ok) return;
  assert.equal(resolved.confirmed, true);
  assert.equal(resolved.open, 17.68000030517578);
  assert.match(resolved.note, /possible filled bar/);
  assert.match(resolved.note, /filled flag stays/);
});
