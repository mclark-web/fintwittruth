import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { buildCohortWindow, parseCalendarDay } from "./calendar";
import { emptyWeeksFromSlugs, futureWeekFromSlugs, newestRealWeekSlug, parseCheckedWeeks } from "./empty-weeks";
import { GRADED_PRINT_LIST, OCT19_X_SCOPE, emptyWeekSearchLine } from "./search-scope";

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

test("an empty week names each source and how far back it reached", () => {
  const before = emptyWeekSearchLine(buildCohortWindow(parseCalendarDay("2026-10-12")));
  assert.match(before, /^Searched Substack from /);
  assert.match(before, /X was not searched\./);
  assert.doesNotMatch(before, /X was searched/);
  for (const name of ["SPX", "NDX", "ES", "NQ", "the S&P 500", "the Nasdaq 100", "the Dow"]) {
    assert.ok(before.includes(name), name);
  }
  assert.ok(before.includes(GRADED_PRINT_LIST));
  assert.match(before, /This is not a 0% grade\.$/);

  const overlap = emptyWeekSearchLine(buildCohortWindow(parseCalendarDay("2026-10-19")));
  assert.match(overlap, /Searched Substack from /);
  assert.match(overlap, /X was searched only from Friday, October 16 at 10:22 AM ET through /);
  assert.ok(overlap.includes(GRADED_PRINT_LIST));

  const later = emptyWeekSearchLine(buildCohortWindow(parseCalendarDay("2026-11-02")));
  assert.match(later, /Searched Substack from (.+) through (.+)\. X was searched from \1 through \2\./);
  assert.ok(later.includes(GRADED_PRINT_LIST));
  assert.equal(before.endsWith(overlap.slice(overlap.indexOf("No post read"))), true);
});

test("empty-week pages share one search line, and a future week revalidates", () => {
  const root = join(process.cwd(), "src");
  const week = readFileSync(join(root, "app/weeks/[slug]/page.tsx"), "utf8");
  const index = readFileSync(join(root, "app/weeks/page.tsx"), "utf8");
  const methodology = readFileSync(join(root, "app/methodology/page.tsx"), "utf8");
  const readme = readFileSync(join(process.cwd(), "README.md"), "utf8");
  const csv = readFileSync(join(process.cwd(), "data/calls/calls.csv"), "utf8");
  const home = readFileSync(join(root, "app/page.tsx"), "utf8");
  const css = readFileSync(join(root, "app/globals.css"), "utf8");
  assert.match(week, /No qualifying calls this week/);
  assert.match(week, /emptyWeekSearchLine\(empty\.window\)/);
  assert.match(week, /\{OCT19_X_SCOPE\}/);
  assert.match(week, /export const revalidate = 60/);
  assert.match(week, /This week has not closed yet/);
  assert.match(week, /\[text-wrap:balance\]/);
  assert.doesNotMatch(week, /EXIT LIQUIDITY/);
  assert.doesNotMatch(week, /so this week has no grade/);
  assert.match(index, /No qualifying calls/);
  assert.match(index, /emptyWeekSearchLine\(row\.week\.window\)/);
  assert.match(index, /export const revalidate = 60/);
  assert.match(index, /This week has not closed yet/);
  assert.match(index, /\[text-wrap:balance\]/);
  assert.doesNotMatch(index, /so this week has no grade/);
  assert.match(methodology, /\{OCT19_X_SCOPE\}/);
  assert.match(methodology, /\{GRADED_PRINT_LIST\}/);
  assert.ok(readme.includes(OCT19_X_SCOPE));
  assert.ok(csv.includes(OCT19_X_SCOPE));
  assert.match(home, /latest collect window that has closed|No qualifying calls in the week/);
  assert.match(css, /h1,\s*\n\s*h2,\s*\n\s*h3 \{\s*\n\s*text-wrap: balance;/);
});
