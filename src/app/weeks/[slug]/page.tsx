import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CohortWindow, NoiseIndex, PriceSource, QuoteTape, ReadoutCards } from "@/components/market";
import { DirectionChip, PeerChip, ChudChip } from "@/components/score";
import { READOUT_META } from "@/lib/labels";
import { getCohort, listCohortSlugs, matureGrade } from "@/lib/queries";
import { READOUTS } from "@/lib/scoring";

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

  const rows = [...cohort.calls].sort((a, b) => {
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
      <div className="mt-6">
        <QuoteTape quotes={cohort.quotes} kind="latest" />
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
          Same calls, four grades
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          Every row is one post from the Wednesday–Sunday window. The gap, Monday noon, Wednesday, and Friday
          score that post again. Watchlist and viral posts share this board. Nothing new is added midweek.
        </p>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-card">
          <table className="min-w-[860px] w-full text-left text-sm">
            <caption className="sr-only">Grade evolution for {cohort.title}</caption>
            <thead className="bg-white text-xs uppercase tracking-wide text-muted">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  Account
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Call
                </th>
                {READOUTS.map((kind) => (
                  <th key={kind} scope="col" className="px-4 py-3 font-medium">
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
                  </td>
                  {READOUTS.map((kind) => {
                    const grade = call.grades[kind];
                    return (
                      <td key={kind} className="px-4 py-3">
                        {grade ? (
                          <Link href={`/weeks/${cohort.slug}/${kind}`} className="block hover:underline">
                            <span className="font-mono text-xl">
                              {grade.score}
                              <span className="text-xs text-muted">/100</span>
                            </span>
                            <span className="mt-1 flex flex-col items-start gap-1">
                              <span className="text-xs text-muted">Badge {grade.badge}/10</span>
                              {grade.isChad ? <PeerChip isChad /> : null}
                              {grade.isChudTerritory ? <ChudChip /> : null}
                            </span>
                          </Link>
                        ) : (
                          <span className="text-muted">Pending</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
