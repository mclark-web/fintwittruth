import assert from "node:assert/strict";
import test from "node:test";
import { buildDataset } from "./dataset";
import { FEATURED_COHORT_SLUG, LATEST_COHORT_SLUG } from "./demo-data";
import { callCheckpointLabel, checkpointPrints, checkpointSymbols, priceAt, reportOutLabel, TAPE_DISPLAY } from "./prints";
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
    assert.equal(priceAt(quote, "wednesday"), null);
    assert.equal(priceAt(quote, "friday"), null);
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
  const latest = data.cohorts.find((cohort) => cohort.slug === LATEST_COHORT_SLUG);
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
  assert.equal(reportOutLabel("Gap", 15.2), "Gap ($15.20)");
  assert.equal(reportOutLabel("Noon", 42.1), "Noon ($42.10)");
  assert.equal(reportOutLabel("Wed", null), "Wed");
  assert.equal(reportOutLabel("Fri", Number.NaN), "Fri");

  const latest = data.cohorts.find((cohort) => cohort.slug === LATEST_COHORT_SLUG);
  assert.ok(latest);
  const call = latest.calls.find((item) => item.primary === "NVDA");
  assert.ok(call);
  const quote = latest.quotes.find((item) => item.symbol === "NVDA");
  assert.ok(quote);
  assert.equal(callCheckpointLabel("Gap", latest.quotes, call.primary, "monday-gap"), reportOutLabel("Gap", quote.mondayOpen));
  assert.equal(callCheckpointLabel("Noon", latest.quotes, call.primary, "monday"), reportOutLabel("Noon", quote.monday));
  assert.equal(callCheckpointLabel("Wed", latest.quotes, call.primary, "wednesday"), "Wed");
  assert.equal(callCheckpointLabel("Gap", latest.quotes, undefined, "monday-gap"), "Gap");
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
