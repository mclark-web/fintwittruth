import type { Metadata } from "next";
import Link from "next/link";
import { loadRealCalls } from "@/lib/public-real";
import { TRACKING_EMPTY, WATCHLIST, profileUrl } from "@/lib/watchlist";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Watchlist",
  description: "Real X accounts tracked by GradedCalls FinTwit. No grade until a post is ingested and confirmed.",
};

export default async function WatchlistPage() {
  const loaded = await loadRealCalls();
  const gradedHandles = new Set(
    loaded.calls.filter((call) => Object.keys(call.grades).length > 0).map((call) => call.handle.toLowerCase()),
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <p className="text-xs uppercase tracking-wide text-pine">Real accounts</p>
      <h1 className="mt-2 font-serif text-4xl text-ink">Watchlist</h1>
      <p className="mt-3 max-w-3xl text-muted">
        These are public X accounts. A profile with no confirmed grade says {TRACKING_EMPTY}. Demo handles stay on the demo board.
      </p>
      <p className="mt-3 text-sm">
        <Link href="/real" className="text-pine underline-offset-4 hover:underline">
          Verified real calls
        </Link>
      </p>
      {loaded.kind === "unconfigured" ? (
        <p className="mt-4 max-w-3xl text-sm text-muted">{loaded.detail}</p>
      ) : null}
      {loaded.error ? <p className="mt-4 text-sm text-bear">{loaded.error}</p> : null}
      <ul className="mt-8 grid gap-3 sm:grid-cols-2">
        {WATCHLIST.map((account) => {
          const graded = gradedHandles.has(account.handle.toLowerCase());
          return (
            <li key={account.handle} className="panel p-4">
              <p className="text-xs uppercase tracking-wide text-muted">{graded ? "Verified real call" : TRACKING_EMPTY}</p>
              <h2 className="mt-2 text-xl text-ink">
                <Link href={`/accounts/${account.handle}`} className="hover:underline">
                  @{account.handle}
                </Link>
              </h2>
              <p className="mt-2 text-sm">
                <a href={profileUrl(account.handle)} className="text-pine underline-offset-4 hover:underline">
                  {account.profileUrl}
                </a>
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
