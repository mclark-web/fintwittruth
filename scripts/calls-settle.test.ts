import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { UNGRADED_HORIZON } from "../src/lib/grades";
import {
  CALLS_CSV_PATH,
  CHECKPOINTS,
  CSV_COLUMNS,
  LIVE_JSON_PATH,
  classifyCall,
  collectIssues,
  considerCheckpoint,
  gradeLabel,
  gradedRowsFromLive,
  parseCallCsv,
  renderLiveJson,
  serializeCallCsv,
  settleLedger,
  type CallRow,
  type TapePrint,
} from "./calls-ledger";

const OPEN_TAPE: TapePrint = {
  closed: false,
  ref: 100,
  price: 110,
  primaryRef: 100,
  primaryNow: 110,
  tapeMove: 0.02,
  vixMove: -0.12,
};

const CLOSED_TAPE: TapePrint = {
  closed: true,
  ref: null,
  price: null,
  primaryRef: null,
  primaryNow: null,
  tapeMove: null,
  vixMove: null,
};

const MISSING_TAPE: TapePrint = { ...CLOSED_TAPE, closed: false };

function callRow(overrides: Partial<CallRow> = {}): CallRow {
  const row = {} as CallRow;
  for (const column of CSV_COLUMNS) row[column] = "";
  Object.assign(row, {
    call_id: "2026-09-21__nvda",
    cohort_slug: "2026-09-21",
    history_slug: "2026-09-21",
    handle: "nvda",
    primary: "NVDA",
    direction: "bullish",
    sentiment: "meltup",
    conviction: "high",
    explicit: "true",
    tickers: "NVDA",
    body: "High conviction $NVDA going higher this week.",
    monday_date: "2026-09-21",
    wednesday_date: "2026-09-23",
    friday_date: "2026-09-25",
    monday_status: "PENDING",
    wednesday_status: "PENDING",
    friday_status: "PENDING",
    ...overrides,
  });
  return row;
}

function gradeMonday(row: CallRow, tape: TapePrint = OPEN_TAPE) {
  return considerCheckpoint(row, "monday", { now: new Date("2026-09-21T16:30:00.000Z"), due: true, tape });
}

test("grade bands stay 70 / 40 and an ungraded horizon is not EXIT LIQUIDITY", () => {
  assert.equal(gradeLabel(70), "STRONG");
  assert.equal(gradeLabel(100), "STRONG");
  assert.equal(gradeLabel(69.9), "PROVISIONAL");
  assert.equal(gradeLabel(40), "PROVISIONAL");
  assert.equal(gradeLabel(39.9), "WEAK");
  assert.equal(gradeLabel(1), "WEAK");
  assert.equal(gradeLabel(0), "EXIT LIQUIDITY");
  assert.equal(UNGRADED_HORIZON, "Not graded yet");
});

test("the verified book round-trips through the CSV and the scorer", () => {
  const rows = gradedRowsFromLive();
  const json = readFileSync(LIVE_JSON_PATH, "utf8");
  assert.equal(renderLiveJson(rows), json);
  assert.equal(renderLiveJson(parseCallCsv(serializeCallCsv(rows))), json);
  const issues = collectIssues(rows);
  assert.deepEqual(issues.errors, []);
  assert.ok(rows.length > 0);
  for (const row of rows) {
    assert.ok(row.source_url.startsWith("https://"));
    for (const kind of CHECKPOINTS) {
      assert.equal(row[`${kind}_status`], "GRADED");
      assert.ok(Number(row.ref_price) > 0);
      assert.ok(Number(row[`${kind}_price`]) > 0);
      assert.match(row[`${kind}_text`], new RegExp(`^${row.primary} \\(\\$`));
    }
  }
});

test("duplicate ids, a missing source, a graded row without prices, a foreign ticker, a bad date, and an impossible score fail", () => {
  const rows = gradedRowsFromLive();
  const duplicate = rows.map((row) => ({ ...row }));
  duplicate.push({ ...duplicate[0], export_index: String(duplicate.length) });
  assert.ok(collectIssues(duplicate).errors.some((error) => error.includes("duplicate call_id")));

  const missingUrl = rows.map((row, index) => (index === 0 ? { ...row, source_url: "" } : { ...row }));
  assert.ok(collectIssues(missingUrl).errors.some((error) => error.includes("missing source URL")));

  const noPrice = rows.map((row, index) => (index === 0 ? { ...row, monday_price: "" } : { ...row }));
  assert.ok(collectIssues(noPrice).errors.some((error) => error.includes("missing the price at the call or the price at the checkpoint")));

  const foreign = rows.map((row, index) => (index === 0 ? { ...row, primary: "AAPL" } : { ...row }));
  assert.ok(collectIssues(foreign).errors.some((error) => error.includes("does not match a ticker or index")));

  const badDate = rows.map((row, index) => (index === 0 ? { ...row, monday_date: "2026-01-01" } : { ...row }));
  assert.ok(collectIssues(badDate).errors.some((error) => error.includes("not the allowed")));

  const impossible = rows.map((row, index) => (index === 0 ? { ...row, monday_score: "140" } : { ...row }));
  assert.ok(collectIssues(impossible).errors.some((error) => error.includes("above 100")));
  const negative = rows.map((row, index) => (index === 0 ? { ...row, monday_price: "-1" } : { ...row }));
  assert.ok(collectIssues(negative).errors.some((error) => error.includes("missing the price")));
});

test("settle grades one whitelist symbol and leaves ambiguous, unnamed, and wrong-index rows pending", () => {
  const nvda = gradeMonday(callRow());
  assert.equal(nvda.action, "graded");
  assert.equal(nvda.row.monday_status, "GRADED");
  assert.equal(nvda.row.grade_method, "auto-yahoo");
  assert.ok(Number(nvda.row.monday_price) > 0);
  assert.ok(Number(nvda.row.ref_price) > 0);
  assert.match(nvda.row.monday_text, /^NVDA \(\$/);
  assert.ok(nvda.row.monday_grade === "STRONG" || nvda.row.monday_grade === "PROVISIONAL" || nvda.row.monday_grade === "WEAK" || nvda.row.monday_grade === "EXIT LIQUIDITY");

  const spx = gradeMonday(
    callRow({
      call_id: "2026-09-21__spx",
      handle: "spx",
      primary: "SPY",
      direction: "bearish",
      sentiment: "panic",
      explicit: "true",
      tickers: "SPX",
      body: "SPX is preparing for a pullback.",
    }),
  );
  assert.equal(spx.action, "graded");
  assert.equal(spx.row.primary, "SPY");
  assert.equal(classifyCall(spx.row).autoPrint, "SPY");

  const both = gradeMonday(
    callRow({
      primary: "SPY",
      direction: "bearish",
      sentiment: "panic",
      explicit: "true",
      tickers: "SPX;NDX",
      body: "SPX and NDX are both in a downtrend.",
    }),
  );
  assert.equal(both.action, "flagged");
  assert.equal(both.row.monday_status, "PENDING");
  assert.match(both.detail, /more than one print/);

  const unnamed = gradeMonday(
    callRow({
      primary: "SPY",
      direction: "bearish",
      sentiment: "panic",
      explicit: "false",
      tickers: "",
      body: "Major indexes are facing short-term pressure and a pullback.",
    }),
  );
  assert.equal(unnamed.action, "flagged");
  assert.equal(unnamed.row.monday_status, "PENDING");
  assert.match(unnamed.detail, /no ticker or index/);

  const wrongIndex = gradeMonday(
    callRow({
      primary: "QQQ",
      direction: "bearish",
      sentiment: "panic",
      explicit: "true",
      tickers: "SPX",
      body: "SPX is preparing for a pullback.",
    }),
  );
  assert.equal(wrongIndex.action, "flagged");
  assert.equal(wrongIndex.row.monday_status, "PENDING");

  const lookalike = gradeMonday(
    callRow({
      body: "SPYX and QQQQ are not tickers on this board.",
      tickers: "NVDA",
    }),
  );
  assert.equal(lookalike.action, "flagged");
  assert.equal(classifyCall(lookalike.row).autoPrint, null);

  const badDate = gradeMonday(callRow({ monday_date: "2026-01-01" }));
  assert.equal(badDate.action, "flagged");
  assert.match(badDate.detail, /not in the allowed set/);
  assert.equal(badDate.row.monday_status, "PENDING");

  const missing = gradeMonday(callRow(), MISSING_TAPE);
  assert.equal(missing.action, "flagged");
  assert.match(missing.detail, /Refusing to invent/);
  assert.equal(missing.row.monday_price, "");

  const holiday = considerCheckpoint(
    callRow({
      cohort_slug: "2026-09-07",
      call_id: "2026-09-07__nvda",
      history_slug: "2026-09-07",
      monday_date: "2026-09-07",
      wednesday_date: "2026-09-09",
      friday_date: "2026-09-11",
    }),
    "monday",
    { now: new Date("2026-09-08T16:00:00.000Z"), due: true, tape: CLOSED_TAPE },
  );
  assert.equal(holiday.action, "closed");
  assert.equal(holiday.row.monday_status, "CLOSED");
  assert.equal(holiday.row.monday_grade, "");
  assert.equal(holiday.row.monday_price, "");
});

test("a not-due checkpoint and a second settle do not grade again", () => {
  const waiting = considerCheckpoint(callRow(), "wednesday", {
    now: new Date("2026-09-23T18:00:00.000Z"),
    due: false,
    tape: OPEN_TAPE,
  });
  assert.equal(waiting.action, "unchanged");
  assert.equal(waiting.row.wednesday_status, "PENDING");

  const once = settleLedger([callRow()], {
    now: new Date("2026-09-26T21:00:00.000Z"),
    tapeFor: () => OPEN_TAPE,
    due: () => true,
  });
  assert.equal(once.graded, 3);
  const twice = settleLedger(once.rows, {
    now: new Date("2026-09-26T21:00:00.000Z"),
    tapeFor: () => OPEN_TAPE,
    due: () => true,
  });
  assert.equal(twice.graded, 0);
  assert.equal(twice.synced, 0);
});

test("readout bubbles stay green when the call is right and red when it is wrong", () => {
  const css = readFileSync("src/app/globals.css", "utf8");
  assert.match(css, /\.readout-move-with \{[^}]*color:\s*#4cc38a/);
  assert.match(css, /\.readout-move-against \{[^}]*color:\s*#f26d7d/);
  const up = gradeMonday(callRow());
  assert.equal(up.row.monday_stance, "with");
  const down = gradeMonday(
    callRow({
      direction: "bearish",
      sentiment: "panic",
      body: "High conviction $NVDA crash, sell the open.",
    }),
  );
  assert.equal(down.action, "graded");
  assert.equal(down.row.monday_stance, "against");
});

test("calls:settle defaults to dry-run and rejects an unknown flag", () => {
  const before = readFileSync(CALLS_CSV_PATH, "utf8");
  const dry = spawnSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/calls-settle.ts"], {
    encoding: "utf8",
  });
  assert.equal(dry.status, 0, dry.stderr);
  assert.match(dry.stdout, /dry-run: CSV not written/);
  assert.equal(readFileSync(CALLS_CSV_PATH, "utf8"), before);

  const help = spawnSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/calls-settle.ts", "--help"], {
    encoding: "utf8",
  });
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /--write/);
  assert.match(help.stdout, /Dry-run is the default/);

  const unknown = spawnSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/calls-settle.ts", "--nope"], {
    encoding: "utf8",
  });
  assert.equal(unknown.status, 1);
  assert.match(unknown.stderr, /Unknown argument/);
  assert.equal(readFileSync(CALLS_CSV_PATH, "utf8"), before);
});
