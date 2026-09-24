import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PendingSettleLink } from "../components/board-state";
import { NoiseIndex, ReadoutCards } from "../components/market";
import { zonedToUtc } from "./calendar";
import {
  LABOR_DAY_UNGRADED_LINE,
  closedHorizonNote,
  marketClosedCard,
  pendingClosure,
  pendingHorizonsClause,
  readoutCallsHeading,
  type PendingClosure,
} from "./grades";
import type { ReadoutView } from "./queries";
import type { ReadoutKind } from "./scoring";

const dbReady = existsSync(path.join(process.cwd(), "prisma", "fintwittruth.db"));
const skipWithoutDb = dbReady ? false : "seeded demo database is missing; run npm run build";

const laborDay = {
  mondayAt: zonedToUtc(2026, 9, 7, 12, 0),
  wednesdayAt: zonedToUtc(2026, 9, 9, 16, 0),
  fridayAt: zonedToUtc(2026, 9, 11, 16, 0),
};

function readout(kind: ReadoutKind, status: "published" | "scheduled", at: Date): ReadoutView {
  return {
    kind,
    status,
    consensusBullish: 0.5,
    consensusBearish: 0.5,
    consensusDirection: "split",
    realizedDirection: status === "published" ? "flat" : "pending",
    benchmarkSymbol: "SPY+QQQ+DIA",
    benchmarkMovePct: 0,
    strongCutoff: status === "published" ? 70 : 0,
    narrative: "",
    at,
  };
}

function laborDayReadouts(): Record<ReadoutKind, ReadoutView> {
  return {
    "monday-gap": readout("monday-gap", "scheduled", zonedToUtc(2026, 9, 7, 9, 30)),
    monday: readout("monday", "scheduled", laborDay.mondayAt),
    wednesday: readout("wednesday", "published", laborDay.wednesdayAt),
    friday: readout("friday", "published", laborDay.fridayAt),
  };
}

test("a holiday readout never renders Scheduled or waiting", () => {
  const html = renderToStaticMarkup(
    createElement(ReadoutCards, { slug: "2026-09-07", readouts: laborDayReadouts(), active: "monday" }),
  );
  assert.match(html, /Market closed \(Labor Day\) · Not graded yet/);
  assert.match(html, /text-\[#9a9aa3\][^>]*>Market closed \(Labor Day\) · Not graded yet/);
  assert.doesNotMatch(html, /Scheduled/);
  assert.doesNotMatch(html, /waiting/i);
  assert.equal(marketClosedCard("Labor Day"), "Market closed (Labor Day) · Not graded yet");

  const closure = pendingClosure(["monday-gap", "monday"], laborDay);
  assert.deepEqual(closure, { closed: 2, upcoming: 0, name: "Labor Day" });
  const link = renderToStaticMarkup(
    createElement(PendingSettleLink, { href: "/weeks/2026-09-07/pending", waiting: 2, closure }),
  );
  assert.match(link, /2 horizons are not graded: the market was closed for Labor Day\./);
  assert.doesNotMatch(link, /until the tape prints/);
  assert.doesNotMatch(link, /Scheduled|waiting/i);

  assert.equal(
    readoutCallsHeading({ settled: false, count: 0, label: "Monday noon", holidayName: "Labor Day" }),
    "Market closed for Labor Day · not graded",
  );
  assert.equal(closedHorizonNote(true), "A horizon on this week is not graded: the market was closed.");
  assert.equal(html.includes("waiting"), false);
});

test("Labor Day Weekend Noise Index does not promise a Monday tape", () => {
  const holiday = renderToStaticMarkup(
    createElement(NoiseIndex, {
      calls: [],
      quotes: [],
      mondayAt: zonedToUtc(2026, 9, 7, 12, 0),
    }),
  );
  assert.match(holiday, /text-sm text-\[#9a9aa3\]">Market closed \(Labor Day\) · no Monday tape</);
  assert.doesNotMatch(holiday, /until the session settles/);
  assert.doesNotMatch(holiday, /until the open prints settle/);

  const open = renderToStaticMarkup(
    createElement(NoiseIndex, {
      calls: [],
      quotes: [],
      mondayAt: zonedToUtc(2026, 9, 21, 12, 0),
    }),
  );
  assert.match(open, /The Monday tape is off this board until the session settles/);
  assert.doesNotMatch(open, /Market closed/);
});

test("a future trading day still says Scheduled and until the tape prints", () => {
  const friday = zonedToUtc(2026, 9, 25, 16, 0);
  const dates = {
    mondayAt: zonedToUtc(2026, 9, 21, 12, 0),
    wednesdayAt: zonedToUtc(2026, 9, 23, 16, 0),
    fridayAt: friday,
  };
  const html = renderToStaticMarkup(
    createElement(ReadoutCards, {
      slug: "2026-09-21",
      readouts: {
        "monday-gap": readout("monday-gap", "published", zonedToUtc(2026, 9, 21, 9, 30)),
        monday: readout("monday", "published", dates.mondayAt),
        wednesday: readout("wednesday", "published", dates.wednesdayAt),
        friday: readout("friday", "scheduled", friday),
      },
    }),
  );
  assert.match(html, /Scheduled · same cohort/);
  assert.doesNotMatch(html, /Market closed/);
  const closure: PendingClosure = pendingClosure(["friday"], dates);
  assert.equal(closure.closed, 0);
  assert.equal(
    pendingHorizonsClause(1, closure),
    "1 horizon is off this board until the tape prints.",
  );
  assert.equal(
    readoutCallsHeading({ settled: false, count: 0, label: "Fri close", holidayName: null }),
    "Fri close waiting",
  );
  assert.equal(closedHorizonNote(false), "A horizon on this week is still off the board.");
});

test("an ungraded Friday board tube is not EXIT", { skip: skipWithoutDb }, async () => {
  const { default: FridayPage } = await import("../app/weeks/[slug]/[readout]/page");
  const html = renderToStaticMarkup(
    await FridayPage({ params: Promise.resolve({ slug: "2026-09-21", readout: "friday" }) }),
  );
  assert.match(html, /aria-label="GC Scale, not graded yet"/);
  assert.match(html, />Not graded yet</);
  assert.match(html, /<h2 class="text-sm font-semibold text-\[#9a9aa3\]">Not graded yet<\/h2>/);
  assert.match(html, /A horizon on this week is still off the board/);
  assert.match(html, /Scheduled · same cohort/);
  assert.doesNotMatch(html, /<h2 class="[^"]*text-ink[^"]*">Not graded yet<\/h2>/);
  assert.doesNotMatch(html, /aria-label="0% GC Scale, EXIT LIQUIDITY"/);
  assert.doesNotMatch(html, /data-grade="exit"/);
  assert.doesNotMatch(html, /gc-pct[^>]*>0%</);
});

test("Labor Day Monday board tube stays ungraded and does not promise a print", { skip: skipWithoutDb }, async () => {
  const { default: FridayPage } = await import("../app/weeks/[slug]/[readout]/page");
  const { default: CohortPendingPage } = await import("../app/weeks/[slug]/pending/page");
  const html = renderToStaticMarkup(
    await FridayPage({ params: Promise.resolve({ slug: "2026-09-07", readout: "monday" }) }),
  );
  assert.match(html, /aria-label="GC Scale, not graded yet"/);
  assert.match(html, /Not graded yet · market closed for Labor Day/);
  assert.equal(html.includes(LABOR_DAY_UNGRADED_LINE), true);
  assert.match(html, /Market closed \(Labor Day\) · Not graded yet/);
  assert.match(html, /text-2xl text-\[#9a9aa3\]">Market closed for Labor Day</);
  assert.match(html, /Market closed for Labor Day · not graded/);
  assert.match(html, /Market closed \(Labor Day\) · no Monday tape/);
  assert.doesNotMatch(html, /until the session settles/);
  assert.match(html, /2 horizons are not graded: the market was closed for Labor Day\./);
  assert.match(html, /A horizon on this week is not graded: the market was closed\./);
  assert.doesNotMatch(html, /off the board until 12:00 PM ET/);
  assert.doesNotMatch(html, /Scheduled/);
  assert.doesNotMatch(html, /waiting/i);
  assert.doesNotMatch(html, /aria-label="0% GC Scale, EXIT LIQUIDITY"/);

  const pending = renderToStaticMarkup(
    await CohortPendingPage({ params: Promise.resolve({ slug: "2026-09-07" }) }),
  );
  assert.equal(pending.includes(LABOR_DAY_UNGRADED_LINE), true);
  assert.doesNotMatch(pending, /off the board until (9:30 AM ET|12:00 PM ET)/);
  assert.doesNotMatch(pending, /Scheduled/);
  assert.doesNotMatch(pending, /waiting/i);
});
