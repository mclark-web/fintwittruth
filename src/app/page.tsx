import Link from "next/link";
import { PendingSettleLink } from "@/components/board-state";
import { FinTwitBoard } from "@/components/fintwit-board";
import { CalendarStrip } from "@/components/market";
import { Avatar, ReferenceLine, ReportOutTitle } from "@/components/score";
import { GradePill } from "@/components/gc-tube";
import { pendingReadoutKinds, settledGradeKinds, settledReadoutKinds } from "@/lib/board";
import { DEMO_OPEN_COHORT_SLUG } from "@/lib/demo-data";
import { formatPct, formatScore, formatShortDay } from "@/lib/format";
import { gcGrade } from "@/lib/grades";
import { getFeaturedCohort, getLatestCohort, getLeaderboard, type CallView } from "@/lib/queries";
import { EQUITY_TAPE, type ReadoutKind } from "@/lib/scoring";

const INDEX = new Set<string>([...EQUITY_TAPE, "VIX"]);

type HomeQuery = {
  side?: string;
  index?: string;
  grade?: string;
};

function toggleHref(query: HomeQuery, key: keyof HomeQuery, value: string) {
  const next = new URLSearchParams();
  const current: HomeQuery = {
    side: query.side,
    index: query.index,
    grade: query.grade,
  };
  for (const [name, existing] of Object.entries(current)) {
    if (existing) next.set(name, existing);
  }
  if (next.get(key) === value) next.delete(key);
  else next.set(key, value);
  const text = next.toString();
  return text ? `/?${text}` : "/";
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<HomeQuery>;
}) {
  const query = await searchParams;
  const [latest, featured, board] = await Promise.all([
    getLatestCohort(),
    getFeaturedCohort(),
    getLeaderboard("watchlist"),
  ]);

  const spotlight = featured
    ? ["permapump", "doomscroll"]
        .map((handle) => featured.calls.find((call) => call.handle === handle))
        .filter((call): call is CallView => call != null && settledGradeKinds(call.grades).length > 0)
    : [];
  const featuredReadouts = featured ? Object.values(featured.readouts) : [];
  const featuredKinds = settledReadoutKinds(featuredReadouts);
  const featuredWaiting = pendingReadoutKinds(featuredReadouts);

  const tapeKind: ReadoutKind | null = latest
    ? latest.readouts.monday.status === "published"
      ? "monday"
      : latest.readouts["monday-gap"].status === "published"
        ? "monday-gap"
        : null
    : null;
  const waiting = latest ? pendingReadoutKinds(Object.values(latest.readouts)) : [];
  const feed = latest && tapeKind
    ? latest.calls.filter((call) => {
        if (query.side === "bullish" || query.side === "bearish") {
          if (call.direction !== query.side) return false;
        }
        if (query.index === "1" && !INDEX.has(call.primary)) return false;
        const grade = call.grades[tapeKind];
        if (query.grade === "strong" && !(grade && gcGrade(grade) === "strong")) return false;
        if (query.grade === "weak" && !(grade && gcGrade(grade) === "weak")) return false;
        return true;
      })
    : [];

  const filters = (
    <div className="filters-bar" aria-label="Feed filters">
      <Link href="/" aria-current={query.side || query.index || query.grade ? undefined : "page"}>
        This weekend
      </Link>
      <Link href="/weeks">Last 4 weeks</Link>
      <Link href={toggleHref(query, "side", "bullish")} aria-pressed={query.side === "bullish"}>
        Bullish
      </Link>
      <Link href={toggleHref(query, "side", "bearish")} aria-pressed={query.side === "bearish"}>
        Bearish
      </Link>
      <Link href={toggleHref(query, "index", "1")} aria-pressed={query.index === "1"}>
        Index only
      </Link>
      <Link href={toggleHref(query, "grade", "strong")} aria-pressed={query.grade === "strong"}>
        STRONG
      </Link>
      <Link href={toggleHref(query, "grade", "weak")} aria-pressed={query.grade === "weak"}>
        WEAK
      </Link>
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-7">
      {latest && tapeKind ? (
        <FinTwitBoard
          title="Social calls vs Monday’s tape"
          lede="Weekend narratives and midweek takes, frozen at post time, then graded against the next session’s open — SPY, DIA, QQQ, and VIX."
          quotes={latest.quotes}
          tapeKind={tapeKind}
          calls={latest.calls}
          feed={feed}
          readout={tapeKind}
          toolbar={filters}
          pendingHref={waiting.length > 0 ? `/weeks/${latest.slug}/pending` : undefined}
          exitDetail="0% GC Scale — no graded horizon closed yet"
        />
      ) : (
        <div className="panel p-5">
          <h1 className="text-3xl text-ink">Social calls vs Monday’s tape</h1>
          <p className="mt-2 text-muted">The Monday tape is off this board until the open prints settle.</p>
          <ExitLink />
        </div>
      )}

      {latest ? (
        <p className="mt-4 text-sm text-muted">
          {latest.title} · readout week of {formatShortDay(latest.mondayAt)}. {latest.summary}{" "}
          <Link href={`/weeks/${latest.slug}`} className="text-pine underline-offset-4 hover:underline">
            Open the side-by-side board
          </Link>
          . Fictional weekend doom and melt-up posts for this same Monday tape stay graded on the{" "}
          <Link href={`/weeks/${DEMO_OPEN_COHORT_SLUG}`} className="text-pine underline-offset-4 hover:underline">
            demo week
          </Link>
          .
        </p>
      ) : null}

      <section className="mt-12" aria-labelledby="calendar-heading">
        <h2 id="calendar-heading" className="text-3xl text-ink">
          One cohort. Mon noon, Wed close, Fri close.
        </h2>
        <p className="mt-2 max-w-3xl text-muted">
          Monday noon is the primary read on the weekend book. Wednesday and Friday close keep grading that same
          cohort. A new collect window opens Wednesday at noon, and it does not replace the book already being
          graded.
        </p>
        <div className="mt-5">
          <CalendarStrip />
        </div>
      </section>

      {featured && spotlight.length > 0 ? (
        <section className="mt-12" aria-labelledby="case-heading">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted">Labor Day week, left blank on Monday</p>
              <h2 id="case-heading" className="text-3xl text-ink">
                {featured.title}
              </h2>
              <p className="mt-1 max-w-2xl text-muted">{featured.summary}</p>
            </div>
            <Link href={`/weeks/${featured.slug}`} className="text-sm font-medium text-pine underline-offset-4 hover:underline">
              See the graded board
            </Link>
          </div>
          <ul className="mt-5 grid gap-3 lg:grid-cols-2">
            {spotlight.map((call) => (
              <li key={call.id} className="panel p-4">
                <div className="flex items-center gap-3">
                  <Avatar name={call.displayName} />
                  <div>
                    <Link href={`/accounts/${call.handle}`} className="font-medium hover:underline">
                      {call.displayName}
                    </Link>
                    <p className="text-sm text-muted">
                      {call.direction} {call.primary}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-ink">{call.body}</p>
                <ReferenceLine quotes={featured.quotes} primary={call.primary} />
                <ol className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {featuredKinds.map((kind) => {
                    const grade = call.grades[kind];
                    if (!grade) return null;
                    return (
                      <li key={kind}>
                        <Link href={`/weeks/${featured.slug}/${kind}`} className="block rounded-xl bg-sheet px-3 py-2">
                          <span className="block text-[11px] text-muted">
                            <ReportOutTitle kind={kind} quotes={featured.quotes} primary={call.primary} direction={call.direction} />
                          </span>
                          <span className="mt-1 block font-mono text-2xl">
                            {Math.round(grade.score)}
                            <span className="text-sm text-muted">%</span>
                          </span>
                          <span className="mt-2 inline-flex">
                            <GradePill grade={gcGrade(grade)} />
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              </li>
            ))}
          </ul>
          {featuredWaiting.length > 0 ? (
            <div className="mt-3">
              <PendingSettleLink href={`/weeks/${featured.slug}/pending`} waiting={featuredWaiting.length} />
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="mt-12" aria-labelledby="board-heading">
        <div className="flex items-end justify-between gap-3">
          <h2 id="board-heading" className="text-3xl text-ink">
            Handles, by mature score
          </h2>
          <Link href="/leaderboard" className="text-sm font-medium text-pine underline-offset-4 hover:underline">
            Full leaderboard
          </Link>
        </div>
        <p className="mt-2 text-sm text-muted">
          Watchlist accounts with a settled grade, ranked inside that bucket. Each average uses the furthest
          settled grade. STRONG, WEAK, and hit rate count settled grades only. STRONG is the top 30% of this
          board and also at least 70. WEAK is under 70.
        </p>
        <ol className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
          {board.slice(0, 5).map((row) => (
            <li key={row.handle} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3">
              <span className="font-mono text-sm text-muted">{row.peerRank}</span>
              <Link href={`/accounts/${row.handle}`} className="flex items-center gap-3 hover:underline">
                <Avatar name={row.displayName} />
                <span>
                  <span className="block font-medium">{row.displayName}</span>
                  <span className="text-sm text-muted">@{row.handle}</span>
                </span>
              </Link>
              <span className="text-right">
                <span className="block font-mono text-2xl">
                  {formatScore(row.avgScore, 1)}
                  <span className="text-sm text-muted">%</span>
                </span>
                <span className="text-xs text-muted">
                  Badge {row.badge}/10 · Hit {formatPct(row.hitRate, 0)} · STRONG {formatPct(row.strongRate, 0)}
                </span>
              </span>
            </li>
          ))}
        </ol>
        <div className="mt-3">
          <PendingSettleLink href="/pending" />
        </div>
      </section>
    </div>
  );
}

function ExitLink() {
  return (
    <p className="mt-3 text-sm">
      <Link href="/pending" className="text-pine underline-offset-4 hover:underline">
        Pending settle
      </Link>
    </p>
  );
}
