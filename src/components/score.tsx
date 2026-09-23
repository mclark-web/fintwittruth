import Link from "next/link";
import { gcGrade } from "@/lib/grades";
import { initials } from "@/lib/format";
import { callCheckpointLabel } from "@/lib/prints";
import type { GradeView, QuoteView } from "@/lib/queries";
import { READOUTS, type ReadoutKind } from "@/lib/scoring";
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
  const bull = direction === "bullish";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${
        bull ? "bg-bull/15 text-bull" : "bg-bear/15 text-bear"
      }`}
    >
      {direction}
    </span>
  );
}

export function ReportOutTitle({
  kind,
  quotes,
  primary,
}: {
  kind: ReadoutKind;
  quotes?: QuoteView[];
  primary?: string;
}) {
  const label = READOUT_META[kind].short;
  const suffix = callCheckpointLabel(label, quotes, primary, kind).slice(label.length);
  return (
    <>
      <span className="uppercase tracking-wide">{label}</span>
      {suffix ? <span className="font-mono tracking-normal normal-case">{suffix}</span> : null}
    </>
  );
}

export function Evolution({
  grades,
  slug,
  active,
  quotes,
  primary,
}: {
  grades: Record<ReadoutKind, GradeView | null>;
  slug: string;
  active?: ReadoutKind;
  quotes?: QuoteView[];
  primary?: string;
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
          <li key={kind}>
            <Link
              href={`/weeks/${slug}/${kind}`}
              className={`block min-w-36 rounded-xl border px-3 py-1.5 text-xs ${
                current ? "border-pine bg-pine/15 text-ink" : "border-line bg-sheet text-ink hover:border-pine"
              }`}
            >
              <span className="block whitespace-nowrap text-[11px] text-muted">
                <ReportOutTitle kind={kind} quotes={quotes} primary={primary} />
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
          className="rounded-full border border-line bg-sheet px-2.5 py-1 font-mono text-xs text-ink"
        >
          {level.symbol} {level.role} {level.price.toFixed(2)}
        </li>
      ))}
    </ul>
  );
}
