import assert from "node:assert/strict";
import test from "node:test";
import { ACCOUNTS } from "./demo-data";
import { TRACKING_EMPTY, WATCHLIST, loadWatchlist, profileUrl, trackedRoster } from "./watchlist";

const HANDLES = [
  "AndrewHiesinger",
  "unusual_whales",
  "jasongoepfert",
  "TraderJonesy",
  "OddStats",
  "TradableAstro",
  "clintoptions",
  "kholov23",
  "CheddarFlow",
  "SPY_TRaDeZ",
  "jbdridgebacks",
  "BullishBritt",
  "SeanHasOptions",
  "realalexvieira",
];

test("the watchlist is fourteen listed handles, each with a plain x.com link", () => {
  assert.equal(TRACKING_EMPTY, "Tracking — no graded calls yet");
  assert.equal(HANDLES.includes("mrMoCapital"), false);
  assert.deepEqual(
    WATCHLIST.map((account) => account.handle),
    HANDLES,
  );
  assert.deepEqual(
    WATCHLIST.map((account) => account.profileUrl),
    HANDLES.map((handle) => `https://x.com/${handle}`),
  );
  assert.equal(profileUrl("unusual_whales"), "https://x.com/unusual_whales");
  assert.equal(profileUrl("mrMoCapital"), "");
  assert.equal(
    trackedRoster().some((account) => account.handle.toLowerCase() === "mrmocapital"),
    false,
  );
  for (const account of WATCHLIST) {
    assert.equal("verified_on" in account, false);
    assert.equal(account.profileUrl.startsWith("https://x.com/"), true);
  }
});

test("watchlist handles are not demo accounts and carry no calls", () => {
  const demo = new Set(ACCOUNTS.map((account) => account.handle.toLowerCase()));
  for (const account of WATCHLIST) {
    assert.equal(demo.has(account.handle.toLowerCase()), false);
    assert.equal("calls" in account, false);
  }
  assert.throws(() => loadWatchlist({ version: 1, accounts: [{ handle: "bad handle" }] }));
});

test("writers who are not on the watchlist keep their source URL and never get an x.com profile", () => {
  const piggos = "https://piggostradingdesk.substack.com/p/tomorrows-market-picks-september-905";
  const pulse = "https://smtraderca.substack.com/p/weekly-market-review-9192026";
  const roster = trackedRoster([
    { handle: "piggostradingdesk", sourceUrl: piggos },
    { handle: "smtraderca", sourceUrl: pulse },
    "not_on_x",
  ]);
  const byHandle = new Map(roster.map((account) => [account.handle, account.profileUrl]));
  assert.equal(byHandle.get("piggostradingdesk"), piggos);
  assert.equal(byHandle.get("smtraderca"), pulse);
  assert.equal(byHandle.get("not_on_x"), "");
  assert.equal(byHandle.get("unusual_whales"), "https://x.com/unusual_whales");
  assert.equal(profileUrl("piggostradingdesk"), "");
  assert.equal(profileUrl("smtraderca"), "");
  assert.equal(roster.filter((account) => account.profileUrl.includes("x.com/piggostradingdesk")).length, 0);
  assert.equal(roster.filter((account) => account.profileUrl.includes("x.com/smtraderca")).length, 0);
});
