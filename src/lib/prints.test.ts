import assert from "node:assert/strict";
import test from "node:test";
import { buildDataset } from "./dataset";
import { DEMO_OPEN_COHORT_SLUG, FEATURED_COHORT_SLUG, LATEST_COHORT_SLUG } from "./demo-data";
import { formatSignedPct, moveArrow } from "./format";
import { READOUT_META } from "./labels";
import {
  callCheckpointLabel,
  callStance,
  checkpointPrints,
  checkpointSymbols,
  predictedReadout,
  priceAt,
  referencePrint,
  reportOutLabel,
  TAPE_DISPLAY,
} from "./prints";
import { EQUITY_TAPE, equityTapeMove, READOUTS } from "./scoring";

const data = buildDataset();

test("each published checkpoint lists the tape tickers and the print that was used", () => {
  for (const cohort of data.cohorts) {
    for (const readout of cohort.readouts) {
      const prints = checkpointPrints(cohort.quotes, readout.kind, TAPE_DISPLAY);
      if (readout.status !== "published") {
        assert.equal(prints.length, 0, `${cohort.slug} ${readout.kind} must not invent a print`);
        continue;
      }
      assert.deepEqual(
        prints.map((print) => print.symbol),
        [...TAPE_DISPLAY],
        `${cohort.slug} ${readout.kind}`,
      );
      for (const print of prints) {
        const quote = cohort.quotes.find((item) => item.symbol === print.symbol);
        assert.ok(quote);
        assert.equal(print.price, priceAt(quote, readout.kind));
        assert.ok(Number.isFinite(print.price));
      }
    }
  }
});

test("Monday gap uses the regular-session open and noon grades use the noon print", () => {
  const latest = data.cohorts.find((cohort) => cohort.slug === LATEST_COHORT_SLUG);
  assert.ok(latest);
  for (const symbol of TAPE_DISPLAY) {
    const quote = latest.quotes.find((item) => item.symbol === symbol);
    assert.ok(quote);
    assert.equal(priceAt(quote, "monday-gap"), quote.mondayOpen);
    assert.equal(priceAt(quote, "monday"), quote.monday);
    assert.notEqual(quote.mondayOpen, quote.monday);
    assert.equal(priceAt(quote, "wednesday"), quote.wednesday);
    assert.equal(priceAt(quote, "friday"), quote.friday);
    assert.notEqual(quote.wednesday, null);
    assert.equal(quote.friday, null);
  }
});

test("index tape move from the listed prints matches the published Monday score", () => {
  for (const cohort of data.cohorts) {
    for (const kind of ["monday-gap", "monday"] as const) {
      const readout = cohort.readouts.find((item) => item.kind === kind);
      assert.ok(readout);
      if (readout.status !== "published") continue;
      const moves = {} as Record<(typeof EQUITY_TAPE)[number], number>;
      for (const symbol of EQUITY_TAPE) {
        const quote = cohort.quotes.find((item) => item.symbol === symbol);
        assert.ok(quote);
        const now = priceAt(quote, kind);
        assert.ok(now != null);
        moves[symbol] = (now - quote.ref) / quote.ref;
      }
      assert.ok(Math.abs(equityTapeMove(moves) - readout.benchmarkMovePct) < 1e-12);
    }
  }
});

test("a call ticker is listed beside the tape when it is not SPY, QQQ, DIA, or VIX", () => {
  const latest = data.cohorts.find((cohort) => cohort.slug === DEMO_OPEN_COHORT_SLUG);
  assert.ok(latest);
  const call = latest.calls.find((item) => item.primary === "NVDA");
  assert.ok(call);
  const symbols = checkpointSymbols(call.primary);
  assert.deepEqual(symbols, [...TAPE_DISPLAY, "NVDA"]);
  const prints = checkpointPrints(latest.quotes, "monday-gap", symbols);
  const nvda = prints.find((print) => print.symbol === "NVDA");
  const quote = latest.quotes.find((item) => item.symbol === "NVDA");
  assert.ok(nvda);
  assert.ok(quote);
  assert.equal(nvda.price, quote.mondayOpen);
});

test("report-out cards put the checkpoint price next to the label", () => {
  assert.equal(reportOutLabel("NVDA", 15.2), "NVDA ($15.20)");
  assert.equal(reportOutLabel("SPY", 42.1), "SPY ($42.10)");
  assert.equal(reportOutLabel("NVDA", null), "NVDA");
  assert.equal(reportOutLabel("SPY", Number.NaN), "SPY");

  const demo = data.cohorts.find((cohort) => cohort.slug === DEMO_OPEN_COHORT_SLUG);
  assert.ok(demo);
  const call = demo.calls.find((item) => item.primary === "NVDA");
  assert.ok(call);
  const quote = demo.quotes.find((item) => item.symbol === "NVDA");
  assert.ok(quote);
  assert.equal(callCheckpointLabel("Gap", demo.quotes, call.primary, "monday-gap"), reportOutLabel("Gap", quote.mondayOpen));
  assert.equal(callCheckpointLabel("Noon", demo.quotes, call.primary, "monday"), reportOutLabel("Noon", quote.monday));
  assert.equal(callCheckpointLabel("Fri", demo.quotes, call.primary, "friday"), "Fri");
  assert.equal(callCheckpointLabel("Gap", demo.quotes, undefined, "monday-gap"), "Gap");
});

test("a readout bubble is the predicted ticker, its print, and the move from the reference", () => {
  assert.equal(READOUT_META.monday.short, "Mon noon");
  assert.equal(READOUT_META.monday.time, "12:00 PM ET");
  assert.equal(READOUT_META.wednesday.short, "Wed close");
  assert.equal(READOUT_META.wednesday.time, "4:00 PM ET");
  assert.equal(READOUT_META.friday.short, "Fri close");
  assert.equal(READOUT_META.friday.time, "4:00 PM ET");

  const up = predictedReadout(
    [{ symbol: "NVDA", ref: 219.82, mondayOpen: null, monday: 225.1, wednesday: null, friday: null }],
    "NVDA",
    "monday",
    "bullish",
  );
  assert.ok(up);
  assert.equal(up.text, "NVDA ($225.10) +2.4%");
  assert.equal(up.stance, "with");
  assert.equal(moveArrow(up.move ?? 0), "▲");
  assert.equal(moveArrow(0), "");

  const down = predictedReadout(
    [{ symbol: "SPY", ref: 774.83, mondayOpen: null, monday: null, wednesday: 768.63, friday: null }],
    "SPY",
    "wednesday",
    "bullish",
  );
  assert.ok(down);
  assert.equal(down.text, "SPY ($768.63) \u22120.8%");
  assert.equal(down.stance, "against");
  assert.equal(moveArrow(down.move ?? 0), "▼");
  assert.equal(callStance("bearish", down.move ?? 0), "with");

  const missing = predictedReadout(
    [{ symbol: "NVDA", ref: 222.27, mondayOpen: null, monday: null, wednesday: null, friday: null }],
    "NVDA",
    "friday",
    "bullish",
  );
  assert.ok(missing);
  assert.equal(missing.text, "NVDA");
  assert.equal(missing.price, null);
  assert.equal(missing.move, null);
  assert.equal(missing.stance, null);
  assert.equal(predictedReadout([], undefined, "monday", "bullish"), null);

  const demo = data.cohorts.find((cohort) => cohort.slug === DEMO_OPEN_COHORT_SLUG);
  assert.ok(demo);
  const call = demo.calls.find((item) => item.primary === "NVDA");
  assert.ok(call);
  const quote = demo.quotes.find((item) => item.symbol === "NVDA");
  assert.ok(quote?.monday != null);
  const seeded = predictedReadout(demo.quotes, call.primary, "monday", call.direction);
  assert.ok(seeded);
  assert.equal(seeded.symbol, "NVDA");
  assert.equal(seeded.price, quote.monday);
  assert.equal(seeded.ref, quote.ref);
  assert.equal(seeded.text, `NVDA ($${quote.monday.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) ${formatSignedPct((quote.monday - quote.ref) / quote.ref)}`);
  assert.equal(referencePrint(demo.quotes, "NVDA")?.price, quote.ref);
  assert.notEqual(seeded.symbol, "SPY");
});

test("Labor Day Monday stays blank instead of borrowing a later print", () => {
  const holiday = data.cohorts.find((cohort) => cohort.slug === FEATURED_COHORT_SLUG);
  assert.ok(holiday);
  for (const kind of READOUTS) {
    const prints = checkpointPrints(holiday.quotes, kind, checkpointSymbols("NVDA"));
    if (kind === "monday-gap" || kind === "monday") {
      assert.equal(prints.length, 0);
    } else {
      assert.ok(prints.some((print) => print.symbol === "NVDA"));
      assert.ok(prints.some((print) => print.symbol === "SPY"));
    }
  }
});
