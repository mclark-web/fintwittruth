import assert from "node:assert/strict";
import test from "node:test";
import { zonedToUtc } from "./calendar";
import { FEATURED_COHORT_SLUG, LATEST_COHORT_SLUG } from "./demo-data";
import { buildDataset } from "./dataset";
import { CHUD_THRESHOLD, scoreToBadge } from "./scoring";

const data = buildDataset();

test("locked calendar for the latest readout week", () => {
  const latest = data.cohorts.find((cohort) => cohort.slug === LATEST_COHORT_SLUG);
  assert.ok(latest);
  assert.equal(latest.collectStart.toISOString(), zonedToUtc(2026, 9, 16, 12, 0).toISOString());
  assert.equal(latest.collectEnd.toISOString(), zonedToUtc(2026, 9, 20, 17, 0).toISOString());
  assert.equal(latest.mondayAt.toISOString(), zonedToUtc(2026, 9, 21, 12, 0).toISOString());
  assert.equal(latest.wednesdayAt.toISOString(), zonedToUtc(2026, 9, 23, 12, 0).toISOString());
  assert.equal(latest.fridayAt.toISOString(), zonedToUtc(2026, 9, 25, 12, 0).toISOString());
});

test("one cohort ages across Monday, Wednesday, and Friday", () => {
  const historical = data.cohorts.filter((cohort) => !cohort.isLatest);
  assert.equal(historical.length, 4);
  for (const cohort of historical) {
    for (const kind of ["monday", "wednesday", "friday"] as const) {
      const readout = cohort.readouts.find((item) => item.kind === kind);
      assert.equal(readout?.status, "published");
      const grades = cohort.grades.filter((grade) => grade.readout === kind);
      assert.equal(grades.length, cohort.calls.length);
      assert.deepEqual(
        grades.map((grade) => grade.callId).sort(),
        cohort.calls.map((call) => call.id).sort(),
      );
    }
  }
});

test("latest cohort publishes Monday and leaves Wednesday and Friday scheduled", () => {
  const latest = data.cohorts.find((cohort) => cohort.isLatest);
  assert.ok(latest);
  assert.equal(latest.slug, LATEST_COHORT_SLUG);
  assert.equal(latest.readouts.find((item) => item.kind === "monday")?.status, "published");
  assert.equal(latest.readouts.find((item) => item.kind === "wednesday")?.status, "scheduled");
  assert.equal(latest.readouts.find((item) => item.kind === "friday")?.status, "scheduled");
  assert.equal(latest.grades.length, latest.calls.length);
  assert.ok(latest.grades.every((grade) => grade.readout === "monday"));
});

test("every demo post sits inside the Wednesday-to-Sunday collect window", () => {
  for (const cohort of data.cohorts) {
    for (const call of cohort.calls) {
      assert.ok(call.postedAt >= cohort.collectStart);
      assert.ok(call.postedAt <= cohort.collectEnd);
    }
  }
});

test("scores stay on 0-100 with a 1-10 badge, Chad cut, and Chud line", () => {
  for (const cohort of data.cohorts) {
    for (const kind of ["monday", "wednesday", "friday"] as const) {
      const grades = cohort.grades.filter((grade) => grade.readout === kind);
      if (grades.length === 0) continue;
      for (const grade of grades) {
        assert.ok(grade.score >= 0 && grade.score <= 100);
        assert.equal(grade.badge, scoreToBadge(grade.score));
        assert.ok(grade.badge >= 1 && grade.badge <= 10);
        assert.equal(grade.isChudTerritory, grade.score < CHUD_THRESHOLD);
      }
      const chads = grades.filter((grade) => grade.isChad);
      const slots = Math.ceil(grades.length * 0.3);
      assert.ok(chads.length >= slots);
      const cutoff = Math.min(...chads.map((grade) => grade.score));
      assert.ok(grades.filter((grade) => !grade.isChad).every((grade) => grade.score < cutoff));
    }
  }
});

test("gap-and-fade bulls lead Monday and fade by Friday", () => {
  const week = data.cohorts.find((cohort) => cohort.slug === FEATURED_COHORT_SLUG);
  assert.ok(week);
  const grade = (handle: string, readout: "monday" | "friday") =>
    week.grades.find((item) => item.callId.endsWith(`__${handle}`) && item.readout === readout);
  const pumpMon = grade("permapump", "monday");
  const pumpFri = grade("permapump", "friday");
  const doomMon = grade("doomscroll", "monday");
  const doomFri = grade("doomscroll", "friday");
  assert.ok(pumpMon && pumpFri && doomMon && doomFri);
  assert.ok(pumpMon.score > pumpFri.score);
  assert.ok(doomFri.score > doomMon.score);
  assert.equal(pumpMon.isChad, true);
  assert.equal(pumpMon.isChudTerritory, false);
  assert.equal(pumpFri.isChudTerritory, true);
  assert.equal(doomMon.isChudTerritory, true);
  assert.equal(doomFri.isChudTerritory, false);
  assert.equal(doomFri.isChad, true);
});
