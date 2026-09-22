import type { Metadata } from "next";
import Link from "next/link";
import { pendingReadoutKinds, settledReadoutKinds } from "@/lib/board";
import { READOUT_META } from "@/lib/labels";
import { getCohort, listCohortSlugs } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Pending settle",
  description:
    "Calls and horizons that stay off the Charoof FinTwit boards until a readout settles. Rankings use graded calls only.",
};

export default async function PendingPage() {
  const slugs = await listCohortSlugs();
  const cohorts = (await Promise.all(slugs.map((slug) => getCohort(slug)))).filter((cohort) => cohort != null);
  const waiting = cohorts
    .map((cohort) => ({
      cohort,
      pending: pendingReadoutKinds(Object.values(cohort.readouts)),
      settled: settledReadoutKinds(Object.values(cohort.readouts)),
    }))
    .filter((item) => item.pending.length > 0)
    .sort((a, b) => b.cohort.mondayAt.getTime() - a.cohort.mondayAt.getTime());

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <p className="text-sm text-muted">
        <Link href="/leaderboard" className="hover:underline">
          Leaderboard
        </Link>
      </p>
      <h1 className="mt-4 font-serif text-4xl text-ink">Pending settle</h1>
      <p className="mt-3 max-w-3xl text-muted">
        These horizons are not on the home tape, the weekly boards, or the leaderboards. A call joins those
        rankings after Monday&apos;s open, Monday noon, Wednesday, or Friday settles. This page is the waiting
        list, not a score.
      </p>
      {waiting.length === 0 ? (
        <p className="panel mt-8 p-5 text-sm text-muted">
          Nothing is waiting. Every cohort on the board has a settled grade.{" "}
          <Link href="/weeks" className="text-pine underline-offset-4 hover:underline">
            Open the weeks
          </Link>
          .
        </p>
      ) : (
        <ul className="mt-8 grid gap-4">
          {waiting.map(({ cohort, pending, settled }) => (
            <li key={cohort.slug}>
              <article className="panel p-5">
                <p className="text-xs uppercase tracking-wide text-muted">
                  {settled.length === 0 ? "No settled grade yet" : `${settled.length} settled · ${pending.length} waiting`}
                </p>
                <h2 className="mt-1 font-serif text-3xl text-ink">
                  <Link href={`/weeks/${cohort.slug}/pending`} className="hover:underline">
                    {cohort.title}
                  </Link>
                </h2>
                <p className="mt-2 max-w-2xl text-sm text-muted">{cohort.summary}</p>
                <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                  {pending.map((kind) => (
                    <li key={kind} className="rounded-xl border border-line bg-white px-3 py-3">
                      <p className="text-[11px] uppercase tracking-wide text-muted">{READOUT_META[kind].role}</p>
                      <p className="mt-1 font-serif text-xl text-ink">{READOUT_META[kind].label}</p>
                      <p className="text-sm text-muted">Not graded yet · off the board until {READOUT_META[kind].time}</p>
                    </li>
                  ))}
                </ul>
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
