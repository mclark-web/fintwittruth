import assert from "node:assert/strict";
import test from "node:test";
import { xaiXSearchJob } from "./x-search-job";
import { WATCHLIST } from "./watchlist";

test("scheduled X search stays disabled and returns no posts", async () => {
  const previous = process.env.XAI_API_KEY;
  process.env.XAI_API_KEY = "present-but-unused";
  try {
    assert.equal(xaiXSearchJob.enabled, false);
    const result = await xaiXSearchJob.run(WATCHLIST.map((account) => account.handle));
    assert.equal(result.enabled, false);
    assert.deepEqual(result.posts, []);
    assert.match(result.reason, /disabled/i);
  } finally {
    if (previous == null) delete process.env.XAI_API_KEY;
    else process.env.XAI_API_KEY = previous;
  }
});
