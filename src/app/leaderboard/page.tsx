import type { Metadata } from "next";
import Link from "next/link";
import { PendingSettleLink } from "@/components/board-state";
import { GradePill } from "@/components/gc-tube";
import { formatPct, formatScore } from "@/lib/format";
import { gcGrade } from "@/lib/grades";
import { getLeaderboard, type LeaderRow } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Leaderboard",
  description:
    "GradedCalls FinTwit account scoreboards. Ranks use settled grades only. STRONG is 70 or more. WEAK is under 40.",
};

function Board({ title, note, rows }: { title: string; note: string; rows: LeaderRow[] }) {
  return (
    <section className="mt-8">
      <h2 className="font-serif text-3xl text-ink">{title}</h2>
      <p className="mt-2 max-w-3xl text-sm text-muted">{note}</p>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-card">
        <table className="min-w-[980px] w-full text-left text-sm">
          <caption className="sr-only">{title}</caption>
          <thead className="bg-sheet text-xs uppercase tracking-wide text-muted">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Rank</th>
              <th scope="col" className="px-4 py-3 font-medium">Account</th>
              <th scope="col" className="px-4 py-3 font-medium">Avg score</th>
              <th scope="col" className="px-4 py-3 font-medium">Badge</th>
              <th scope="col" className="px-4 py-3 font-medium">Marks</th>
              <th scope="col" className="px-4 py-3 font-medium">Hit rate</th>
              <th scope="col" className="px-4 py-3 font-medium">Strong rate</th>
              <th scope="col" className="px-4 py-3 font-medium">Weak rate</th>
              <th scope="col" className="px-4 py-3 font-medium">Graded calls</th>
              <th scope="col" className="px-4 py-3 font-medium">Best / worst</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-6 text-muted">
                  No settled grades in this bucket yet. Handles show up here after a readout settles.
                </td>
              </tr>
            ) : null}
            {rows.map((row) => (
              <tr key={row.handle} className="border-t border-line">
                <td className="px-4 py-3 font-mono">{row.peerRank}</td>
                <th scope="row" className="px-4 py-3 font-medium">
                  <Link href={`/accounts/${row.handle}`} className="hover:underline">
                    {row.displayName}
                  </Link>
                  <span className="mt-0.5 block text-xs font-normal text-muted">
                    @{row.handle} · {row.posture}
                  </span>
                </th>
                <td className="px-4 py-3 font-mono text-lg">
                  {formatScore(row.avgScore, 1)}
                  <span className="text-xs text-muted">/100</span>
                </td>
                <td className="px-4 py-3 font-mono">
                  {row.badge}
                  <span className="text-xs text-muted">/10</span>
                </td>
                <td className="px-4 py-3">
                  <GradePill
                    grade={gcGrade({
                      score: row.avgScore,
                      isStrong: row.isStrong,
                      isWeak: row.isWeak,
                    })}
                  />
                </td>
                <td className="px-4 py-3 font-mono">{formatPct(row.hitRate, 0)}</td>
                <td className="px-4 py-3 font-mono">{formatPct(row.strongRate, 0)}</td>
                <td className="px-4 py-3 font-mono">{formatPct(row.weakRate, 0)}</td>
                <td className="px-4 py-3 font-mono">{row.callCount}</td>
                <td className="px-4 py-3 font-mono text-xs">
                  {row.bestScore}/100 · {row.worstScore}/100
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default async function LeaderboardPage() {
  const [verified, watchlist, viral] = await Promise.all([
    getLeaderboard("watchlist", "live"),
    getLeaderboard("watchlist", "demo"),
    getLeaderboard("viral", "demo"),
  ]);
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-serif text-4xl text-ink">Leaderboards</h1>
      <p className="mt-3 max-w-3xl text-muted">
        Verified posts rank apart from the fictional demo. An average uses the furthest settled grade on each
        call. Hit rate, STRONG rate, and WEAK rate count settled grades only. A call with no grade yet is not
        in the rank. STRONG is 70 or more. WEAK is under 40. PROVISIONAL is 40 up to 70. A 0% fill is
        EXIT LIQUIDITY.
      </p>
      <div className="mt-3">
        <PendingSettleLink href="/pending" />
      </div>
      <Board
        title="Verified watchlist"
        note="Public posts on the latest board, ranked against each other."
        rows={verified}
      />
      <Board
        title="Demo watchlist"
        note="Fictional standing accounts, ranked against each other. They are not the verified book."
        rows={watchlist}
      />
      <Board
        title="Viral doom and hype"
        note="Keyword and engagement spikes in the demo seed, ranked against each other."
        rows={viral}
      />
    </div>
  );
}
