import assert from "node:assert/strict";
import test from "node:test";
import { ACCOUNTS } from "./demo-data";
import { TRACKING_EMPTY, WATCHLIST, loadWatchlist, profileUrl } from "./watchlist";

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
  "mrMoCapital",
];

test("the watchlist is the fifteen public handles and links each one to x.com", () => {
  assert.equal(TRACKING_EMPTY, "Tracking — no graded calls yet");
  assert.deepEqual(
    WATCHLIST.map((account) => account.handle),
    HANDLES,
  );
  assert.deepEqual(
    WATCHLIST.map((account) => account.profileUrl),
    HANDLES.map((handle) => `https://x.com/${handle}`),
  );
  assert.equal(profileUrl("unusual_whales"), "https://x.com/unusual_whales");
});

test("watchlist handles are not demo accounts and carry no calls", () => {
  const demo = new Set(ACCOUNTS.map((account) => account.handle.toLowerCase()));
  for (const account of WATCHLIST) {
    assert.equal(demo.has(account.handle.toLowerCase()), false);
    assert.equal("calls" in account, false);
  }
  assert.throws(() => loadWatchlist({ version: 1, accounts: [{ handle: "bad handle" }] }));
});
