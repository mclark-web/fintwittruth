import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar, ChudChip, DirectionChip, PeerChip, ScoreMark } from "@/components/score";
import { formatPct, formatScore } from "@/lib/format";
import { READOUT_META } from "@/lib/labels";
import { getAccount, listHandles } from "@/lib/queries";
import { READOUTS } from "@/lib/scoring";

export async function generateStaticParams() {
  const handles = await listHandles();
  return handles.map((handle) => ({ handle }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const account = await getAccount(handle);
  if (!account) return { title: "Account" };
  return {
    title: `@${account.handle}`,
    description: account.bio,
  };
}

export default async function AccountPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const account = await getAccount(handle);
  if (!account || !account.row) notFound();
  const row = account.row;
  const cohorts = new Map<string, typeof account.calls>();
  for (const call of account.calls) {
    const list = cohorts.get(call.cohortSlug) ?? [];
    list.push(call);
    cohorts.set(call.cohortSlug, list);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <p className="text-sm text-muted">
        <Link href="/leaderboard" className="hover:underline">
          Leaderboard
        </Link>
      </p>
      <header className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="flex gap-4">
          <Avatar name={account.displayName} accent={account.accent} />
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">
              Demo {account.bucket === "viral" ? "viral" : "watchlist"} account · rank {row.peerRank} of {row.peerCount} in this bucket
            </p>
            <h1 className="font-serif text-4xl text-ink">{account.displayName}</h1>
            <p className="text-muted">@{account.handle} · {account.posture}</p>
            <p className="mt-3 max-w-2xl text-ink/80">{account.bio}</p>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-xs uppercase text-muted">Average</dt>
                <dd className="font-mono text-xl">{formatScore(row.avgScore, 1)}/100</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-muted">Chad rate</dt>
                <dd className="font-mono text-xl">{formatPct(row.chadRate, 0)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-muted">Chud rate</dt>
                <dd className="font-mono text-xl">{formatPct(row.chudRate, 0)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-muted">Calls</dt>
                <dd className="font-mono text-xl">{row.callCount}</dd>
              </div>
            </dl>
          </div>
        </div>
        <ScoreMark
          score={row.avgScore}
          digits={1}
          badge={row.badge}
          isChad={row.isChad}
          isChudTerritory={row.isChudTerritory}
          rank={row.peerRank}
          peerCount={row.peerCount}
        />
      </header>
      <p className="mt-4 max-w-3xl text-sm text-muted">
        The card score is the rounded average of mature grades. Call-level scores below stay exact. Best mature grade {row.bestScore}/100. Worst {row.worstScore}/100.
      </p>

      <div className="mt-10 grid gap-8">
        {[...cohorts.entries()].map(([slug, calls]) => (
          <section key={slug} aria-labelledby={`cohort-${slug}`}>
            <h2 id={`cohort-${slug}`} className="font-serif text-2xl text-ink">
              <Link href={`/weeks/${slug}`} className="hover:underline">
                {calls[0]?.cohortTitle}
              </Link>
            </h2>
            <p className="text-sm text-muted">Same posts, rescored at the gap, Monday noon, Wednesday, and Friday.</p>
            <ul className="mt-3 grid gap-3">
              {calls.map((call) => (
                <li key={call.id} className="panel p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <DirectionChip direction={call.direction} />
                    <span className="font-mono text-xs text-pine">{call.primary}</span>
                  </div>
                  <p className="mt-2 text-ink">
                    <Link href={`/calls/${call.id}`} className="hover:underline">
                      {call.body}
                    </Link>
                  </p>
                  <ol className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {READOUTS.map((kind) => {
                      const grade = call.grades[kind];
                      return (
                        <li key={kind} className="rounded-xl bg-white px-3 py-2">
                          <Link href={`/weeks/${slug}/${kind}`} className="text-[11px] uppercase text-muted hover:underline">
                            {READOUT_META[kind].short}
                          </Link>
                          {grade ? (
                            <>
                              <p className="font-mono text-2xl">
                                {grade.score}
                                <span className="text-sm text-muted">/100</span>
                              </p>
                              <p className="text-xs text-muted">Badge {grade.badge}/10</p>
                              <span className="mt-1 flex flex-wrap gap-1">
                                {grade.isChad ? <PeerChip isChad /> : null}
                                {grade.isChudTerritory ? <ChudChip /> : null}
                              </span>
                            </>
                          ) : (
                            <p className="text-sm text-muted">Pending</p>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
