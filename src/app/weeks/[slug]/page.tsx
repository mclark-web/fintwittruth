import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NothingGraded, PendingSettleLink } from "@/components/board-state";
import { CallCard } from "@/components/call-card";
import { CohortWindow, NoiseIndex, PriceSource, QuoteTape, ReadoutCards } from "@/components/market";
import { GcTube } from "@/components/gc-tube";
import { mondayTapeClosedLine, pendingClosure } from "@/lib/grades";
import { callHasSettledGrade, pendingReadoutKinds, settledReadoutKinds } from "@/lib/board";
import { closedPendingLiveWeeks, emptyLiveWeeks, futureLiveWeek, resolveLiveWeek } from "@/lib/empty-weeks";
import { formatScopeWhen, formatShortDay } from "@/lib/format";
import { gradedSymbols } from "@/lib/prints";
import { getCohort, listCohortSlugs, matureGrade } from "@/lib/queries";
import { OCT19_X_SCOPE, emptyWeekSearchLine } from "@/lib/search-scope";

/** Re-read the clock so a future week stops saying it is open after Sunday 5:00 PM ET. */
export const revalidate = 60;

export async function generateStaticParams() {
  const slugs = await listCohortSlugs();
  const future = futureLiveWeek();
  return [
    ...slugs,
    ...emptyLiveWeeks().map((week) => week.slug),
    ...closedPendingLiveWeeks().map((week) => week.slug),
    ...(future ? [future.slug] : []),
  ].map((slug) => ({
    slug,
  }));
}

/** Unknown slugs render on request. Only collect Mondays in the recorded span return 200. */
export const dynamicParams = true;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const cohort = await getCohort(slug);
  if (!cohort) {
    const resolved = resolveLiveWeek(slug);
    if (resolved.status === 200 && resolved.kind === "empty") {
      return { title: `Week of ${formatShortDay(resolved.week.window.mondayAt)}: no qualifying calls` };
    }
    if (resolved.status === 200 && resolved.kind === "future") {
      return { title: `Week of ${formatShortDay(resolved.week.window.mondayAt)}: not closed yet` };
    }
    if (resolved.status === 200 && resolved.kind === "closed") {
      return { title: `Week of ${formatShortDay(resolved.week.window.mondayAt)}: closed, not graded yet` };
    }
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
    const resolved = resolveLiveWeek(slug);
    if (resolved.status === 404) notFound();
    if (resolved.kind === "future") {
      return (
        <div className="mx-auto max-w-3xl px-4 py-10">
          <p className="text-xs uppercase tracking-wide text-muted">Week of {formatShortDay(resolved.week.window.mondayAt)}</p>
          <h1 className="mt-1 font-serif text-4xl text-ink [text-wrap:balance]">This week has not closed yet</h1>
          <p className="mt-3 text-muted">
            Collect window: {formatScopeWhen(resolved.week.window.collectStart)} through{" "}
            {formatScopeWhen(resolved.week.window.collectEnd)}. The book closes Sunday at 5:00 PM ET, so there is
            nothing to grade yet.
          </p>
          <p className="mt-4 text-sm">
            <Link href="/weeks" className="accent-link hit-44 underline-offset-4 hover:underline">
              All weeks
            </Link>
          </p>
        </div>
      );
    }
    if (resolved.kind === "closed") {
      return (
        <div className="mx-auto max-w-3xl px-4 py-10">
          <p className="text-xs uppercase tracking-wide text-muted">Week of {formatShortDay(resolved.week.window.mondayAt)}</p>
          <h1 className="mt-1 font-serif text-4xl text-ink [text-wrap:balance]">Closed, not graded yet</h1>
          <p className="mt-3 text-muted">
            Collect window: {formatScopeWhen(resolved.week.window.collectStart)} through{" "}
            {formatScopeWhen(resolved.week.window.collectEnd)}. Calls for this week are not loaded yet, so there is no
            grade yet.
          </p>
          <p className="mt-4 text-sm">
            <Link href="/weeks" className="accent-link hit-44 underline-offset-4 hover:underline">
              All weeks
            </Link>
          </p>
        </div>
      );
    }
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-xs uppercase tracking-wide text-muted">Week of {formatShortDay(resolved.week.window.mondayAt)}</p>
        <h1 className="mt-1 font-serif text-4xl text-ink [text-wrap:balance]">No qualifying calls this week</h1>
        <p className="mt-3 text-muted">{emptyWeekSearchLine(resolved.week.window, resolved.week.coverage)}</p>
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
