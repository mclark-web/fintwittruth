/**
 * Check the calls ledger with the same grade, bubble, and calendar code the site uses.
 * data_source=demo is rejected. The production book is this file.
 */
import { readFileSync } from "node:fs";
import {
  CALLS_CSV_PATH,
  CSV_ONLY_COLUMNS,
  LIVE_JSON_PATH,
  CHECKPOINTS,
  collectIssues,
  parseCallCsv,
  renderLiveJson,
  serializeCallCsv,
} from "./calls-ledger";

function main() {
  const errors: string[] = [];
  const csvText = readFileSync(CALLS_CSV_PATH, "utf8");
  const jsonText = readFileSync(LIVE_JSON_PATH, "utf8");
  const rows = parseCallCsv(csvText);
  const issues = collectIssues(rows);
  errors.push(...issues.errors);

  const rendered = renderLiveJson(rows);
  const renderedAgain = renderLiveJson(parseCallCsv(serializeCallCsv(rows)));
  if (rendered !== renderedAgain) errors.push("exporting the CSV twice was not byte-identical");
  if (rendered !== jsonText) errors.push("src/lib/live-calls.json is not the export of calls.csv");

  const wiped = rows.map((row) => {
    const copy = { ...row };
    for (const column of CSV_ONLY_COLUMNS) {
      if (column === "export_index") continue;
      copy[column] = "";
    }
    return copy;
  });
  if (renderLiveJson(wiped) !== rendered) {
    errors.push("checkpoint and bookkeeping columns changed the exported JSON");
  }

  const parsed = JSON.parse(rendered) as { cohorts: Array<Record<string, unknown>> };
  for (const cohort of parsed.cohorts) {
    const calls = cohort.calls as Array<Record<string, unknown>>;
    for (const call of calls) {
      for (const column of CSV_ONLY_COLUMNS) {
        if (column in call) errors.push(`exported JSON includes CSV-only column ${column}`);
      }
    }
  }

  const graded = rows.reduce(
    (sum, row) => sum + CHECKPOINTS.filter((kind) => row[`${kind}_status`] === "GRADED").length,
    0,
  );
  const demo = rows.filter((row) => row.data_source === "demo").length;
  const publicRows = rows.filter((row) => row.data_source === "public").length;
  const licensed = rows.filter((row) => row.data_source === "licensed").length;
  console.log(`rows: ${rows.length}`);
  console.log(`data_source demo: ${demo}`);
  console.log(`data_source public: ${publicRows}`);
  console.log(`data_source licensed: ${licensed}`);
  console.log(`graded checkpoints: ${graded}`);
  console.log(`json derived from csv: ${rendered === jsonText ? "byte-identical" : "MISMATCH"}`);
  console.log(`bookkeeping stays csv-only: ${renderLiveJson(wiped) === rendered ? "yes" : "MISMATCH"}`);
  console.log(`idempotent export: ${rendered === renderedAgain ? "byte-identical" : "MISMATCH"}`);
  for (const warning of issues.warnings) console.log(`WARN ${warning}`);
  if (errors.length > 0) {
    for (const error of errors) console.error(`ERROR ${error}`);
    process.exit(1);
  }
  console.log("OK");
}

main();
