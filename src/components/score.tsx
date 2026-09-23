import Link from "next/link";
import { gcGrade } from "@/lib/grades";
import { initials } from "@/lib/format";
import type { GradeView } from "@/lib/queries";
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
  isChad,
  isChudTerritory,
  rank,
  peerCount,
  digits = 0,
  variant = "stack",
}: {
  score: number;
  badge: number;
  isChad: boolean;
  isChudTerritory: boolean;
  rank?: number;
  peerCount?: number;
  digits?: number;
  variant?: "stack" | "mini";
}) {
  const grade = gcGrade({ score, isChad, isChudTerritory });
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

export function Evolution({
  grades,
  slug,
  active,
}: {
  grades: Record<ReadoutKind, GradeView | null>;
  slug: string;
  active?: ReadoutKind;
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
              className={`block min-w-28 rounded-xl border px-3 py-1.5 text-xs ${
                current ? "border-pine bg-pine/15 text-ink" : "border-line bg-sheet text-ink hover:border-pine"
              }`}
            >
              <span className="block text-[10px] uppercase tracking-wide text-muted">
                {READOUT_META[kind].short}
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
