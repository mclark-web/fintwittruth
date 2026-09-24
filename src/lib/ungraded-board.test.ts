import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import FridayPage from "../app/weeks/[slug]/[readout]/page";
import CohortPendingPage from "../app/weeks/[slug]/pending/page";
import { LABOR_DAY_UNGRADED_LINE } from "./grades";

async function markup(slug: string, readout: string) {
  return renderToStaticMarkup(await FridayPage({ params: Promise.resolve({ slug, readout }) }));
}

test("an ungraded Friday board tube is not EXIT", async () => {
  const html = await markup("2026-09-21", "friday");
  assert.match(html, /aria-label="GC Scale, not graded yet"/);
  assert.match(html, />Not graded yet</);
  assert.doesNotMatch(html, /aria-label="0% GC Scale, EXIT LIQUIDITY"/);
  assert.doesNotMatch(html, /data-grade="exit"/);
  assert.doesNotMatch(html, /gc-pct[^>]*>0%</);
});

test("Labor Day Monday board tube stays ungraded and does not promise a print", async () => {
  const html = await markup("2026-09-07", "monday");
  assert.match(html, /aria-label="GC Scale, not graded yet"/);
  assert.match(html, /Not graded yet · market closed for Labor Day/);
  assert.equal(html.includes(LABOR_DAY_UNGRADED_LINE), true);
  assert.doesNotMatch(html, /off the board until 12:00 PM ET/);
  assert.doesNotMatch(html, /aria-label="0% GC Scale, EXIT LIQUIDITY"/);

  const pending = renderToStaticMarkup(
    await CohortPendingPage({ params: Promise.resolve({ slug: "2026-09-07" }) }),
  );
  assert.equal(pending.includes(LABOR_DAY_UNGRADED_LINE), true);
  assert.doesNotMatch(pending, /off the board until (9:30 AM ET|12:00 PM ET)/);
});
