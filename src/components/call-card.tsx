import Link from "next/link";
import { formatWhen } from "@/lib/format";
import type { CallView } from "@/lib/queries";
import type { ReadoutKind } from "@/lib/scoring";
import { Avatar, DirectionChip, Evolution, LevelList, ScoreMark } from "./score";

export function CallCard({ call, readout }: { call: CallView; readout: ReadoutKind }) {
  const grade = call.grades[readout];
  return (
    <article className="panel grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_auto]">
      <div>
        <header className="flex flex-wrap items-center gap-3">
          <Avatar name={call.displayName} accent={call.accent} />
          <div>
            <Link href={`/accounts/${call.handle}`} className="font-medium text-ink hover:underline">
              {call.displayName}
            </Link>
            <p className="text-sm text-muted">
              @{call.handle} · {call.posture}
            </p>
          </div>
          <DirectionChip direction={call.direction} />
          <span className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">
            {call.sentiment === "panic" ? "Panic" : "Melt-up"} · {call.bucket === "viral" ? "Viral" : "Watchlist"}
          </span>
          <span className="rounded-full bg-pine/5 px-2 py-0.5 font-mono text-xs text-pine">{call.primary}</span>
          <span className="text-xs uppercase tracking-wide text-muted">{call.conviction} conviction</span>
        </header>
        <p className="mt-4 max-w-3xl text-lg leading-snug text-ink">{call.body}</p>
        <div className="mt-3">
          <LevelList levels={call.levels} />
        </div>
        <p className="mt-3 text-xs text-muted">
          Posted {formatWhen(call.postedAt)} ·{" "}
          <Link href={`/calls/${call.id}`} className="underline-offset-4 hover:underline">
            Call detail
          </Link>
        </p>
        {grade ? <p className="mt-3 max-w-3xl text-sm text-muted">{grade.note}</p> : null}
        <div className="mt-4">
          <Evolution grades={call.grades} slug={call.cohortSlug} active={readout} />
        </div>
      </div>
      <div className="lg:justify-self-end">
        {grade ? (
          <ScoreMark
            score={grade.score}
            badge={grade.badge}
            isChad={grade.isChad}
            isChudTerritory={grade.isChudTerritory}
            rank={grade.peerRank}
            peerCount={grade.peerCount}
          />
        ) : (
          <div className="min-w-36 rounded-2xl border border-dashed border-line bg-white px-4 py-3">
            <p className="font-serif text-xl text-ink">Not graded yet</p>
            <p className="mt-1 text-sm text-muted">This readout has not settled, so the call is off the board.</p>
            <Link href={`/weeks/${call.cohortSlug}/pending`} className="mt-2 inline-block text-sm text-pine underline-offset-4 hover:underline">
              Pending settle
            </Link>
          </div>
        )}
      </div>
    </article>
  );
}
