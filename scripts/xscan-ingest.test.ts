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
