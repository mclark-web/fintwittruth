import Link from "next/link";
import { GradePill } from "@/components/gc-tube";
import { disputeHref } from "@/lib/dispute";
import { formatWhen } from "@/lib/format";
import { gcGrade } from "@/lib/grades";
import { READOUT_META } from "@/lib/labels";
import { REAL_READOUT_META, type RealCallView } from "@/lib/real-book";
import { READOUTS } from "@/lib/scoring";
import { profileUrl } from "@/lib/watchlist";

export function RealCallCard({ call }: { call: RealCallView }) {
  const settled = READOUTS.filter((kind) => call.grades[kind] != null);
  return (
    <article className="panel p-5">
      <p className="text-xs uppercase tracking-wide text-pine">{call.label}</p>
      <h2 className="mt-2 text-xl text-ink">
        <Link href={`/accounts/${call.handle}`} className="hover:underline">
          {call.authorName} <span className="font-normal text-muted">@{call.handle}</span>
        </Link>
      </h2>
      <p className="mt-1 text-xs text-muted">
        {formatWhen(call.postedAt)}
        {call.cohortSlug ? ` · readout week ${call.cohortSlug}` : ""} · {call.horizon}
      </p>
      <p className="mt-3 text-[15px] leading-relaxed text-ink">“{call.text}”</p>
      <p className="mt-3 text-sm text-muted">
        {call.direction} {call.symbol} · {call.conviction} conviction
        {call.levels.length > 0
          ? ` · ${call.levels.map((level) => `${level.role} ${level.price}`).join(", ")}`
          : ""}
      </p>
      {settled.length > 0 ? (
        <ol className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {settled.map((kind) => {
            const grade = call.grades[kind];
            if (!grade) return null;
            return (
              <li key={kind} className="rounded-xl bg-sheet px-3 py-2">
                <p className="text-xs uppercase text-muted">{REAL_READOUT_META[kind as keyof typeof REAL_READOUT_META]?.label ?? READOUT_META[kind].label}</p>
                <p className="font-mono text-2xl">
                  {grade.score}
                  <span className="text-sm text-muted">/100</span>
                </p>
                <span className="mt-1 inline-flex">
                  <GradePill grade={gcGrade(grade)} />
                </span>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="mt-4 text-sm text-muted">{call.ungradedReason}</p>
      )}
      <p className="post-meta">
        <a href={call.sourceUrl} className="underline-offset-4 hover:text-ink hover:underline">
          Original post
        </a>
        <a href={profileUrl(call.handle)} className="underline-offset-4 hover:text-ink hover:underline">
          Profile on X
        </a>
        <Link href={`/real/${call.id}`} className="underline-offset-4 hover:text-ink hover:underline">
          Call detail
        </Link>
        {settled.length > 0 ? (
          <a
            href={disputeHref({ id: call.id, handle: call.handle, sourceUrl: call.sourceUrl })}
            className="underline-offset-4 hover:text-ink hover:underline"
          >
            Dispute this grade
          </a>
        ) : null}
      </p>
    </article>
  );
}
