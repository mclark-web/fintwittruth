import type { Metadata } from "next";
import Link from "next/link";
import { GcTube } from "@/components/gc-tube";
import { etYmd, formatScore, formatShortDay, formatWhen } from "@/lib/format";
import { gcBoardGrade, LABOR_DAY_UNGRADED_LINE, UNGRADED_HORIZON, ungradedHorizonLine } from "@/lib/grades";
import { READOUT_META } from "@/lib/labels";
import { getCohortList } from "@/lib/queries";
import { READOUTS } from "@/lib/scoring";

export const metadata: Metadata = {
  title: "Weeks",
  description:
    "Verified GradedCalls FinTwit weeks, with Monday noon, Wednesday close, and Friday close grades on the same calls.",
};

export default async function WeeksPage() {
  const cohorts = (await getCohortList()).filter((cohort) => cohort.dataset === "live");
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-serif text-4xl text-ink">Weeks</h1>
      <p className="mt-3 max-w-2xl text-muted">
        The latest real week is first. A number is the average grade at that checkpoint. A checkpoint that has
        not been graded stays off the ranking. Fictional weeks live on the demo board.
      </p>
      <p className="mt-3 text-sm">
        <Link href="/demo" className="accent-link hit-44 underline-offset-4 hover:underline">
          Demo board
        </Link>
      </p>
      <ul className="mt-8 grid gap-4">
        {cohorts.map((cohort) => (
          <li key={cohort.slug}>
            <article className="panel p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted">
                    {cohort.dataset === "live"
                      ? cohort.isLatest
                        ? "Latest · verified"
                        : "Verified"
                      : "Demo"}{" "}
                    · week of {formatShortDay(cohort.mondayAt)}
                  </p>
                  <h2 className="mt-1 font-serif text-3xl text-ink">
                    <Link href={`/weeks/${cohort.slug}`} className="hover:underline">
                      {cohort.title}
                    </Link>
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm text-muted">{cohort.summary}</p>
                  <p className="mt-2 text-xs text-muted">
                    {formatWhen(cohort.collectStart)} → {formatWhen(cohort.collectEnd)}
                  </p>
                </div>
              </div>
              <ol className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {READOUTS.map((kind) => {
                  const avg = cohort.averages[kind];
                  const settled = cohort.statuses[kind] === "published" && avg != null;
                  const calibration = settled && avg != null ? gcBoardGrade([avg]) : null;
                  const graded = calibration && !calibration.ungraded ? calibration : null;
                  const waitingLine = ungradedHorizonLine({
                    kind,
                    sessionYmd: etYmd(cohort.mondayAt),
                    time: READOUT_META[kind].time,
                  });
                  return (
                    <li key={kind}>
                      <Link
                        href={settled ? `/weeks/${cohort.slug}/${kind}` : `/weeks/${cohort.slug}/pending`}
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
        ))}
      </ul>
    </div>
  );
}
