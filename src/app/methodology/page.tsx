import type { Metadata } from "next";
import Link from "next/link";
import { CalendarStrip } from "@/components/market";
import { FEATURED_COHORT_SLUG } from "@/lib/demo-data";
import { CH_FACTOR } from "@/lib/labels";
import { PRICE_ADJUSTMENT, PRICE_CLOSED_RULE, PRICE_FETCHED_AT, PRICE_SOURCE } from "@/lib/quotes";
import { getCohort } from "@/lib/queries";
import {
  CHAD_FRACTION,
  CHUD_THRESHOLD,
  DIRECTION_BANDS,
  DIRECTION_MAX,
  LEVEL_MAX,
  READOUTS,
  SPECIFICITY_MAX,
  VIX_BANDS,
  VIX_MAX,
} from "@/lib/scoring";

export const metadata: Metadata = {
  title: "Methodology",
  description:
    "FinTwitTruth v1 grades one Wednesday-to-Sunday cohort on the Monday gap, Monday noon, Wednesday noon, and Friday noon, with a VIX factor.",
};

export default async function MethodologyPage() {
  const featured = await getCohort(FEATURED_COHORT_SLUG);
  const examples = featured
    ? ["permapump", "doomscroll", "doomsiren"]
        .map((handle) => featured.calls.find((call) => call.handle === handle))
        .filter((call) => call != null)
    : [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-xs uppercase tracking-wide text-muted">FinTwitTruth v1</p>
      <h1 className="mt-2 font-serif text-4xl text-ink">How a week is graded</h1>
      <p className="mt-4 text-lg text-ink/80">
        FinTwitTruth is a scorecard. It watches one weekend of doom, crash, and melt-up calls age against
        recorded prints. It does not tell anyone to buy or sell because the noise was loud.
      </p>

      <section className="mt-8" aria-labelledby="inclusion">
        <h2 id="inclusion" className="font-serif text-3xl text-ink">
          Who is in the book
        </h2>
        <p className="mt-3 text-ink/80">
          Each Wednesday 12:00 PM ET through Sunday 5:00 PM ET cohort has two buckets. Both feed the weekly
          board. Leaderboards stay separate.
        </p>
        <dl className="mt-4 grid gap-4">
          <div className="panel p-4">
            <dt className="font-medium text-ink">Named watchlist</dt>
            <dd className="mt-1 text-sm text-muted">
              Standing demo accounts. Their posts are in every cohort and are ranked against other watchlist
              accounts.
            </dd>
          </div>
          <div className="panel p-4">
            <dt className="font-medium text-ink">Viral doom and hype</dt>
            <dd className="mt-1 text-sm text-muted">
              A keyword-and-engagement style bucket for crash, war, sell-the-open, and melt-up spikes. In this
              demo the posts and engagement counts are fictional. They are ranked on their own leaderboard and
              still sit on the weekly board with the watchlist.
            </dd>
          </div>
        </dl>
      </section>

      <section className="mt-10" aria-labelledby="calendar">
        <h2 id="calendar" className="font-serif text-3xl text-ink">
          Collect once, read the tape four times
        </h2>
        <div className="mt-4">
          <CalendarStrip />
        </div>
        <dl className="mt-6 grid gap-4">
          <div className="panel p-4">
            <dt className="font-medium text-ink">Collect window</dt>
            <dd className="mt-1 text-sm text-muted">
              Wednesday 12:00 PM America/New_York through Sunday 5:00 PM America/New_York. The cohort does not
              grow after Sunday.
            </dd>
          </div>
          <div className="panel p-4">
            <dt className="font-medium text-ink">Weekend reference</dt>
            <dd className="mt-1 text-sm text-muted">
              There is no Sunday cash print. The reference is the prior Friday adjusted close for SPY, QQQ,
              DIA, and the Friday VIX close. Equity index futures are shut from Friday 5:00 PM ET until Sunday
              6:00 PM ET, so Sunday 5:00 PM only ends the book.
            </dd>
          </div>
          <div className="panel p-4">
            <dt className="font-medium text-ink">Monday gap — 9:30 AM ET</dt>
            <dd className="mt-1 text-sm text-muted">
              Friday adjusted close to the regular-hours open for SPY, QQQ, and DIA. VIX uses Friday&apos;s
              close to Monday&apos;s regular-session open.
            </dd>
          </div>
          <div className="panel p-4">
            <dt className="font-medium text-ink">Monday 12:00 PM ET — weekend-noise grade</dt>
            <dd className="mt-1 text-sm text-muted">
              The primary score. It asks whether the weekend doom, war panic, sell-the-open calls, and melt-up
              calls were still there at noon. The print is the open of the Yahoo Finance 5-minute bar stamped
              12:00 PM America/New_York. VIX uses the same stamp.
            </dd>
          </div>
          <div className="panel p-4">
            <dt className="font-medium text-ink">Wednesday and Friday noon</dt>
            <dd className="mt-1 text-sm text-muted">
              The same calls, aged against the real noon prints and VIX at those stamps. Wednesday noon also
              opens the next collect window. That new window is a different board. Wednesday&apos;s grade still
              belongs to the cohort that closed the previous Sunday. Friday is the last score on the book.
            </dd>
          </div>
          <div className="panel p-4">
            <dt className="font-medium text-ink">Missing print</dt>
            <dd className="mt-1 text-sm text-muted">{PRICE_CLOSED_RULE}</dd>
          </div>
        </dl>
      </section>

      <section className="mt-10" aria-labelledby="score">
        <h2 id="score" className="font-serif text-3xl text-ink">
          The 0–100 score
        </h2>
        <p className="mt-3 text-ink/80">
          Every published grade shows the full score and a 1–10 badge. Parts add to 100: direction{" "}
          {DIRECTION_MAX}, levels {LEVEL_MAX}, specificity {SPECIFICITY_MAX}, VIX {VIX_MAX}.
        </p>
        <h3 className="mt-6 font-medium text-ink">Direction versus the equity tape</h3>
        <p className="mt-1 text-sm text-muted">
          The tape is the equal-weight percent move of SPY, QQQ, and DIA from Friday&apos;s adjusted close to
          the readout print. Each name counts one third. A bullish call is scored on that tape. A bearish call
          is scored on the inverse. Flat tape is a push. Numbered targets are still checked on the call&apos;s
          own symbol.
        </p>
        <table className="mt-3 w-full text-left text-sm">
          <caption className="sr-only">Direction point bands</caption>
          <thead className="text-xs uppercase tracking-wide text-muted">
            <tr>
              <th scope="col" className="py-2 font-medium">Move versus the call</th>
              <th scope="col" className="py-2 font-medium">Points</th>
            </tr>
          </thead>
          <tbody>
            {DIRECTION_BANDS.map((band) => (
              <tr key={band.label} className="border-t border-line">
                <td className="py-2">{band.label}</td>
                <td className="py-2 font-mono">{band.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <h3 className="mt-6 font-medium text-ink">VIX factor, {VIX_MAX} points</h3>
        <p className="mt-1 text-sm text-muted">
          VIX is always in the score. A panic, crash, or selloff call wants VIX higher. A melt-up or
          complacency call wants VIX lower. A spike hurts a melt-up call. A drop hurts a panic call. The move
          is Friday&apos;s VIX close to the VIX print at the same stamp as the equity readout.
        </p>
        <table className="mt-3 w-full text-left text-sm">
          <caption className="sr-only">VIX point bands</caption>
          <thead className="text-xs uppercase tracking-wide text-muted">
            <tr>
              <th scope="col" className="py-2 font-medium">VIX versus the call</th>
              <th scope="col" className="py-2 font-medium">Points</th>
            </tr>
          </thead>
          <tbody>
            {VIX_BANDS.map((band) => (
              <tr key={band.label} className="border-t border-line">
                <td className="py-2">{band.label}</td>
                <td className="py-2 font-mono">{band.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <h3 className="mt-6 font-medium text-ink">Levels</h3>
        <p className="mt-1 text-sm text-muted">
          A reached target scores {LEVEL_MAX}. A near miss scores less. Support and resistance score when they
          hold. If a stated invalidation is busted, level points cap at 2. A post with no level keeps a floor
          of 4.
        </p>
        <h3 className="mt-6 font-medium text-ink">Specificity</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
          <li>Named ticker: 5</li>
          <li>Named target: 4</li>
          <li>Named invalidation: 3</li>
          <li>Named support or resistance: 3</li>
        </ul>
        <p className="mt-2 text-sm text-muted">
          A mood with no ticker cannot clear {CHUD_THRESHOLD}, even when the tape agrees.
        </p>
      </section>

      <section className="mt-10" aria-labelledby="marks">
        <h2 id="marks" className="font-serif text-3xl text-ink">
          {CH_FACTOR}
        </h2>
        <p className="mt-3 text-ink/80">
          Chad means Accuracy &amp; Discipline. Chud means Uncertainty &amp; Doubt. Those words are opinions
          about a past call. The 0–100 score and the 1–10 badge stay visible beside them.
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-ink/80">
          <li>
            Under {CHUD_THRESHOLD}/100 is Chud territory. The line is absolute. A score under {CHUD_THRESHOLD}{" "}
            is never Chad.
          </li>
          <li>
            Chad is the top {Math.round(CHAD_FRACTION * 100)}% of the peer set and a score of at least{" "}
            {CHUD_THRESHOLD}. On a readout, the peer set is every call on that weekly board, watchlist and
            viral together. On a leaderboard, the peer set is the accounts inside one bucket. Ties at the
            cutoff are included.
          </li>
          <li>
            A score of {CHUD_THRESHOLD} or more that sits outside the cut is neither Chad nor Chud. The card
            still shows the score.
          </li>
          <li>
            The badge runs from 1 to 10. 0–9 is badge 1. 90–100 is badge 10. Each ten-point step lifts the
            badge by one until that top band.
          </li>
        </ul>
      </section>

      <section className="mt-10" aria-labelledby="wni">
        <h2 id="wni" className="font-serif text-3xl text-ink">
          Weekend Noise Index
        </h2>
        <p className="mt-3 text-ink/80">
          The index is the share of the cohort tagged panic, crash, or selloff, shown next to the melt-up
          share. The board plots that share against the equal-weight Monday gap and Monday noon equity return
          from Friday&apos;s close, and against the VIX change at those stamps. An engagement-weighted panic
          share is shown beside the count. The index describes the book. It is not a trading signal.
        </p>
      </section>

      <section className="mt-10" aria-labelledby="consensus">
        <h2 id="consensus" className="font-serif text-3xl text-ink">
          Consensus versus the tape
        </h2>
        <p className="mt-3 text-ink/80">
          Bullish and bearish weight uses conviction: high counts 3, medium 2, low 1. A crowd is bullish at 55%
          or more of that weight, bearish at 45% or less, and split in between. The realized tape uses the
          equal-weight SPY, QQQ, and DIA move: up at least 0.08% is bullish, down at least 0.08% is bearish,
          and the middle is flat. Agreement is a description, not a recommendation.
        </p>
      </section>

      {featured && examples.length > 0 ? (
        <section className="mt-10" aria-labelledby="example">
          <h2 id="example" className="font-serif text-3xl text-ink">
            Worked example: {featured.title}
          </h2>
          <p className="mt-3 text-ink/80">
            {featured.summary}{" "}
            <Link href={`/weeks/${featured.slug}`} className="text-pine underline-offset-4 hover:underline">
              Open the full cohort
            </Link>
            .
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <caption className="sr-only">Sample grade evolution</caption>
              <thead className="text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th scope="col" className="py-2 font-medium">Call</th>
                  {READOUTS.map((kind) => (
                    <th key={kind} scope="col" className="py-2 font-medium">
                      {kind === "monday-gap" ? "Gap" : kind === "monday" ? "Noon" : kind}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {examples.map((call) => (
                  <tr key={call.id} className="border-t border-line">
                    <th scope="row" className="py-3 pr-3 font-medium">
                      <Link href={`/calls/${call.id}`} className="hover:underline">
                        {call.displayName}
                      </Link>
                      <span className="mt-0.5 block text-xs font-normal text-muted">
                        {call.sentiment} {call.explicit ? call.primary : "no ticker"}
                      </span>
                    </th>
                    {READOUTS.map((kind) => {
                      const grade = call.grades[kind];
                      return (
                        <td key={kind} className="py-3 font-mono">
                          {grade ? `${grade.score}/100` : "Pending"}
                          {grade ? (
                            <span className="mt-1 block text-xs text-muted">
                              Badge {grade.badge}/10
                              {grade.isChad ? " · Chad" : ""}
                              {grade.isChudTerritory ? " · Chud territory" : ""}
                            </span>
                          ) : null}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="mt-10" aria-labelledby="data">
        <h2 id="data" className="font-serif text-3xl text-ink">
          Where the prints come from
        </h2>
        <p className="mt-3 text-ink/80">
          Prints are recorded {PRICE_SOURCE} chart data. The seed refuses a missing quote and will not invent a
          level to fill a hole.
        </p>
        <p className="mt-3 text-ink/80">{PRICE_ADJUSTMENT}</p>
        <p className="mt-3 text-ink/80">
          The series is committed in <span className="font-mono text-xs">src/lib/market-history.json</span> and
          was fetched {PRICE_FETCHED_AT}. VIX is the Yahoo symbol ^VIX. Monday, September 7, 2026 was Labor Day.
          SPY, QQQ, and DIA have no session that day. A Yahoo VIX daily bar exists for that holiday and is not
          used as a Monday open or noon print. Wednesday, September 23 and Friday, September 25 were still ahead
          of the fetch, so those grades stay empty. FinTwitTruth does not scrape X and does not draw a price
          when a print is missing.
        </p>
        <p className="mt-4 text-sm text-muted">
          Scores describe how demo posts lined up with those recorded prints. They are not investment advice.{" "}
          <Link href="/disclaimer" className="text-pine underline-offset-4 hover:underline">
            Read the disclaimer
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
