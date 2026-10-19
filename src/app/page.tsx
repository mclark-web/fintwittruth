import Link from "next/link";
import { CallCard } from "@/components/call-card";
import { GradePill, GcTube } from "@/components/gc-tube";
import { NoiseIndex, QuoteTape } from "@/components/market";
import { Avatar } from "@/components/score";
import { emptyLiveWeeks } from "@/lib/empty-weeks";
import { formatAsOf, formatCheckpointStamp, formatRate, formatScore, formatShortDay, formatWeekday, referenceCloseDay } from "@/lib/format";
import { gcBoardGrade, gcGrade } from "@/lib/grades";
import { GC_SCALE_BANDS } from "@/lib/labels";
import { bestWorst } from "@/lib/lanes";
import { gradedSymbols } from "@/lib/prints";
import { getLatestCohort, getLeaderboard, getLiveCohorts, type CallView, type CohortView, type LeaderRow } from "@/lib/queries";
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
  return `${formatCheckpointStamp(at)} vs ${formatWeekday(close)} close`;
}

function headlineKind(calls: CallView[]): ReadoutKind {
  if (calls.some((call) => call.grades.monday)) return "monday";
  if (calls.some((call) => call.grades.wednesday)) return "wednesday";
  return "friday";
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<HomeQuery>;
}) {
  const query = await searchParams;
  const [latest, ranked, live] = await Promise.all([
    getLatestCohort(),
    getLeaderboard("watchlist", "live"),
    getLiveCohorts(),
  ]);
  const calls = latest?.calls ?? [];
  const readout = headlineKind(calls);
  const graded = calls.filter((call) => call.grades[readout] != null);
  const calibration = gcBoardGrade(graded.map((call) => call.grades[readout]?.score ?? 0));
  const lanes = bestWorst(graded, (call) => call.grades[readout]?.score ?? 0);
  const asOf = latest
    ? latest.readouts.friday.status === "published"
      ? latest.fridayAt
      : latest.readouts.wednesday.status === "published"
        ? latest.wednesdayAt
        : latest.mondayAt
    : null;
  const rankedHandles = new Set(ranked.map((row) => row.handle.toLowerCase()));
  const roster = trackedRoster(
    live.flatMap((cohort) => cohort.calls.map((call) => ({ handle: call.handle, sourceUrl: call.sourceUrl }))),
  );
  const ungraded = roster.filter((account) => !rankedHandles.has(account.handle.toLowerCase()));
  const filtered = graded.filter((call) => {
    if (query.side === "bullish" || query.side === "bearish") {
      if (call.direction !== query.side) return false;
    }
    if (query.index === "1" && !INDEX.has(call.primary)) return false;
    return true;
  });
  const filterOn = Boolean(query.side || query.index);
  const emptyWeeks = emptyLiveWeeks();

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
            {latest ? `Week of ${formatAsOf(latest.mondayAt)} · n=${graded.length}` : "No graded weekend yet"}
          </p>
          {emptyWeeks.length ? (
            <p className="mt-1 text-xs text-muted">
              No qualifying calls in the week{emptyWeeks.length === 1 ? "" : "s"} of{" "}
              {emptyWeeks.map((week) => formatShortDay(week.window.mondayAt)).join(" and ")}, so nothing to grade.
            </p>
          ) : latest ? (
            <p className="mt-1 text-xs text-muted">
              Week of {formatAsOf(latest.mondayAt)} is the latest collect window that has closed.
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
          quotes={latest?.quotes}
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
          quotes={latest?.quotes}
          empty={
            lanes.ready
              ? "No call sits clearly below the rest."
              : `Fewer than ${lanes.minimum} graded calls this weekend; see all weeks.`
          }
        />
      </section>

      {!lanes.ready && graded.length > 0 && latest ? (
        <section className="mt-8" aria-labelledby="graded-calls">
          <h2 id="graded-calls" className="text-2xl text-ink">
            Graded calls
          </h2>
          <p className="mt-1 text-sm text-muted">
            {graded.length} graded {graded.length === 1 ? "call" : "calls"} this weekend. Too few to split into best and worst.
          </p>
          <div className="mt-4 flex flex-col gap-3.5">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted">No calls match this filter.</p>
            ) : (
              filtered.map((call) => <CallCard key={call.id} call={call} readout={readout} quotes={latest.quotes} />)
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
          {roster.length} accounts, live data only. Hit is the share of graded calls that were right. An account with no graded call reads Not graded yet.
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
          <li>2. It is graded at Monday noon (the headline), then Wednesday close and Friday close.</li>
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
          {latest ? (
            <p className="mt-1 text-xs text-muted">{priceMoveLabel(latest, readout)}</p>
          ) : null}
          {latest ? (
            <div className="mt-3">
              <QuoteTape
                quotes={latest.quotes}
                kind={readout}
                variant="scoreboard"
                caption="Market move used for grading"
                symbols={gradedSymbols(calls)}
              />
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted">No prices are on the board yet.</p>
          )}
          {latest && calls.length >= 10 ? (
            <div className="mt-4">
              <NoiseIndex calls={calls} quotes={latest.quotes} mondayAt={latest.mondayAt} />
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

type HomeQuotes = NonNullable<Awaited<ReturnType<typeof getLatestCohort>>>["quotes"];

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
        <span className="text-xs text-muted">Hit {formatRate(row.hitRate, 0)}</span>
      </span>
    </li>
  );
}
