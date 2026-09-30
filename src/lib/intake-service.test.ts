import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileIntakeStore } from "./intake-store";
import { IntakeError, ingestManualText, ingestStatusUrl, reviewIntakePost } from "./intake-service";
import { gradeRealPosts } from "./real-book";

const HTML = `<blockquote class="twitter-tweet"><p lang="en" dir="ltr">High conviction bearish $SPY this week. Sell the open.</p>&mdash; Example (@unusual_whales) <a href="https://twitter.com/unusual_whales/status/1700000000000000001">September 18, 2026</a></blockquote>`;

test("paste, confirm, and grade a public status without calling a model", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "gc-intake-"));
  const store = fileIntakeStore(path.join(dir, "book.json"));
  const fetchImpl: typeof fetch = async () =>
    new Response(
      JSON.stringify({
        author_name: "Unusual Whales",
        author_url: "https://twitter.com/unusual_whales",
        html: HTML,
      }),
      { status: 200 },
    );
  try {
    const pending = await ingestStatusUrl("https://x.com/Unusual_Whales/status/1700000000000000001", {
      fetchImpl,
      store,
      allowLlm: false,
      now: new Date("2026-09-18T16:05:00.000Z"),
    });
    assert.equal(pending.status, "pending");
    assert.equal(pending.handle, "unusual_whales");
    assert.equal(pending.extraction.symbol, "SPY");
    assert.equal(pending.extraction.ambiguous, false);
    assert.match(pending.llmNote, /off until XAI_API_KEY/);
    await assert.rejects(
      () => ingestStatusUrl("https://x.com/unusual_whales/status/1700000000000000001", { fetchImpl, store, allowLlm: false }),
      IntakeError,
    );

    const confirmed = await reviewIntakePost(
      pending.id,
      "confirm",
      {
        symbol: "SPY",
        direction: "bearish",
        horizon: "this week",
        conviction: "high",
        sentiment: "panic",
        postedAt: "2026-09-18T16:00:00.000Z",
        target: "",
        invalidation: "",
        note: "",
      },
      store,
    );
    assert.equal(confirmed.status, "confirmed");
    const [graded] = gradeRealPosts((await store.read()).posts);
    assert.equal(graded?.label, "Verified real call");
    assert.ok(graded?.grades.monday);
    assert.equal(graded?.sourceUrl, "https://x.com/unusual_whales/status/1700000000000000001");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("manual text is stored when oEmbed is skipped, and empty text is refused", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "gc-intake-"));
  const store = fileIntakeStore(path.join(dir, "book.json"));
  try {
    await assert.rejects(
      () => ingestManualText("https://x.com/unusual_whales/status/20", "   ", { store, allowLlm: false }),
      IntakeError,
    );
    const pending = await ingestManualText(
      "https://x.com/unusual_whales/status/20",
      "High conviction bearish $SPY this week. Sell the open.",
      { store, allowLlm: false, authorName: "Unusual Whales" },
    );
    assert.equal(pending.textSource, "manual");
    assert.equal(pending.postedAtLabel, "");
    assert.equal(pending.status, "pending");
    assert.equal(pending.extraction.symbol, "SPY");
    assert.equal(pending.sourceUrl, "https://x.com/unusual_whales/status/20");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("confirming an unsupported ticker does not grade it", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "gc-intake-"));
  const store = fileIntakeStore(path.join(dir, "book.json"));
  const html = HTML.replaceAll("$SPY", "$TSLA");
  try {
    const pending = await ingestStatusUrl("https://x.com/TraderJonesy/status/1700000000000000002", {
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            author_name: "TraderJonesy",
            author_url: "https://twitter.com/TraderJonesy",
            html,
          }),
          { status: 200 },
        ),
      store,
      allowLlm: false,
    });
    const saved = await reviewIntakePost(
      pending.id,
      "confirm",
      {
        symbol: "TSLA",
        direction: "bearish",
        horizon: "this week",
        conviction: "high",
        sentiment: "",
        postedAt: "2026-09-18T16:00:00.000Z",
        target: "",
        invalidation: "",
        note: "",
      },
      store,
    );
    assert.equal(saved.status, "not_gradable");
    const [call] = gradeRealPosts((await store.read()).posts);
    assert.equal(call?.label, "Not gradable yet");
    assert.equal(Object.keys(call?.grades ?? {}).length, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
