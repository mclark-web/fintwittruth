import type { Metadata } from "next";
import Link from "next/link";
import { CalendarStrip } from "@/components/market";
import { formatScopeWhen } from "@/lib/format";
import { UNGRADED_HORIZON } from "@/lib/grades";
import { GC_FACTOR } from "@/lib/labels";
import { PRICE_CLOSED_RULE, PRICE_FETCHED_AT, PRICE_SOURCE } from "@/lib/quotes";
import { checkedWeekRows } from "@/lib/empty-weeks";
import { GRADED_PRINT_LIST, OCT19_X_SCOPE, methodologySourceLead } from "@/lib/search-scope";
import {
  STRONG_LINE,
  DIRECTION_BANDS,
  DIRECTION_MAX,
  LEVEL_MAX,
  SPECIFICITY_MAX,
  VIX_BANDS,
  VIX_MAX,
} from "@/lib/scoring";

export const metadata: Metadata = {
  title: "Methodology",
  description:
    "GradedCalls FinTwit v1 grades one Wednesday-to-Sunday cohort on the Monday gap, Monday noon, the Wednesday close, and the Friday close, with a VIX factor.",
};

export default function MethodologyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-xs uppercase tracking-wide text-muted">GradedCalls FinTwit v1</p>
      <h1 className="mt-2 font-serif text-4xl text-ink">How a week is graded</h1>
      <p className="mt-4 text-lg text-ink/80">
        GradedCalls FinTwit is a scorecard. The board grades sourced public posts against recorded prints.
        It does not tell anyone to buy or sell because the noise was loud.
      </p>

      <section className="mt-8" aria-labelledby="inclusion">
        <h2 id="inclusion" className="font-serif text-3xl text-ink">
          Who is in the book
        </h2>
        <p className="mt-3 text-ink/80">
          Each Wednesday 12:00 PM ET through Sunday 5:00 PM ET cohort has two buckets. Both feed the weekly
          board. Live accounts share one rank. An account is on that rank once a call is graded.
        </p>
        <dl className="mt-4 grid gap-4">
          <div className="panel p-4">
            <dt className="font-medium text-ink">Named watchlist</dt>
            <dd className="mt-1 text-sm text-muted">
              Accounts we follow. A post joins the rank after it is verified and graded.
            </dd>
          </div>
          <div className="panel p-4">
            <dt className="font-medium text-ink">Viral doom and hype</dt>
            <dd className="mt-1 text-sm text-muted">
              Crash, war, sell-the-open, and melt-up posts. A verified post is ranked with the accounts we follow.
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
              grow after Sunday. One call per handle per cohort; a handle can appear in later weeks. The slot is
              the earliest forward-looking post that names a direction on a graded print ({GRADED_PRINT_LIST}) and
              does not expire before that week&apos;s checkpoints. The choice is from the post text, not the later
              print. A post that names no ticker is not shown. The row stays in the ledger with exclusion reason no-ticker
              and is left out of the pages, counts, ranks, lead, and sitemap. It is not graded on SPY.
              A same-day or 0DTE trade does not take the slot: a 0DTE tone, a trade for today, a bare Friday
              that is not &quot;next Friday,&quot; or an intraday label posted on the collect-window Friday. That
              row stays in the ledger, ungraded, and the next eligible post from the handle is the call. A fill
              note or an intraday label from earlier in the window stays graded when the post does not name that
              expiry. One graded call is enough to rank. An ambiguous direction is excluded.{" "}
              {methodologySourceLead(checkedWeekRows())} {OCT19_X_SCOPE}
            </dd>
          </div>
          <div className="panel p-4">
            <dt className="font-medium text-ink">Weekend reference</dt>
            <dd className="mt-1 text-sm text-muted">
              There is no Sunday cash print. The reference is the prior trading-week close (Friday, or Thursday
              when Friday is a market holiday) for SPY, QQQ, DIA, and that day&apos;s VIX close. Equity index futures are shut from Friday 5:00 PM ET until
              Sunday 6:00 PM ET, so Sunday 5:00 PM only ends the book. Yahoo adjclose is stored for audit and is
              not used against the unadjusted open, the Monday noon bar, or the official close.
            </dd>
          </div>
          <div className="panel p-4">
            <dt className="font-medium text-ink">Monday open — 9:30 AM ET</dt>
            <dd className="mt-1 text-sm text-muted">
              Monday open is the move from Friday&apos;s close to the 9:30 AM ET open for SPY, QQQ, and DIA. Older notes
              called this the Monday gap. VIX uses Friday&apos;s close to Monday&apos;s regular-session open.
            </dd>
          </div>
          <div className="panel p-4">
            <dt className="font-medium text-ink [text-wrap:balance]">Monday 12:00 PM ET — weekend-noise grade</dt>
            <dd className="mt-1 text-sm text-muted">
              The primary score. It asks whether the weekend doom, war panic, sell-the-open calls, and melt-up
              calls were still there at noon. The print is the open of the Yahoo Finance 5-minute bar stamped
              12:00 PM America/New_York. The chart endpoint is
              https://query1.finance.yahoo.com/v8/finance/chart/{"{symbol}"} with period1 at 13:00 UTC on that
              session date, period2 at 22:00 UTC, interval 5m, includeAdjustedClose true, and events div.
              The raw response behind each noon print is committed with that URL, those settings, the fetch
              time, and a SHA-256 checksum of the body. The accuracy guard compares the displayed print to
              that file, to the cent. A live re-check then pulls the same chart at least three times and
              takes a majority within $0.05. When those pulls disagree, the guard reports Yahoo unstable.
              A live flip does not fail the guard. A 12:00 open that exactly equals the previous bar&apos;s close
              is flagged as a possible filled bar. On October 19, 2026 the unfilled 5-minute open is 769.07.
              The 11:55 5-minute bar closes at 769.45, which is also the 11:59 1-minute close. Yahoo
              sometimes serves that 769.45 figure as the 12:00 open. That filled open is not the grade.
              The stored Monday grade is the unfilled 12:00 5-minute open. VIX uses the same stamp.
            </dd>
          </div>
          <div className="panel p-4">
            <dt className="font-medium text-ink">Wed close and Fri close</dt>
            <dd className="mt-1 text-sm text-muted">
              The same calls, aged against the official regular-session close and VIX at that close. A regular
              session closes at 4:00 PM ET. An early-close day uses the 1:00 PM ET official close. There is no
              4:00 PM bar on those days. The grade waits 45 minutes after the close so Yahoo&apos;s daily bar and
              the VIX print are posted. A daily bar before that buffer is the last trade, not the close.
              Wednesday at noon still opens the next collect window. That new window is a different board.
              Wednesday&apos;s close still belongs to the cohort that closed the previous Sunday. Friday&apos;s
              close is the last score on the book.
            </dd>
          </div>
          <div className="panel p-4">
            <dt className="font-medium text-ink">Verified real calls</dt>
            <dd className="mt-1 text-sm text-muted">
              Sourced calls and paste-intake calls use the same stamps. Monday is the open of the 12:00 PM ET
              5-minute bar. Wednesday and Friday are the 4:00 PM ET regular-session close. Those calls skip the
              Monday gap.
            </dd>
          </div>
          <div className="panel p-4">
            <dt className="font-medium text-ink">Missing print</dt>
            <dd className="mt-1 text-sm text-muted">{PRICE_CLOSED_RULE}</dd>
          </div>
          <div className="panel p-4">
            <dt className="font-medium text-ink">Boards show settled grades only</dt>
            <dd className="mt-1 text-sm text-muted">
              The home tape, weekly rankings, leaderboards, and account scorecards list a call only after a
              readout has settled. Monday&apos;s open, Monday noon, the Wednesday close, and the Friday close are those horizons.
              Hit rate, STRONG rate, and WEAK rate are the share of settled readouts, not the share of calls.
              A readout is Monday&apos;s open, Monday noon, the Wednesday close, or the Friday close. The graded-checkpoint
              count is Monday noon, Wednesday, and Friday only, so a hit rate can include the Monday open and
              still differ from that checkpoint total. While a readout is still scheduled,
              the calls sit on that week&apos;s Not graded yet list.{" "}
              <Link href="/weeks" className="accent-link underline-offset-4 hover:underline">
                All weeks
              </Link>
              . That list is not part of the ranking.
            </dd>
          </div>
        </dl>
      </section>

      <section className="mt-10" aria-labelledby="score">
        <h2 id="score" className="font-serif text-3xl text-ink">
          How the percentage is built
        </h2>
        <p className="mt-3 text-ink/80">
          The board shows one GC Scale percent. Parts add to that percent: direction {DIRECTION_MAX}, levels{" "}
          {LEVEL_MAX}, specificity {SPECIFICITY_MAX}, VIX {VIX_MAX}.
        </p>
        <p className="mt-3 text-ink/80">
          Once a primary named in the post is recorded and an earlier checkpoint is graded, a later checkpoint is graded on
          that same primary when the print is in the price file. A post that names no ticker is not shown. It stays in
          the ledger with exclusion reason no-ticker and is not graded on SPY. A post that was never graded stays pending
          when it names more than one print. A missing print stays pending and is not invented.
          The call score is the latest settled checkpoint: Friday close, else Wednesday close, else Monday noon.
          It is not the mean of those pills. The home lead is the mean of those call scores on the newest
          closed week that already has a grade.
        </p>
        <h3 className="mt-6 font-medium text-ink">Direction versus the recorded primary</h3>
        <p className="mt-1 text-sm text-muted">
          A call is scored on its recorded primary. The move is that symbol&apos;s print minus the reference,
          divided by the reference. A bullish call wants that print up. A bearish call wants it down. Flat is a
          push. The equal-weight SPY, QQQ, and DIA move is the cohort tape on the week page. It is not the
          call&apos;s direction score, and it is not the hit. Numbered targets are checked on the same primary.
          A selloff call scores well only when its primary is down. A melt-up call scores well only when its
          primary is up.
        </p>
        <ul className="mt-3 grid gap-3 min-[820px]:hidden">
          {DIRECTION_BANDS.map((band) => (
            <li key={band.label} className="panel p-4">
              <p className="text-sm">{band.label}</p>
              <p className="mt-1 font-mono text-sm">{band.points} points</p>
            </li>
          ))}
        </ul>
        <div className="mt-3 hidden min-[820px]:block">
          <table className="w-full text-left text-sm">
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
        </div>
        <h3 className="mt-6 font-medium text-ink">VIX factor, {VIX_MAX} points</h3>
        <p className="mt-1 text-sm text-muted">
          VIX is always in the score. A panic, crash, or selloff call wants VIX higher. A melt-up or
          complacency call wants VIX lower. A spike hurts a melt-up call. A drop hurts a panic call. The move
          is Friday&apos;s VIX close to the VIX print at the same stamp as the equity readout.
        </p>
        <ul className="mt-3 grid gap-3 min-[820px]:hidden">
          {VIX_BANDS.map((band) => (
            <li key={band.label} className="panel p-4">
              <p className="text-sm">{band.label}</p>
              <p className="mt-1 font-mono text-sm">{band.points} points</p>
            </li>
          ))}
        </ul>
        <div className="mt-3 hidden min-[820px]:block">
          <table className="w-full text-left text-sm">
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
        </div>
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
          A post that names no ticker is not shown and is not scored.
        </p>
      </section>

      <section className="mt-10" aria-labelledby="marks">
        <h2 id="marks" className="font-serif text-3xl text-ink">
          {GC_FACTOR}
        </h2>
        <p className="mt-3 text-ink/80">
          {GC_FACTOR}: STRONG 70+, PROVISIONAL 40–69, WEAK under 40, EXIT LIQUIDITY at a graded 0. An ungraded
          horizon reads <span className="text-[#9a9aa3]">{UNGRADED_HORIZON}</span>.
        </p>
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

      <section className="mt-10" aria-labelledby="data">
        <h2 id="data" className="font-serif text-3xl text-ink">
          Where the prints come from
        </h2>
        <p className="mt-3 text-ink/80">
          Prints are recorded {PRICE_SOURCE} chart data. The seed refuses a missing quote and will not invent a
          level to fill a hole.
        </p>
        <p className="mt-3 text-ink/80">
          Weekend reference is the prior trading-week close (Friday, or Thursday when Friday is a market holiday)
          for SPY, QQQ, DIA, and VIX. That close is stored next to Yahoo adjclose for audit. Grades measure against
          the session close, not a dividend-rewritten adjclose. A holiday has no equity daily bar and stays ungraded.
        </p>
        <p className="mt-3 text-ink/80">
          The series is committed in <span className="font-mono text-xs">src/lib/market-history.json</span> and
          was fetched {formatScopeWhen(PRICE_FETCHED_AT)}. VIX is the Yahoo symbol ^VIX. Monday, September 7, 2026 was Labor Day.
          SPY, QQQ, and DIA have no session that day. A Yahoo VIX daily bar exists for that holiday and is not
          used as a Monday open or noon print. Wednesday, September 23 and Friday, September 25 are graded on
          those days&apos; official closes.
          GradedCalls FinTwit does not scrape X and does not draw a price when a print is missing.
        </p>
        <p className="mt-4 text-sm text-muted">
          Scores describe how posts lined up with those recorded prints. They are not investment advice.
          GradedCalls FinTwit is not affiliated with Yahoo Finance.{" "}
          <Link href="/disclaimer" className="text-pine underline-offset-4 hover:underline">
            Read the disclaimer
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
