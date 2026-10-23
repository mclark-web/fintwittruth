import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildDataset } from "../src/lib/dataset";
import { parsePendingApproval } from "../src/lib/pending-approval";
import { sessionClose } from "../src/lib/quotes";
import { planBackfill } from "./backfill-xscan";
import { CHECKPOINTS, parseCallCsv } from "./calls-ledger";

const NOW = new Date("2026-10-23T03:00:00.000Z");
const scan = readFileSync("data/calls/sources/x-call-backfill-2026-07-27_10-21.csv", "utf8");
const rows = parseCallCsv(readFileSync("data/calls/calls.csv", "utf8"));

const GRADED_CALLS: Record<string, number> = {
  "2026-08-03": 1,
  "2026-08-10": 2,
  "2026-08-17": 1,
  "2026-08-24": 2,
  "2026-08-31": 1,
  "2026-09-07": 1,
  "2026-09-14": 1,
  "2026-09-21": 4,
  "2026-09-28": 9,
  "2026-10-05": 8,
  "2026-10-12": 4,
  "2026-10-19": 10,
  "2026-10-26": 0,
};

const GRADED_CHECKPOINTS: Record<string, number> = {
  "2026-08-03": 2,
  "2026-08-10": 4,
  "2026-08-17": 2,
  "2026-08-24": 6,
  "2026-08-31": 3,
  "2026-09-07": 2,
  "2026-09-14": 3,
  "2026-09-21": 12,
  "2026-09-28": 27,
  "2026-10-05": 24,
  "2026-10-12": 12,
  "2026-10-19": 20,
  "2026-10-26": 0,
};

test("the July 27 backfill stays append-only and keeps ambiguous rows off the book", () => {
  const plan = planBackfill(scan, rows, NOW);
  assert.equal(plan.counts.scanRows, 371);
  assert.equal(plan.counts.clearRows, 240);
  assert.equal(plan.counts.ambiguousRows, 131);
  assert.equal(plan.counts.calls, 0);
  assert.equal(plan.counts.deduped, 38);
  assert.equal(plan.counts.outsideWindow, 121);
  assert.equal(plan.counts.recaps, 0);
  assert.equal(plan.counts.unnamed, 40);
  assert.equal(plan.counts.notGradeable, 41);
  assert.ok(plan.pending.every((row) => row.reason.includes("Not graded")));
  assert.equal(plan.pending.filter((row) => row.reason.startsWith("ambiguous=true")).length, 131);

  const published = new Set(rows.map((row) => `${row.source_url}\n${row.tickers}\n${row.direction}`));
  for (const row of plan.pending.filter((item) => item.reason.startsWith("ambiguous=true"))) {
    assert.equal(published.has(`${row.post_url}\n${row.ticker}\n${row.direction}`), false);
  }
  const pending = parsePendingApproval(readFileSync("data/calls/pending-approval.csv", "utf8"));
  const queued = new Set(pending.map((row) => `${row.postUrl}\n${row.ticker}\n${row.direction}`));
  for (const row of plan.pending) {
    assert.equal(queued.has(`${row.post_url}\n${row.ticker}\n${row.direction}`), true);
  }
});

test("clear backfill rows are graded at the recorded checkpoints", () => {
  const backfill = rows.filter((row) => row.notes.startsWith("backfill-ticker="));
  assert.equal(backfill.length, 38);
  assert.equal(backfill.filter((row) => CHECKPOINTS.some((kind) => row[`${kind}_status`] === "GRADED")).length, 35);
  assert.equal(rows.length, 112);

  const gradedCalls: Record<string, number> = {};
  const gradedCheckpoints: Record<string, number> = {};
  for (const row of rows) {
    gradedCalls[row.cohort_slug] = (gradedCalls[row.cohort_slug] ?? 0) + (CHECKPOINTS.some((kind) => row[`${kind}_status`] === "GRADED") ? 1 : 0);
    gradedCheckpoints[row.cohort_slug] =
      (gradedCheckpoints[row.cohort_slug] ?? 0) + CHECKPOINTS.filter((kind) => row[`${kind}_status`] === "GRADED").length;
  }
  assert.deepEqual(gradedCalls, GRADED_CALLS);
  assert.deepEqual(gradedCheckpoints, GRADED_CHECKPOINTS);
  const accounts = new Set(
    rows.filter((row) => CHECKPOINTS.some((kind) => row[`${kind}_status`] === "GRADED")).map((row) => row.handle),
  );
  assert.equal(accounts.size, 10);

  const august = rows.find((row) => row.cohort_slug === "2026-08-03");
  assert.ok(august);
  assert.equal(august.monday_status, "PENDING");
  assert.equal(august.monday_score, "");
  assert.equal(august.wednesday_status, "GRADED");
  assert.equal(august.friday_status, "GRADED");
  assert.equal(august.grade_method, "auto-yahoo");
  assert.equal(Number(august.wednesday_price), sessionClose(august.primary, august.wednesday_date));
  assert.equal(Number(august.friday_price), sessionClose(august.primary, august.friday_date));

  const labor = rows.find((row) => row.cohort_slug === "2026-09-07" && row.notes.startsWith("backfill-ticker="));
  assert.ok(labor);
  assert.equal(labor.monday_status, "CLOSED");
  assert.equal(labor.monday_score, "");
  assert.equal(labor.wednesday_status, "GRADED");
  assert.equal(labor.friday_status, "GRADED");

  for (const row of rows.filter((item) => item.cohort_slug === "2026-10-19")) {
    assert.equal(row.friday_status, "PENDING");
    assert.equal(row.friday_score, "");
    assert.equal(row.monday_status, "GRADED");
    assert.equal(row.wednesday_status, "GRADED");
  }
  for (const row of backfill.filter((item) => item.cohort_slug === "2026-10-26")) {
    for (const kind of CHECKPOINTS) assert.equal(row[`${kind}_status`], "PENDING");
  }

  const data = buildDataset();
  const week = data.cohorts.find((cohort) => cohort.slug === "2026-08-03" && cohort.dataset === "live");
  assert.ok(week);
  assert.equal(week.readouts.find((item) => item.kind === "monday")?.status, "scheduled");
  assert.equal(week.readouts.find((item) => item.kind === "wednesday")?.status, "published");
  assert.equal(week.readouts.find((item) => item.kind === "friday")?.status, "published");
  assert.equal(week.grades.length, week.calls.length * 2);
  const holiday = data.cohorts.find((cohort) => cohort.slug === "2026-09-07" && cohort.dataset === "live");
  assert.ok(holiday);
  assert.equal(holiday.readouts.find((item) => item.kind === "monday")?.status, "scheduled");
  assert.equal(holiday.grades.filter((grade) => grade.readout === "monday").length, 0);
});
