import type { Metadata } from "next";
import Link from "next/link";
import { RealCallCard } from "@/components/real-call-card";
import { loadRealCalls } from "@/lib/public-real";
import { TRACKING_EMPTY } from "@/lib/watchlist";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Verified real calls",
  description: "Confirmed public posts graded against recorded Yahoo prints. Demo calls are not on this board.",
};

export default async function RealBoardPage() {
  const loaded = await loadRealCalls();
  const graded = loaded.calls.filter((call) => Object.keys(call.grades).length > 0);
  const waiting = loaded.calls.filter((call) => Object.keys(call.grades).length === 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <p className="text-xs uppercase tracking-wide text-pine">Separate from the demo book</p>
      <h1 className="mt-2 font-serif text-4xl text-ink">Verified real calls</h1>
      <p className="mt-3 max-w-3xl text-muted">
        These posts were fetched from a public status URL and confirmed before grading. Scores use the same Monday, Wednesday, and Friday Yahoo prints as the rest of the board. Demo calls stay labeled demo.
      </p>
      <p className="mt-3 text-sm">
        <Link href="/watchlist" className="text-pine underline-offset-4 hover:underline">
          Watchlist
        </Link>
      </p>
      {loaded.error ? <p className="mt-4 text-sm text-bear">{loaded.error}</p> : null}
      {loaded.calls.length === 0 ? (
        <div className="panel mt-8 p-5">
          <h2 className="font-serif text-2xl text-ink">No verified real calls yet</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Tracked accounts stay on {TRACKING_EMPTY} until a post is confirmed. Nothing on this page is filled in from the demo seed.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid gap-4">
          {graded.map((call) => (
            <RealCallCard key={call.id} call={call} />
          ))}
          {waiting.map((call) => (
            <RealCallCard key={call.id} call={call} />
          ))}
        </div>
      )}
    </div>
  );
}
