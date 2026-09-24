import type { MetadataRoute } from "next";
import { listCallIds, listCohortSlugs, listHandles } from "@/lib/queries";
import { READOUTS } from "@/lib/scoring";
import { WATCHLIST } from "@/lib/watchlist";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://fintwittruth.vercel.app";
  const [slugs, handles, calls] = await Promise.all([listCohortSlugs(), listHandles(), listCallIds()]);
  return [
    { url: base },
    { url: `${base}/weeks` },
    { url: `${base}/watchlist` },
    { url: `${base}/real` },
    { url: `${base}/demo` },
    { url: `${base}/leaderboard` },
    { url: `${base}/pending` },
    { url: `${base}/methodology` },
    { url: `${base}/disclaimer` },
    { url: `${base}/terms` },
    { url: `${base}/donate` },
    ...slugs.flatMap((slug) => [
      { url: `${base}/weeks/${slug}` },
      { url: `${base}/weeks/${slug}/pending` },
      ...READOUTS.map((readout) => ({ url: `${base}/weeks/${slug}/${readout}` })),
    ]),
    ...[...new Set([...handles, ...WATCHLIST.map((account) => account.handle)])].map((handle) => ({
      url: `${base}/accounts/${handle}`,
    })),
    ...calls.map((id) => ({ url: `${base}/calls/${id}` })),
  ];
}
