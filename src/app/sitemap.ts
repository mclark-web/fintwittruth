import type { MetadataRoute } from "next";
import { emptyLiveWeeks } from "@/lib/empty-weeks";
import { getLiveCohorts } from "@/lib/queries";
import { READOUTS } from "@/lib/scoring";
import { WATCHLIST } from "@/lib/watchlist";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://fintwittruth.vercel.app";
  const live = await getLiveCohorts();
  const handles = new Set<string>(WATCHLIST.map((account) => account.handle));
  for (const cohort of live) {
    for (const call of cohort.calls) handles.add(call.handle);
  }
  return [
    { url: base },
    { url: `${base}/weeks` },
    { url: `${base}/watchlist` },
    { url: `${base}/real` },
    { url: `${base}/leaderboard` },
    { url: `${base}/pending` },
    { url: `${base}/methodology` },
    { url: `${base}/disclaimer` },
    { url: `${base}/terms` },
    { url: `${base}/donate` },
    ...emptyLiveWeeks().map((week) => ({ url: `${base}/weeks/${week.slug}` })),
    ...live.flatMap((cohort) => [
      { url: `${base}/weeks/${cohort.slug}` },
      { url: `${base}/weeks/${cohort.slug}/pending` },
      ...READOUTS.map((readout) => ({ url: `${base}/weeks/${cohort.slug}/${readout}` })),
    ]),
    ...[...handles].map((handle) => ({ url: `${base}/accounts/${handle}` })),
    ...live.flatMap((cohort) => cohort.calls.map((call) => ({ url: `${base}/calls/${call.id}` }))),
  ];
}
