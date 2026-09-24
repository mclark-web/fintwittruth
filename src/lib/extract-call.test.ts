import assert from "node:assert/strict";
import test from "node:test";
import { extractCall, needsModelHelp } from "./extract-call";

const CLEAR =
  "High conviction bearish $SPY this week. Sell the open. Target 740. Invalid below 770.";

test("a clear index post becomes a gradable call", () => {
  const parsed = extractCall(CLEAR);
  assert.equal(parsed.symbol, "SPY");
  assert.equal(parsed.direction, "bearish");
  assert.equal(parsed.horizon, "this week");
  assert.equal(parsed.conviction, "high");
  assert.equal(parsed.sentiment, "panic");
  assert.equal(parsed.gradable, true);
  assert.equal(parsed.ambiguous, false);
  assert.equal(parsed.parser, "rules");
  assert.equal(needsModelHelp(parsed), false);
  assert.deepEqual(
    parsed.levels.map((level) => level.role),
    ["target", "invalidation"],
  );
});

test("a post that argues both ways, or names an unsupported ticker, stays in review", () => {
  const mixed = extractCall("High conviction bullish and bearish $SPY this week.");
  assert.equal(mixed.direction, null);
  assert.equal(mixed.ambiguous, true);
  assert.equal(needsModelHelp(mixed), true);

  const other = extractCall("High conviction bearish $TSLA this week. Sell the open.");
  assert.equal(other.symbol, "TSLA");
  assert.equal(other.gradable, false);
  assert.equal(other.ambiguous, true);
  assert.match(other.reasons.join(" "), /not a symbol/);
  assert.equal(needsModelHelp(other), false);
});

test("VIX mentioned beside one index does not split the call", () => {
  const parsed = extractCall("High conviction bullish rally on $QQQ this week. VIX should fade.");
  assert.equal(parsed.symbol, "QQQ");
  assert.equal(parsed.direction, "bullish");
  assert.equal(parsed.gradable, true);
});

test("two index tickers are ambiguous", () => {
  const parsed = extractCall("High conviction bearish $SPY and $QQQ this week. Sell the open.");
  assert.equal(parsed.symbol, null);
  assert.equal(parsed.ambiguous, true);
});
