import type { Metadata } from "next";
import Link from "next/link";
import { formatShortDay, formatWhen } from "@/lib/format";
import { READOUT_META } from "@/lib/labels";
import { getCohortList } from "@/lib/queries";
import { READOUTS } from "@/lib/scoring";

export const metadata: Metadata = {
  title: "Weeks",
  description: "Every FinTwitTruth cohort, with Monday, Wednesday, and Friday grades on the same calls.",
};

export default async function WeeksPage() {
  const cohorts = await getCohortList();
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-serif text-4xl text-ink">Weekly cohorts</h1>
      <p className="mt-3 max-w-2xl text-muted">
        Each card is one collect window. The three numbers are the average score of that same book at Monday,
        Wednesday, and Friday noon. A dash means the readout is still scheduled.
      </p>
      <ul className="mt-8 grid gap-4">
        {cohorts.map((cohort) => (
          <li key={cohort.slug}>
            <article className="panel p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted">
                    {cohort.isLatest ? "Latest · demo" : "Demo"} · week of {formatShortDay(cohort.mondayAt)}
                  </p>
                  <h2 className="mt-1 font-serif text-3xl text-ink">
                    <Link href={`/weeks/${cohort.slug}`} className="hover:underline">
                      {cohort.title}
                    </Link>
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm text-muted">{cohort.summary}</p>
                  <p className="mt-2 text-xs text-muted">
                    {formatWhen(cohort.collectStart)} → {formatWhen(cohort.collectEnd)}
                  </p>
                </div>
              </div>
              <ol className="mt-4 grid gap-2 sm:grid-cols-3">
                {READOUTS.map((kind) => {
                  const avg = cohort.averages[kind];
                  return (
                    <li key={kind}>
                      <Link href={`/weeks/${cohort.slug}/${kind}`} className="block rounded-xl border border-line bg-white px-3 py-3 hover:border-pine">
                        <span className="text-[11px] uppercase tracking-wide text-muted">
                          {READOUT_META[kind].label} · {READOUT_META[kind].role}
                        </span>
                        <span className="mt-1 block font-mono text-2xl text-ink">
                          {avg == null ? "Pending" : avg.toFixed(0)}
                          {avg == null ? null : <span className="text-sm text-muted">/100</span>}
                        </span>
                        <span className="text-xs text-muted">
                          {cohort.statuses[kind] === "published" ? "Published 12:00 PM ET" : "Scheduled 12:00 PM ET"}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </article>
          </li>
        ))}
      </ul>
    </div>
  );
}
