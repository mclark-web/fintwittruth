import assert from "node:assert/strict";
import test from "node:test";
import { zonedToUtc } from "./calendar";
import { bandRateLabel, etYmd, formatScopeWhen, hitRateLabel, initials, formatScore, formatWeekday, lastTradingDayBeforeWeekend, referenceCloseDay } from "./format";

test("a UTC fetch time is shown in ET", () => {
  assert.equal(formatScopeWhen("2026-10-19T19:29:44.258Z"), "Monday, October 19 at 3:29\u00a0PM\u00a0ET");
});

test("rate labels keep the readout count beside the rounded percent", () => {
  assert.equal(hitRateLabel(1 / 8, 8), "Hit 13% of 8 readouts");
  assert.equal(bandRateLabel("WEAK", 7, 8), "WEAK on 7 of 8");
  assert.equal(bandRateLabel("STRONG", 2, 8), "STRONG on 2 of 8");
});

test("GC percents floor, and a positive average under 1 reads <1", () => {
  assert.equal(formatScore(15.9), "15");
  assert.equal(formatScore(9.2), "9");
  assert.equal(formatScore(39.5), "39");
  assert.equal(formatScore(0), "0");
  assert.equal(formatScore(0.4), "<1");
  assert.equal(formatScore(0.99), "<1");
  assert.equal(formatScore(1), "1");
});

test("the weekend reference is the last trading day, including a Friday holiday", () => {
  const ordinary = zonedToUtc(2026, 9, 21, 12, 0);
  const goodFridayWeek = zonedToUtc(2026, 4, 6, 12, 0);
  assert.equal(etYmd(lastTradingDayBeforeWeekend(ordinary)), "2026-09-18");
  assert.equal(formatWeekday(lastTradingDayBeforeWeekend(ordinary)), "Fri Sep 18");
  assert.equal(etYmd(lastTradingDayBeforeWeekend(goodFridayWeek)), "2026-04-02");
  assert.equal(formatWeekday(lastTradingDayBeforeWeekend(goodFridayWeek)), "Thu Apr 2");
  assert.equal(etYmd(referenceCloseDay(goodFridayWeek, "2026-04-03")), "2026-04-02");
  assert.equal(etYmd(referenceCloseDay(ordinary, "2026-09-18")), "2026-09-18");
});

test("initials never split an emoji into a lone surrogate", () => {
  const out = initials("da_trader 🇺🇸");
  assert.equal(out, "D🇺");
  assert.ok(!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(out));
  assert.equal(initials("Drew Kane"), "DK");
});
