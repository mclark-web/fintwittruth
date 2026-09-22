import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NothingGraded, PendingSettleLink } from "@/components/board-state";
import { Avatar, ChudChip, DirectionChip, PeerChip, ScoreMark } from "@/components/score";
import { callHasSettledGrade, settledGradeKinds } from "@/lib/board";
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
  if (!account) notFound();
  const row = account.row;
  const gradedCalls = account.calls.filter((call) => callHasSettledGrade(call.grades));
  const pendingCount = account.calls.length - gradedCalls.length;
  const cohorts = new Map<string, typeof gradedCalls>();
  for (const call of gradedCalls) {
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
              Demo {account.bucket === "viral" ? "viral" : "watchlist"} account
              {row ? ` · rank ${row.peerRank} of ${row.peerCount} in this bucket` : " · not on the leaderboard yet"}
            </p>
            <h1 className="font-serif text-4xl text-ink">{account.displayName}</h1>
            <p className="text-muted">@{account.handle} · {account.posture}</p>
            <p className="mt-3 max-w-2xl text-ink/80">{account.bio}</p>
            {row ? (
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-5">
                <div>
                  <dt className="text-xs uppercase text-muted">Average</dt>
                  <dd className="font-mono text-xl">{formatScore(row.avgScore, 1)}/100</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-muted">Hit rate</dt>
                  <dd className="font-mono text-xl">{formatPct(row.hitRate, 0)}</dd>
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
                  <dt className="text-xs uppercase text-muted">Graded calls</dt>
                  <dd className="font-mono text-xl">{row.callCount}</dd>
                </div>
              </dl>
            ) : (
              <div className="mt-4">
                <NothingGraded href="/pending" />
              </div>
            )}
          </div>
        </div>
        {row ? (
          <ScoreMark
            score={row.avgScore}
            digits={1}
            badge={row.badge}
            isChad={row.isChad}
            isChudTerritory={row.isChudTerritory}
            rank={row.peerRank}
            peerCount={row.peerCount}
          />
        ) : null}
      </header>
      <p className="mt-4 max-w-3xl text-sm text-muted">
        {row
          ? `The card score is the rounded average of the furthest settled grade on each call. Hit rate, Chad rate, and Chud rate use settled grades only. Best settled grade ${row.bestScore}/100. Worst ${row.worstScore}/100.`
          : "This handle has no settled grade, so it is not ranked."}
      </p>
      {row && pendingCount > 0 ? (
        <div className="mt-3">
          <PendingSettleLink href="/pending" />
        </div>
      ) : null}

      <div className="mt-10 grid gap-8">
        {[...cohorts.entries()].map(([slug, calls]) => (
          <section key={slug} aria-labelledby={`cohort-${slug}`}>
            <h2 id={`cohort-${slug}`} className="font-serif text-2xl text-ink">
              <Link href={`/weeks/${slug}`} className="hover:underline">
                {calls[0]?.cohortTitle}
              </Link>
            </h2>
            <p className="text-sm text-muted">Settled grades only. Horizons still waiting on the tape are not on this card.</p>
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
                    {settledGradeKinds(call.grades).map((kind) => {
                      const grade = call.grades[kind];
                      if (!grade) return null;
                      return (
                        <li key={kind} className="rounded-xl bg-white px-3 py-2">
                          <Link href={`/weeks/${slug}/${kind}`} className="text-[11px] uppercase text-muted hover:underline">
                            {READOUT_META[kind].short}
                          </Link>
                          <p className="font-mono text-2xl">
                            {grade.score}
                            <span className="text-sm text-muted">/100</span>
                          </p>
                          <p className="text-xs text-muted">Badge {grade.badge}/10</p>
                          <span className="mt-1 flex flex-wrap gap-1">
                            {grade.isChad ? <PeerChip isChad /> : null}
                            {grade.isChudTerritory ? <ChudChip /> : null}
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                </li>
              ))}
            </ul>
            {calls.some((call) => settledGradeKinds(call.grades).length < READOUTS.length) ? (
              <div className="mt-3">
                <PendingSettleLink href={`/weeks/${slug}/pending`} />
              </div>
            ) : null}
          </section>
        ))}
      </div>
    </div>
  );
}
