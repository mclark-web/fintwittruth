import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CallCard } from "@/components/call-card";
import { CohortWindow, Move, NoiseIndex, PriceSource, QuoteTape, ReadoutCards } from "@/components/market";
import { READOUT_META } from "@/lib/labels";
import { getCohort, listCohortSlugs } from "@/lib/queries";
import { READOUTS, isReadoutKind, type ReadoutKind } from "@/lib/scoring";

export async function generateStaticParams() {
  const slugs = await listCohortSlugs();
  return slugs.flatMap((slug) => READOUTS.map((readout) => ({ slug, readout })));
}

export const dynamicParams = false;

function asReadout(value: string): ReadoutKind | null {
  return isReadoutKind(value) ? value : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; readout: string }>;
}): Promise<Metadata> {
  const { slug, readout } = await params;
  const kind = asReadout(readout);
  const cohort = await getCohort(slug);
  if (!cohort || !kind) return { title: "Readout" };
  return {
    title: `${cohort.title} · ${READOUT_META[kind].label}`,
    description: cohort.readouts[kind].narrative,
  };
}

export default async function ReadoutPage({
  params,
}: {
  params: Promise<{ slug: string; readout: string }>;
}) {
  const { slug, readout: readoutParam } = await params;
  const kind = asReadout(readoutParam);
  if (!kind) notFound();
  const cohort = await getCohort(slug);
  if (!cohort) notFound();
  const readout = cohort.readouts[kind];
  const meta = READOUT_META[kind];
  const calls = [...cohort.calls].sort((a, b) => {
    const left = a.grades[kind]?.score ?? -1;
    const right = b.grades[kind]?.score ?? -1;
    if (right !== left) return right - left;
    return a.handle.localeCompare(b.handle);
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <p className="text-sm text-muted">
        <Link href="/weeks" className="hover:underline">
          Weeks
        </Link>
        <span aria-hidden> / </span>
        <Link href={`/weeks/${cohort.slug}`} className="hover:underline">
          {cohort.title}
        </Link>
      </p>
      <p className="mt-4 text-xs uppercase tracking-wide text-muted">
        {meta.role} · {cohort.dataset === "demo" ? "demo" : "live"}
      </p>
      <h1 className="mt-1 font-serif text-4xl text-ink sm:text-5xl">
        {meta.label} board
      </h1>
      <p className="mt-2 font-serif text-2xl text-pine">{cohort.title}</p>
      <div className="mt-3">
        <CohortWindow
          collectStart={cohort.collectStart}
          collectEnd={cohort.collectEnd}
          mondayAt={cohort.mondayAt}
        />
      </div>

      <div className="mt-6">
        <ReadoutCards slug={cohort.slug} readouts={cohort.readouts} active={kind} />
      </div>

      <section className="panel mt-6 p-5">
        <h2 className="font-serif text-2xl text-ink">{readout.status === "published" ? "What the tape did" : "Waiting on the clock"}</h2>
        <p className="mt-2 max-w-3xl text-ink/80">{readout.narrative}</p>
        <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">Conviction-weighted consensus</p>
            <div
              className="mt-2 flex h-3 overflow-hidden rounded-full bg-line"
              role="img"
              aria-label={`${Math.round(readout.consensusBullish * 100)} percent bullish and ${Math.round(readout.consensusBearish * 100)} percent bearish`}
            >
              <div className="bg-bull" style={{ width: `${readout.consensusBullish * 100}%` }} />
              <div className="bg-bear" style={{ width: `${readout.consensusBearish * 100}%` }} />
            </div>
            <p className="mt-2 text-sm text-muted">
              {Math.round(readout.consensusBullish * 100)}% bullish · {Math.round(readout.consensusBearish * 100)}% bearish · crowd {readout.consensusDirection}
            </p>
          </div>
          <p className="font-mono text-sm text-ink">
            {readout.status === "published" ? (
              <>
                {readout.benchmarkSymbol} <Move value={readout.benchmarkMovePct} /> from Friday&apos;s close
                {readout.chadCutoff > 0 ? ` · Chad line ${readout.chadCutoff}/100` : ""}
              </>
            ) : (
              "Prices publish with the grade"
            )}
          </p>
        </div>
      </section>

      {kind === "monday-gap" || kind === "monday" ? (
        <div className="mt-6">
          <NoiseIndex calls={cohort.calls} quotes={cohort.quotes} />
        </div>
      ) : null}

      <div className="mt-6">
        <QuoteTape quotes={cohort.quotes} kind={kind} />
        <PriceSource />
      </div>

      <section className="mt-8" aria-labelledby="calls-heading">
        <h2 id="calls-heading" className="font-serif text-3xl text-ink">
          {calls.length} calls in this cohort
        </h2>
        <p className="mt-2 text-sm text-muted">
          Chad is Accuracy &amp; Discipline: the top 30% of these calls, ties at the cutoff included, and only when the score is also at least 70. Chud is Uncertainty &amp; Doubt: under 70/100. Watchlist and viral posts share this weekly board.
        </p>
        <div className="mt-4 grid gap-4">
          {calls.map((call) => (
            <CallCard key={call.id} call={call} readout={kind} />
          ))}
        </div>
      </section>
    </div>
  );
}
