import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { emptyWeeksFromSlugs, futureWeekFromSlugs, newestRealWeekSlug, parseCheckedWeeks } from "./empty-weeks";

test("empty weeks come from the collect calendar and skip weeks that have calls", () => {
  const now = new Date("2026-10-20T16:00:00Z");
  const gaps = emptyWeeksFromSlugs(["2026-09-21", "2026-10-19"], [], now).map((week) => week.slug);
  assert.deepEqual(gaps, ["2026-09-28", "2026-10-05", "2026-10-12"]);

  const filled = emptyWeeksFromSlugs(
    ["2026-09-21", "2026-09-28", "2026-10-05", "2026-10-12", "2026-10-19"],
    [],
    now,
  );
  assert.deepEqual(filled, []);
});

test("a checked empty week counts for freshness and stays off the list once it has calls", () => {
  const text = "week,note\n2026-10-26,No qualifying calls\n";
  assert.deepEqual(parseCheckedWeeks(text), ["2026-10-26"]);
  assert.equal(newestRealWeekSlug(["2026-10-19"], ["2026-10-26"]), "2026-10-26");
  assert.equal(newestRealWeekSlug(["2026-10-19"], []), "2026-10-19");

  const open = emptyWeeksFromSlugs(["2026-10-19"], ["2026-10-26"], new Date("2026-10-19T20:00:00Z"));
  assert.deepEqual(open, []);

  const closed = emptyWeeksFromSlugs(["2026-10-19"], ["2026-10-26"], new Date("2026-11-03T16:00:00Z"));
  assert.deepEqual(
    closed.map((week) => week.slug),
    ["2026-10-26"],
  );
  const laterCall = emptyWeeksFromSlugs(["2026-10-19", "2026-10-26"], ["2026-10-26"], new Date("2026-11-03T16:00:00Z"));
  assert.deepEqual(laterCall, []);
});

test("the next Monday is a future week only while its collect window is open", () => {
  const open = futureWeekFromSlugs(["2026-10-19"], [], new Date("2026-10-19T20:00:00Z"));
  assert.equal(open?.slug, "2026-10-26");
  const closed = futureWeekFromSlugs(["2026-10-19"], [], new Date("2026-10-26T16:00:00Z"));
  assert.equal(closed, null);
});

test("empty-week pages say what was searched, and a future week is not a 404", () => {
  const root = join(process.cwd(), "src");
  const week = readFileSync(join(root, "app/weeks/[slug]/page.tsx"), "utf8");
  const index = readFileSync(join(root, "app/weeks/page.tsx"), "utf8");
  const home = readFileSync(join(root, "app/page.tsx"), "utf8");
  const css = readFileSync(join(root, "app/globals.css"), "utf8");
  assert.match(week, /No qualifying calls this week/);
  assert.match(week, /Searched /);
  assert.match(week, /This is not a 0% grade/);
  assert.match(week, /This week has not closed yet/);
  assert.match(week, /10:22 AM ET/);
  assert.match(week, /not searched/);
  assert.match(week, /\[text-wrap:balance\]/);
  assert.doesNotMatch(week, /EXIT LIQUIDITY/);
  assert.match(index, /No qualifying calls/);
  assert.match(index, /Searched /);
  assert.match(index, /This week has not closed yet/);
  assert.match(index, /\[text-wrap:balance\]/);
  assert.match(home, /latest collect window that has closed|No qualifying calls in the week/);
  assert.match(css, /h1,\s*\n\s*h2,\s*\n\s*h3 \{\s*\n\s*text-wrap: balance;/);
});
