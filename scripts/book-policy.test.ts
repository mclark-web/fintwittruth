import assert from "node:assert/strict";
import test from "node:test";
import { exclusionReason, expiresBeforeReadout, partitionBook, sameDayHorizon, stampPending, twoSidedQuote } from "./book-policy";
import type { CallRow } from "./calls-ledger";

function row(partial: Partial<CallRow> & Pick<CallRow, "call_id" | "cohort_slug" | "handle" | "posted_at" | "primary" | "body">): CallRow {
  return {
    tickers: partial.primary,
    direction: "bullish",
    ...partial,
  } as CallRow;
}

test("same-day trades are the session or an expiry on or before readout Monday", () => {
  assert.equal(sameDayHorizon("$SPY 766 PUT 0DTE @ 0.45", "2026-08-24"), true);
  assert.equal(sameDayHorizon("puts ODT", "2026-10-26"), true);
  assert.equal(sameDayHorizon("$SPY $SPX calls today for the gap fill", "2026-09-28"), true);
  assert.equal(sameDayHorizon("buying calls for $QQQ for today", "2026-10-19"), true);
  assert.equal(sameDayHorizon("$SPY 772 calls .85 tomorrows exp", "2026-09-28"), true);
  assert.equal(sameDayHorizon("$NVDA Fridays exp", "2026-10-19"), true);
  assert.equal(sameDayHorizon("showing $SPY at780 for tomorrow", "2026-08-17"), true);
  assert.equal(sameDayHorizon("into the close today", "2026-10-26"), true);
  assert.equal(sameDayHorizon("$QQQ 10/23 720 calls", "2026-10-26"), true);
  assert.equal(sameDayHorizon("$SPY 770 calls .98 10/19 exp", "2026-10-19"), true);
  assert.equal(sameDayHorizon("$SPY 767 calls .57 LOTTO", "2026-09-28"), false);
  assert.equal(sameDayHorizon("Adding $SPY Friday $770 calls here", "2026-10-05"), true);
  assert.equal(sameDayHorizon("Just bought calls for next Friday. $SPY", "2026-10-19"), false);
  assert.equal(sameDayHorizon("$NVDA 225 calls 1.90 9/25 exp", "2026-09-21"), false);
  assert.equal(sameDayHorizon("Still keep half 10/30 SPY puts", "2026-10-26"), false);
});

test("single names, IWM, VIX, and the two crypto tickers leave the graded book", () => {
  assert.equal(exclusionReason(row({ call_id: "a", cohort_slug: "2026-10-12", handle: "h", posted_at: "2026-10-09T12:00:00.000Z", primary: "AAPL", body: "$AAPL calls" })), "Single-name call. Graded prints are SPY, QQQ, and DIA. Not graded.");
  assert.equal(
    exclusionReason(row({ call_id: "a2", cohort_slug: "2026-10-26", handle: "h", posted_at: "2026-10-22T12:00:00.000Z", primary: "ADBE", body: "$ADBE Friday calls" })),
    "Single-name call. Graded prints are SPY, QQQ, and DIA. Not graded.",
  );
  assert.match(exclusionReason(row({ call_id: "b", cohort_slug: "2026-09-21", handle: "h", posted_at: "2026-09-16T12:00:00.000Z", primary: "IWM", body: "short $iwm" })) ?? "", /IWM is not on the graded-print list/);
  assert.match(exclusionReason(row({ call_id: "c", cohort_slug: "2026-10-26", handle: "h", posted_at: "2026-10-22T12:00:00.000Z", primary: "VIX", body: "$VIX up" })) ?? "", /VIX is not a graded index print/);
  assert.match(exclusionReason(row({ call_id: "d", cohort_slug: "2026-10-26", handle: "PerspicillumRes", posted_at: "2026-10-21T17:45:00.000Z", primary: "DASH", tickers: "DASH", body: "LONG $DASH 53.350" })) ?? "", /Dash coin/);
  assert.match(exclusionReason(row({ call_id: "e", cohort_slug: "2026-10-26", handle: "PerspicillumRes", posted_at: "2026-10-21T17:45:00.000Z", primary: "VVV", tickers: "VVV", body: "LONG $VVV 26.995" })) ?? "", /VVV/);
  assert.equal(exclusionReason(row({ call_id: "f", cohort_slug: "2026-10-19", handle: "h", posted_at: "2026-10-16T12:00:00.000Z", primary: "SPY", body: "$SPY calls for next Friday" })), null);
  assert.equal(exclusionReason(row({ call_id: "g", cohort_slug: "2026-10-26", handle: "Staticether", posted_at: "2026-10-22T12:00:00.000Z", primary: "SPX", tickers: "SPX", body: "$SPX will be at 6900 by March" })), null);
  assert.match(
    exclusionReason(row({
      call_id: "h",
      cohort_slug: "2026-08-24",
      handle: "clintoptions",
      posted_at: "2026-08-21T19:06:07.000Z",
      primary: "SPY",
      tone_label: "0DTE",
      posture: "0DTE",
      body: "$SPY 766 calls here for the degens! 0.42",
    })) ?? "",
    /Same-day or 0DTE/,
  );
  assert.equal(expiresBeforeReadout({ body: "$SPY 766 calls here for the degens! 0.42", cohort_slug: "2026-08-24" }), false);
  assert.match(
    exclusionReason(row({
      call_id: "i",
      cohort_slug: "2026-10-12",
      handle: "clintoptions",
      posted_at: "2026-10-09T16:25:35.000Z",
      primary: "SPY",
      tone_label: "intraday",
      posture: "intraday",
      body: "Only took this second setup on $SPY calls for a premarket high breakout.",
    })) ?? "",
    /Same-day or 0DTE/,
  );
  assert.equal(
    exclusionReason(row({
      call_id: "j",
      cohort_slug: "2026-08-10",
      handle: "AndrewHiesinger",
      posted_at: "2026-08-06T13:49:56.000Z",
      primary: "SPY",
      tone_label: "intraday",
      posture: "intraday",
      body: "Upside to $775 looks inevitable on $SPY.",
    })),
    null,
  );
  assert.equal(
    exclusionReason(row({
      call_id: "k",
      cohort_slug: "2026-10-19",
      handle: "BreadWinneh",
      posted_at: "2026-10-15T13:33:49.000Z",
      primary: "QQQ",
      tone_label: "intraday",
      posture: "intraday",
      body: "$QQQ 723C 722C .95 fill",
    })),
    null,
  );
});

test("one index call per handle keeps the earliest post that is not same-day", () => {
  const rows = [
    row({ call_id: "1", cohort_slug: "2026-10-19", handle: "TraderJonesy", posted_at: "2026-10-16T16:24:00.000Z", primary: "QQQ", body: "buying calls for $QQQ for today" }),
    row({ call_id: "2", cohort_slug: "2026-10-19", handle: "TraderJonesy", posted_at: "2026-10-16T17:21:00.000Z", primary: "SPY", body: "Just bought calls for next Friday. $SPY" }),
    row({ call_id: "3", cohort_slug: "2026-10-19", handle: "BreadWinneh", posted_at: "2026-10-15T13:33:00.000Z", primary: "QQQ", body: "$QQQ 723C" }),
    row({ call_id: "4", cohort_slug: "2026-10-19", handle: "BreadWinneh", posted_at: "2026-10-16T15:15:00.000Z", primary: "QQQ", body: "$QQQ 720C" }),
  ];
  const book = partitionBook(rows);
  assert.deepEqual(
    book.keep.map((item) => item.call_id).sort(),
    ["2", "3"],
  );
  assert.equal(book.queue.find((item) => item.row.call_id === "1")?.reason.includes("0DTE"), true);
  assert.equal(book.queue.find((item) => item.row.call_id === "4")?.reason.includes("Later than the first"), true);
});

test("a two-sided queue row is labeled two-sided and keeps the ticker sentence", () => {
  assert.equal(twoSidedQuote("Long: above 700. Short: below 690."), true);
  const stamped = stampPending({
    handle: "BossTradingGrp",
    display_name: "Boss",
    post_url: "https://x.com/BossTradingGrp/status/2113248938786713626",
    posted_at_ET: "2026-10-22 12:00:00 ET",
    ticker: "QQQ",
    direction: "long",
    quote: "Long: calls above 700. Short: puts below 690.",
    reason: "The verbatim quote does not name the ticker. Not graded.",
  });
  assert.equal(stamped.direction, "two-sided");
  assert.equal(stamped.reason, "Two-sided. The verbatim quote does not name the ticker. Not graded.");
});
