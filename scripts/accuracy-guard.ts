import history from "../src/lib/market-history.json";
import { SETTLE_BUFFER_MINUTES, settlementIsDue } from "../src/lib/calendar";
import { buildDataset } from "../src/lib/dataset";
import { formatPrice } from "../src/lib/format";
import { planCheckpoint } from "../src/lib/settlement";
import { etParts, fetchChart, pricesAgree, readDailyBar, readNoonBar, readOfficialClose, unix } from "../src/lib/yahoo";

type HistoryCohort = {
  referenceDate: string;
  monday: { date: string; session: string } | null;
  wednesday: { date: string; session: string } | null;
  friday: { date: string; session: string } | null;
};

const cohorts = history.cohorts as Record<string, HistoryCohort>;

function ymdFrom(date: Date): string {
  return etParts(Math.floor(date.getTime() / 1000)).date;
}

async function officialClose(symbol: string, ymd: string): Promise<number | null> {
  try {
    const daily = await fetchChart(symbol, unix(ymd) - 86400, unix(ymd) + 86400 * 2, "1d");
    return readOfficialClose(daily, ymd).close;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${symbol} ${ymd} official close could not be read. ${message}`);
  }
}

/**
 * Wednesday and Friday settle on the official daily close, after the post-close buffer.
 * A missing 5-minute noon bar is not evidence that Yahoo lacks the print. Before this
 * check, that miss was swallowed and the readout stayed "Waiting on the clock".
 */
async function checkClose(input: {
  symbol: string;
  kind: "Wednesday" | "Friday";
  ymd: string;
  checkpointAt: Date;
  displayed: number | null;
  session: string | null;
  mismatches: string[];
}) {
  const now = new Date();
  if (input.session === "closed") {
    if (input.displayed != null) {
      input.mismatches.push(`${input.symbol} ${input.kind} is a closed session but a price is stored.`);
    } else {
      console.log(`ok ${input.symbol} ${input.kind} closed session stays blank`);
    }
    return;
  }
  if (!settlementIsDue(input.checkpointAt, now)) {
    if (input.displayed != null) {
      input.mismatches.push(
        `${input.symbol} ${input.kind} close is stored before the ${SETTLE_BUFFER_MINUTES}-minute post-close buffer.`,
      );
    } else {
      console.log(`ok ${input.symbol} ${input.kind} close not due`);
    }
    return;
  }

  let yahoo: number | null = null;
  try {
    yahoo = await officialClose(input.symbol, input.ymd);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    input.mismatches.push(`${input.symbol} ${input.kind} close is due and Yahoo could not be read. ${message}`);
    return;
  }
  const plan = planCheckpoint({
    ymd: input.ymd,
    checkpointAt: input.checkpointAt,
    now,
    officialClose: yahoo,
  });
  if (plan === "flag" || yahoo == null) {
    input.mismatches.push(
      `${input.symbol} ${input.kind} close is due and Yahoo has no official daily close for ${input.ymd}. Refusing to invent a print.`,
    );
    return;
  }
  if (
    input.displayed == null ||
    !pricesAgree(input.displayed, yahoo) ||
    formatPrice(input.displayed) !== formatPrice(yahoo)
  ) {
    input.mismatches.push(
      `${input.symbol} ${input.kind} close displayed ${input.displayed == null ? "blank" : formatPrice(input.displayed)} vs Yahoo official close ${formatPrice(yahoo)}`,
    );
    return;
  }
  console.log(`ok ${input.symbol} ${input.kind} close ${formatPrice(input.displayed)}`);
}

async function main() {
  const data = buildDataset();
  const live = data.cohorts.find((cohort) => cohort.dataset === "live" && cohort.isLatest);
  if (!live) throw new Error("No live cohort to check.");
  const spec = cohorts[live.slug];
  if (!spec) throw new Error(`No market history for live cohort ${live.slug}.`);
  const mismatches: string[] = [];

  for (const quote of live.quotes) {
    const daily = await fetchChart(quote.symbol, unix(spec.referenceDate) - 86400, unix(ymdFrom(live.mondayAt)) + 86400 * 3, "1d");
    const friday = readDailyBar(daily, spec.referenceDate);
    const displayedRef = quote.ref;
    if (!pricesAgree(displayedRef, friday.close) || formatPrice(displayedRef) !== formatPrice(friday.close)) {
      mismatches.push(`${quote.symbol} Friday close displayed ${formatPrice(displayedRef)} vs Yahoo ${formatPrice(friday.close)}`);
    } else {
      console.log(`ok ${quote.symbol} Friday close ${formatPrice(displayedRef)}`);
    }
    if (spec.monday?.session === "open") {
      const monday = readDailyBar(daily, spec.monday.date);
      if (quote.mondayOpen == null || !pricesAgree(quote.mondayOpen, monday.open) || formatPrice(quote.mondayOpen) !== formatPrice(monday.open)) {
        mismatches.push(
          `${quote.symbol} Monday open displayed ${quote.mondayOpen == null ? "blank" : formatPrice(quote.mondayOpen)} vs Yahoo ${formatPrice(monday.open)}`,
        );
      } else {
        console.log(`ok ${quote.symbol} Monday open ${formatPrice(quote.mondayOpen)}`);
      }
      const bars = await fetchChart(quote.symbol, unix(spec.monday.date, 13), unix(spec.monday.date, 22), "5m");
      const noon = readNoonBar(bars, spec.monday.date);
      if (quote.monday == null || !pricesAgree(quote.monday, noon.open) || formatPrice(quote.monday) !== formatPrice(noon.open)) {
        mismatches.push(
          `${quote.symbol} Monday noon displayed ${quote.monday == null ? "blank" : formatPrice(quote.monday)} vs Yahoo ${formatPrice(noon.open)}`,
        );
      } else {
        console.log(`ok ${quote.symbol} Monday noon ${formatPrice(quote.monday)}`);
      }
    }
    await checkClose({
      symbol: quote.symbol,
      kind: "Wednesday",
      ymd: spec.wednesday?.date ?? ymdFrom(live.wednesdayAt),
      checkpointAt: live.wednesdayAt,
      displayed: quote.wednesday,
      session: spec.wednesday?.session ?? null,
      mismatches,
    });
    await checkClose({
      symbol: quote.symbol,
      kind: "Friday",
      ymd: spec.friday?.date ?? ymdFrom(live.fridayAt),
      checkpointAt: live.fridayAt,
      displayed: quote.friday,
      session: spec.friday?.session ?? null,
      mismatches,
    });
  }

  if (mismatches.length > 0) {
    console.error("Accuracy guard failed:");
    for (const line of mismatches) console.error(`- ${line}`);
    process.exit(1);
  }
  console.log(`Accuracy guard passed for ${live.slug} (${live.quotes.length} symbols).`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
