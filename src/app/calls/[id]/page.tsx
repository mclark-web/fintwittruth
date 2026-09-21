import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PricePath } from "@/components/market";
import { Avatar, DirectionChip, LevelList, ScoreMark } from "@/components/score";
import { formatPct, formatWhen } from "@/lib/format";
import { READOUT_META } from "@/lib/labels";
import { getCall, listCallIds } from "@/lib/queries";
import { DIRECTION_MAX, LEVEL_MAX, SPECIFICITY_MAX, type ReadoutKind } from "@/lib/scoring";

export async function generateStaticParams() {
  const ids = await listCallIds();
  return ids.map((id) => ({ id }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const result = await getCall(id);
  if (!result) return { title: "Call" };
  return {
    title: `${result.call.displayName} on ${result.call.primary}`,
    description: result.call.body,
  };
}

function Breakdown({
  directionPoints,
  levelPoints,
  specificityPoints,
}: {
  directionPoints: number;
  levelPoints: number;
  specificityPoints: number;
}) {
  const rows = [
    { label: "Direction", value: directionPoints, max: DIRECTION_MAX },
    { label: "Levels", value: levelPoints, max: LEVEL_MAX },
    { label: "Specificity", value: specificityPoints, max: SPECIFICITY_MAX },
  ];
  return (
    <ul className="mt-3 grid gap-2">
      {rows.map((row) => (
        <li key={row.label}>
          <div className="flex justify-between text-xs text-muted">
            <span>{row.label}</span>
            <span className="font-mono">
              {row.value}/{row.max}
            </span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-line">
            <div
              className="h-1.5 rounded-full bg-pine"
              style={{ width: `${Math.min(100, (row.value / row.max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default async function CallPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getCall(id);
  if (!result || !result.cohort) notFound();
  const { call, cohort } = result;
  const quote = cohort.quotes.find((item) => item.symbol === call.primary) ?? cohort.quotes[0];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <p className="text-sm text-muted">
        <Link href={`/weeks/${cohort.slug}`} className="hover:underline">
          {cohort.title}
        </Link>
        <span aria-hidden> / </span>
        <Link href={`/accounts/${call.handle}`} className="hover:underline">
          @{call.handle}
        </Link>
      </p>
      <article className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="panel p-5">
          <p className="text-xs uppercase tracking-wide text-muted">Demo call</p>
          <header className="mt-3 flex flex-wrap items-center gap-3">
            <Avatar name={call.displayName} accent={call.accent} />
            <div>
              <h1 className="font-serif text-3xl text-ink">{call.displayName}</h1>
              <p className="text-sm text-muted">
                @{call.handle} · {call.posture}
              </p>
            </div>
          </header>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <DirectionChip direction={call.direction} />
            <span className="font-mono text-xs text-pine">{call.primary}</span>
            <span className="text-xs uppercase tracking-wide text-muted">{call.conviction} conviction</span>
          </div>
          <p className="mt-4 text-xl leading-snug text-ink">{call.body}</p>
          <div className="mt-4">
            <LevelList levels={call.levels} />
          </div>
          {call.tickers.length > 0 ? (
            <p className="mt-3 text-sm text-muted">Named tickers: {call.tickers.join(", ")}</p>
          ) : (
            <p className="mt-3 text-sm text-muted">No ticker named. Specificity stays at the floor.</p>
          )}
          <p className="mt-3 text-xs text-muted">Posted {formatWhen(call.postedAt)} inside the collect window.</p>
        </div>
        <div className="panel p-5">
          {quote ? <PricePath quote={quote} /> : null}
        </div>
      </article>

      <section className="mt-8" aria-labelledby="grades-heading">
        <h2 id="grades-heading" className="font-serif text-3xl text-ink">
          Grade evolution
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          The words do not change. Monday, Wednesday, and Friday each rescore this call against the price path
          from the Sunday reference.
        </p>
        <ol className="mt-4 grid gap-4 lg:grid-cols-3">
          {(["monday", "wednesday", "friday"] as const satisfies readonly ReadoutKind[]).map((kind) => {
            const grade = call.grades[kind];
            const meta = READOUT_META[kind];
            const readout = cohort.readouts[kind];
            return (
              <li key={kind} className="panel p-4">
                <p className="text-[11px] uppercase tracking-wide text-muted">{meta.role}</p>
                <h3 className="font-serif text-2xl text-ink">{meta.label}</h3>
                <p className="text-xs text-muted">{formatWhen(readout.at)}</p>
                {grade ? (
                  <>
                    <div className="mt-3">
                      <ScoreMark
                        score={grade.score}
                        badge={grade.badge}
                        isChad={grade.isChad}
                        isChudTerritory={grade.isChudTerritory}
                        rank={grade.peerRank}
                        peerCount={grade.peerCount}
                      />
                    </div>
                    <p className="mt-3 text-sm text-ink/80">{grade.note}</p>
                    <p className="mt-2 font-mono text-xs text-muted">
                      Symbol move {formatPct(grade.rawMovePct)} · signed {formatPct(grade.signedMovePct)}
                    </p>
                    <Breakdown
                      directionPoints={grade.directionPoints}
                      levelPoints={grade.levelPoints}
                      specificityPoints={grade.specificityPoints}
                    />
                    <Link href={`/weeks/${cohort.slug}/${kind}`} className="mt-3 inline-block text-sm text-pine underline-offset-4 hover:underline">
                      Open the {meta.label} board
                    </Link>
                  </>
                ) : (
                  <p className="mt-3 text-sm text-muted">{readout.narrative}</p>
                )}
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
