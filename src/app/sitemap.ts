import type { MetadataRoute } from "next";
import { emptyLiveWeeks } from "@/lib/empty-weeks";
import { getLiveCohorts } from "@/lib/queries";
import { READOUTS } from "@/lib/scoring";
import { pageUrl } from "@/lib/site-urls";
import { WATCHLIST } from "@/lib/watchlist";

/** Re-read the clock so a week drops out of "unclosed" without a rebuild. Unclosed weeks are not listed. */
export const revalidate = 60;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const live = await getLiveCohorts();
  const handles = new Set<string>(WATCHLIST.map((account) => account.handle));
  for (const cohort of live) {
    for (const call of cohort.calls) handles.add(call.handle);
  }
  return [
    { url: pageUrl("/") },
    { url: pageUrl("/weeks") },
    { url: pageUrl("/watchlist") },
    { url: pageUrl("/real") },
    { url: pageUrl("/leaderboard") },
    { url: pageUrl("/pending") },
    { url: pageUrl("/methodology") },
    { url: pageUrl("/disclaimer") },
    { url: pageUrl("/terms") },
    { url: pageUrl("/donate") },
    ...emptyLiveWeeks().map((week) => ({ url: pageUrl(`/weeks/${week.slug}`) })),
    ...live.flatMap((cohort) => [
      { url: pageUrl(`/weeks/${cohort.slug}`) },
      { url: pageUrl(`/weeks/${cohort.slug}/pending`) },
      ...READOUTS.map((readout) => ({ url: pageUrl(`/weeks/${cohort.slug}/${readout}`) })),
    ]),
    ...[...handles].map((handle) => ({ url: pageUrl(`/accounts/${handle}`) })),
    ...live.flatMap((cohort) => cohort.calls.map((call) => ({ url: pageUrl(`/calls/${call.id}`) }))),
  ];
}
