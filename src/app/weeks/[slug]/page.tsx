import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NothingGraded, PendingSettleLink } from "@/components/board-state";
import { CallCard } from "@/components/call-card";
import { CohortWindow, NoiseIndex, PriceSource, QuoteTape, ReadoutCards } from "@/components/market";
import { GcTube } from "@/components/gc-tube";
import { mondayTapeClosedLine, pendingClosure } from "@/lib/grades";
import { callHasSettledGrade, pendingReadoutKinds, settledReadoutKinds } from "@/lib/board";
import { emptyLiveWeeks, futureLiveWeek } from "@/lib/empty-weeks";
import { formatShortDay, formatWhen } from "@/lib/format";
import { gradedSymbols } from "@/lib/prints";
import { getCohort, listCohortSlugs, matureGrade } from "@/lib/queries";

const OCT19_X_SCOPE =
  "X was checked only from Friday, October 16 at 10:22 AM ET through Sunday, October 18 at 5:00 PM ET. X posts from Wednesday noon through Friday 10:22 AM ET were out of scope and were not searched. For this week, first means the first forward-looking post inside that searched range.";

export async function generateStaticParams() {
  const slugs = await listCohortSlugs();
  const future = futureLiveWeek();
  return [...slugs, ...emptyLiveWeeks().map((week) => week.slug), ...(future ? [future.slug] : [])].map((slug) => ({
    slug,
  }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const cohort = await getCohort(slug);
  if (!cohort) {
    const empty = emptyLiveWeeks().find((week) => week.slug === slug);
    if (empty) return { title: `Week of ${formatShortDay(empty.window.mondayAt)}: no qualifying calls` };
    const future = futureLiveWeek();
    if (future?.slug === slug) return { title: `Week of ${formatShortDay(future.window.mondayAt)}: not closed yet` };
    return { title: "Week" };
  }
  return {
    title: cohort.title,
    description: cohort.summary,
    robots: cohort.dataset === "demo" ? { index: false, follow: false } : undefined,
  };
}

export default async function CohortPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cohort = await getCohort(slug);
  if (!cohort) {
    const empty = emptyLiveWeeks().find((week) => week.slug === slug);
    const future = futureLiveWeek();
    if (!empty && future?.slug !== slug) notFound();
    if (!empty && future) {
      return (
        <div className="mx-auto max-w-3xl px-4 py-10">
          <p className="text-xs uppercase tracking-wide text-muted">Week of {formatShortDay(future.window.mondayAt)}</p>
          <h1 className="mt-1 font-serif text-4xl text-ink [text-wrap:balance]">This week has not closed yet</h1>
          <p className="mt-3 text-muted">
            Collect window: {formatWhen(future.window.collectStart)} → {formatWhen(future.window.collectEnd)}. The book
            closes Sunday at 5:00 PM ET, so there is nothing to grade yet.
          </p>
          <p className="mt-4 text-sm">
            <Link href="/weeks" className="accent-link hit-44 underline-offset-4 hover:underline">
              All weeks
            </Link>
          </p>
        </div>
      );
    }
    if (!empty) notFound();
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-xs uppercase tracking-wide text-muted">Week of {formatShortDay(empty.window.mondayAt)}</p>
        <h1 className="mt-1 font-serif text-4xl text-ink [text-wrap:balance]">No qualifying calls this week</h1>
        <p className="mt-3 text-muted">
          Searched {formatWhen(empty.window.collectStart)} through {formatWhen(empty.window.collectEnd)} for a
          forward-looking post covering the week that names a direction on SPY, QQQ, DIA, the S&P 500, the Nasdaq 100,
          or the Dow. No post read in that search named one, so there is nothing to grade. This is not a 0% grade.
        </p>
        <p className="mt-4 text-sm">
          <Link href="/weeks" className="accent-link hit-44 underline-offset-4 hover:underline">
            All weeks
          </Link>
        </p>
      </div>
    );
  }

  const readouts = Object.values(cohort.readouts);
  const settled = settledReadoutKinds(readouts);
  const pending = pendingReadoutKinds(readouts);
  const closure = pendingClosure(pending, cohort);
  const closedMonday = mondayTapeClosedLine(cohort.mondayAt);
  const tapeKinds = settled;
  const rows = cohort.calls
    .filter((call) => callHasSettledGrade(call.grades))
    .sort((a, b) => {
      const left = matureGrade(a)?.score ?? -1;
      const right = matureGrade(b)?.score ?? -1;
      return right - left || a.handle.localeCompare(b.handle);
    });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <p className="text-sm text-muted">
        <Link href="/weeks" className="hover:underline">
          Weeks
        </Link>
      </p>
      <p className="mt-4 text-xs uppercase tracking-wide text-muted">
        {cohort.dataset === "demo" ? "DEMO" : "Live week"}
        {cohort.isLatest ? " · latest" : ""}
      </p>
      <h1 className="mt-1 font-serif text-4xl text-ink [text-wrap:balance] sm:text-5xl">{cohort.title}</h1>
      {cohort.slug === "2026-10-19" ? (
        <p className="mt-3 max-w-3xl text-lg text-ink/80">{OCT19_X_SCOPE}</p>
      ) : null}
      <p className="mt-3 max-w-3xl text-lg text-ink/80">
        {cohort.slug === "2026-10-19" ? cohort.summary.replace(OCT19_X_SCOPE, "").replace(/\s+/g, " ").trim() : cohort.summary}
      </p>
      <div className="mt-3">
        <CohortWindow
          collectStart={cohort.collectStart}
          collectEnd={cohort.collectEnd}
          mondayAt={cohort.mondayAt}
        />
      </div>
      <div className="mt-6 space-y-4">
        {tapeKinds.length > 0 ? (
          tapeKinds.map((kind) => (
            <QuoteTape key={kind} quotes={cohort.quotes} kind={kind} symbols={gradedSymbols(cohort.calls)} />
          ))
        ) : (
          closedMonday ? (
            <p className="text-sm text-[#9a9aa3]">{closedMonday}</p>
          ) : (
            <p className="text-sm text-muted">Monday&apos;s prices are not on this board until they are graded.</p>
          )
        )}
        <PriceSource />
      </div>
      <div className="mt-4">
        <ReadoutCards slug={cohort.slug} readouts={cohort.readouts} />
      </div>
      <div className="mt-4">
        <NoiseIndex calls={cohort.calls} quotes={cohort.quotes} mondayAt={cohort.mondayAt} />
      </div>

      <section className="mt-10" aria-labelledby="evolution-heading">
        <h2 id="evolution-heading" className="font-serif text-3xl text-ink">
          Settled grades
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          Watchlist and viral posts share this weekly board. Each card shows the Monday noon, Wednesday close, and Friday close prices, plus one GC Scale grade.
        </p>
        {rows.length === 0 || settled.length === 0 ? (
          <div className="mt-4">
            <NothingGraded href={`/weeks/${cohort.slug}/pending`} />
          </div>
        ) : (
          <ul className="mt-4 grid gap-3">
            {rows.map((call) => {
              const readout = call.grades.monday
                ? "monday"
                : call.grades.friday
                  ? "friday"
                  : call.grades.wednesday
                    ? "wednesday"
                    : "monday-gap";
              return (
                <li key={call.id}>
                  <CallCard call={call} readout={readout} quotes={cohort.quotes} />
                </li>
              );
            })}
          </ul>
        )}
        {pending.length > 0 ? (
          <div className="mt-3">
            <PendingSettleLink href={`/weeks/${cohort.slug}/pending`} waiting={pending.length} closure={closure} />
          </div>
        ) : null}
      </section>
    </div>
  );
}
