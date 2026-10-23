/**
 * Replace the October 26 cohort with the current scan rules.
 * Older cohorts stay, including their export indexes. A second run is idempotent.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { CALLS_CSV_PATH, parseCallCsv, serializeCallCsv } from "./calls-ledger";
import { XSCAN_COHORT, ingestXScan, serializePending } from "./xscan-ingest";

const scanPath = join(process.cwd(), "data/calls/sources/x-call-scan-2026-10-22.csv");
const pendingPath = join(process.cwd(), "data/calls/pending-approval.csv");

function byId(a: { call_id: string }, b: { call_id: string }): number {
  return a.call_id < b.call_id ? -1 : a.call_id > b.call_id ? 1 : 0;
}

function main() {
  const existing = parseCallCsv(readFileSync(CALLS_CSV_PATH, "utf8"));
  const template = existing.find((row) => row.cohort_slug !== XSCAN_COHORT) ?? existing[0];
  if (!template) throw new Error("calls.csv has no template row.");
  const historical = existing.filter((row) => row.cohort_slug !== XSCAN_COHORT);
  const ingested = ingestXScan(readFileSync(scanPath, "utf8"), template);
  const calls = ingested.calls.slice().sort(byId);
  const used = new Set(historical.map((row) => Number(row.export_index)));
  const total = historical.length + calls.length;
  const free: number[] = [];
  for (let index = 0; index < total; index += 1) {
    if (!used.has(index)) free.push(index);
  }
  if (free.length !== calls.length) {
    throw new Error(`export_index has ${free.length} open slots for ${calls.length} October 26 rows.`);
  }
  calls.forEach((row, index) => {
    row.export_index = String(free[index]);
  });
  const rows = [...historical, ...calls].sort(byId);
  writeFileSync(CALLS_CSV_PATH, serializeCallCsv(rows));
  writeFileSync(pendingPath, serializePending(ingested.pending));
  console.log(JSON.stringify({ ...ingested.counts, cohort: XSCAN_COHORT, rows: rows.length }, null, 2));
}

const isDirectRun = process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) main();
