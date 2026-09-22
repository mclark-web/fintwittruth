import Link from "next/link";
import { PendingSettleLink } from "@/components/board-state";
import { CalendarStrip, NoiseIndex, PriceSource, QuoteTape, ReadoutCards } from "@/components/market";
import { Avatar, ChudChip, PeerChip } from "@/components/score";
import { pendingReadoutKinds, settledGradeKinds, settledReadoutKinds } from "@/lib/board";
import { formatPct, formatScore, formatShortDay } from "@/lib/format";
import { CH_FACTOR, CHAD_MEANING, CHUD_MEANING, READOUT_META } from "@/lib/labels";
import { getLatestCohort, getLeaderboard } from "@/lib/queries";

export default async function HomePage() {
  const [latest, board] = await Promise.all([
    getLatestCohort(),
    getLeaderboard("watchlist"),
  ]);

  const gradedCalls = latest
    ? latest.calls.filter((call) => settledGradeKinds(call.grades).length > 0)
    : [];
  const featuredKinds = latest ? settledReadoutKinds(Object.values(latest.readouts)) : [];
  const featuredWaiting = latest ? pendingReadoutKinds(Object.values(latest.readouts)) : [];
  const latestTapes = latest
    ? (["monday-gap", "monday"] as const).filter((kind) => latest.readouts[kind].status === "published")
    : [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <section className="grid items-end gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)]">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-pine">Charoof FinTwit</p>
          <h1 className="mt-3 max-w-3xl font-serif text-5xl leading-[1.05] text-ink sm:text-6xl">
            Weekend doom and melt-up noise, graded at the open.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink/80">
            Charoof FinTwit collects one book from Wednesday noon through Sunday 5pm ET: crash calls, war panic,
            sell-the-open posts, and euphoric melt-up calls. Monday&apos;s gap and Monday noon grade that book
            against recorded prints. Wednesday and Friday age the same book.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={latest ? `/weeks/${latest.slug}` : "/weeks"} className="rounded-full bg-pine px-5 py-2.5 text-sm font-medium text-lime">
              Latest board
            </Link>
            <Link href="/methodology" className="rounded-full border border-line bg-white px-5 py-2.5 text-sm font-medium text-ink">
              How the week works
            </Link>
          </div>
        </div>
        <dl className="panel grid grid-cols-2 gap-4 p-5">
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">Score</dt>
            <dd className="mt-1 font-mono text-3xl text-ink">0–100</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">Badge</dt>
            <dd className="mt-1 font-mono text-3xl text-ink">1–10</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">Chud · {CHUD_MEANING}</dt>
            <dd className="mt-1 text-sm text-ink">Any score under 70</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">Chad · {CHAD_MEANING}</dt>
            <dd className="mt-1 text-sm text-ink">Top 30% and at least 70</dd>
          </div>
        </dl>
        <p className="mt-4 max-w-2xl text-sm text-muted lg:col-span-2">
          {CH_FACTOR}: Chad is {CHAD_MEANING}. Chud is {CHUD_MEANING}. Both are opinions about a past call. The
          score stays on the card either way.
        </p>
      </section>

      <section className="mt-12" aria-labelledby="calendar-heading">
        <h2 id="calendar-heading" className="font-serif text-3xl text-ink">
          One cohort. Gap, noon, then the week.
        </h2>
        <p className="mt-2 max-w-3xl text-muted">
          Monday&apos;s open and Monday noon are the primary reads on the weekend book. Wednesday and Friday keep
          grading that same cohort. A new collect window opens Wednesday at noon, and it does not replace the
          book already being graded.
        </p>
        <div className="mt-5">
          <CalendarStrip />
        </div>
      </section>

      {latest ? (
        <section className="mt-12" aria-labelledby="latest-heading">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted">Live cohort · verified posts</p>
              <h2 id="latest-heading" className="font-serif text-3xl text-ink">
                {latest.title}
              </h2>
              <p className="mt-1 max-w-2xl text-muted">{latest.summary}</p>
              <p className="mt-2 text-sm text-muted">Readout week of {formatShortDay(latest.mondayAt)}</p>
            </div>
            <Link href={`/weeks/${latest.slug}`} className="text-sm font-medium text-pine underline-offset-4 hover:underline">
              Open the side-by-side board
            </Link>
          </div>
          <div className="mt-5 space-y-4">
            {latestTapes.length > 0 ? (
              latestTapes.map((kind) => <QuoteTape key={kind} quotes={latest.quotes} kind={kind} />)
            ) : (
              <p className="text-sm text-muted">
                The Monday tape is off this board until the open and noon prints settle.
              </p>
            )}
            <PriceSource />
            {latestTapes.length < 2 ? (
              <PendingSettleLink href={`/weeks/${latest.slug}/pending`} />
            ) : null}
          </div>
          <div className="mt-4">
            <ReadoutCards slug={latest.slug} readouts={latest.readouts} />
          </div>
          <div className="mt-4">
            <NoiseIndex calls={latest.calls} quotes={latest.quotes} />
          </div>
        </section>
      ) : null}

      <section className="mt-12" aria-labelledby="case-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">Graded book</p>
            <h2 id="case-heading" className="font-serif text-3xl text-ink">
              Verified calls
            </h2>
            <p className="mt-1 max-w-2xl text-muted">
              Only posts with a source URL and a timestamp inside the collect window. A bearish call on a green
              Monday stays under 70.
            </p>
          </div>
          <Link href="/demo" className="text-sm font-medium text-pine underline-offset-4 hover:underline">
            DEMO board
          </Link>
        </div>
        {gradedCalls.length === 0 ? (
          <div className="panel mt-5 p-5">
            <h3 className="font-serif text-2xl text-ink">No verified calls on this board yet</h3>
            <p className="mt-2 max-w-2xl text-sm text-muted">
              The live book is empty until the operator pastes a public post. Fictional weekend cards are labeled
              DEMO and are not ranked here.
            </p>
            <p className="mt-3 text-sm">
              <Link href="/demo" className="font-medium text-pine underline-offset-4 hover:underline">
                Open the DEMO board
              </Link>
            </p>
          </div>
        ) : (
          <ul className="mt-5 grid gap-3 lg:grid-cols-2">
            {gradedCalls.map((call) => (
              <li key={call.id} className="panel p-4">
                <div className="flex items-center gap-3">
                  <Avatar name={call.displayName} accent={call.accent} />
                  <div>
                    <Link href={`/accounts/${call.handle}`} className="font-medium hover:underline">
                      {call.displayName}
                    </Link>
                    <p className="text-sm text-muted">
                      {call.direction} {call.primary}
                      {call.toneLabel ? ` · ${call.toneLabel}` : ""}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-ink">{call.body}</p>
                {call.sourceUrl ? (
                  <p className="mt-2 text-xs">
                    <a href={call.sourceUrl} className="text-pine underline-offset-4 hover:underline">
                      Source
                    </a>
                  </p>
                ) : null}
                <ol className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {featuredKinds.map((kind) => {
                    const grade = call.grades[kind];
                    if (!grade) return null;
                    return (
                      <li key={kind}>
                        <Link href={`/weeks/${latest?.slug}/${kind}`} className="block rounded-xl bg-white px-3 py-2">
                          <span className="text-[11px] uppercase text-muted">{READOUT_META[kind].short}</span>
                          <span className="mt-1 block font-mono text-2xl">
                            {grade.score}
                            <span className="text-sm text-muted">/100</span>
                          </span>
                          <span className="mt-1 flex flex-wrap gap-1">
                            {grade.isChad ? <PeerChip isChad /> : null}
                            {grade.isChudTerritory ? <ChudChip /> : null}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              </li>
            ))}
          </ul>
        )}
        {latest && featuredWaiting.length > 0 ? (
          <div className="mt-3">
            <PendingSettleLink href={`/weeks/${latest.slug}/pending`} waiting={featuredWaiting.length} />
          </div>
        ) : null}
      </section>

      <section className="mt-12" aria-labelledby="board-heading">
        <div className="flex items-end justify-between gap-3">
          <h2 id="board-heading" className="font-serif text-3xl text-ink">
            Handles, by mature score
          </h2>
          <Link href="/leaderboard" className="text-sm font-medium text-pine underline-offset-4 hover:underline">
            Full leaderboard
          </Link>
        </div>
        <p className="mt-2 text-sm text-muted">
          Verified watchlist accounts with a settled grade. Fictional DEMO handles are not in this rank. Chad is
          the top 30% of this board and also at least 70.
        </p>
        {board.length === 0 ? (
          <p className="panel mt-4 p-5 text-sm text-muted">
            No verified handle has a settled grade yet.{" "}
            <Link href="/demo" className="text-pine underline-offset-4 hover:underline">
              DEMO handles
            </Link>{" "}
            stay off this list.
          </p>
        ) : (
        <ol className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
          {board.slice(0, 5).map((row) => (
            <li key={row.handle} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3">
              <span className="font-mono text-sm text-muted">{row.peerRank}</span>
              <Link href={`/accounts/${row.handle}`} className="flex items-center gap-3 hover:underline">
                <Avatar name={row.displayName} accent={row.accent} />
                <span>
                  <span className="block font-medium">{row.displayName}</span>
                  <span className="text-sm text-muted">@{row.handle}</span>
                </span>
              </Link>
              <span className="text-right">
                <span className="block font-mono text-2xl">
                  {formatScore(row.avgScore, 1)}
                  <span className="text-sm text-muted">/100</span>
                </span>
                <span className="text-xs text-muted">
                  Badge {row.badge}/10 · Hit {formatPct(row.hitRate, 0)} · Chad {formatPct(row.chadRate, 0)}
                </span>
              </span>
            </li>
          ))}
        </ol>
        )}
        <div className="mt-3">
          <PendingSettleLink href="/pending" />
        </div>
      </section>
    </div>
  );
}
