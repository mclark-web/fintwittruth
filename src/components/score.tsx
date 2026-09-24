import Link from "next/link";
import { gcGrade } from "@/lib/grades";
import { formatPrice, formatSignedPct, initials, moveArrow } from "@/lib/format";
import { predictedReadout, referencePrint } from "@/lib/prints";
import type { GradeView, QuoteView } from "@/lib/queries";
import { READOUTS, type Direction, type ReadoutKind } from "@/lib/scoring";
import { READOUT_META } from "@/lib/labels";
import { GcTube, GradePill } from "./gc-tube";

export function Avatar({ name }: { name: string; accent?: string }) {
  return (
    <span className="av" aria-hidden>
      {initials(name)}
    </span>
  );
}

export function ScoreMark({
  score,
  badge,
  isStrong,
  isWeak,
  rank,
  peerCount,
  digits = 0,
  variant = "stack",
}: {
  score: number;
  badge: number;
  isStrong: boolean;
  isWeak: boolean;
  rank?: number;
  peerCount?: number;
  digits?: number;
  variant?: "stack" | "mini";
}) {
  const grade = gcGrade({ score, isStrong, isWeak });
  if (variant === "mini") {
    return (
      <div className="flex flex-col items-end gap-1.5">
        <GradePill grade={grade} />
        <GcTube score={score} grade={grade} variant="mini" showMeta={false} />
      </div>
    );
  }
  return (
    <div className="min-w-44">
      <GcTube score={score} grade={grade} variant="sidebar" />
      <p className="mt-2 font-mono text-xs text-muted">
        Badge {badge}/10
        {digits > 0 ? ` · ${score.toFixed(digits)}/100` : ` · ${Math.round(score)}/100`}
      </p>
      {rank && peerCount ? (
        <p className="mt-1 text-xs text-muted">
          Rank {rank} of {peerCount}
        </p>
      ) : null}
    </div>
  );
}

export function DirectionChip({ direction }: { direction: "bullish" | "bearish" }) {
  return <span className="direction-tag">{direction}</span>;
}

const STANCE_LABEL = {
  with: "with call",
  against: "against call",
  flat: "flat",
} as const;

export function ReferenceLine({ quotes, primary }: { quotes?: QuoteView[]; primary?: string }) {
  const ref = referencePrint(quotes, primary);
  if (!ref) return null;
  return (
    <p className="call-ref">
      Reference {ref.symbol} (${formatPrice(ref.price)})
    </p>
  );
}

export function SignedMove({
  move,
  stance,
}: {
  move: number;
  stance: "with" | "against" | "flat" | null;
}) {
  const arrow = moveArrow(move);
  const tone = stance === "with" || stance === "against" ? ` readout-move-${stance}` : "";
  return (
    <span className={`readout-move${tone}`}>
      {arrow ? <span aria-hidden="true">{arrow} </span> : null}
      {formatSignedPct(move)}
    </span>
  );
}

export function ReadoutBubble({
  kind,
  quotes,
  primary,
  direction,
}: {
  kind: ReadoutKind;
  quotes?: QuoteView[];
  primary?: string;
  direction?: Direction;
}) {
  const meta = READOUT_META[kind];
  const print = predictedReadout(quotes, primary, kind, direction);
  const stance = print?.stance ?? null;
  return (
    <span className="readout-bubble">
      <span className="readout-when" title={meta.time}>
        {meta.short}
      </span>
      <span className="readout-line">
        <span className="readout-ticker">{print?.symbol ?? primary}</span>
        {print?.price != null ? <span className="readout-px">(${formatPrice(print.price)})</span> : null}
        {print?.move != null ? <SignedMove move={print.move} stance={stance} /> : null}
      </span>
      {stance ? <span className={`stance stance-${stance}`}>{STANCE_LABEL[stance]}</span> : null}
    </span>
  );
}

export function ReportOutTitle({
  kind,
  quotes,
  primary,
  direction,
}: {
  kind: ReadoutKind;
  quotes?: QuoteView[];
  primary?: string;
  direction?: Direction;
}) {
  return <ReadoutBubble kind={kind} quotes={quotes} primary={primary} direction={direction} />;
}

export function Evolution({
  grades,
  slug,
  active,
  quotes,
  primary,
  direction,
}: {
  grades: Record<ReadoutKind, GradeView | null>;
  slug: string;
  active?: ReadoutKind;
  quotes?: QuoteView[];
  primary?: string;
  direction?: Direction;
}) {
  const settled = READOUTS.filter((kind) => grades[kind] != null);
  return (
    <ol className="flex flex-wrap gap-2">
      {settled.map((kind) => {
        const grade = grades[kind];
        if (!grade) return null;
        const current = active === kind;
        const pill = gcGrade(grade);
        return (
          <li key={kind} className="w-full sm:w-auto">
            <Link
              href={`/weeks/${slug}/${kind}`}
              className={`block w-full rounded-xl border px-3 py-1.5 text-xs sm:w-auto sm:min-w-52 ${
                current ? "border-pine bg-[#14171e] text-ink" : "border-line bg-sheet text-ink hover:border-pine"
              }`}
            >
              <span className="block text-xs text-[#9a9aa3]">
                <ReportOutTitle kind={kind} quotes={quotes} primary={primary} direction={direction} />
              </span>
              <span className="mt-1 flex items-center justify-between gap-2">
                <span className="font-mono text-sm">{Math.round(grade.score)}%</span>
                <GradePill grade={pill} />
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

export function LevelList({
  levels,
}: {
  levels: { symbol: string; price: number; role: string }[];
}) {
  if (levels.length === 0) {
    return <p className="text-sm text-muted">No level named.</p>;
  }
  return (
    <ul className="flex flex-wrap gap-2">
      {levels.map((level) => (
        <li
          key={`${level.role}-${level.symbol}-${level.price}`}
          className="rounded-full border border-[rgba(154,154,163,.35)] bg-transparent px-2.5 py-1 font-mono text-xs text-[#c9c9cf]"
        >
          {level.symbol} {level.role} {level.price.toFixed(2)}
        </li>
      ))}
    </ul>
  );
}
