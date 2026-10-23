import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildDataset } from "../src/lib/dataset";
import { parsePendingApproval } from "../src/lib/pending-approval";
import { parseCallCsv } from "./calls-ledger";
import { ingestXScan } from "./xscan-ingest";

const scan = readFileSync("data/calls/sources/x-call-scan-2026-10-22.csv", "utf8");
const rows = parseCallCsv(readFileSync("data/calls/calls.csv", "utf8"));
const ingested = ingestXScan(scan, rows[0]);

test("the October 22 scan adds clear FinTwit rows and queues ambiguous rows", () => {
  const week = rows.filter((row) => row.cohort_slug === "2026-10-26");
  assert.equal(week.length, ingested.counts.calls);
  assert.ok(ingested.counts.calls > 0);
  assert.equal(ingested.counts.ambiguousRows, 63);
  assert.equal(ingested.counts.bankRows, 175);
  assert.equal(ingested.pending.length, ingested.counts.pendingRows);
  assert.ok(ingested.pending.every((row) => row.reason.includes("Not graded")));
  const pending = parsePendingApproval(readFileSync("data/calls/pending-approval.csv", "utf8"));
  assert.equal(pending.length, ingested.pending.length);
  const bodies = new Set(week.map((row) => row.body));
  for (const row of ingested.pending) assert.equal(bodies.has(row.quote), false);
  for (const row of week) {
    assert.equal(row.data_source, "public");
    assert.ok(row.source_url.startsWith("https://x.com/"));
    assert.equal(row.monday_status, "PENDING");
    assert.equal(row.wednesday_status, "PENDING");
    assert.equal(row.friday_status, "PENDING");
    assert.equal(row.monday_score, "");
    assert.equal(row.ref_price, "");
    assert.equal(row.body.length > 0, true);
  }
  const twoSided = [
    "2113248938786713626",
    "2113249165413396631",
    "2113256079505420587",
    "2113267856234238328",
    "2113430455991009647",
  ];
  for (const status of twoSided) {
    const sides = week.filter((row) => row.source_url.endsWith(`/${status}`));
    const directions = [...new Set(sides.map((row) => row.direction))].sort();
    assert.ok(sides.length >= 2, status);
    assert.deepEqual(directions, ["bearish", "bullish"]);
    assert.equal(new Set(sides.map((row) => row.body)).size, sides.length / 2);
  }
  const held = [
    "2113291700189696089",
    "2113278596781408266",
    "2113392133591732357",
    "2113222345447841905",
    "2113416016013467825",
  ];
  for (const status of held) {
    assert.equal(week.some((row) => row.source_url.endsWith(`/${status}`)), false);
    assert.equal(ingested.pending.some((row) => row.post_url.endsWith(`/${status}`)), true);
  }
  assert.equal(week.some((row) => row.source_url.endsWith("/2113401290227437964")), true);
  const spx = week.find((row) => row.handle === "Staticether");
  assert.equal(spx?.primary, "SPX");
  assert.equal(spx?.flags, "");
  assert.equal(spx?.tickers, "SPX");
  const vix = week.find((row) => row.handle === "JaffreyTrades");
  assert.equal(vix?.primary, "VIX");
  assert.equal(vix?.monday_status, "PENDING");
  assert.equal(vix?.monday_score, "");
});

test("the October 26 week is on the board and has no checkpoint grade", () => {
  const data = buildDataset();
  const week = data.cohorts.find((cohort) => cohort.slug === "2026-10-26");
  assert.ok(week);
  assert.equal(week.dataset, "live");
  assert.equal(week.isLatest, true);
  assert.equal(week.quotes.length, 0);
  assert.equal(week.grades.length, 0);
  assert.ok(week.calls.length > 0);
  assert.ok(week.readouts.every((readout) => readout.status === "scheduled"));
  assert.ok(week.calls.every((call) => call.sourceUrl.startsWith("https://x.com/") && call.body.length > 0));
});
