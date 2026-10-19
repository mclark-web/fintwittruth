import Link from "next/link";
import { disputePath } from "@/lib/dispute";
import { formatPrice, formatSignedPct, formatWhen } from "@/lib/format";
import { gcGrade } from "@/lib/grades";
import { READOUT_META } from "@/lib/labels";
import { predictedReadout } from "@/lib/prints";
import type { CallView, QuoteView } from "@/lib/queries";
import type { ReadoutKind } from "@/lib/scoring";
import { GradePill } from "./gc-tube";
import { Avatar, DirectionChip } from "./score";

/** Headline noon grade, then the two later closes. Monday open stays off the card. */
const CARD_CHECKPOINTS: ReadoutKind[] = ["monday", "wednesday", "friday"];

export function CallCard({
  call,
  readout,
  quotes,
  clampQuote = false,
}: {
  call: CallView;
  readout: ReadoutKind;
  quotes?: QuoteView[];
  clampQuote?: boolean;
}) {
  const grade = call.grades[readout] ?? call.grades.monday ?? call.grades.wednesday ?? call.grades.friday;
  const pill = grade ? gcGrade(grade) : null;

  return (
    <article className="panel p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={call.displayName} />
          <div className="min-w-0">
            <Link href={`/accounts/${call.handle}`} className="font-medium text-ink hover:underline">
              {call.displayName} <span className="font-normal text-muted">@{call.handle}</span>
            </Link>
            <p className="mt-0.5 text-xs text-[#c9c9cf]">
              {formatWhen(call.postedAt)}
              {call.dataset === "demo" ? " · DEMO" : " · verified"}
            </p>
          </div>
        </div>
        {grade && pill ? (
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className="font-mono text-2xl text-ink">
              {Math.round(grade.score)}
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
        <span className="font-mono text-xs text-[#c9c9cf]">{call.primary}</span>
      </p>
      <ul className="checkpoint-bubbles mt-3">
        {CARD_CHECKPOINTS.map((kind) => (
          <li key={kind}>
            <CheckpointBubble call={call} kind={kind} quotes={quotes} />
          </li>
        ))}
      </ul>
      <p className="post-meta">
        {call.sourceUrl ? (
          <a href={call.sourceUrl} className="accent-link hit-44 underline-offset-4 hover:underline">
            Source
          </a>
        ) : null}
        <Link href={`/calls/${call.id}`} className="accent-link underline-offset-4 hover:underline">
          Call detail
        </Link>
        {call.dataset !== "demo" && call.sourceUrl && grade ? (
          <a href={disputePath(call.id)} className="accent-link hit-44 underline-offset-4 hover:underline">
            Dispute this grade
          </a>
        ) : null}
      </p>
    </article>
  );
}

function CheckpointBubble({
  call,
  kind,
  quotes,
}: {
  call: CallView;
  kind: ReadoutKind;
  quotes?: QuoteView[];
}) {
  const graded = call.grades[kind] != null;
  const print = predictedReadout(quotes, call.primary, kind, call.direction);
  const meta = READOUT_META[kind];
  if (!graded || !print || print.price == null || print.move == null) {
    return (
      <span className="checkpoint-bubble">
        <span>{meta.short}</span>
        <span className="text-[#9a9aa3]">Not graded yet</span>
      </span>
    );
  }
  const tone = print.stance === "with" ? "right" : print.stance === "against" ? "wrong" : "flat";
  return (
    <span className={`checkpoint-bubble checkpoint-bubble-${tone}`}>
      <span className="checkpoint-when">{meta.short}</span>
      <span>
        {print.symbol} (${formatPrice(print.price)}) {formatSignedPct(print.move)}
      </span>
    </span>
  );
}
