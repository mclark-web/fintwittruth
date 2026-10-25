import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { buildCohortWindow, parseCalendarDay } from "./calendar";
import {
  checkedWeekRows,
  closedPendingFromSlugs,
  emptyWeeksFromSlugs,
  futureWeekFromSlugs,
  resolveWeekSlug,
  newestRealWeekSlug,
  parseCheckedWeekRows,
  parseCheckedWeeks,
  resolveLiveWeek,
} from "./empty-weeks";
import { formatScopeWhen } from "./format";
import { GRADED_PRINT_LIST, OCT19_X_SCOPE, X_SEARCH_START, emptyWeekHeading, emptyWeekSearchLine, methodologySourceLead } from "./search-scope";

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
  const covered = "week,note,coverage\n2026-10-26,No qualifying calls,substack\n2026-11-02,Searched both,substack+x\n";
  assert.deepEqual(parseCheckedWeekRows(covered), [
    { slug: "2026-10-26", note: "No qualifying calls", coverage: "substack" },
    { slug: "2026-11-02", note: "Searched both", coverage: "substack+x" },
  ]);
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
  const rolled = futureWeekFromSlugs(["2026-10-19"], [], new Date("2026-10-26T16:00:00Z"));
  assert.equal(rolled?.slug, "2026-11-02");
  assert.equal(resolveWeekSlug("2026-11-02", ["2026-10-19"], [], new Date("2026-11-01T21:59:00Z")).status, 200);
});

test("a closed week with no calls and no checked-empty row is not graded yet", () => {
  assert.deepEqual(closedPendingFromSlugs(["2026-10-19"], [], new Date("2026-10-19T20:00:00Z")), []);
  assert.deepEqual(
    closedPendingFromSlugs(["2026-10-19"], [], new Date("2026-10-26T16:00:00Z")).map((week) => week.slug),
    ["2026-10-26"],
  );
  assert.deepEqual(
    closedPendingFromSlugs(["2026-10-19"], [], new Date("2026-11-03T16:00:00Z")).map((week) => week.slug),
    ["2026-10-26", "2026-11-02"],
  );
  assert.deepEqual(
    closedPendingFromSlugs(["2026-10-19"], ["2026-10-26"], new Date("2026-11-03T16:00:00Z")).map((week) => week.slug),
    ["2026-11-02"],
  );
});

test("an empty week names recorded coverage and does not assume X for a later week", () => {
  const beforeWindow = buildCohortWindow(parseCalendarDay("2026-10-12"));
  const recorded = checkedWeekRows();
  const oct12 = recorded.find((row) => row.slug === "2026-10-12");
  assert.equal(oct12?.coverage, "substack+x");
  const before = emptyWeekSearchLine(beforeWindow, oct12?.coverage ?? "");
  assert.equal(formatScopeWhen(X_SEARCH_START), "Friday, October 16 at 10:22\u00a0AM\u00a0ET");
  assert.equal(formatScopeWhen(beforeWindow.collectEnd), "Sunday, October 11 at 5:00\u00a0PM\u00a0ET");
  assert.match(before, /^Searched Substack from Wednesday, October 7 at 12:00\u00a0PM\u00a0ET through Sunday, October 11 at 5:00\u00a0PM\u00a0ET\./);
  assert.match(before, /X was searched from Wednesday, October 7 at 12:00\u00a0PM\u00a0ET through Sunday, October 11 at 5:00\u00a0PM\u00a0ET\./);
  assert.doesNotMatch(before, /X was not searched|EDT|EST|Sun, Oct/);
  const substackOnly = emptyWeekSearchLine(beforeWindow, "substack");
  assert.match(substackOnly, /X was not searched\./);
  const assumed = emptyWeekSearchLine(beforeWindow);
  assert.match(assumed, /No search coverage is recorded for this week, so there is nothing to grade\. This is not a 0% grade\./);
  assert.doesNotMatch(assumed, /Searched Substack|X was not searched|No post read|were read/);
  for (const name of ["SPX", "NDX", "ES", "NQ", "the S&P 500", "the Nasdaq 100", "the Dow"]) {
    assert.ok(before.includes(name), name);
  }
  assert.ok(before.includes(GRADED_PRINT_LIST));
  assert.match(before, /This is not a 0% grade\.$/);

  const overlapWindow = buildCohortWindow(parseCalendarDay("2026-10-19"));
  const oct19 = recorded.find((row) => row.slug === "2026-10-19");
  assert.equal(oct19?.coverage, "substack+x-from-2026-10-16T14:22:00.000Z");
  const uncovered = emptyWeekSearchLine(overlapWindow);
  assert.match(uncovered, /No search coverage is recorded for this week/);
  assert.doesNotMatch(uncovered, /X was searched|No post read|were read|EDT|EST/);
  const overlap = emptyWeekSearchLine(overlapWindow, oct19?.coverage ?? "");
  assert.match(
    overlap,
    /X was searched only from Friday, October 16 at 10:22\u00a0AM\u00a0ET through Sunday, October 18 at 5:00\u00a0PM\u00a0ET\./,
  );
  assert.doesNotMatch(overlap, /EDT|EST|Sun, Oct/);
  assert.ok(overlap.includes(GRADED_PRINT_LIST));
  assert.ok(OCT19_X_SCOPE.includes("Friday, October 16 at 10:22 AM ET"));
  assert.ok(OCT19_X_SCOPE.includes("Sunday, October 18 at 5:00 PM ET"));
  assert.doesNotMatch(OCT19_X_SCOPE, /EDT|EST|Sun, Oct/);

  const laterWindow = buildCohortWindow(parseCalendarDay("2026-11-02"));
  const later = emptyWeekSearchLine(laterWindow);
  assert.match(later, /No search coverage is recorded for this week/);
  assert.doesNotMatch(later, /X was searched|No post read|were read/);
  const start = formatScopeWhen(laterWindow.collectStart);
  const end = formatScopeWhen(laterWindow.collectEnd);
  const covered = emptyWeekSearchLine(laterWindow, "substack+x");
  assert.ok(covered.includes(`Searched Substack from ${start} through ${end}. X was searched from ${start} through ${end}.`));
  assert.doesNotMatch(covered, /EDT|EST/);
});

test("the open week steps to the first Monday after the last recorded week", () => {
  const beforeClose = new Date("2026-10-25T20:57:00.000Z");
  assert.equal(formatScopeWhen(beforeClose), "Sunday, October 25 at 4:57\u00a0PM\u00a0ET");
  assert.equal(resolveLiveWeek("2026-10-26", beforeClose).status, 404);
  const stillOpen = resolveLiveWeek("2026-11-02", beforeClose);
  assert.equal(stillOpen.status, 200);
  if (stillOpen.status === 200) assert.equal(stillOpen.kind, "future");
  assert.equal(resolveLiveWeek("2026-11-09", beforeClose).status, 404);

  const justClosed = new Date("2026-10-25T21:01:00.000Z");
  assert.equal(formatScopeWhen(justClosed), "Sunday, October 25 at 5:01\u00a0PM\u00a0ET");
  assert.equal(resolveLiveWeek("2026-10-26", justClosed).status, 404);
  const rolled = resolveLiveWeek("2026-11-02", justClosed);
  assert.equal(rolled.status, 200);
  if (rolled.status === 200) assert.equal(rolled.kind, "future");
  assert.equal(resolveLiveWeek("2026-11-09", justClosed).status, 404);
});

test("at Sunday November 1 5:01 PM ET, /weeks/2026-11-02 returns 200 in the closed state", () => {
  const now = new Date("2026-11-01T22:01:00.000Z");
  assert.equal(formatScopeWhen(now), "Sunday, November 1 at 5:01\u00a0PM\u00a0ET");
  const page = resolveLiveWeek("2026-11-02", now);
  assert.equal(page.status, 200);
  if (page.status !== 200) return;
  assert.equal(page.kind, "closed");
  assert.equal(page.week.slug, "2026-11-02");
  assert.equal(resolveLiveWeek("2026-11-03", now).status, 404);
  assert.equal(resolveLiveWeek("not-a-week", now).status, 404);
  const nextOpen = resolveLiveWeek("2026-11-09", now);
  assert.equal(nextOpen.status, 200);
  if (nextOpen.status === 200) assert.equal(nextOpen.kind, "future");
  assert.equal(resolveLiveWeek("2026-11-16", now).status, 404);
});

test("empty-week pages share one search line, and a future week revalidates", () => {
  const root = join(process.cwd(), "src");
  const week = readFileSync(join(root, "app/weeks/[slug]/page.tsx"), "utf8");
  const index = readFileSync(join(root, "app/weeks/page.tsx"), "utf8");
  const methodology = readFileSync(join(root, "app/methodology/page.tsx"), "utf8");
  const sitemap = readFileSync(join(root, "app/sitemap.ts"), "utf8");
  const readme = readFileSync(join(process.cwd(), "README.md"), "utf8");
  const csv = readFileSync(join(process.cwd(), "data/calls/calls.csv"), "utf8");
  const home = readFileSync(join(root, "app/page.tsx"), "utf8");
  const css = readFileSync(join(root, "app/globals.css"), "utf8");
  assert.match(week, /\{emptyWeekHeading\(resolved\.week\.coverage\)\} this week/);
  assert.match(week, /emptyWeekSearchLine\(resolved\.week\.window, resolved\.week\.coverage\)/);
  assert.match(week, /Closed, not graded yet/);
  assert.match(week, /export const dynamicParams = true/);
  assert.doesNotMatch(week, /formatWhen/);
  assert.match(week, /\{OCT19_X_SCOPE\}/);
  assert.match(week, /export const revalidate = 60/);
  assert.match(week, /This week has not closed yet/);
  assert.match(week, /\[text-wrap:balance\]/);
  assert.doesNotMatch(week, /EXIT LIQUIDITY/);
  assert.doesNotMatch(week, /so this week has no grade/);
  assert.match(index, /emptyWeekHeading\(row\.week\.coverage\)/);
  assert.match(index, /emptyWeekSearchLine\(row\.week\.window, row\.week\.coverage\)/);
  assert.match(index, /Closed, not graded yet/);
  assert.doesNotMatch(index, /formatWhen|EDT/);
  assert.match(index, /export const revalidate = 60/);
  assert.match(index, /This week has not closed yet/);
  assert.match(index, /\[text-wrap:balance\]/);
  assert.doesNotMatch(index, /so this week has no grade/);
  assert.match(methodology, /\{methodologySourceLead\(checkedWeekRows\(\)\)\} \{OCT19_X_SCOPE\}/);
  const lead = methodologySourceLead(checkedWeekRows());
  assert.equal(
    lead,
    "For the week of October 19, 2026, Substack covers the whole Wednesday noon to Sunday 5:00 PM ET window.",
  );
  assert.equal(lead.split("For the week of October 19").length - 1, 1);
  assert.match(methodology, /\{GRADED_PRINT_LIST\}/);
  assert.match(methodology, /later checkpoint is graded on/i);
  assert.match(methodology, /never graded stays pending/i);
  assert.match(methodology, /latest settled checkpoint/);
  assert.match(sitemap, /export const revalidate = 60/);
  assert.doesNotMatch(sitemap, /futureLiveWeek/);
  assert.ok(readme.includes(OCT19_X_SCOPE));
  assert.ok(csv.includes(OCT19_X_SCOPE));
  assert.match(home, /has not closed/);
  assert.match(home, /5:00 PM ET/);
  assert.match(home, /weekendLead/);
  assert.match(home, /latest collect window that has closed|No qualifying calls in the/);
  assert.match(css, /h1,\s*\n\s*h2,\s*\n\s*h3 \{\s*\n\s*text-wrap: balance;/);
});

test("an empty week's heading names a search result only when coverage is recorded", () => {
  assert.equal(emptyWeekHeading(""), "No search on record");
  assert.equal(emptyWeekHeading("substack"), "No qualifying calls");
  assert.equal(emptyWeekHeading("substack+x-from-2026-10-16T14:22:00.000Z"), "No qualifying calls");
  assert.equal(emptyWeekHeading("x"), "No qualifying calls");
});
