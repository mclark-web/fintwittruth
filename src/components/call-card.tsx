import Link from "next/link";
import { callRollupScore } from "@/lib/board";
import { ReadoutBubbles, TimeframePills } from "@/components/call-readouts";
import { disputePath } from "@/lib/dispute";
import { formatScopeWhen, formatScore } from "@/lib/format";
import { gcGrade } from "@/lib/grades";
import type { CallView, QuoteView } from "@/lib/queries";
import type { ReadoutKind } from "@/lib/scoring";
import { GradePill } from "./gc-tube";
import { Avatar, DirectionChip } from "./score";

export function CallCard({
  call,
  quotes,
  clampQuote = false,
}: {
  call: CallView;
  readout?: ReadoutKind;
  quotes?: QuoteView[];
  clampQuote?: boolean;
}) {
  const rollup = callRollupScore(call.grades);
  const pill = rollup == null ? null : gcGrade({ score: rollup });

  return (
    <article className="panel p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={call.displayName} />
          <div className="min-w-0 [overflow-wrap:anywhere]">
            <Link href={`/accounts/${call.handle}`} className="font-medium text-ink hover:underline">
              {call.displayName} <span className="font-normal text-muted">@{call.handle}</span>
            </Link>
            <p className="mt-0.5 text-xs text-[#c9c9cf]">{formatScopeWhen(call.postedAt)}</p>
          </div>
        </div>
        {rollup != null && pill ? (
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className="font-mono text-2xl text-ink">
              {formatScore(rollup)}
              <span className="text-sm text-muted">%</span>
            </span>
            <GradePill grade={pill} />
          </div>
        ) : (
          <span className="text-xs text-[#9a9aa3]">Not graded yet</span>
        )}
      </div>
      <p className={`mt-3 text-[15px] leading-relaxed text-ink ${clampQuote ? "line-clamp-2" : ""}`}>“{call.body}”</p>
      <p className="mt-3 flex flex-wrap items-center gap-2">
        <DirectionChip direction={call.direction} />
        <span className="font-mono text-xs text-[#c9c9cf]">
          {call.tickers.length > 0 ? call.tickers.join(", ") : "No ticker named"}
        </span>
      </p>
      <TimeframePills grades={call.grades} />
      <ReadoutBubbles grades={call.grades} quotes={quotes} primary={call.primary} direction={call.direction} />
      <p className="post-meta">
        {call.sourceUrl ? (
          <a href={call.sourceUrl} className="accent-link hit-44 underline-offset-4 hover:underline">
            Source
          </a>
        ) : null}
        <Link href={`/calls/${call.id}`} className="accent-link hit-44 underline-offset-4 hover:underline">
          Call detail
        </Link>
        {call.sourceUrl && rollup != null ? (
          <a href={disputePath(call.id)} className="accent-link hit-44 underline-offset-4 hover:underline">
            Dispute this grade
          </a>
        ) : null}
      </p>
    </article>
  );
}
