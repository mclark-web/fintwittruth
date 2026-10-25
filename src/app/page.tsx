import Link from "next/link";
import { CallCard } from "@/components/call-card";
import { GradePill, GcTube } from "@/components/gc-tube";
import { NoiseIndex, QuoteTape } from "@/components/market";
import { Avatar } from "@/components/score";
import { leadReadout, leadScores, matureScore, weekendLead } from "@/lib/board";
import { closedPendingLiveWeeks, emptyLiveWeeks } from "@/lib/empty-weeks";
import { parseWeekCoverage } from "@/lib/search-scope";
import { formatAsOf, formatDay, formatRate, formatScore, formatScopeWhen, formatShortDay, formatWeekday, referenceCloseDay } from "@/lib/format";
import { gcBoardGrade, gcGrade } from "@/lib/grades";
import { GC_SCALE_BANDS } from "@/lib/labels";
import { bestWorst } from "@/lib/lanes";
import { gradedSymbols } from "@/lib/prints";
import { getLeaderboard, getLiveCohorts, type CallView, type CohortView, type LeaderRow } from "@/lib/queries";
import { cohortReferenceDate } from "@/lib/quotes";
import { EQUITY_TAPE, type ReadoutKind } from "@/lib/scoring";
import { trackedRoster } from "@/lib/watchlist";

const INDEX = new Set<string>([...EQUITY_TAPE, "VIX"]);

type HomeQuery = {
  side?: string;
  index?: string;
};

function toggleHref(query: HomeQuery, key: keyof HomeQuery, value: string) {
  const next = new URLSearchParams();
  const current: HomeQuery = { side: query.side, index: query.index };
  for (const [name, existing] of Object.entries(current)) {
    if (existing) next.set(name, existing);
  }
  if (next.get(key) === value) next.delete(key);
  else next.set(key, value);
  const text = next.toString();
  return text ? `/?${text}` : "/";
}

function priceMoveLabel(cohort: CohortView, kind: ReadoutKind): string {
  const at = cohort.readouts[kind].at;
  const close = referenceCloseDay(cohort.mondayAt, cohortReferenceDate(cohort.slug));
  return `${formatScopeWhen(at)} vs ${formatDay(close)} close`;
}

function emptyWeeksLine(weeks: { coverage: string; window: { mondayAt: Date } }[]): string {
  const days = (list: typeof weeks) => list.map((week) => formatShortDay(week.window.mondayAt)).join(" and ");
  const plural = (list: typeof weeks) => (list.length === 1 ? "week" : "weeks");
  const covered = weeks.filter((week) => parseWeekCoverage(week.coverage));
  const uncovered = weeks.filter((week) => !parseWeekCoverage(week.coverage));
  const parts: string[] = [];
  if (covered.length) parts.push(`No qualifying calls in the ${plural(covered)} of ${days(covered)}, so nothing to grade.`);
  if (uncovered.length) parts.push(`No search coverage is recorded for the ${plural(uncovered)} of ${days(uncovered)}, so nothing to grade.`);
  return parts.join(" ");
}

function hasGrade(call: CallView): boolean {
  return matureScore(call.grades) != null;
}

/** Newest closed week that already has a grade. An open collect window is not the board. */
function closedGradedCohort(live: CohortView[], now: Date): CohortView | null {
  return (
    live
      .filter((cohort) => cohort.collectEnd.getTime() <= now.getTime() && cohort.calls.some(hasGrade))
      .sort((a, b) => b.mondayAt.getTime() - a.mondayAt.getTime())[0] ?? null
  );
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<HomeQuery>;
}) {
  const query = await searchParams;
  const now = new Date();
  const [ranked, live] = await Promise.all([
    getLeaderboard(null, "live"),
    getLiveCohorts(),
  ]);
  const board = closedGradedCohort(live, now);
  const open = live
    .filter((cohort) => cohort.collectEnd.getTime() > now.getTime())
    .sort((a, b) => a.mondayAt.getTime() - b.mondayAt.getTime());
  const closedUngraded = live
    .filter((cohort) => cohort.collectEnd.getTime() <= now.getTime() && !cohort.calls.some(hasGrade))
    .sort((a, b) => b.mondayAt.getTime() - a.mondayAt.getTime());
  const calls = board?.calls ?? [];
  const graded = calls.filter(hasGrade);
  const readout = leadReadout(graded.map((call) => call.grades));
  const headlineScores = leadScores(graded.map((call) => call.grades));
  const calibration = gcBoardGrade(headlineScores);
  const filtered = graded.filter((call) => {
    if (query.side === "bullish" || query.side === "bearish") {
      if (call.direction !== query.side) return false;
    }
    if (query.index === "1" && !INDEX.has(call.primary)) return false;
    return true;
  });
  const filterOn = Boolean(query.side || query.index);
  const lanes = bestWorst(filtered, (call) => matureScore(call.grades) ?? 0);
  const asOf = board
    ? board.readouts.friday.status === "published"
      ? board.fridayAt
      : board.readouts.wednesday.status === "published"
        ? board.wednesdayAt
        : board.mondayAt
    : null;
  const rankedHandles = new Set(ranked.map((row) => row.handle.toLowerCase()));
  const roster = trackedRoster(
    live.flatMap((cohort) => cohort.calls.map((call) => ({ handle: call.handle, sourceUrl: call.sourceUrl }))),
  );
  const ungraded = roster.filter((account) => !rankedHandles.has(account.handle.toLowerCase()));
  const emptyWeeks = emptyLiveWeeks();
  const pendingWeeks = closedPendingLiveWeeks();

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-7">
      <div className="home-hero">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#c9c9cf]">GradedCalls FinTwit</p>
          <h1 className="home-title">Weekend market calls from FinTwit writers, graded against the prior Friday close.</h1>
          <p className="mt-3 max-w-[52ch] text-sm leading-relaxed text-muted [text-wrap:pretty]">
            A call is a public bullish or bearish post about a ticker or index. We grade it at Monday noon,
            Wednesday close, and Friday close against that close (Thursday&apos;s close when Friday is a market holiday).
          </p>
          <p className="mt-3 text-sm text-ink">
            {asOf ? `As of ${formatAsOf(asOf)} · ${calls.length} call${calls.length === 1 ? "" : "s"}` : "As of — · 0 calls"}
          </p>
          <p className="mt-1 flex flex-wrap items-center text-sm">
            <Link href="/methodology" className="accent-link hit-44 underline-offset-4 hover:underline">
              How grading works
            </Link>
            <span className="px-2 text-muted" aria-hidden="true">·</span>
            <Link href="/weeks" className="accent-link hit-44 underline-offset-4 hover:underline">
              All weeks
            </Link>
          </p>
        </div>
        <section className="panel p-4" aria-labelledby="latest-weekend">
          <h2 id="latest-weekend" className="text-sm font-semibold text-ink">
            Latest weekend
          </h2>
          <p className="mt-1 text-xs text-muted">
            {board && !calibration.ungraded ? weekendLead(board.mondayAt, calibration) : "No graded calls yet this week"}
          </p>
          {open[0] ? (
            <p className="mt-1 text-xs text-muted">
              Week of {formatShortDay(open[0].mondayAt)} has not closed. The collect window closes {formatWeekday(open[0].collectEnd)} at 5:00 PM ET.
            </p>
          ) : closedUngraded[0] ? (
            <p className="mt-1 text-xs text-muted">
              Week of {formatShortDay(closedUngraded[0].mondayAt)} has closed and is not graded yet.
            </p>
          ) : pendingWeeks.length ? (
            <p className="mt-1 text-xs text-muted">
              {pendingWeeks.length === 1
                ? `Week of ${formatShortDay(pendingWeeks[0]!.window.mondayAt)} has closed and is not graded yet.`
                : `Weeks of ${pendingWeeks.map((week) => formatShortDay(week.window.mondayAt)).join(" and ")} have closed and are not graded yet.`}
              {board ? ` Week of ${formatAsOf(board.mondayAt)} is the latest graded week.` : ""}
            </p>
          ) : emptyWeeks.length ? (
            <p className="mt-1 text-xs text-muted">
              {emptyWeeksLine(emptyWeeks)}
            </p>
          ) : board ? (
            <p className="mt-1 text-xs text-muted">
              Week of {formatAsOf(board.mondayAt)} is the latest collect window that has closed.
            </p>
          ) : null}
          <div className="mt-4">
            <GcTube
              score={calibration.fill}
              grade={calibration.ungraded ? "exit" : calibration.grade}
              variant="hero"
              ungraded={calibration.ungraded}
            />
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted">{GC_SCALE_BANDS}</p>
        </section>
      </div>

      <section className="lane-grid mt-8" aria-label="Best and worst calls">
        <Lane
          title="Best calls"
          note="Highest GC Scale this weekend."
          calls={lanes.ready ? lanes.best : []}
          readout={readout}
          quotes={board?.quotes}
          empty={
            lanes.ready
              ? "No call sits clearly above the rest."
              : `Fewer than ${lanes.minimum} graded calls this weekend; see all weeks.`
          }
        />
        <Lane
          title="Worst calls"
          note="Lowest GC Scale this weekend."
          calls={lanes.ready ? lanes.worst : []}
          readout={readout}
          quotes={board?.quotes}
          empty={
            lanes.ready
              ? "No call sits clearly below the rest."
              : `Fewer than ${lanes.minimum} graded calls this weekend; see all weeks.`
          }
        />
      </section>

      {!lanes.ready && graded.length > 0 && board ? (
        <section className="mt-8" aria-labelledby="graded-calls">
          <h2 id="graded-calls" className="text-2xl text-ink">
            Graded calls
          </h2>
          <p className="mt-1 text-sm text-muted">
            {filtered.length} graded {filtered.length === 1 ? "call" : "calls"} this weekend. Too few to split into best and worst.
          </p>
          <div className="mt-4 flex flex-col gap-3.5">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted">No calls match this filter.</p>
            ) : (
              filtered.map((call) => <CallCard key={call.id} call={call} readout={readout} quotes={board.quotes} />)
            )}
          </div>
        </section>
      ) : null}

      <section className="mt-10" aria-labelledby="accounts-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="accounts-heading" className="text-2xl text-ink [text-wrap:balance]">
            Tracked accounts, by average grade
          </h2>
          <Link href="/leaderboard" className="accent-link text-sm underline-offset-4 hover:underline">
            Full leaderboard
          </Link>
        </div>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          {roster.length} accounts, live data only. Hit is the share of settled checkpoints that were right. An account with no graded call reads Not graded yet.
        </p>
        <ol className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
          {ranked.map((row) => (
            <AccountRow key={row.handle} row={row} />
          ))}
          {ungraded.map((account) => (
            <li key={account.handle} className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-1">
              <span className="font-mono text-sm text-muted">—</span>
              <Link href={`/accounts/${account.handle}`} className="min-w-0 justify-self-start justify-start font-medium hover:underline">
                @{account.handle}
              </Link>
              <span className="text-sm text-[#9a9aa3]">Not graded yet</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-10" aria-labelledby="how-heading">
        <h2 id="how-heading" className="text-2xl text-ink">
          How it works
        </h2>
        <ol className="mt-3 max-w-3xl space-y-2 text-sm leading-relaxed text-muted">
          <li>1. A post is captured Wednesday noon through Sunday 5 PM ET.</li>
          <li>2. It is graded at Monday noon, Wednesday close, and Friday close. The score is the latest checkpoint that has settled.</li>
          <li>3. 70% and up is STRONG, 40–69% is PROVISIONAL, and under 40% is WEAK.</li>
        </ol>
        <p className="mt-3 text-sm">
          <Link href="/methodology" className="accent-link hit-44 underline-offset-4 hover:underline">
            How grading works
          </Link>
        </p>
      </section>

      <details className="panel mt-10 p-4" open={filterOn}>
        <summary className="cursor-pointer text-sm font-semibold text-ink">Prices, noise, and filters</summary>
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-ink">Market move used for grading</h3>
          {board ? (
            <p className="mt-1 text-xs text-muted">{priceMoveLabel(board, readout)}</p>
          ) : null}
          {board && board.quotes.length > 0 ? (
            <div className="mt-3">
              <QuoteTape
                quotes={board.quotes}
                kind={readout}
                variant="scoreboard"
                caption="Market move used for grading"
                symbols={gradedSymbols(calls)}
              />
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted">No checkpoint prices are in yet.</p>
          )}
          {board && graded.length >= 10 ? (
            <div className="mt-4">
              <NoiseIndex calls={calls} quotes={board.quotes} mondayAt={board.mondayAt} />
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted">The noise index stays hidden until a weekend has at least 10 graded calls.</p>
          )}
          <div className="filters-bar" aria-label="Call filters">
            <Link href="/" aria-current={filterOn ? undefined : "page"}>
              Latest weekend
            </Link>
            <Link href={toggleHref(query, "side", "bullish")} aria-pressed={query.side === "bullish"}>
              Bullish
            </Link>
            <Link href={toggleHref(query, "side", "bearish")} aria-pressed={query.side === "bearish"}>
              Bearish
            </Link>
            <Link href={toggleHref(query, "index", "1")} aria-pressed={query.index === "1"}>
              Index only
            </Link>
          </div>
        </div>
      </details>
    </div>
  );
}

function Lane({
  title,
  note,
  calls,
  readout,
  quotes,
  empty,
}: {
  title: string;
  note: string;
  calls: CallView[];
  readout: ReadoutKind;
  quotes?: HomeQuotes;
  empty: string;
}) {
  return (
    <section className="panel p-4" aria-labelledby={`${title}-heading`}>
      <h2 id={`${title}-heading`} className="text-xl text-ink">
        {title}
      </h2>
      <p className="mt-1 text-sm text-muted">{note}</p>
      {calls.length === 0 ? (
        <p className="mt-4 text-sm text-muted">
          {empty}{" "}
          <Link href="/weeks" className="accent-link hit-44 underline-offset-4 hover:underline">
            All weeks
          </Link>
        </p>
      ) : (
        <ul className="mt-4 grid gap-3">
          {calls.map((call) => (
            <li key={call.id}>
              <CallCard call={call} readout={readout} quotes={quotes} clampQuote />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type HomeQuotes = CohortView["quotes"];

function AccountRow({ row }: { row: LeaderRow }) {
  const pill = gcGrade({ score: row.avgScore, isStrong: row.isStrong, isWeak: row.isWeak });
  return (
    <li className="grid grid-cols-[1.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2 px-4 py-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-y-0">
      <span className="font-mono text-sm text-muted">{row.peerRank}</span>
      <Link href={`/accounts/${row.handle}`} className="flex min-w-0 items-center gap-3 hover:underline">
        <Avatar name={row.displayName} />
        <span className="min-w-0">
          <span className="block font-medium">{row.displayName}</span>
          <span className="block text-sm text-muted">@{row.handle}</span>
        </span>
      </Link>
      <span className="col-start-2 flex flex-wrap items-center gap-2 sm:col-start-auto sm:justify-end">
        <span className="font-mono text-2xl text-ink">
          {formatScore(row.avgScore, 0)}
          <span className="text-sm text-muted">%</span>
        </span>
        <GradePill grade={pill} />
        {row.callCount === 1 ? <span className="text-xs text-muted">n=1</span> : null}
        <span className="text-xs text-muted">Hit {formatRate(row.hitRate, 0)} of checkpoints</span>
      </span>
    </li>
  );
}
