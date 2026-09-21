import type { Metadata } from "next";
import Link from "next/link";
import { ChudChip, PeerChip } from "@/components/score";
import { formatPct, formatScore } from "@/lib/format";
import { getLeaderboard } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Leaderboard",
  description: "FinTwitTruth account scoreboard. Top 30% of handles earn Chad. Averages under 70 sit in Chud territory.",
};

export default async function LeaderboardPage() {
  const rows = await getLeaderboard();
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-serif text-4xl text-ink">Leaderboard</h1>
      <p className="mt-3 max-w-3xl text-muted">
        Ranked on the average of each account&apos;s most mature grade: Friday when the week is finished,
        otherwise the latest published noon. The peer set is these accounts. The top 30% earn Chad. An average
        under 70 is still Chud territory, even for a relative Chad in a weak field.
      </p>
      <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-card">
        <table className="min-w-[860px] w-full text-left text-sm">
          <caption className="sr-only">Account leaderboard</caption>
          <thead className="bg-white text-xs uppercase tracking-wide text-muted">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Rank</th>
              <th scope="col" className="px-4 py-3 font-medium">Account</th>
              <th scope="col" className="px-4 py-3 font-medium">Avg score</th>
              <th scope="col" className="px-4 py-3 font-medium">Badge</th>
              <th scope="col" className="px-4 py-3 font-medium">Marks</th>
              <th scope="col" className="px-4 py-3 font-medium">Chad rate</th>
              <th scope="col" className="px-4 py-3 font-medium">Chud rate</th>
              <th scope="col" className="px-4 py-3 font-medium">Calls</th>
              <th scope="col" className="px-4 py-3 font-medium">Best / worst</th>
            </tr>
          </thead>
          <tbody>
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
                  <span className="flex flex-wrap gap-1">
                    {row.isChad ? <PeerChip isChad /> : <PeerChip isChad={false} />}
                    {row.isChudTerritory ? <ChudChip /> : null}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono">{formatPct(row.chadRate, 0)}</td>
                <td className="px-4 py-3 font-mono">{formatPct(row.chudRate, 0)}</td>
                <td className="px-4 py-3 font-mono">{row.callCount}</td>
                <td className="px-4 py-3 font-mono text-xs">
                  {row.bestScore}/100 · {row.worstScore}/100
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
