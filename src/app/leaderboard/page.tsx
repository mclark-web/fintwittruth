import type { Metadata } from "next";
import Link from "next/link";
import { PendingSettleLink } from "@/components/board-state";
import { GradePill } from "@/components/gc-tube";
import { formatRate, formatScore } from "@/lib/format";
import { gcGrade } from "@/lib/grades";
import { getLeaderboard, type LeaderRow } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Leaderboard",
  description: "GradedCalls FinTwit account scoreboards. Ranks use settled grades only.",
};

function Board({ title, note, rows }: { title: string; note: string; rows: LeaderRow[] }) {
  return (
    <section className="mt-8">
      <h2 className="font-serif text-3xl text-ink">{title}</h2>
      <p className="mt-2 max-w-3xl text-sm text-muted">{note}</p>
      <ul className="mt-4 grid gap-3 min-[820px]:hidden">
        {rows.length === 0 ? (
          <li className="panel p-4 text-sm text-muted">
            No graded calls in this list yet. An account shows up here after a call is graded.
          </li>
        ) : (
          rows.map((row) => (
            <li key={row.handle} className="panel p-4">
              <p className="text-xs text-[#9a9aa3]">Rank {row.peerRank}</p>
              <p className="mt-1 font-medium">
                <Link href={`/accounts/${row.handle}`} className="hover:underline">
                  {row.displayName}
                </Link>
              </p>
              <p className="text-xs text-muted">
                @{row.handle} · {row.posture}
              </p>
              <p className="mt-2 font-mono text-2xl text-ink">
                {formatScore(row.avgScore, 0)}
                <span className="text-sm text-muted">%</span>
              </p>
              <div className="mt-2">
                <GradePill
                  grade={gcGrade({
                    score: row.avgScore,
                    isStrong: row.isStrong,
                    isWeak: row.isWeak,
                  })}
                />
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <dt className="text-xs text-[#9a9aa3]">Hit</dt>
                  <dd className="font-mono">{formatRate(row.hitRate, 0)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[#9a9aa3]">STRONG rate</dt>
                  <dd className="font-mono">{formatRate(row.strongRate, 0)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[#9a9aa3]">WEAK rate</dt>
                  <dd className="font-mono">{formatRate(row.weakRate, 0)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[#9a9aa3]">Graded calls</dt>
                  <dd className="font-mono">{row.callCount}</dd>
                </div>
              </dl>
              <p className="mt-2 font-mono text-xs text-muted">
                Best {formatScore(row.bestScore)}% · worst {formatScore(row.worstScore)}%
              </p>
            </li>
          ))
        )}
      </ul>
      <div className="mt-4 hidden overflow-x-clip rounded-2xl border border-line bg-card min-[820px]:block">
        <table className="w-full table-fixed text-left text-sm">
          <caption className="sr-only">{title}</caption>
          <thead className="bg-sheet text-xs uppercase tracking-wide text-muted">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Rank</th>
              <th scope="col" className="px-4 py-3 font-medium">Account</th>
              <th scope="col" className="px-4 py-3 font-medium">Average grade</th>
              <th scope="col" className="px-4 py-3 font-medium">Grade</th>
              <th scope="col" className="px-4 py-3 font-medium">Hit</th>
              <th scope="col" className="px-4 py-3 font-medium">STRONG rate</th>
              <th scope="col" className="px-4 py-3 font-medium">WEAK rate</th>
              <th scope="col" className="px-4 py-3 font-medium">Graded calls</th>
              <th scope="col" className="px-4 py-3 font-medium">Best / worst</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-muted">
                  No graded calls in this list yet. An account shows up here after a call is graded.
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
                  {formatScore(row.avgScore, 0)}
                  <span className="text-xs text-muted">%</span>
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
                <td className="px-4 py-3 font-mono">{formatRate(row.hitRate, 0)}</td>
                <td className="px-4 py-3 font-mono">{formatRate(row.strongRate, 0)}</td>
                <td className="px-4 py-3 font-mono">{formatRate(row.weakRate, 0)}</td>
                <td className="px-4 py-3 font-mono">{row.callCount}</td>
                <td className="px-4 py-3 font-mono text-xs">
                  {formatScore(row.bestScore)}% · {formatScore(row.worstScore)}%
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
  const verified = await getLeaderboard("watchlist", "live");
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-serif text-4xl text-ink">Leaderboard</h1>
      <p className="mt-3 max-w-3xl text-muted">
        Live accounts only. An average grade uses the furthest graded checkpoint on each call. Hit is the share
        of graded calls that were right. STRONG rate and WEAK rate count graded calls only. An account with no
        graded call is not in this rank. Bands are on the{" "}
        <Link href="/methodology" className="accent-link underline-offset-4 hover:underline">
          methodology
        </Link>{" "}
        page. Fictional ranks live on the demo board.
      </p>
      <div className="mt-7">
        <PendingSettleLink href="/pending" />
      </div>
      <Board
        title="Tracked accounts"
        note="Verified posts, ranked against each other. Accounts with no graded call read Not graded yet on the home board."
        rows={verified}
      />
    </div>
  );
}
