import type { Metadata } from "next";
import Link from "next/link";
import { CalendarStrip } from "@/components/market";
import {
  CHAD_FRACTION,
  CHUD_THRESHOLD,
  DIRECTION_BANDS,
  DIRECTION_MAX,
  LEVEL_MAX,
  SPECIFICITY_MAX,
} from "@/lib/scoring";
import { getCohort } from "@/lib/queries";
import { FEATURED_COHORT_SLUG } from "@/lib/demo-data";

export const metadata: Metadata = {
  title: "Methodology",
  description:
    "FinTwitTruth collects one cohort from Wednesday noon through Sunday 5pm ET and grades it Monday, Wednesday, and Friday at noon.",
};

export default async function MethodologyPage() {
  const featured = await getCohort(FEATURED_COHORT_SLUG);
  const examples = featured
    ? ["permapump", "doomscroll", "narrativened"]
        .map((handle) => featured.calls.find((call) => call.handle === handle))
        .filter((call) => call != null)
    : [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-xs uppercase tracking-wide text-muted">Locked calendar</p>
      <h1 className="mt-2 font-serif text-4xl text-ink">How a week is graded</h1>
      <p className="mt-4 text-lg text-ink/80">
        FinTwitTruth does not grade three different piles of posts. It watches one weekend-positioning window
        age against the market from Monday to Friday.
      </p>

      <section className="mt-8" aria-labelledby="calendar">
        <h2 id="calendar" className="font-serif text-3xl text-ink">
          Collect once, read three times
        </h2>
        <div className="mt-4">
          <CalendarStrip />
        </div>
        <dl className="mt-6 grid gap-4">
          <div className="panel p-4">
            <dt className="font-medium text-ink">Collect window</dt>
            <dd className="mt-1 text-sm text-muted">
              Wednesday 12:00 PM America/New_York through Sunday 5:00 PM America/New_York. Every call on that
              week&apos;s board was posted inside this window. The cohort does not grow after Sunday.
            </dd>
          </div>
          <div className="panel p-4">
            <dt className="font-medium text-ink">Reference price</dt>
            <dd className="mt-1 text-sm text-muted">
              The last official cash close, frozen at the Sunday 5:00 PM ET cutoff. Equity index futures are
              shut from Friday 5:00 PM ET until Sunday 6:00 PM ET, so Sunday 5:00 PM ends the book. It is not a
              new cash print. In this demo that close is the Yahoo Finance unadjusted regular-session close of
              the Friday before readout Monday. Every later grade measures the move from that same reference.
            </dd>
          </div>
          <div className="panel p-4">
            <dt className="font-medium text-ink">Monday 12:00 PM ET — initial grade</dt>
            <dd className="mt-1 text-sm text-muted">
              First score after the Sunday futures reopen and the Monday morning session. The print is the open
              of the Yahoo Finance 5-minute bar stamped 12:00 PM America/New_York. If that cash session is
              closed, the grade repeats the prior official close. No bar is filled in.
            </dd>
          </div>
          <div className="panel p-4">
            <dt className="font-medium text-ink">Wednesday 12:00 PM ET — mid-week update</dt>
            <dd className="mt-1 text-sm text-muted">
              The same calls, rescored. A new collect window opens this same hour for next week&apos;s cohort.
              That new window is a different board. Wednesday&apos;s grade still belongs to the cohort that
              closed the previous Sunday.
            </dd>
          </div>
          <div className="panel p-4">
            <dt className="font-medium text-ink">Friday 12:00 PM ET — final grade</dt>
            <dd className="mt-1 text-sm text-muted">
              Last score on that cohort. Leaderboard &quot;mature&quot; averages prefer this print when it exists.
            </dd>
          </div>
        </dl>
      </section>

      <section className="mt-10" aria-labelledby="score">
        <h2 id="score" className="font-serif text-3xl text-ink">
          The 0–100 score
        </h2>
        <p className="mt-3 text-ink/80">
          Every published grade shows the full score. Parts add up to 100: direction {DIRECTION_MAX}, levels{" "}
          {LEVEL_MAX}, specificity {SPECIFICITY_MAX}.
        </p>
        <h3 className="mt-6 font-medium text-ink">Direction, from the Sunday reference</h3>
        <p className="mt-1 text-sm text-muted">
          A bullish call is scored on the symbol&apos;s raw move. A bearish call is scored on the inverse. Flat
          tape is a push, not a win.
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
        <h3 className="mt-6 font-medium text-ink">Levels</h3>
        <p className="mt-1 text-sm text-muted">
          A reached target scores {LEVEL_MAX}. A near miss scores less. Support and resistance score when they
          hold. If a stated invalidation is busted, level points cap at 2 — a far-off target cannot hide a
          broken call. A post with no level keeps a floor of 6.
        </p>
        <h3 className="mt-6 font-medium text-ink">Specificity</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
          <li>Named ticker: 5</li>
          <li>Named target: 4</li>
          <li>Named invalidation: 3</li>
          <li>Named support or resistance: 3</li>
        </ul>
        <p className="mt-2 text-sm text-muted">
          A mood with no ticker cannot clear {CHUD_THRESHOLD}, even when the tape agrees. Naming the instrument
          and a level is how a call leaves Chud territory.
        </p>
      </section>

      <section className="mt-10" aria-labelledby="marks">
        <h2 id="marks" className="font-serif text-3xl text-ink">
          Chad, Chud territory, and the badge
        </h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-ink/80">
          <li>Under {CHUD_THRESHOLD}/100 is Chud territory. The line is absolute. It does not care how the rest of the field did.</li>
          <li>
            The top {Math.round(CHAD_FRACTION * 100)}% of the peer set earns Chad. On a readout, the peer set is
            the calls in that cohort. On the leaderboard, the peer set is the accounts. Ties at the cutoff are
            included, so a crowded score can put slightly more than 30% in Chad.
          </li>
          <li>
            Both labels can be true. A weak week can crown a peer Chad who is still under 70. The card shows the
            score, the Chad mark, and Chud territory together.
          </li>
          <li>
            The badge runs from 1 to 10 beside the score. 0–9 is badge 1, the Chud end. 90–100 is badge 10, the
            Chad end. Each ten-point step lifts the badge by one until that top band.
          </li>
        </ul>
      </section>

      <section className="mt-10" aria-labelledby="consensus">
        <h2 id="consensus" className="font-serif text-3xl text-ink">
          Consensus versus the tape
        </h2>
        <p className="mt-3 text-ink/80">
          Bullish and bearish weight uses conviction: high counts 3, medium 2, low 1. A crowd is bullish at 55%
          or more of that weight, bearish at 45% or less, and split in between. The tape is SPY versus the
          Sunday reference: up at least 0.08% is bullish, down at least 0.08% is bearish, and the middle is flat.
          The readout says whether the crowd and the tape agree. Agreement is not a recommendation.
        </p>
      </section>

      {featured && examples.length > 0 ? (
        <section className="mt-10" aria-labelledby="example">
          <h2 id="example" className="font-serif text-3xl text-ink">
            Worked example: {featured.title}
          </h2>
          <p className="mt-3 text-ink/80">
            {featured.summary} These three demo calls are the same posts at every column.{" "}
            <Link href={`/weeks/${featured.slug}`} className="text-pine underline-offset-4 hover:underline">
              Open the full cohort
            </Link>
            .
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <caption className="sr-only">Sample grade evolution</caption>
              <thead className="text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th scope="col" className="py-2 font-medium">Call</th>
                  <th scope="col" className="py-2 font-medium">Monday</th>
                  <th scope="col" className="py-2 font-medium">Wednesday</th>
                  <th scope="col" className="py-2 font-medium">Friday</th>
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
                        {call.direction} {call.explicit ? call.primary : "no ticker"}
                      </span>
                    </th>
                    {(["monday", "wednesday", "friday"] as const).map((kind) => {
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
          Where the posts come from
        </h2>
        <p className="mt-3 text-ink/80">
          Handles and wording in this deployment are a labeled demo. Market outcomes are not. Each grade uses
          the Yahoo Finance print for that evaluation date, committed in{" "}
          <span className="font-mono text-xs">src/lib/market-history.json</span> and fetched from the chart API
          on September 21, 2026. The Friday reference is the unadjusted regular-session close. Monday, Wednesday,
          and Friday grades are the open of the 5-minute bar at 12:00 PM ET. Yahoo&apos;s dividend-adjusted close
          is stored beside the official close and is not used, because the noon bars are not dividend-adjusted.
          Monday, September 7, 2026 was Labor Day, so that readout repeats the September 4 close. Wednesday,
          September 23 and Friday, September 25 were still ahead of the fetch, so those grades stay empty.
          FinTwitTruth does not scrape X or any ranking site, and it does not draw a price path when a print is
          missing. A later feed would implement the social and market adapters, write into the same cohort shape,
          and rerun the scorer at each noon. The calendar above does not change when the source changes.
        </p>
        <p className="mt-4 text-sm text-muted">
          Scores describe how fictional posts lined up with those recorded prints. They are not investment advice,
          and a past week is not a forecast. FinTwitTruth is not affiliated with Yahoo Finance.{" "}
          <Link href="/disclaimer" className="text-pine underline-offset-4 hover:underline">
            Read the disclaimer
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
