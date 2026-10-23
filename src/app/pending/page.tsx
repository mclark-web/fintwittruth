import type { Metadata } from "next";
import Link from "next/link";
import { GcTube } from "@/components/gc-tube";
import { pendingReadoutKinds, settledReadoutKinds } from "@/lib/board";
import { etYmd } from "@/lib/format";
import { UNGRADED_HORIZON, pendingClosure, ungradedHorizonLine } from "@/lib/grades";
import { READOUT_META } from "@/lib/labels";
import { loadPendingApproval } from "@/lib/pending-approval";
import { getCohort, listCohortSlugs, type CohortView } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Not graded yet",
  description: "Calls that stay off the GradedCalls FinTwit boards until a checkpoint is graded. Rankings use graded calls only.",
};

export default async function PendingPage() {
  const approval = loadPendingApproval();
  const slugs = await listCohortSlugs();
  const cohorts = (await Promise.all(slugs.map((slug) => getCohort(slug)))).filter(
    (cohort): cohort is CohortView => cohort != null && cohort.dataset === "live",
  );
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
      <h1 className="mt-4 font-serif text-4xl text-ink">Not graded yet</h1>
      <p className="mt-3 max-w-3xl text-muted">
        These checkpoints are not on the home board, the weekly boards, or the leaderboard. A call joins those
        rankings after Monday&apos;s open, Monday noon, the Wednesday close, or the Friday close is graded. This page is the waiting
        list, not a score. Demo weeks are not listed here.
      </p>
      {waiting.length === 0 ? (
        <p className="panel mt-8 p-5 text-sm text-muted">
          Nothing is waiting. Every live week on the board has a grade.{" "}
          <Link href="/weeks" className="accent-link underline-offset-4 hover:underline">
            Open the weeks
          </Link>
          .
        </p>
      ) : (
        <ul className="mt-8 grid gap-4">
          {waiting.map(({ cohort, pending, settled }) => {
            const closure = pendingClosure(pending, cohort);
            const holidayClosed = closure.closed > 0 && closure.upcoming === 0;
            return (
            <li key={cohort.slug}>
              <article className="panel p-5">
                <p className="text-xs uppercase tracking-wide text-muted">
                  {settled.length === 0 ? (
                    "No settled grade yet"
                  ) : holidayClosed ? (
                    <>
                      {settled.length} settled ·{" "}
                      <span className="normal-case text-[#9a9aa3]">
                        {pending.length} {UNGRADED_HORIZON}
                      </span>
                    </>
                  ) : (
                    `${settled.length} settled · ${pending.length} waiting`
                  )}
                </p>
                <h2 className="mt-1 font-serif text-3xl text-ink [text-wrap:balance]">
                  <Link href={`/weeks/${cohort.slug}/pending`} className="hover:underline">
                    {cohort.title}
                  </Link>
                </h2>
                <p className="mt-2 max-w-2xl text-sm text-muted">{cohort.summary}</p>
                <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                  {pending.map((kind) => (
                    <li key={kind} className="rounded-xl border border-line bg-sheet px-3 py-3">
                      <p className="text-xs uppercase tracking-wide text-[#9a9aa3]">{READOUT_META[kind].role}</p>
                      <p className="mt-1 font-serif text-xl text-ink">{READOUT_META[kind].label}</p>
                      <div className="mt-2 max-w-40">
                        <GcTube score={0} grade="exit" variant="mini" showMeta={false} ungraded />
                      </div>
                      <p className="mt-2 text-sm text-[#9a9aa3]">
                        {ungradedHorizonLine({
                          kind,
                          sessionYmd: etYmd(cohort.mondayAt),
                          time: READOUT_META[kind].time,
                        })}
                      </p>
                    </li>
                  ))}
                </ul>
              </article>
            </li>
            );
          })}
        </ul>
      )}
      <section className="mt-10" aria-labelledby="approval-heading">
        <h2 id="approval-heading" className="font-serif text-3xl text-ink">Pending approval</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          {approval.length} posts are waiting. An ambiguous scan row is not graded. Each line is the verbatim quote and the status link.
        </p>
        <ul className="mt-4 grid gap-3">
          {approval.map((post) => (
            <li key={`${post.postUrl}-${post.ticker}-${post.quote.slice(0, 24)}`} className="panel p-4">
              <p className="text-xs uppercase tracking-wide text-[#9a9aa3]">Not graded yet</p>
              <h3 className="mt-1 text-lg text-ink">
                @{post.handle}
                {post.ticker ? ` · ${post.ticker}` : ""}
                {post.direction ? ` · ${post.direction}` : ""}
              </h3>
              <p className="mt-2 text-sm text-ink">“{post.quote}”</p>
              <p className="mt-2 text-xs text-muted">{post.postedAtEt}</p>
              <p className="mt-1 text-sm text-muted">{post.reason}</p>
              {post.postUrl ? (
                <p className="mt-2 text-sm">
                  <a href={post.postUrl} className="accent-link hit-44 underline-offset-4 hover:underline">
                    Status
                  </a>
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
