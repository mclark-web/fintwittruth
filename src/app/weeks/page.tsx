import type { Metadata } from "next";
import Link from "next/link";
import { GcTube } from "@/components/gc-tube";
import { emptyLiveWeeks, futureLiveWeek } from "@/lib/empty-weeks";
import { etYmd, formatScore, formatShortDay, formatWhen } from "@/lib/format";
import { emptyWeekSearchLine } from "@/lib/search-scope";
import { gcBoardGrade, LABOR_DAY_UNGRADED_LINE, UNGRADED_HORIZON, ungradedHorizonLine } from "@/lib/grades";
import { READOUT_META } from "@/lib/labels";
import { getCohortList } from "@/lib/queries";
import { READOUTS } from "@/lib/scoring";

export const metadata: Metadata = {
  title: "Weeks",
  description:
    "Verified GradedCalls FinTwit weeks, with Monday noon, Wednesday close, and Friday close grades on the same calls.",
};

/** Re-read the clock so a future week stops saying it is open after Sunday 5:00 PM ET. */
export const revalidate = 60;

export default async function WeeksPage() {
  const cohorts = (await getCohortList()).filter((cohort) => cohort.dataset === "live");
  const emptyWeeks = emptyLiveWeeks();
  const future = futureLiveWeek();
  const rows = [
    ...(future ? [{ kind: "future" as const, at: future.window.mondayAt.getTime(), week: future }] : []),
    ...emptyWeeks.map((week) => ({ kind: "empty" as const, at: week.window.mondayAt.getTime(), week })),
    ...cohorts.map((cohort) => ({ kind: "cohort" as const, at: cohort.mondayAt.getTime(), cohort })),
  ].sort((a, b) => b.at - a.at);
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-serif text-4xl text-ink">Weeks</h1>
      <p className="mt-3 max-w-2xl text-muted">
        The latest week is first. A week that has not closed yet has nothing to grade. A number is the average
        grade at that checkpoint. A checkpoint that has not been graded stays off the ranking. Fictional weeks live
        on the demo board.
      </p>
      <p className="mt-3 text-sm">
        <Link href="/demo" className="accent-link hit-44 underline-offset-4 hover:underline">
          Demo board
        </Link>
      </p>
      <ul className="mt-8 grid gap-4">
        {rows.map((row) =>
          row.kind === "future" ? (
            <li key={row.week.slug}>
              <article className="panel p-5">
                <p className="text-xs uppercase tracking-wide text-muted">
                  Week of {formatShortDay(row.week.window.mondayAt)}
                </p>
                <h2 className="mt-1 font-serif text-3xl text-ink [text-wrap:balance]">
                  <Link href={`/weeks/${row.week.slug}`} className="hover:underline">
                    This week has not closed yet
                  </Link>
                </h2>
                <p className="mt-2 max-w-2xl text-sm text-muted">
                  The collect window is still open, so there is nothing to grade yet.
                </p>
                <p className="mt-2 text-xs text-muted">
                  {formatWhen(row.week.window.collectStart)} → {formatWhen(row.week.window.collectEnd)}
                </p>
              </article>
            </li>
          ) : row.kind === "empty" ? (
            <li key={row.week.slug}>
              <article className="panel p-5">
                <p className="text-xs uppercase tracking-wide text-muted">
                  Week of {formatShortDay(row.week.window.mondayAt)}
                </p>
                <h2 className="mt-1 font-serif text-3xl text-ink [text-wrap:balance]">
                  <Link href={`/weeks/${row.week.slug}`} className="hover:underline">
                    No qualifying calls
                  </Link>
                </h2>
                <p className="mt-2 max-w-2xl text-sm text-muted">{emptyWeekSearchLine(row.week.window)}</p>
                <p className="mt-2 text-xs text-muted">
                  {formatWhen(row.week.window.collectStart)} → {formatWhen(row.week.window.collectEnd)}
                </p>
              </article>
            </li>
          ) : (
            <li key={row.cohort.slug}>
              <article className="panel p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted">
                      {row.cohort.dataset === "live"
                        ? row.cohort.isLatest
                          ? "Latest · verified"
                          : "Verified"
                        : "Demo"}{" "}
                      · week of {formatShortDay(row.cohort.mondayAt)}
                    </p>
                    <h2 className="mt-1 font-serif text-3xl text-ink [text-wrap:balance]">
                      <Link href={`/weeks/${row.cohort.slug}`} className="hover:underline">
                        {row.cohort.title}
                      </Link>
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm text-muted">{row.cohort.summary}</p>
                    <p className="mt-2 text-xs text-muted">
                      {formatWhen(row.cohort.collectStart)} → {formatWhen(row.cohort.collectEnd)}
                    </p>
                  </div>
                </div>
                <ol className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  {READOUTS.map((kind) => {
                    const avg = row.cohort.averages[kind];
                    const settled = row.cohort.statuses[kind] === "published" && avg != null;
                    const calibration = settled && avg != null ? gcBoardGrade([avg]) : null;
                    const graded = calibration && !calibration.ungraded ? calibration : null;
                    const waitingLine = ungradedHorizonLine({
                      kind,
                      sessionYmd: etYmd(row.cohort.mondayAt),
                      time: READOUT_META[kind].time,
                    });
                    return (
                      <li key={kind}>
                        <Link
                          href={settled ? `/weeks/${row.cohort.slug}/${kind}` : `/weeks/${row.cohort.slug}/pending`}
                          className="block rounded-xl border border-line bg-sheet px-3 py-3 hover:border-pine"
                        >
                        <span className="text-xs tracking-wide text-[#9a9aa3]">
                          {READOUT_META[kind].short} · {READOUT_META[kind].time}
                        </span>
                        <span className="mt-2 block">
                          <GcTube
                            score={graded ? graded.fill : 0}
                            grade={graded ? graded.grade : "exit"}
                            variant="mini"
                            showMeta={false}
                            ungraded={!settled}
                          />
                        </span>
                        <span className={`mt-2 block font-mono text-2xl ${settled ? "text-ink" : "text-[#9a9aa3]"}`}>
                          {settled && graded ? `${formatScore(graded.fill)}%` : UNGRADED_HORIZON}
                        </span>
                        <span className="mt-1 block text-xs text-muted">
                          {settled
                            ? `On the board · ${READOUT_META[kind].time}`
                            : waitingLine === LABOR_DAY_UNGRADED_LINE
                              ? waitingLine
                              : `Off the board until ${READOUT_META[kind].time}`}
                        </span>
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              </article>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}
