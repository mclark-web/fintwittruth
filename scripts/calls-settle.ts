/**
 * Fill due Monday noon, Wednesday close, and Friday close grades from the recorded Yahoo prints.
 * Dry-run is the default. The CSV is written only with --write.
 * A pending row is graded when the post names exactly one whitelist print and that print is the primary.
 * A row that already has a graded checkpoint is graded again at the next due print, on that same primary.
 * A post that names no ticker stays pending and is not graded on SPY, even when an earlier checkpoint was graded.
 * A post that was never graded stays pending when it names more than one print.
 * A same-day or 0DTE trade stays pending.
 */
import { readFileSync, writeFileSync } from "node:fs";
import {
  CALLS_CSV_PATH,
  collectIssues,
  loadTape,
  parseCallCsv,
  settleLedger,
  serializeCallCsv,
  type CallRow,
  type Checkpoint,
} from "./calls-ledger";

const HELP = `Usage: npm run calls:settle -- [--write]

Dry-run is the default. Nothing is written unless --write is present.
Pending Monday 12:00 PM ET, Wednesday close, and Friday close checkpoints are graded from the prints already in market-history.json.
A row is auto-graded when the post names exactly one whitelist symbol and that symbol is the primary.
Once a primary named in the post is recorded and an earlier checkpoint is graded, a later due checkpoint is graded on that same primary.
A post that names no ticker stays pending and is not graded on SPY.
A post that was never graded stays pending when it names more than one print.
A same-day or 0DTE trade stays pending.
A date outside the cohort's Monday / Wednesday / Friday, and a missing print, stay pending.
`;

function tapeFor(row: CallRow, kind: Checkpoint) {
  return loadTape(row.history_slug, row.primary, kind, row[`${kind}_date`]);
}

function main() {
  const args = process.argv.slice(2).filter((arg) => arg !== "--");
  if (args.includes("--help") || args.includes("-h")) {
    console.log(HELP.trim());
    return;
  }
  const unknown = args.filter((arg) => arg !== "--write");
  if (unknown.length > 0) {
    console.error(`Unknown argument ${unknown[0]}. Dry-run is the default. Pass --write to persist the CSV.`);
    process.exit(1);
  }
  const write = args.includes("--write");
  const csvText = readFileSync(CALLS_CSV_PATH, "utf8");
  const rows = parseCallCsv(csvText);
  const issues = collectIssues(rows);
  if (issues.errors.length > 0) {
    for (const error of issues.errors) console.error(`ERROR ${error}`);
    console.error("Refusing to settle a ledger that does not validate.");
    process.exit(1);
  }
  const result = settleLedger(rows, { now: new Date(), tapeFor });
  for (const line of result.lines) {
    const flagged = /left pending|not in the allowed set|Refusing|no recorded print|session is closed/.test(line);
    console.log(flagged ? `FLAG ${line}` : line);
  }
  console.log(
    `${result.graded} graded, ${result.synced} synced, ${result.closed} closed, ${result.flagged} flagged, ${result.pending} still pending`,
  );
  const next = serializeCallCsv(result.rows);
  if (!write) {
    console.log("dry-run: CSV not written");
  } else if (next === csvText) {
    console.log("CSV unchanged");
  } else {
    writeFileSync(CALLS_CSV_PATH, next);
    console.log("Wrote data/calls/calls.csv");
  }
}

main();
