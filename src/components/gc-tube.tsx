import { gcFill, GC_GRADE_LABEL, UNGRADED_HORIZON, UNGRADED_HORIZON_ARIA, type GcGrade } from "@/lib/grades";
import { GC_FACTOR } from "@/lib/labels";

export function GradePill({ grade }: { grade: GcGrade }) {
  return (
    <span className={`gc-grade-tag ${grade}`} data-grade={grade}>
      {GC_GRADE_LABEL[grade]}
    </span>
  );
}

function Liquid({ rich }: { rich: boolean }) {
  return (
    <div className="gc-liquid">
      <div className="gc-liquid-core" />
      <div className="gc-swirl">
        {rich ? (
          <>
            <div className="vortex" />
            <div className="vortex vortex-b" />
            <div className="tex" />
            <div className="tex-b" />
            <div className="tex-c" />
            <div className="caustic" />
            <div className="caustic caustic-b" />
            <div className="orb orb-a" />
            <div className="orb orb-b" />
            <div className="orb orb-c" />
          </>
        ) : (
          <div className="tex" />
        )}
      </div>
      <div className="gc-liquid-sheen" />
      {rich ? <div className="gc-wave" /> : null}
      <div className="gc-meniscus" />
    </div>
  );
}

export function GcTube({
  score,
  grade,
  variant = "sidebar",
  showMeta = true,
  compactMeta = false,
  ungraded = false,
}: {
  score: number | null | undefined;
  grade: GcGrade;
  variant?: "hero" | "mini" | "sidebar" | "card" | "inline";
  showMeta?: boolean;
  compactMeta?: boolean;
  ungraded?: boolean;
}) {
  const empty = ungraded || grade === "exit" || gcFill(score) <= 0;
  const fill = empty ? 0 : gcFill(score);
  const shown = Math.round(fill);
  const rich = variant !== "mini" && variant !== "inline";
  const label = ungraded
    ? UNGRADED_HORIZON_ARIA
    : `${shown}% ${GC_FACTOR}, ${GC_GRADE_LABEL[empty ? "exit" : grade]}`;

  return (
    <div
      className={`gc-scale is-${variant}${empty ? " is-empty" : ""}${shown >= 100 ? " is-full" : ""}`}
      style={{
        ["--gc-fill" as string]: `${shown}%`,
        width: variant === "mini" ? 128 : undefined,
      }}
      role="img"
      aria-label={label}
    >
      <div className="gc-tube-slot" aria-hidden>
        {rich ? <div className="gc-bloom" /> : null}
        <div className="gc-tube">
          <Liquid rich={rich} />
        </div>
      </div>
      {showMeta ? (
        <div
          className="gc-meta"
          style={
            compactMeta
              ? { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" }
              : undefined
          }
        >
          <div className="gc-label">{GC_FACTOR}</div>
          <div className="gc-pct" style={compactMeta ? { fontSize: 18 } : undefined}>
            {ungraded ? "—" : `${shown}%`}
          </div>
          {ungraded ? (
            <span className="text-xs text-[#9a9aa3]">{UNGRADED_HORIZON}</span>
          ) : (
            <GradePill grade={empty ? "exit" : grade} />
          )}
        </div>
      ) : null}
    </div>
  );
}
