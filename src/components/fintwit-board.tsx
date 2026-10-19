import Link from "next/link";
import type { ReactNode } from "react";
import { CallCard } from "@/components/call-card";
import { GcTube } from "@/components/gc-tube";
import { NoiseIndex, QuoteTape } from "@/components/market";
import { closedHorizonNote, gcBoardGrade } from "@/lib/grades";
import { GC_SCALE_BANDS } from "@/lib/labels";
import { gradedSymbols } from "@/lib/prints";
import type { CallView, QuoteView } from "@/lib/queries";
import type { ReadoutKind } from "@/lib/scoring";

export function FinTwitBoard({
  title,
  lede,
  quotes,
  calls,
  feed,
  readout,
  toolbar,
  pendingHref,
  marketClosed = false,
  mondayAt,
  titleHeading = "h1",
}: {
  kicker?: string;
  title: string;
  lede: string;
  quotes: QuoteView[];
  tapeKind: ReadoutKind;
  calls: CallView[];
  feed?: CallView[];
  readout: ReadoutKind;
  toolbar?: ReactNode;
  pendingHref?: string;
  marketClosed?: boolean;
  mondayAt?: Date;
  titleHeading?: "h1" | "p";
}) {
  const graded = (feed ?? calls).filter((call) => call.grades[readout] != null);
  const horizonGraded = calls.some((call) => call.grades[readout] != null);
  const calibration = gcBoardGrade(
    calls.filter((call) => call.grades[readout] != null).map((call) => call.grades[readout]?.score ?? 0),
  );
  const boardGrade = calibration.ungraded ? "exit" : calibration.grade;
  const ranked = [...graded].sort((a, b) => {
    const left = a.grades[readout]?.score ?? -1;
    const right = b.grades[readout]?.score ?? -1;
    return right - left || a.handle.localeCompare(b.handle);
  });

  return (
    <div>
      <div>
        {titleHeading === "p" ? <p className="ft-hero-title">{title}</p> : <h1>{title}</h1>}
        <p className="mt-2 max-w-[48ch] text-sm leading-relaxed text-muted">{lede}</p>
      </div>

      <div className="panel mt-4 p-4">
        <h2 className="text-sm font-semibold text-ink">Latest checkpoint</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">{GC_SCALE_BANDS}</p>
        <div className="mt-4 max-w-sm">
          <GcTube
            score={calibration.fill}
            grade={boardGrade}
            variant="sidebar"
            compactMeta
            ungraded={!horizonGraded}
          />
        </div>
      </div>

      {toolbar}

      <div className="mt-4 flex flex-col gap-3.5">
        {ranked.length === 0 ? (
          calls.some((call) => call.grades[readout] != null) ? (
            <div className="panel p-5">
              <h2 className="text-xl text-ink">No posts in this filter</h2>
              <p className="mt-2 text-sm text-muted">This checkpoint is graded. None of those calls match the filter.</p>
            </div>
          ) : (
            <div className="panel p-5">
              <h2 className="text-xl text-ink">Nothing graded yet</h2>
              <p className={`mt-2 text-sm ${marketClosed ? "text-[#9a9aa3]" : "text-muted"}`}>
                {marketClosed
                  ? closedHorizonNote(true)
                  : "This checkpoint has not been graded, so there is no score yet."}
              </p>
              {pendingHref ? (
                <p className="mt-3 text-sm">
                  <Link href={pendingHref} className="accent-link underline-offset-4 hover:underline">
                    Not graded yet
                  </Link>
                </p>
              ) : (
                <div className="mt-4 max-w-sm">
                  <GcTube score={0} grade="exit" variant="sidebar" compactMeta ungraded />
                </div>
              )}
            </div>
          )
        ) : (
          ranked.map((call) => <CallCard key={call.id} call={call} readout={readout} quotes={quotes} />)
        )}
      </div>

      {calls.length >= 10 ? <div className="mt-4"><NoiseIndex calls={calls} quotes={quotes} compact mondayAt={mondayAt} /></div> : null}

      <details className="panel mt-4 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-ink">Market move used for grading</summary>
        <div className="mt-3">
          <QuoteTape quotes={quotes} kind={readout} variant="scoreboard" caption="Market move used for grading" symbols={gradedSymbols(calls)} />
        </div>
      </details>
    </div>
  );
}
