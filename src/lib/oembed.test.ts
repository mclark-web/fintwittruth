import assert from "node:assert/strict";
import test from "node:test";
import { OembedUnavailableError, fetchStatusOembed, parseStatusUrl, textFromOembedHtml } from "./oembed";

const HTML = `<blockquote class="twitter-tweet"><p lang="en" dir="ltr">High conviction bearish $SPY this week. Sell the open.</p>&mdash; Example (@unusual_whales) <a href="https://twitter.com/unusual_whales/status/1700000000000000001?ref_src=twsrc%5Etfw">September 18, 2026</a></blockquote>`;

test("a status URL is canonicalized and other links are refused", () => {
  const parsed = parseStatusUrl("https://twitter.com/unusual_whales/status/1700000000000000001?s=20");
  assert.equal(parsed?.canonical, "https://x.com/unusual_whales/status/1700000000000000001");
  assert.equal(parseStatusUrl("https://x.com/unusual_whales"), null);
  assert.equal(parseStatusUrl("https://example.com/unusual_whales/status/1700000000000000001"), null);
});

test("oEmbed HTML yields the post text and the date label, not an invented timestamp", () => {
  const read = textFromOembedHtml(HTML);
  assert.match(read.text, /bearish \$SPY/);
  assert.equal(read.postedAtLabel, "September 18, 2026");
  assert.equal("postedAt" in read, false);
});

test("fetchStatusOembed asks publish.x.com first and follows a working payload", async () => {
  const post = await fetchStatusOembed("https://x.com/unusual_whales/status/1700000000000000001", async (input) => {
    const url = String(input);
    assert.match(url, /^https:\/\/publish\.x\.com\/oembed\?/);
    assert.match(url, /omit_script=true/);
    assert.match(decodeURIComponent(url), /https:\/\/x\.com\/unusual_whales\/status\/1700000000000000001/);
    return new Response(
      JSON.stringify({
        url: "https://twitter.com/unusual_whales/status/1700000000000000001",
        author_name: "Unusual Whales",
        author_url: "https://twitter.com/unusual_whales",
        html: HTML,
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  });
  assert.equal(post.handle, "unusual_whales");
  assert.equal(post.authorName, "Unusual Whales");
  assert.match(post.text, /Sell the open/);
  assert.equal(post.postedAtLabel, "September 18, 2026");
  assert.equal(post.sourceUrl, "https://x.com/unusual_whales/status/1700000000000000001");
});

test("fetchStatusOembed falls back to publish.twitter.com when the current host fails", async () => {
  const seen: string[] = [];
  const post = await fetchStatusOembed("https://x.com/unusual_whales/status/20", async (input) => {
    const url = String(input);
    seen.push(url);
    if (url.startsWith("https://publish.x.com/oembed")) {
      return new Response("nope", { status: 301 });
    }
    return new Response(
      JSON.stringify({
        author_name: "jack",
        author_url: "https://twitter.com/jack",
        html: HTML.replace("unusual_whales", "jack").replace("1700000000000000001", "20"),
      }),
      { status: 200 },
    );
  });
  assert.equal(seen.length, 2);
  assert.match(seen[0] ?? "", /^https:\/\/publish\.x\.com\/oembed/);
  assert.match(seen[1] ?? "", /^https:\/\/publish\.twitter\.com\/oembed/);
  assert.equal(post.handle, "jack");
  assert.equal(post.statusId, "20");
});

test("fetchStatusOembed throws a typed miss when every host is down", async () => {
  await assert.rejects(
    () =>
      fetchStatusOembed("https://x.com/unusual_whales/status/20", async () => {
        throw new Error("network");
      }),
    (error: unknown) => {
      assert.ok(error instanceof OembedUnavailableError);
      assert.equal(error.sourceUrl, "https://x.com/unusual_whales/status/20");
      assert.equal(error.handle, "unusual_whales");
      assert.equal(error.statusId, "20");
      assert.match(error.message, /Paste the post text/);
      return true;
    },
  );
});
