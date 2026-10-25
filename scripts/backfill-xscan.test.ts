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
  "2026-08-10": 2,
  "2026-08-24": 0,
  "2026-09-07": 1,
  "2026-09-14": 1,
  "2026-09-21": 1,
  "2026-09-28": 1,
  "2026-10-05": 1,
  "2026-10-12": 1,
  "2026-10-19": 2,
  "2026-10-26": 0,
};

const GRADED_CHECKPOINTS: Record<string, number> = {
  "2026-08-10": 4,
  "2026-08-24": 0,
  "2026-09-07": 2,
  "2026-09-14": 3,
  "2026-09-21": 3,
  "2026-09-28": 3,
  "2026-10-05": 3,
  "2026-10-12": 3,
  "2026-10-19": 6,
  "2026-10-26": 0,
};

test("the July 27 backfill stays append-only and keeps ambiguous rows off the book", () => {
  const plan = planBackfill(scan, rows, NOW);
  assert.equal(plan.counts.scanRows, 371);
  assert.equal(plan.counts.clearRows, 240);
  assert.equal(plan.counts.ambiguousRows, 131);
  assert.equal(plan.counts.calls, 0);
  assert.equal(plan.counts.deduped, 13);
  assert.equal(plan.counts.outsideWindow, 121);
  assert.equal(plan.counts.recaps, 0);
  assert.equal(plan.counts.unnamed, 40);
  assert.equal(plan.counts.notGradeable, 66);
  assert.ok(plan.pending.every((row) => row.reason.includes("Not graded")));
  assert.equal(plan.pending.filter((row) => row.reason.includes("ambiguous=true")).length, 131);

  const published = new Set(rows.map((row) => `${row.source_url}\n${row.tickers}\n${row.direction}`));
  for (const row of plan.pending.filter((item) => item.reason.startsWith("ambiguous=true"))) {
    assert.equal(published.has(`${row.post_url}\n${row.ticker}\n${row.direction}`), false);
  }
  const pending = parsePendingApproval(readFileSync("data/calls/pending-approval.csv", "utf8"));
  assert.equal(pending.some((row) => row.handle === "piggostradingdesk"), false);
  assert.equal(pending.some((row) => row.reason.includes("names no ticker")), false);
  const queued = new Set(pending.map((row) => `${row.postUrl}\n${row.ticker}\n${row.direction}`));
  for (const row of plan.pending) {
    assert.equal(queued.has(`${row.post_url}\n${row.ticker}\n${row.direction}`), true);
  }
});

test("clear backfill rows are graded at the recorded checkpoints", () => {
  const backfill = rows.filter((row) => row.notes.startsWith("backfill-ticker="));
  assert.equal(backfill.length, 13);
  assert.equal(backfill.filter((row) => CHECKPOINTS.some((kind) => row[`${kind}_status`] === "GRADED")).length, 8);
  assert.equal(rows.length, 40);

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
  assert.equal(accounts.size, 5);
  assert.equal(accounts.has("piggostradingdesk"), false);

  const august = rows.filter((row) => row.cohort_slug === "2026-08-10");
  assert.equal(august.length, 2);
  for (const row of august) {
    assert.equal(row.monday_status, "PENDING");
    assert.equal(row.monday_score, "");
    assert.equal(row.wednesday_status, "GRADED");
    assert.equal(row.friday_status, "GRADED");
    assert.equal(row.grade_method, "auto-yahoo");
    assert.equal(Number(row.wednesday_price), sessionClose(row.primary, row.wednesday_date));
    assert.equal(Number(row.friday_price), sessionClose(row.primary, row.friday_date));
  }

  const labor = rows.find((row) => row.cohort_slug === "2026-09-07" && row.notes.startsWith("backfill-ticker="));
  assert.ok(labor);
  assert.equal(labor.monday_status, "CLOSED");
  assert.equal(labor.monday_score, "");
  assert.equal(labor.wednesday_status, "GRADED");
  assert.equal(labor.friday_status, "GRADED");

  for (const row of rows.filter((item) => item.cohort_slug === "2026-10-19")) {
    if (row.handle === "piggostradingdesk") {
      assert.equal(row.flags, "no-ticker");
      for (const kind of CHECKPOINTS) {
        assert.equal(row[`${kind}_status`], "PENDING");
        assert.equal(row[`${kind}_score`], "");
        assert.equal(row[`${kind}_text`], "");
      }
      assert.equal(row.grade_method, "");
      assert.match(row.notes, /exclusion=no-ticker/);
      assert.match(row.notes, /not shown/);
      continue;
    }
    assert.equal(row.monday_status, "GRADED");
    assert.equal(row.wednesday_status, "GRADED");
    assert.equal(row.friday_status, "GRADED");
    assert.equal(Number(row.friday_price), sessionClose(row.primary, row.friday_date));
    assert.equal(row.friday_grade, "WEAK");
    if (row.primary === "QQQ") assert.equal(row.friday_score, "21");
    if (row.handle === "BreadWinneh") {
      assert.equal(row.friday_score, "21");
      assert.equal(row.friday_grade, "WEAK");
      assert.equal(row.friday_text, "QQQ ($704.40) −0.8%");
    }
    if (row.handle === "TraderJonesy") {
      assert.equal(row.friday_score, "24");
      assert.equal(row.friday_stance, "against");
      assert.equal(row.friday_text, "SPY ($759.97) −0.4%");
      assert.equal(row.monday_text, "SPY ($769.07) +0.8%");
      assert.equal(row.monday_score, "58");
      assert.match(row.notes, /769\.0723876953125/);
      assert.doesNotMatch(row.notes, /5-minute open has not been revised/);
    }
  }
  for (const row of backfill.filter((item) => item.cohort_slug === "2026-10-26")) {
    for (const kind of CHECKPOINTS) assert.equal(row[`${kind}_status`], "PENDING");
  }

  const data = buildDataset();
  const week = data.cohorts.find((cohort) => cohort.slug === "2026-08-10" && cohort.dataset === "live");
  assert.ok(week);
  assert.equal(week.readouts.find((item) => item.kind === "monday")?.status, "scheduled");
  assert.equal(week.readouts.find((item) => item.kind === "wednesday")?.status, "published");
  assert.equal(week.readouts.find((item) => item.kind === "friday")?.status, "published");
  assert.equal(week.grades.length, week.calls.length * 2);
  assert.equal(data.cohorts.some((cohort) => cohort.slug === "2026-08-03" && cohort.dataset === "live"), false);
  const oct19 = data.cohorts.find((cohort) => cohort.slug === "2026-10-19" && cohort.dataset === "live");
  assert.ok(oct19);
  const bread = oct19.calls.find((call) => call.handle === "BreadWinneh");
  assert.ok(bread);
  const breadFriday = oct19.grades.find((grade) => grade.callId === bread.id && grade.readout === "friday");
  assert.equal(breadFriday?.score, 21);
  const holiday = data.cohorts.find((cohort) => cohort.slug === "2026-09-07" && cohort.dataset === "live");
  assert.ok(holiday);
  assert.equal(holiday.readouts.find((item) => item.kind === "monday")?.status, "scheduled");
  assert.equal(holiday.grades.filter((grade) => grade.readout === "monday").length, 0);
});
