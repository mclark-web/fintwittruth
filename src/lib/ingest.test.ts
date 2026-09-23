import assert from "node:assert/strict";
import test from "node:test";
import { excerptAppearsInDocument, IngestError, parseOperatorPaste, toLiveCall, upsertLiveCall } from "./ingest";
import type { LiveFile } from "./live-book";

const paste = `source: https://example.com/post
handle: pulsewriter
name: Pulse Writer
posted: 2026-09-20T04:52:42.466Z
direction: bearish
primary: SPY
tickers: SPX
explicit: true
---
It appears the market is preparing for additional pullback. The market internals are flashing signs of weakness on SPX.
`;

test("a structured paste becomes a call with handle, direction, tickers, time, and source", () => {
  const parsed = parseOperatorPaste(paste);
  assert.equal(parsed.handle, "pulsewriter");
  assert.equal(parsed.direction, "bearish");
  assert.deepEqual(parsed.tickers, ["SPX"]);
  assert.equal(parsed.sourceUrl, "https://example.com/post");
  assert.equal(parsed.postedAt, "2026-09-20T04:52:42.466Z");
  assert.match(parsed.body, /additional pullback/);
});

test("a tweet URL supplies the handle and still requires the text and a timestamp", () => {
  const parsed = parseOperatorPaste(`https://x.com/crashcaller/status/1
posted: 2026-09-19T18:00:00Z
---
Markets are doomed. Sell the open. This crash call is not a drill for $SPY this weekend.
`);
  assert.equal(parsed.handle, "crashcaller");
  assert.equal(parsed.direction, "bearish");
  assert.equal(parsed.sourceUrl, "https://x.com/crashcaller/status/1");
  assert.ok(parsed.tickers.includes("SPY"));
});

test("missing timestamp, missing source, and a mixed call are refused", () => {
  assert.throws(() => parseOperatorPaste("source: https://example.com/x\n---\n" + "x".repeat(50)), IngestError);
  assert.throws(
    () =>
      parseOperatorPaste(`handle: someone
posted: 2026-09-19T18:00:00Z
---
Markets are doomed. Sell the open. This crash call is not a drill for the weekend session.
`),
    /source URL/,
  );
  assert.throws(
    () =>
      parseOperatorPaste(`source: https://example.com/mix
handle: someone
posted: 2026-09-19T18:00:00Z
direction: bearish
---
This is a melt-up and also a crash. Sell the open and buy the all-time high in the same note today.
`),
    /both ways/,
  );
});

test("the excerpt has to appear in the source document", () => {
  const excerpt = "It appears the market is preparing for additional pullback.";
  assert.equal(
    excerptAppearsInDocument(excerpt, `<p>${excerpt}</p><script>ignore</script>`),
    true,
  );
  assert.equal(excerptAppearsInDocument(excerpt, "<p>A different note entirely about nothing related.</p>"), false);
});

test("upsert refuses a post outside the collect window", () => {
  const parsed = parseOperatorPaste(paste);
  const call = toLiveCall(parsed, "2026-09-21__pulsewriter");
  const empty: LiveFile = { version: 1, cohorts: [] };
  const stored = upsertLiveCall(
    empty,
    {
      slug: "2026-09-21",
      historySlug: "2026-09-21",
      title: "Verified weekend book",
      summary: "Operator book.",
      monday: { year: 2026, month: 9, day: 21 },
    },
    call,
  );
  assert.equal(stored.cohorts[0].calls[0].sourceUrl, "https://example.com/post");
  const late = toLiveCall(
    parseOperatorPaste(paste.replace("2026-09-20T04:52:42.466Z", "2026-09-22T12:00:00Z")),
    "late",
  );
  assert.throws(() =>
    upsertLiveCall(
      empty,
      {
        slug: "2026-09-21",
        historySlug: "2026-09-21",
        title: "Verified weekend book",
        summary: "Operator book.",
        monday: { year: 2026, month: 9, day: 21 },
      },
      late,
    ),
  );
});
