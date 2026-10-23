import { formatScore } from "@/lib/format";
import { GC_GRADE_LABEL, UNGRADED_HORIZON, gcGrade } from "@/lib/grades";
import { READOUT_META } from "@/lib/labels";
import { CALL_TIMEFRAMES, type CallTimeframe } from "@/lib/board";
import type { QuoteView } from "@/lib/queries";
import type { Direction, ReadoutKind } from "@/lib/scoring";
import { ReadoutBubble } from "./score";

type GradeLike = { score: number } | null | undefined;

const TIMEFRAME_LABEL: Record<CallTimeframe, string> = {
  monday: "Mon noon",
  wednesday: "Wed close",
  friday: "Fri close",
};

function timeframeStep(grade: GradeLike): "open" | "exit" | "strong" | "provisional" | "weak" {
  if (grade == null || !Number.isFinite(grade.score)) return "open";
  if (grade.score <= 0) return "exit";
  return gcGrade({ score: grade.score });
}

function timeframeValue(grade: GradeLike, step: ReturnType<typeof timeframeStep>): string {
  if (step === "open" || grade == null) return UNGRADED_HORIZON;
  if (step === "exit") return "0%";
  return `${formatScore(grade.score)}%`;
}

/** Locked heat glyphs (#20): warm ▲, middle ◆, cold ▼. Ungraded has none. */
const HEAT_GLYPH: Record<ReturnType<typeof timeframeStep>, string> = {
  strong: "▲",
  provisional: "◆",
  weak: "▼",
  exit: "▼",
  open: "",
};

export const EXIT_LEGEND = "0% = EXIT LIQUIDITY";

function timeframeName(kind: CallTimeframe, grade: GradeLike, step: ReturnType<typeof timeframeStep>): string {
  const label = TIMEFRAME_LABEL[kind];
  if (step === "open") return `GC Scale, ${label}: ${UNGRADED_HORIZON}`;
  if (step === "exit") return `GC Scale, ${label}: 0% ${GC_GRADE_LABEL.exit}`;
  return `GC Scale, ${label}: ${timeframeValue(grade, step)} ${GC_GRADE_LABEL[step]}`;
}

/** Same three pills, in the same order, on every call card. Color is warmth, cold is dim grey. */
export function TimeframePills({
  grades,
}: {
  grades: Partial<Record<ReadoutKind, GradeLike>>;
}) {
  const steps = CALL_TIMEFRAMES.map((kind) => timeframeStep(grades[kind]));
  return (
    <>
      <ol className="tf-pills" aria-label="GC Scale by timeframe">
        {CALL_TIMEFRAMES.map((kind, i) => {
          const grade = grades[kind];
          const step = steps[i];
          const name = timeframeName(kind, grade, step);
          const glyph = HEAT_GLYPH[step];
          return (
            <li key={kind} className={`tf-pill tf-${step}`} aria-label={name} title={name}>
              <span className="tf-h">{TIMEFRAME_LABEL[kind]}</span>
              <span className="tf-v">
                {glyph ? (
                  <span className="tf-glyph" aria-hidden>
                    {glyph}
                  </span>
                ) : null}
                {timeframeValue(grade, step)}
              </span>
              {step === "weak" || step === "exit" ? <span className="tf-bar" aria-hidden /> : null}
            </li>
          );
        })}
      </ol>
      {steps.includes("exit") ? <p className="tf-key">{EXIT_LEGEND}</p> : null}
    </>
  );
}

/** Same three price bubbles, in the same order, on every call card. */
export function ReadoutBubbles({
  grades,
  quotes,
  primary,
  direction,
}: {
  grades: Partial<Record<ReadoutKind, unknown>>;
  quotes?: QuoteView[];
  primary?: string;
  direction?: Direction;
}) {
  return (
    <ul className="readout-bubbles">
      {CALL_TIMEFRAMES.map((kind) => {
        const graded = grades[kind] != null;
        return (
          <li key={kind} className="readout-bubble-slot">
            {graded ? (
              <ReadoutBubble kind={kind} quotes={quotes} primary={primary} direction={direction} />
            ) : (
              <span className="readout-bubble">
                <span className="readout-when">{READOUT_META[kind].short}</span>
                <span className="text-[#9a9aa3]">{UNGRADED_HORIZON}</span>
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
