/**
 * Append the October 22, 2026 X scan to the call ledger and the approval queue.
 * Existing ledger rows stay. A second run does not add the same call id again.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { CALLS_CSV_PATH, parseCallCsv, serializeCallCsv } from "./calls-ledger";
import { XSCAN_COHORT, ingestXScan, serializePending } from "./xscan-ingest";

const scanPath = join(process.cwd(), "data/calls/sources/x-call-scan-2026-10-22.csv");
const pendingPath = join(process.cwd(), "data/calls/pending-approval.csv");

function main() {
  const existing = parseCallCsv(readFileSync(CALLS_CSV_PATH, "utf8"));
  const template = existing[0];
  if (!template) throw new Error("calls.csv has no template row.");
  const ingested = ingestXScan(readFileSync(scanPath, "utf8"), template);
  const have = new Set(existing.map((row) => row.call_id));
  const added = ingested.calls
    .filter((row) => !have.has(row.call_id))
    .sort((a, b) => (a.call_id < b.call_id ? -1 : a.call_id > b.call_id ? 1 : 0));
  let nextIndex = existing.reduce((max, row) => Math.max(max, Number(row.export_index)), -1) + 1;
  for (const row of added) {
    row.export_index = String(nextIndex);
    nextIndex += 1;
  }
  const rows = [...existing, ...added].sort((a, b) => (a.call_id < b.call_id ? -1 : a.call_id > b.call_id ? 1 : 0));
  writeFileSync(CALLS_CSV_PATH, serializeCallCsv(rows));
  writeFileSync(pendingPath, serializePending(ingested.pending));
  console.log(JSON.stringify({ ...ingested.counts, added: added.length, cohort: XSCAN_COHORT }, null, 2));
}

const isDirectRun = process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) main();
