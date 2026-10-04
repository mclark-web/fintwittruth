/**
 * Regenerate src/lib/live-calls.json from data/calls/calls.csv.
 * Checkpoint columns stay in the CSV. The demo book is not written.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { CALLS_CSV_PATH, LIVE_JSON_PATH, collectIssues, parseCallCsv, renderLiveJson } from "./calls-ledger";

const csv = readFileSync(CALLS_CSV_PATH, "utf8");
const rows = parseCallCsv(csv);
const issues = collectIssues(rows);
for (const warning of issues.warnings) console.warn(`WARN ${warning}`);
if (issues.errors.length > 0) {
  for (const error of issues.errors) console.error(`ERROR ${error}`);
  console.error(`Refusing to write ${LIVE_JSON_PATH}`);
  process.exit(1);
}

const json = renderLiveJson(rows);
writeFileSync(LIVE_JSON_PATH, json);
console.log(`Wrote ${rows.length} calls to src/lib/live-calls.json`);
