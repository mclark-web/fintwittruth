import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReadoutBubbles, TimeframePills } from "@/components/call-readouts";
import { GradePill } from "@/components/gc-tube";
import { disputePath } from "@/lib/dispute";
import { formatPct, formatScopeWhen } from "@/lib/format";
import { gcGrade } from "@/lib/grades";
import { READOUT_META } from "@/lib/labels";
import { loadRealCalls } from "@/lib/public-real";
import { REAL_READOUT_META } from "@/lib/real-book";
import type { QuoteView } from "@/lib/queries";
import { quotesForCohort } from "@/lib/quotes";
import { DIRECTION_MAX, EQUITY_TAPE, LEVEL_MAX, READOUTS, SPECIFICITY_MAX, VIX_MAX, type Direction } from "@/lib/scoring";
import { profileUrl } from "@/lib/watchlist";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: `Verified real call ${id}` };
}

function Breakdown({
  directionPoints,
  levelPoints,
  specificityPoints,
  vixPoints,
}: {
  directionPoints: number;
  levelPoints: number;
  specificityPoints: number;
  vixPoints: number;
}) {
  const rows = [
    { label: "Direction vs tape", value: directionPoints, max: DIRECTION_MAX },
    { label: "Levels", value: levelPoints, max: LEVEL_MAX },
    { label: "Specificity", value: specificityPoints, max: SPECIFICITY_MAX },
    { label: "VIX factor", value: vixPoints, max: VIX_MAX },
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
            <div className="h-1.5 rounded-full bg-pine" style={{ width: `${Math.min(100, (row.value / row.max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default async function RealCallPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const loaded = await loadRealCalls();
  const call = loaded.calls.find((item) => item.id === id);
  if (!call) notFound();
  const settled = READOUTS.filter((kind) => call.grades[kind] != null);
  const xProfile = profileUrl(call.handle);
  const direction: Direction | undefined = call.direction === "bullish" || call.direction === "bearish" ? call.direction : undefined;
  let quotes: QuoteView[] = [];
  if (call.cohortSlug) {
    try {
      quotes = quotesForCohort(call.cohortSlug, [...EQUITY_TAPE, "VIX", call.symbol]).map((quote) => ({
        symbol: quote.symbol,
        name: quote.symbol,
        ref: quote.ref,
        mondayOpen: quote.mondayOpen,
        monday: quote.monday,
        wednesday: quote.wednesday,
        friday: quote.friday,
      }));
    } catch {
      quotes = [];
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <p className="text-sm text-muted">
        <Link href="/real" className="hover:underline">
          Verified real calls
        </Link>
        <span aria-hidden> / </span>
        <Link href={`/accounts/${call.handle}`} className="hover:underline">
          @{call.handle}
        </Link>
      </p>
      <article className="panel mt-4 p-5">
        <p className="text-xs uppercase tracking-wide text-pine">{call.label}</p>
        <h1 className="mt-2 font-serif text-3xl text-ink">{call.authorName}</h1>
        <p className="mt-1 text-sm text-muted">
          {xProfile ? (
            <a href={xProfile} className="text-pine underline-offset-4 hover:underline">
              @{call.handle}
            </a>
          ) : (
            <span>@{call.handle}</span>
          )}
          {" · "}
          {formatScopeWhen(call.postedAt)}
          {call.cohortSlug ? ` · readout week ${call.cohortSlug}` : ""}
        </p>
        <p className="mt-4 text-xl leading-snug text-ink">{call.text}</p>
        <p className="mt-3 text-sm text-muted">
          {call.direction} {call.symbol} · {call.horizon} · {call.conviction} conviction
        </p>
        <p className="mt-4 text-sm">
          <a href={call.sourceUrl} className="text-pine underline-offset-4 hover:underline">
            Original post
          </a>
        </p>
        {settled.length > 0 ? (
          <p className="mt-2 text-sm">
            <a
              href={disputePath(call.id)}
              className="text-pine underline-offset-4 hover:underline"
            >
              Dispute this grade
            </a>
          </p>
        ) : null}
      </article>
      <section className="mt-8">
        <h2 className="font-serif text-3xl text-ink">Settled grades</h2>
        <TimeframePills grades={call.grades} />
        <ReadoutBubbles grades={call.grades} quotes={quotes} primary={call.symbol} direction={direction} />
        {settled.length === 0 ? (
          <p className="mt-3 max-w-2xl text-sm text-muted">{call.ungradedReason}</p>
        ) : (
          <ol className="mt-4 grid gap-4 lg:grid-cols-2">
            {settled.map((kind) => {
              const grade = call.grades[kind];
              if (!grade) return null;
              return (
                <li key={kind} className="panel p-4">
                  <p className="text-xs uppercase tracking-wide text-muted">
                    {REAL_READOUT_META[kind as keyof typeof REAL_READOUT_META]?.role ?? READOUT_META[kind].role}
                  </p>
                  <h3 className="font-serif text-2xl text-ink">
                    {REAL_READOUT_META[kind as keyof typeof REAL_READOUT_META]?.label ?? READOUT_META[kind].label}
                  </h3>
                  <p className="mt-2 text-sm text-ink/80">{grade.note}</p>
                  <p className="mt-2 font-mono text-xs text-muted">
                    Tape {formatPct(grade.rawMovePct)} · signed {formatPct(grade.signedMovePct)} · VIX {formatPct(grade.vixMovePct)}
                  </p>
                  <span className="mt-3 inline-flex">
                    <GradePill grade={gcGrade(grade)} />
                  </span>
                  <Breakdown
                    directionPoints={grade.directionPoints}
                    levelPoints={grade.levelPoints}
                    specificityPoints={grade.specificityPoints}
                    vixPoints={grade.vixPoints}
                  />
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
