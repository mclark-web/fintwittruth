import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NothingGraded, PendingSettleLink } from "@/components/board-state";
import { CallCard } from "@/components/call-card";
import { RealCallCard } from "@/components/real-call-card";
import { Avatar, ScoreMark } from "@/components/score";
import { TrackedAccount } from "@/components/tracked-account";
import { cohortClockDates, pendingClosure } from "@/lib/grades";
import { callHasSettledGrade } from "@/lib/board";
import { formatRate, formatScore } from "@/lib/format";
import { loadRealCallsForHandle } from "@/lib/public-real";
import { getAccount, listHandles } from "@/lib/queries";
import { READOUTS } from "@/lib/scoring";
import { pageMeta } from "@/lib/site-urls";
import { WATCHLIST, findWatchAccount, profileUrl } from "@/lib/watchlist";

function horizonState(slug: string, calls: { grades: Partial<Record<(typeof READOUTS)[number], unknown>> }[]) {
  const missing = READOUTS.filter((kind) => calls.some((call) => call.grades[kind] == null));
  const monday = slug.match(/(\d{4}-\d{2}-\d{2})$/)?.[1];
  const dates = monday ? cohortClockDates(monday) : null;
  const closure = dates && missing.length > 0 ? pendingClosure(missing, dates) : null;
  const note =
    closure && closure.closed > 0 && closure.upcoming === 0
      ? "Settled grades only. Closed sessions are not on this card."
      : "Graded checkpoints only. A checkpoint with no grade yet is not on this card.";
  return { missing, closure, note };
}

export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  const handles = await listHandles();
  const tracked = WATCHLIST.map((account) => account.handle);
  return [...new Set([...handles, ...tracked])].map((handle) => ({ handle }));
}

export const dynamicParams = true;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const account = await getAccount(handle);
  const watched = findWatchAccount(handle);
  if (!account && !watched) {
    const realCalls = await loadRealCallsForHandle(handle);
    if (realCalls.length === 0) return { title: "Account" };
    return { title: "Account", ...pageMeta(`/accounts/${handle}`) };
  }
  if (!account) return { title: `@${watched?.handle}`, ...pageMeta(`/accounts/${handle}`) };
  const demoOnly = account.calls.length > 0 && account.calls.every((call) => call.dataset === "demo");
  return {
    title: `@${account.handle}`,
    description: account.bio,
    robots: demoOnly ? { index: false, follow: false } : undefined,
    ...pageMeta(`/accounts/${handle}`),
  };
}

export default async function AccountPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const [account, realCalls] = await Promise.all([getAccount(handle), loadRealCallsForHandle(handle)]);
  const watched = findWatchAccount(handle);
  if (!account && !watched && realCalls.length === 0) notFound();
  if (!account) {
    return (
      <TrackedAccount
        handle={watched?.handle ?? realCalls[0]?.handle ?? handle}
        authorName={realCalls[0]?.authorName ?? null}
        calls={realCalls}
      />
    );
  }
  const gradedReal = realCalls.filter((call) => Object.keys(call.grades).length > 0);
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
              {account.calls.some((call) => call.dataset === "live") ? "Verified" : "Demo"}{" "}
              {account.bucket === "viral" ? "viral" : "watchlist"} account
              {row ? ` · rank ${row.peerRank} of ${row.peerCount} in this bucket` : " · not on the leaderboard yet"}
            </p>
            <h1 className="font-serif text-4xl text-ink">{account.displayName}</h1>
            <p className="text-muted">
              @{account.handle}
              {watched ? (
                <>
                  {" · "}
                  <a href={profileUrl(account.handle)} className="accent-link underline-offset-4 hover:underline">
                    Profile on X
                  </a>
                </>
              ) : null}
              {" · "}
              {account.posture}
            </p>
            <p className="mt-3 max-w-2xl text-ink/80">{account.bio}</p>
            {row ? (
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-5">
                <div>
                  <dt className="text-xs uppercase text-muted">Average grade</dt>
                  <dd className="font-mono text-xl">{formatScore(row.avgScore, 0)}%</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Hit</dt>
                  <dd className="font-mono text-xl">{formatRate(row.hitRate, 0)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">STRONG rate</dt>
                  <dd className="font-mono text-xl">{formatRate(row.strongRate, 0)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">WEAK rate</dt>
                  <dd className="font-mono text-xl">{formatRate(row.weakRate, 0)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-muted">Graded calls</dt>
                  <dd className="font-mono text-xl">{row.callCount}</dd>
                </div>
              </dl>
            ) : watched && gradedReal.length === 0 ? (
              <div className="panel mt-4 p-5">
                <h2 className="font-serif text-2xl text-ink">Not graded yet</h2>
                <p className="mt-2 text-sm text-muted">
                  A call is graded once its post URL is confirmed.{" "}
                  <Link href="/methodology" className="accent-link hit-44 underline-offset-4 hover:underline">
                    How grading works
                  </Link>
                </p>
              </div>
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
            isStrong={row.isStrong}
            isWeak={row.isWeak}
            rank={row.peerRank}
            peerCount={row.peerCount}
          />
        ) : null}
      </header>
      <p className="mt-4 max-w-3xl text-sm text-muted">
        {row
          ? `The number is the average of the furthest graded checkpoint on each call. Hit is the share of graded calls that were right. Best ${formatScore(row.bestScore)}%. Worst ${formatScore(row.worstScore)}%.`
          : "This handle has no graded call, so it is not ranked."}
      </p>
      {row && pendingCount > 0 ? (
        <div className="mt-3">
          <PendingSettleLink href="/pending" />
        </div>
      ) : null}

      {realCalls.length > 0 ? (
        <section className="mt-10 grid gap-4" aria-labelledby="real-calls">
          <h2 id="real-calls" className="font-serif text-2xl text-ink">
            Verified real calls
          </h2>
          {realCalls.map((call) => (
            <RealCallCard key={call.id} call={call} />
          ))}
        </section>
      ) : null}

      <div className="mt-10 grid gap-8">
        {[...cohorts.entries()].map(([slug, calls]) => {
          const horizon = horizonState(slug, calls);
          return (
          <section key={slug} aria-labelledby={`cohort-${slug}`}>
            <h2 id={`cohort-${slug}`} className="font-serif text-2xl text-ink">
              <Link href={`/weeks/${slug}`} className="hover:underline">
                {calls[0]?.cohortTitle}
              </Link>
            </h2>
            <p className="text-sm text-muted">{horizon.note}</p>
            <ul className="mt-3 grid gap-3">
              {calls.map((call) => {
                const readout = call.grades.monday
                  ? "monday"
                  : call.grades.friday
                    ? "friday"
                    : call.grades.wednesday
                      ? "wednesday"
                      : "monday-gap";
                return (
                  <li key={call.id}>
                    <CallCard call={call} readout={readout} quotes={account.quotesBySlug[slug]} />
                  </li>
                );
              })}
            </ul>
            {horizon.missing.length > 0 ? (
              <div className="mt-3">
                <PendingSettleLink
                  href={`/weeks/${slug}/pending`}
                  waiting={horizon.missing.length}
                  closure={horizon.closure ?? undefined}
                />
              </div>
            ) : null}
          </section>
          );
        })}
      </div>
    </div>
  );
}
