import type { Metadata } from "next";
import Link from "next/link";
import { CallCard } from "@/components/call-card";
import { GradePill } from "@/components/gc-tube";
import { formatAsOf, formatRate, formatScore, formatShortDay } from "@/lib/format";
import { gcGrade } from "@/lib/grades";
import { getCohortList, getFeaturedCohort, getLeaderboard, type CallView, type LeaderRow } from "@/lib/queries";
import type { ReadoutKind } from "@/lib/scoring";

export const metadata: Metadata = {
  title: "Demo board",
  description: "Fictional GradedCalls FinTwit posts. Labeled demo and kept off the live board.",
  robots: { index: false, follow: false },
};

function cardReadout(call: CallView): ReadoutKind {
  if (call.grades.friday) return "friday";
  if (call.grades.wednesday) return "wednesday";
  if (call.grades.monday) return "monday";
  return "monday-gap";
}

export default async function DemoPage() {
  const [cohorts, featured, watchlist, viral] = await Promise.all([
    getCohortList(),
    getFeaturedCohort(),
    getLeaderboard("watchlist", "demo"),
    getLeaderboard("viral", "demo"),
  ]);
  const demos = cohorts.filter((cohort) => cohort.dataset === "demo");
  const spotlight = featured
    ? ["permapump", "doomscroll"]
        .map((handle) => featured.calls.find((call) => call.handle === handle))
        .filter((call): call is CallView => call != null)
    : [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#c9c9cf]">Demo</p>
      <h1 className="mt-3 text-4xl text-ink">Fictional examples</h1>
      <p className="mt-3 max-w-2xl text-sm text-muted">
        These handles and posts are made up, including the weekend doom and melt-up cards. Every card is marked DEMO.
        The prices under them are real Yahoo Finance prints. None of these rows are the live board.
      </p>

      {featured && spotlight.length > 0 ? (
        <section className="mt-10" aria-labelledby="doom-heading">
          <p className="text-xs uppercase tracking-wide text-muted">DEMO · Labor Day week</p>
          <h2 id="doom-heading" className="mt-1 text-3xl text-ink">
            {featured.title}
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">{featured.summary}</p>
          <ul className="mt-5 grid gap-3">
            {spotlight.map((call) => (
              <li key={call.id}>
                <CallCard call={call} readout={cardReadout(call)} quotes={featured.quotes} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-10" aria-labelledby="demo-weeks">
        <h2 id="demo-weeks" className="text-3xl text-ink">
          Demo weeks
        </h2>
        <ul className="mt-4 grid gap-3">
          {demos.map((cohort) => (
            <li key={cohort.slug}>
              <article className="panel p-5">
                <p className="text-xs uppercase tracking-wide text-muted">
                  DEMO · week of {formatShortDay(cohort.mondayAt)}
                </p>
                <h3 className="mt-1 text-2xl text-ink">
                  <Link href={`/weeks/${cohort.slug}`} className="hover:underline">
                    {cohort.title}
                  </Link>
                </h3>
                <p className="mt-2 text-sm text-muted">{cohort.summary}</p>
              </article>
            </li>
          ))}
        </ul>
      </section>

      <DemoRanks title="Demo accounts, by average grade" rows={watchlist} />
      <DemoRanks title="Demo viral posts, by average grade" rows={viral} />
      <p className="mt-8 text-xs text-muted">Ranks above use fictional posts only. As of {formatAsOf(new Date())} they are not the live board.</p>
    </div>
  );
}

function DemoRanks({ title, rows }: { title: string; rows: LeaderRow[] }) {
  return (
    <section className="mt-10">
      <h2 className="text-2xl text-ink">{title}</h2>
      <p className="mt-2 text-sm text-muted">DEMO. Hit is the share of graded calls that were right.</p>
      <ol className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
        {rows.slice(0, 5).map((row) => (
          <li key={row.handle} className="grid gap-2 px-4 py-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
            <span className="font-mono text-sm text-muted">{row.peerRank}</span>
            <Link href={`/accounts/${row.handle}`} className="min-w-0 hover:underline">
              <span className="block font-medium">{row.displayName}</span>
              <span className="block text-sm text-muted">@{row.handle} · DEMO</span>
            </Link>
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xl">
                {formatScore(row.avgScore, 0)}
                <span className="text-sm text-muted">%</span>
              </span>
              <GradePill grade={gcGrade({ score: row.avgScore, isStrong: row.isStrong, isWeak: row.isWeak })} />
              <span className="text-xs text-muted">Hit {formatRate(row.hitRate, 0)}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
