import type { Metadata } from "next";
import Link from "next/link";
import { formatShortDay, formatWhen } from "@/lib/format";
import { READOUT_META } from "@/lib/labels";
import { getCohortList } from "@/lib/queries";
import { READOUTS } from "@/lib/scoring";

export const metadata: Metadata = {
  title: "Weeks",
  description:
    "Every Charoof FinTwit cohort, with Monday gap, Monday noon, Wednesday, and Friday grades on the same calls.",
};

export default async function WeeksPage() {
  const cohorts = await getCohortList();
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-serif text-4xl text-ink">Weekly cohorts</h1>
      <p className="mt-3 max-w-2xl text-muted">
        Each card is one collect window. A number is the average of settled grades at that horizon. A horizon
        that has not printed stays off the ranking until it settles.
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
              <ol className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {READOUTS.map((kind) => {
                  const avg = cohort.averages[kind];
                  const settled = cohort.statuses[kind] === "published" && avg != null;
                  return (
                    <li key={kind}>
                      <Link
                        href={settled ? `/weeks/${cohort.slug}/${kind}` : `/weeks/${cohort.slug}/pending`}
                        className="block rounded-xl border border-line bg-white px-3 py-3 hover:border-pine"
                      >
                        <span className="text-[11px] uppercase tracking-wide text-muted">
                          {READOUT_META[kind].label} · {READOUT_META[kind].role}
                        </span>
                        <span className="mt-1 block font-mono text-2xl text-ink">
                          {settled ? avg.toFixed(0) : "Not graded yet"}
                          {settled ? <span className="text-sm text-muted">/100</span> : null}
                        </span>
                        <span className="text-xs text-muted">
                          {settled
                            ? `On the board · ${READOUT_META[kind].time}`
                            : `Off the board until ${READOUT_META[kind].time}`}
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
