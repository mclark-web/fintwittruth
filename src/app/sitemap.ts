import type { MetadataRoute } from "next";
import { listCallIds, listCohortSlugs, listHandles } from "@/lib/queries";
import { READOUTS } from "@/lib/scoring";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const [slugs, handles, calls] = await Promise.all([listCohortSlugs(), listHandles(), listCallIds()]);
  return [
    { url: base },
    { url: `${base}/weeks` },
    { url: `${base}/leaderboard` },
    { url: `${base}/methodology` },
    { url: `${base}/disclaimer` },
    ...slugs.flatMap((slug) => [
      { url: `${base}/weeks/${slug}` },
      ...READOUTS.map((readout) => ({ url: `${base}/weeks/${slug}/${readout}` })),
    ]),
    ...handles.map((handle) => ({ url: `${base}/accounts/${handle}` })),
    ...calls.map((id) => ({ url: `${base}/calls/${id}` })),
  ];
}
