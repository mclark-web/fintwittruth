import Link from "next/link";
import { initials } from "@/lib/format";
import type { GradeView } from "@/lib/queries";
import { READOUTS, type ReadoutKind } from "@/lib/scoring";
import { CHAD_MEANING, CHUD_MEANING, READOUT_META } from "@/lib/labels";

export function Avatar({ name, accent }: { name: string; accent: string }) {
  return (
    <span
      className="grid h-10 w-10 shrink-0 place-items-center rounded-full font-mono text-xs font-medium text-white"
      style={{ backgroundColor: accent }}
      aria-hidden
    >
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
}: {
  score: number;
  badge: number;
  isChad: boolean;
  isChudTerritory: boolean;
  rank?: number;
  peerCount?: number;
  digits?: number;
}) {
  return (
    <div className="min-w-36 rounded-2xl border border-line bg-white px-4 py-3">
      <p className="font-mono text-4xl leading-none tracking-tight text-ink">
        {score.toFixed(digits)}
        <span className="text-base text-muted">/100</span>
      </p>
      <p className="mt-2 font-mono text-sm text-ink">
        Badge {badge}
        <span className="text-muted">/10</span>
        <span className="ml-1 text-xs text-muted">
          {badge === 1 ? CHUD_MEANING : badge === 10 ? CHAD_MEANING : ""}
        </span>
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <PeerChip isChad={isChad} />
        {isChudTerritory ? <ChudChip /> : null}
      </div>
      {rank && peerCount ? (
        <p className="mt-2 text-xs text-muted">
          Rank {rank} of {peerCount}
        </p>
      ) : null}
    </div>
  );
}

export function PeerChip({ isChad }: { isChad: boolean }) {
  if (isChad) {
    return (
      <span className="rounded-full bg-chad-wash px-2 py-0.5 text-xs font-semibold text-chad" title={CHAD_MEANING}>
        Chad
        <span className="font-normal"> · {CHAD_MEANING}</span>
      </span>
    );
  }
  return (
    <span className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">Outside Chad cut</span>
  );
}

export function ChudChip() {
  return (
    <span className="rounded-full bg-chud-wash px-2 py-0.5 text-xs font-semibold text-chud" title={CHUD_MEANING}>
      Chud
      <span className="font-normal"> · {CHUD_MEANING}</span>
    </span>
  );
}

export function DirectionChip({ direction }: { direction: "bullish" | "bearish" }) {
  const bull = direction === "bullish";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${
        bull ? "bg-emerald-50 text-bull" : "bg-rose-50 text-bear"
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
        return (
          <li key={kind}>
            <Link
              href={`/weeks/${slug}/${kind}`}
              className={`block rounded-xl border px-3 py-1.5 text-xs ${
                current ? "border-pine bg-pine text-lime" : "border-line bg-white text-ink hover:border-pine"
              }`}
            >
              <span className="block text-[10px] uppercase tracking-wide opacity-80">
                {READOUT_META[kind].short}
              </span>
              <span className="font-mono text-sm">
                {grade.score}
                <span className="opacity-70">/100</span>
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
          className="rounded-full border border-line bg-white px-2.5 py-1 font-mono text-xs text-ink"
        >
          {level.symbol} {level.role} {level.price.toFixed(2)}
        </li>
      ))}
    </ul>
  );
}
