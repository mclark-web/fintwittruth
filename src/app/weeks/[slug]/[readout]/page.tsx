import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PendingSettleLink } from "@/components/board-state";
import { FinTwitBoard } from "@/components/fintwit-board";
import { CheckpointPrints, CohortWindow, Move, ReadoutCards } from "@/components/market";
import { READOUT_META } from "@/lib/labels";
import { pendingReadoutKinds } from "@/lib/board";
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
  const settled = readout.status === "published";
  const pendingCount = pendingReadoutKinds(Object.values(cohort.readouts)).length;
  const calls = settled
    ? [...cohort.calls]
        .filter((call) => call.grades[kind] != null)
        .sort((a, b) => {
          const left = a.grades[kind]?.score ?? -1;
          const right = b.grades[kind]?.score ?? -1;
          if (right !== left) return right - left;
          return a.handle.localeCompare(b.handle);
        })
    : [];

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
      <div className="mt-4">
        <CohortWindow
          collectStart={cohort.collectStart}
          collectEnd={cohort.collectEnd}
          mondayAt={cohort.mondayAt}
        />
      </div>

      <div className="mt-6">
        <ReadoutCards slug={cohort.slug} readouts={cohort.readouts} quotes={cohort.quotes} active={kind} />
      </div>

      <section className="panel mt-6 p-5">
        <p className="text-2xl text-ink">{readout.status === "published" ? "What the tape did" : "Waiting on the clock"}</p>
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
          <div className="font-mono text-sm text-ink">
            {readout.status === "published" ? (
              <>
                <p>
                  {readout.benchmarkSymbol} <Move value={readout.benchmarkMovePct} /> from Friday&apos;s close
                  {readout.strongCutoff > 0 ? ` · STRONG line ${readout.strongCutoff}/100` : ""}
                </p>
                <CheckpointPrints quotes={cohort.quotes} kind={kind} />
              </>
            ) : (
              <p>Prices publish with the grade</p>
            )}
          </div>
        </div>
      </section>

      <section className="mt-8" aria-labelledby="calls-heading">
        <h2 id="calls-heading" className="sr-only">
          {settled ? `${calls.length} graded calls` : `${meta.label} waiting`}
        </h2>
        <p className="mb-4 max-w-3xl text-sm text-muted">
          STRONG is the top 30% of these settled calls, ties at the cutoff included, and only when the score is also at least 70. WEAK is under 70. PROVISIONAL cleared 70 and missed the cut. 0% is EXIT LIQUIDITY. Watchlist and viral posts share this weekly board.
        </p>
        {pendingCount > 0 ? (
          <div className="mb-4">
            <PendingSettleLink href={`/weeks/${cohort.slug}/pending`} waiting={pendingCount} />
          </div>
        ) : null}
        <FinTwitBoard
          kicker={`${meta.role} · ${cohort.dataset === "demo" ? "demo" : "live"}`}
          title={`${meta.label} board`}
          lede={cohort.title}
          quotes={cohort.quotes}
          tapeKind={kind}
          calls={cohort.calls}
          feed={calls}
          readout={kind}
          pendingHref={pendingCount > 0 ? `/weeks/${cohort.slug}/pending` : undefined}
        />
      </section>
    </div>
  );
}
