import type { Metadata } from "next";
import Link from "next/link";
import { ChudChip, PeerChip } from "@/components/score";
import { formatPct, formatScore } from "@/lib/format";
import { getLeaderboard, type LeaderRow } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Leaderboard",
  description:
    "Charoof FinTwit account scoreboards. Watchlist and viral handles are ranked separately. Chad requires the top 30% and a score of at least 70.",
};

function Board({ title, note, rows }: { title: string; note: string; rows: LeaderRow[] }) {
  return (
    <section className="mt-8">
      <h2 className="font-serif text-3xl text-ink">{title}</h2>
      <p className="mt-2 max-w-3xl text-sm text-muted">{note}</p>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-card">
        <table className="min-w-[860px] w-full text-left text-sm">
          <caption className="sr-only">{title}</caption>
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
                    <PeerChip isChad={row.isChad} />
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
    </section>
  );
}

export default async function LeaderboardPage() {
  const [watchlist, viral] = await Promise.all([
    getLeaderboard("watchlist"),
    getLeaderboard("viral"),
  ]);
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-serif text-4xl text-ink">Leaderboards</h1>
      <p className="mt-3 max-w-3xl text-muted">
        Two buckets, ranked apart. Both still feed each week&apos;s board. An average uses the furthest grade
        on every call. Chad is the top 30% of that bucket and also at least 70. Under 70 is Chud territory.
      </p>
      <Board
        title="Named watchlist"
        note="Accounts on the standing watchlist, ranked against each other."
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
