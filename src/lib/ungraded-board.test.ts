import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PendingSettleLink } from "../components/board-state";
import { TimeframePills } from "../components/call-readouts";
import { NoiseIndex, ReadoutCards } from "../components/market";
import { zonedToUtc } from "./calendar";
import {
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
  assert.match(holiday, /text-sm text-\[#9a9aa3\]">Market closed \(Labor Day\) · no Monday prices</);
  assert.doesNotMatch(holiday, /until the session settles/);
  assert.doesNotMatch(holiday, /until the open prints settle/);

  const open = renderToStaticMarkup(
    createElement(NoiseIndex, {
      calls: [],
      quotes: [],
      mondayAt: zonedToUtc(2026, 9, 21, 12, 0),
    }),
  );
  assert.match(open, /prices are not on this board until they are graded/);
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
  assert.match(html, /Scheduled · same week/);
  assert.doesNotMatch(html, /Market closed/);
  const closure: PendingClosure = pendingClosure(["friday"], dates);
  assert.equal(closure.closed, 0);
  assert.equal(
    pendingHorizonsClause(1, closure),
    "1 horizon is off this board until the prices are in.",
  );
  assert.equal(
    readoutCallsHeading({ settled: false, count: 0, label: "Fri close", holidayName: null }),
    "Fri close waiting",
  );
  assert.equal(closedHorizonNote(false), "A horizon on this week is still off the board.");
});

test("Friday September 25 uses the official close", { skip: skipWithoutDb }, async () => {
  const { default: FridayPage } = await import("../app/weeks/[slug]/[readout]/page");
  const html = renderToStaticMarkup(
    await FridayPage({ params: Promise.resolve({ slug: "2026-09-21", readout: "friday" }) }),
  );
  assert.ok(html.indexOf("<h1") !== -1 && html.indexOf("<h1") < html.indexOf("<h2"));
  assert.match(html, /What the market did/);
  assert.match(html, /771\.35/);
  assert.doesNotMatch(html, /had not reached the 45-minute post-close buffer/);
  assert.doesNotMatch(html, /Waiting on the clock/);
  assert.doesNotMatch(html, /aria-label="GC Scale, not graded yet"/);
  assert.doesNotMatch(html, /aria-label="0% GC Scale, EXIT LIQUIDITY"/);
});

test("the pending counter uses Not graded yet", { skip: skipWithoutDb }, async () => {
  const { default: PendingPage } = await import("../app/pending/page");
  const html = renderToStaticMarkup(await PendingPage());
  assert.match(html, /2026-10-26\/pending/);
  assert.doesNotMatch(html, /2026-10-19\/pending/);
  assert.match(html, /Not graded yet/);
  assert.doesNotMatch(html, /Pending approval/);
  assert.doesNotMatch(html, /ambiguous=true/);
  assert.doesNotMatch(html, /Nothing is waiting/);
  assert.doesNotMatch(html, /aria-label="0% GC Scale, EXIT LIQUIDITY"/);
  assert.doesNotMatch(html, /NOT GRADED/);
  assert.doesNotMatch(html, />\s*\d+ not graded\s*</);
});

test("timeframe pills keep one order and paint cold scores dim grey", () => {
  const html = renderToStaticMarkup(
    createElement(TimeframePills, {
      grades: {
        monday: { score: 80 },
        wednesday: { score: 20 },
        friday: null,
      },
    }),
  );
  const noon = html.indexOf("Mon noon");
  const wednesday = html.indexOf("Wed close");
  const friday = html.indexOf("Fri close");
  assert.ok(noon >= 0 && noon < wednesday && wednesday < friday);
  assert.match(html, /tf-strong/);
  assert.match(html, /tf-weak/);
  assert.match(html, /tf-open/);
  assert.match(html, /Not graded yet/);
  assert.doesNotMatch(html, /EXIT LIQUIDITY/);
  const zero = renderToStaticMarkup(createElement(TimeframePills, { grades: { monday: { score: 0 } } }));
  assert.match(zero, /tf-exit/);
  assert.match(zero, /<span class="tf-v"><span class="tf-glyph" aria-hidden="true">▼<\/span>0%<\/span>/);
  assert.match(zero, /aria-label="GC Scale, Mon noon: 0% EXIT LIQUIDITY"/);
  assert.match(zero, /<p class="tf-key">0% = EXIT LIQUIDITY<\/p>/);
  assert.match(zero, /tf-bar/);
  assert.match(html, /▲<\/span>80%/);
  assert.match(html, /▼<\/span>20%/);
  assert.doesNotMatch(html, /tf-key/);
  assert.match(zero, /Wed close/);
  assert.match(zero, /Fri close/);
});

test("production does not serve the fictional Labor Day cohort", { skip: skipWithoutDb }, async () => {
  const { getCohort } = await import("./queries");
  const cohort = await getCohort("2026-09-07");
  assert.ok(cohort);
  assert.equal(
    cohort.calls.some((call) => call.handle === "doomscroll"),
    false,
  );
  assert.equal(
    cohort.calls.every((call) => !call.body.includes("WWIII")),
    true,
  );
  assert.equal(
    cohort.calls.some((call) => call.handle === "TraderJonesy" && call.primary === "SPY"),
    true,
  );
});
