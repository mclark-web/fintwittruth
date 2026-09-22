import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DirectionChip } from "@/components/score";
import { pendingReadoutKinds, settledReadoutKinds } from "@/lib/board";
import { READOUT_META } from "@/lib/labels";
import { getCohort, listCohortSlugs } from "@/lib/queries";

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
  if (!cohort) return { title: "Pending settle" };
  return {
    title: `${cohort.title} · Pending settle`,
    description: `Calls in ${cohort.title} that stay off the board until a readout settles.`,
  };
}

export default async function CohortPendingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cohort = await getCohort(slug);
  if (!cohort) notFound();
  const readouts = Object.values(cohort.readouts);
  const pending = pendingReadoutKinds(readouts);
  const settled = settledReadoutKinds(readouts);
  const calls = [...cohort.calls].sort((a, b) => a.handle.localeCompare(b.handle));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <p className="text-sm text-muted">
        <Link href="/pending" className="hover:underline">
          Pending settle
        </Link>
        <span aria-hidden> / </span>
        <Link href={`/weeks/${cohort.slug}`} className="hover:underline">
          {cohort.title}
        </Link>
      </p>
      <p className="mt-4 text-xs uppercase tracking-wide text-muted">Off the primary board</p>
      <h1 className="mt-1 font-serif text-4xl text-ink">Pending settle</h1>
      <p className="mt-2 font-serif text-2xl text-pine">{cohort.title}</p>
      <p className="mt-3 max-w-3xl text-muted">
        These calls are in the book. They are not ranked here. A horizon moves onto the{" "}
        <Link href={`/weeks/${cohort.slug}`} className="text-pine underline-offset-4 hover:underline">
          graded board
        </Link>{" "}
        when its tape settles.
      </p>

      {pending.length === 0 ? (
        <p className="panel mt-8 p-5 text-sm text-muted">
          Every readout on this cohort has settled
          {settled.length > 0 ? ` (${settled.map((kind) => READOUT_META[kind].short).join(", ")})` : ""}. The
          grades are on the main board.
        </p>
      ) : (
        <div className="mt-8 grid gap-8">
          {pending.map((kind) => {
            const readout = cohort.readouts[kind];
            const meta = READOUT_META[kind];
            const waiting = calls.filter((call) => call.grades[kind] == null);
            return (
              <section key={kind} aria-labelledby={`pending-${kind}`}>
                <h2 id={`pending-${kind}`} className="font-serif text-3xl text-ink">
                  {meta.label}
                </h2>
                <p className="mt-1 text-sm text-muted">
                  Not graded yet · {meta.role} · off the board until {meta.time}
                </p>
                <p className="mt-3 max-w-3xl text-sm text-ink/80">{readout.narrative}</p>
                <p className="mt-2 text-sm text-muted">
                  {waiting.length} {waiting.length === 1 ? "call is" : "calls are"} waiting. No score, no Chad, no Chud.
                </p>
                <ul className="mt-4 grid gap-3">
                  {waiting.map((call) => (
                    <li key={call.id} className="panel p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/accounts/${call.handle}`} className="font-medium hover:underline">
                          {call.displayName}
                        </Link>
                        <span className="text-sm text-muted">@{call.handle}</span>
                        <DirectionChip direction={call.direction} />
                        <span className="font-mono text-xs text-pine">{call.primary}</span>
                        <span className="text-xs uppercase tracking-wide text-muted">Waiting on the tape</span>
                      </div>
                      <p className="mt-2 text-ink">
                        <Link href={`/calls/${call.id}`} className="hover:underline">
                          {call.body}
                        </Link>
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
