import type { Metadata } from "next";
import Link from "next/link";
import { UNCONFIGURED_PUBLIC } from "@/lib/intake-store";
import { loadRealCalls } from "@/lib/public-real";
import { trackedRoster } from "@/lib/watchlist";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Watchlist",
  description: "Accounts tracked by GradedCalls FinTwit. No grade until a post is confirmed.",
};

export default async function WatchlistPage() {
  const loaded = await loadRealCalls();
  let cohorts: { calls: { handle: string; sourceUrl: string; grades: Record<string, unknown> }[] }[] = [];
  try {
    const { getLiveCohorts } = await import("@/lib/queries");
    cohorts = await getLiveCohorts();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
  }
  const gradedHandles = new Set<string>();
  for (const cohort of cohorts) {
    for (const call of cohort.calls) {
      if (call.grades.monday || call.grades.wednesday || call.grades.friday || call.grades["monday-gap"]) {
        gradedHandles.add(call.handle.toLowerCase());
      }
    }
  }
  for (const call of loaded.calls) {
    if (Object.keys(call.grades).length > 0) gradedHandles.add(call.handle.toLowerCase());
  }
  const roster = trackedRoster([
    ...cohorts.flatMap((cohort) =>
      cohort.calls.map((call) => ({ handle: call.handle, sourceUrl: call.sourceUrl })),
    ),
    ...loaded.calls.map((call) => ({ handle: call.handle, sourceUrl: call.sourceUrl })),
  ]);
  const gradedCount = roster.filter((account) => gradedHandles.has(account.handle.toLowerCase())).length;
  const intakeNote = loaded.kind === "unconfigured" && cohorts.every((cohort) => cohort.calls.length === 0) ? UNCONFIGURED_PUBLIC : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <p className="text-xs uppercase tracking-wide text-[#c9c9cf]">Real accounts</p>
      <h1 className="mt-2 font-serif text-4xl text-ink">Watchlist</h1>
      <p className="mt-3 max-w-3xl text-muted">
        {roster.length} accounts tracked.{" "}
        {gradedCount === 0
          ? "None has a verified, graded call yet."
          : `${gradedCount} ${gradedCount === 1 ? "has" : "have"} a verified, graded call.`}{" "}
        A call is graded once its post URL is confirmed. An account with no confirmed call stays ungraded.
      </p>
      <p className="mt-3 text-sm">
        <Link href="/real" className="accent-link underline-offset-4 hover:underline">
          Verified real calls
        </Link>
      </p>
      {intakeNote ? <p className="mt-4 max-w-3xl text-sm text-muted">{intakeNote}</p> : null}
      {loaded.error ? <p className="mt-4 text-sm text-bear">{loaded.error}</p> : null}
      <ul className="mt-8 grid gap-3 sm:grid-cols-2">
        {roster.map((account) => {
          const graded = gradedHandles.has(account.handle.toLowerCase());
          return (
            <li key={account.handle} className="panel min-w-0 p-4 [overflow-wrap:anywhere]">
              <p className="text-xs uppercase tracking-wide text-muted">{graded ? "Graded call" : "Not graded yet"}</p>
              <h2 className="mt-2 text-xl text-ink">
                <Link href={`/accounts/${account.handle}`} className="hover:underline">
                  @{account.handle}
                </Link>
              </h2>
              {account.profileUrl ? (
                <p className="mt-2 text-sm">
                  <a href={account.profileUrl} className="accent-link hit-44 min-w-0 max-w-full underline-offset-4 [overflow-wrap:anywhere] hover:underline">
                    {account.profileUrl.includes("substack.com") ? (
                      <>
                        Read on Substack&nbsp;<span aria-hidden="true">↗</span>
                      </>
                    ) : (
                      account.profileUrl
                    )}
                  </a>
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
