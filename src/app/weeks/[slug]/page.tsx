import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NothingGraded, PendingSettleLink } from "@/components/board-state";
import { CohortWindow, NoiseIndex, PriceSource, QuoteTape, ReadoutCards } from "@/components/market";
import { GcTube, GradePill } from "@/components/gc-tube";
import { DirectionChip, ReadoutBubble, ReferenceLine } from "@/components/score";
import { gcGrade } from "@/lib/grades";
import { callHasSettledGrade, pendingReadoutKinds, settledReadoutKinds } from "@/lib/board";
import { READOUT_META } from "@/lib/labels";
import { getCohort, listCohortSlugs, matureGrade } from "@/lib/queries";

export async function generateStaticParams() {
  const slugs = await listCohortSlugs();
  return slugs.map((slug) => ({ slug }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const cohort = await getCohort(slug);
  if (!cohort) return { title: "Cohort" };
  return {
    title: cohort.title,
    description: cohort.summary,
  };
}

export default async function CohortPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cohort = await getCohort(slug);
  if (!cohort) notFound();

  const readouts = Object.values(cohort.readouts);
  const settled = settledReadoutKinds(readouts);
  const pending = pendingReadoutKinds(readouts);
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
        {cohort.dataset === "demo" ? "Demo cohort" : "Live cohort"}
        {cohort.isLatest ? " · latest" : ""}
      </p>
      <h1 className="mt-1 font-serif text-4xl text-ink sm:text-5xl">{cohort.title}</h1>
      <p className="mt-3 max-w-3xl text-lg text-ink/80">{cohort.summary}</p>
      <div className="mt-3">
        <CohortWindow
          collectStart={cohort.collectStart}
          collectEnd={cohort.collectEnd}
          mondayAt={cohort.mondayAt}
        />
      </div>
      <div className="mt-6 space-y-4">
        {tapeKinds.length > 0 ? (
          tapeKinds.map((kind) => <QuoteTape key={kind} quotes={cohort.quotes} kind={kind} />)
        ) : (
          <p className="text-sm text-muted">The Monday tape is off this board until the session settles.</p>
        )}
        <PriceSource />
      </div>
      <div className="mt-4">
        <ReadoutCards slug={cohort.slug} readouts={cohort.readouts} />
      </div>
      <div className="mt-4">
        <NoiseIndex calls={cohort.calls} quotes={cohort.quotes} />
      </div>

      <section className="mt-10" aria-labelledby="evolution-heading">
        <h2 id="evolution-heading" className="font-serif text-3xl text-ink">
          Settled grades
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          Rows are calls that already have a settled grade. Watchlist and viral posts share this board. A
          horizon stays off the table until its tape prints.
        </p>
        {rows.length === 0 || settled.length === 0 ? (
          <div className="mt-4">
            <NothingGraded href={`/weeks/${cohort.slug}/pending`} />
          </div>
        ) : (
          <>
          <ul className="mt-4 grid gap-3 min-[820px]:hidden">
            {rows.map((call) => (
              <li key={call.id} className="panel p-4">
                <p className="font-medium text-ink">
                  <Link href={`/accounts/${call.handle}`} className="hover:underline">
                    {call.displayName}
                  </Link>
                </p>
                <p className="text-xs text-[#9a9aa3]">@{call.handle}</p>
                <p className="mt-3 text-ink">
                  <Link href={`/calls/${call.id}`} className="hover:underline">
                    {call.body}
                  </Link>
                </p>
                <p className="mt-2 flex flex-wrap items-center gap-2">
                  <DirectionChip direction={call.direction} />
                  <span className="font-mono text-xs text-pine">{call.primary}</span>
                </p>
                <ReferenceLine quotes={cohort.quotes} primary={call.primary} />
                <div className="mt-3 grid gap-2">
                  {settled.map((kind) => {
                    const grade = call.grades[kind];
                    return (
                      <div key={kind} className="min-w-0">
                        {grade ? (
                          <Link href={`/weeks/${cohort.slug}/${kind}`} className="mt-1 block hover:underline">
                            <ReadoutBubble
                              kind={kind}
                              quotes={cohort.quotes}
                              primary={call.primary}
                              direction={call.direction}
                            />
                            <span className="call-grade mt-1 block">
                              <GcTube score={grade.score} grade={gcGrade(grade)} variant="mini" showMeta={false} />
                            </span>
                            <span className="mt-1 flex flex-wrap items-center gap-2">
                              <span className="font-mono text-sm tabular-nums">{Math.round(grade.score)}%</span>
                              <GradePill grade={gcGrade(grade)} />
                            </span>
                          </Link>
                        ) : (
                          <span className="text-xs text-[#9a9aa3]">Not graded yet</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-4 hidden overflow-x-clip rounded-2xl border border-line bg-card min-[820px]:block">
            <table className="w-full table-fixed text-left text-sm">
              <caption className="sr-only">Settled grades for {cohort.title}</caption>
              <thead className="bg-sheet text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Account
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Call
                  </th>
                  {settled.map((kind) => (
                    <th key={kind} scope="col" className="px-4 py-3 font-medium normal-case tracking-normal">
                      {READOUT_META[kind].short}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((call) => (
                  <tr key={call.id} className="border-t border-line align-top">
                    <th scope="row" className="px-4 py-3 font-medium">
                      <Link href={`/accounts/${call.handle}`} className="hover:underline">
                        {call.displayName}
                      </Link>
                      <span className="mt-1 block text-xs font-normal text-muted">@{call.handle}</span>
                    </th>
                    <td className="px-4 py-3">
                      <Link href={`/calls/${call.id}`} className="hover:underline">
                        {call.body}
                      </Link>
                      <span className="mt-2 flex flex-wrap items-center gap-2">
                        <DirectionChip direction={call.direction} />
                        <span className="font-mono text-xs text-pine">{call.primary}</span>
                      </span>
                      <ReferenceLine quotes={cohort.quotes} primary={call.primary} />
                    </td>
                    {settled.map((kind) => {
                      const grade = call.grades[kind];
                      return (
                        <td key={kind} className="px-4 py-3">
                          {grade ? (
                            <Link href={`/weeks/${cohort.slug}/${kind}`} className="block hover:underline">
                              <ReadoutBubble
                                kind={kind}
                                quotes={cohort.quotes}
                                primary={call.primary}
                                direction={call.direction}
                              />
                              <span className="mt-1 block max-w-32">
                                <GcTube score={grade.score} grade={gcGrade(grade)} variant="mini" showMeta={false} />
                              </span>
                              <span className="mt-1 flex flex-col items-start gap-1">
                                <span className="font-mono text-sm">{Math.round(grade.score)}%</span>
                                <GradePill grade={gcGrade(grade)} />
                              </span>
                            </Link>
                          ) : (
                            <span className="text-muted">Not graded yet</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
        {pending.length > 0 ? (
          <div className="mt-3">
            <PendingSettleLink href={`/weeks/${cohort.slug}/pending`} waiting={pending.length} />
          </div>
        ) : null}
      </section>
    </div>
  );
}
