import Link from "next/link";
import type { ReactNode } from "react";
import { CallCard } from "@/components/call-card";
import { ExitLiquidity, GcTube } from "@/components/gc-tube";
import { NoiseIndex, QuoteTape } from "@/components/market";
import { gcBoardGrade, gcGrade } from "@/lib/grades";
import { GC_FACTOR } from "@/lib/labels";
import type { CallView, QuoteView } from "@/lib/queries";
import type { ReadoutKind } from "@/lib/scoring";

export function FinTwitBoard({
  kicker = "Sector · FinTwit",
  title,
  lede,
  quotes,
  tapeKind,
  calls,
  feed,
  readout,
  toolbar,
  pendingHref,
  exitDetail,
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
  exitDetail?: string;
}) {
  const graded = (feed ?? calls).filter((call) => call.grades[readout] != null);
  const calibration = gcBoardGrade(
    calls.filter((call) => call.grades[readout] != null).map((call) => call.grades[readout]?.score ?? 0),
  );
  const ranked = [...graded].sort((a, b) => {
    const left = a.grades[readout]?.score ?? -1;
    const right = b.grades[readout]?.score ?? -1;
    return right - left || a.handle.localeCompare(b.handle);
  });
  const top = [...calls]
    .filter((call) => call.grades[readout] != null)
    .sort((a, b) => (b.grades[readout]?.score ?? -1) - (a.grades[readout]?.score ?? -1) || a.handle.localeCompare(b.handle))
    .slice(0, 4);

  return (
    <div>
      <div className="ft-hero">
        <div>
          <div className="chip">{kicker}</div>
          <h1>{title}</h1>
          <p className="mt-2 max-w-[48ch] text-sm leading-relaxed text-muted">{lede}</p>
        </div>
        <QuoteTape quotes={quotes} kind={tapeKind} variant="scoreboard" />
      </div>

      <div className="panel mt-4 grid items-center gap-5 p-4 md:grid-cols-[1.2fr_1fr]">
        <p className="text-sm leading-relaxed text-muted">
          {GC_FACTOR} for graded posts on this horizon. The horizontal tube fills left to right. STRONG is
          70 or more. WEAK is under 40. PROVISIONAL is 40 up to 70. 0% is an empty glass.
        </p>
        <GcTube score={calibration.fill} grade={calibration.grade} variant="sidebar" compactMeta />
      </div>

      {toolbar}

      <div className="ft-layout">
        <div className="flex flex-col gap-3.5">
          {ranked.length === 0 ? (
            calls.some((call) => call.grades[readout] != null) ? (
              <div className="panel p-5">
                <h2 className="text-xl text-ink">No posts in this filter</h2>
                <p className="mt-2 text-sm text-muted">The horizon is graded. None of those calls match the pills above.</p>
              </div>
            ) : (
            <div className="panel p-5">
              <h2 className="text-xl text-ink">Nothing graded yet</h2>
              <p className="mt-2 text-sm text-muted">
                This horizon has not settled, so every tube on it stays empty.
              </p>
              {pendingHref ? (
                <p className="mt-3 text-sm">
                  <Link href={pendingHref} className="text-pine underline-offset-4 hover:underline">
                    Pending settle
                  </Link>
                </p>
              ) : (
                <div className="mt-4 max-w-sm">
                  <ExitLiquidity detail="0% GC Scale — this horizon is still off the board" />
                </div>
              )}
            </div>
            )
          ) : (
            ranked.map((call) => <CallCard key={call.id} call={call} readout={readout} quotes={quotes} />)
          )}
        </div>
        <aside className="flex flex-col gap-3.5">
          <NoiseIndex calls={calls} quotes={quotes} compact />
          <section className="panel p-4">
            <h2 className="text-sm font-semibold text-ink">Top handles</h2>
            <p className="mt-1 text-xs text-muted">By GC Scale on this horizon</p>
            {top.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No settled grades to rank.</p>
            ) : (
              <ol className="rank-list mt-2">
                {top.map((call, index) => {
                  const grade = call.grades[readout];
                  if (!grade) return null;
                  const pill = gcGrade(grade);
                  return (
                    <li key={call.id}>
                      <span>
                        <span className="rank-n">{String(index + 1).padStart(2, "0")}</span>
                        <Link href={`/accounts/${call.handle}`} className="hover:underline">
                          {call.displayName}
                        </Link>
                      </span>
                      <span className={pill === "weak" || pill === "exit" ? "text-bear" : pill === "strong" ? "text-bull" : "text-muted"}>
                        {Math.round(grade.score)}%
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
          <section className="panel p-4">
            <h2 className="text-sm font-semibold text-ink">Methodology</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Posts lock with the weekend book. Grades use the Monday open and the noon prints against Friday&apos;s
              regular-session close for SPY, QQQ, DIA, and VIX.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {["Monday open", "Public sources", "Sample size", "No edits after lock"].map((chip) => (
                <span key={chip} className="rounded-full border border-line px-2 py-1 text-xs text-muted">
                  {chip}
                </span>
              ))}
            </div>
            <Link href="/methodology" className="mt-3 inline-block text-sm text-pine underline-offset-4 hover:underline">
              How the week is graded
            </Link>
          </section>
          {pendingHref ? <ExitLiquidity detail={exitDetail} /> : null}
        </aside>
      </div>
    </div>
  );
}
