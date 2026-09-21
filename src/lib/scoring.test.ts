import assert from "node:assert/strict";
import test from "node:test";
import {
  CHUD_THRESHOLD,
  directionPoints,
  rankPeers,
  scoreCall,
  scoreToBadge,
} from "./scoring";

test("badge maps 0-100 onto 1-10", () => {
  assert.equal(scoreToBadge(0), 1);
  assert.equal(scoreToBadge(9), 1);
  assert.equal(scoreToBadge(10), 2);
  assert.equal(scoreToBadge(69), 7);
  assert.equal(scoreToBadge(70), 8);
  assert.equal(scoreToBadge(89), 9);
  assert.equal(scoreToBadge(90), 10);
  assert.equal(scoreToBadge(100), 10);
});

test("direction points use the published bands", () => {
  assert.equal(directionPoints(0.02), 60);
  assert.equal(directionPoints(0.011), 54);
  assert.equal(directionPoints(0.006), 46);
  assert.equal(directionPoints(-0.011), 0);
});

test("a fully specified call can score 100 and a vague call stays under 70", () => {
  const sharp = scoreCall(
    {
      direction: "bullish",
      primary: "SPY",
      tickers: ["SPY"],
      explicit: true,
      levels: [
        { symbol: "SPY", price: 110, role: "target" },
        { symbol: "SPY", price: 95, role: "invalidation" },
        { symbol: "SPY", price: 99, role: "support" },
      ],
    },
    100,
    112,
  );
  assert.equal(sharp.score, 100);
  assert.equal(sharp.badge, 10);
  assert.equal(sharp.isChudTerritory, false);

  const vague = scoreCall(
    {
      direction: "bullish",
      primary: "SPY",
      tickers: [],
      explicit: false,
      levels: [],
    },
    100,
    103,
  );
  assert.ok(vague.score < CHUD_THRESHOLD);
  assert.equal(vague.isChudTerritory, true);
});

test("busted invalidation caps level points", () => {
  const busted = scoreCall(
    {
      direction: "bullish",
      primary: "SPY",
      tickers: ["SPY"],
      explicit: true,
      levels: [
        { symbol: "SPY", price: 110, role: "target" },
        { symbol: "SPY", price: 99, role: "invalidation" },
      ],
    },
    100,
    98,
  );
  assert.equal(busted.levelPoints, 2);
});

test("top 30% of the peer set earns Chad and ties at the cut are included", () => {
  const ranked = rankPeers([
    { id: "a", score: 90, tieBreak: "a" },
    { id: "b", score: 80, tieBreak: "b" },
    { id: "c", score: 80, tieBreak: "c" },
    { id: "d", score: 70, tieBreak: "d" },
    { id: "e", score: 60, tieBreak: "e" },
    { id: "f", score: 50, tieBreak: "f" },
    { id: "g", score: 40, tieBreak: "g" },
    { id: "h", score: 30, tieBreak: "h" },
    { id: "i", score: 20, tieBreak: "i" },
    { id: "j", score: 10, tieBreak: "j" },
  ]);
  const chads = ranked.filter((row) => row.isChad).map((row) => row.id);
  assert.deepEqual(chads.sort(), ["a", "b", "c"]);
  const under = ranked.find((row) => row.id === "j");
  assert.equal(under?.isChudTerritory, true);
  const clear = ranked.find((row) => row.id === "d");
  assert.equal(clear?.isChad, false);
  assert.equal(clear?.isChudTerritory, false);
});
