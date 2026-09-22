import history from "../src/lib/market-history.json";
import { buildDataset } from "../src/lib/dataset";
import { formatPrice } from "../src/lib/format";
import { etParts, fetchChart, pricesAgree, readDailyBar, readNoonBar, unix } from "../src/lib/yahoo";

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
    if (quote.wednesday == null) {
      const wednesday = ymdFrom(live.wednesdayAt);
      try {
        const bars = await fetchChart(quote.symbol, unix(wednesday, 13), unix(wednesday, 22), "5m");
        const printed = readNoonBar(bars, wednesday);
        mismatches.push(`${quote.symbol} Wednesday noon is blank on the board but Yahoo printed ${printed.open}`);
      } catch {
        console.log(`ok ${quote.symbol} Wednesday noon still blank`);
      }
    }
    if (quote.friday == null) {
      const fridayDate = ymdFrom(live.fridayAt);
      try {
        const bars = await fetchChart(quote.symbol, unix(fridayDate, 13), unix(fridayDate, 22), "5m");
        const printed = readNoonBar(bars, fridayDate);
        mismatches.push(`${quote.symbol} Friday noon is blank on the board but Yahoo printed ${printed.open}`);
      } catch {
        console.log(`ok ${quote.symbol} Friday noon still blank`);
      }
    }
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
