import type { Metadata } from "next";
import Link from "next/link";
import { CallCard } from "@/components/call-card";
import { RealCallCard } from "@/components/real-call-card";
import { UNCONFIGURED_PUBLIC } from "@/lib/intake-store";
import { loadRealCalls } from "@/lib/public-real";
import { getLiveCohorts } from "@/lib/queries";
import type { ReadoutKind } from "@/lib/scoring";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Verified real calls",
  description: "Confirmed public posts graded against recorded Yahoo prints.",
};

function readoutFor(grades: { monday?: unknown; wednesday?: unknown; friday?: unknown }): ReadoutKind {
  if (grades.monday) return "monday";
  if (grades.friday) return "friday";
  if (grades.wednesday) return "wednesday";
  return "monday";
}

export default async function RealBoardPage() {
  const [loaded, cohorts] = await Promise.all([loadRealCalls(), getLiveCohorts()]);
  const liveIds = new Set(cohorts.flatMap((cohort) => cohort.calls.map((call) => call.id)));
  const extra = loaded.calls.filter((call) => !liveIds.has(call.id));
  const count = cohorts.reduce((sum, cohort) => sum + cohort.calls.length, 0) + extra.length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <p className="text-xs uppercase tracking-wide text-[#c9c9cf]">Live board</p>
      <h1 className="mt-2 font-serif text-4xl text-ink">Verified real calls</h1>
      <p className="mt-3 max-w-3xl text-muted">
        These are the same verified posts as the home board. A call is graded once its post URL is confirmed.
      </p>
      <p className="mt-3 text-sm">
        <Link href="/watchlist" className="accent-link underline-offset-4 hover:underline">
          Watchlist
        </Link>
      </p>
      {loaded.error ? <p className="mt-4 text-sm text-bear">{loaded.error}</p> : null}
      {count === 0 ? (
        <div className="panel mt-8 p-5">
          <h2 className="font-serif text-2xl text-ink">Not graded yet</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            {loaded.kind === "unconfigured" ? UNCONFIGURED_PUBLIC : "No graded calls are on the live board."} A call is graded once its post URL is confirmed.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid gap-4">
          {cohorts.flatMap((cohort) =>
            cohort.calls.map((call) => (
              <CallCard key={call.id} call={call} readout={readoutFor(call.grades)} quotes={cohort.quotes} />
            )),
          )}
          {extra.map((call) => (
            <RealCallCard key={call.id} call={call} />
          ))}
        </div>
      )}
    </div>
  );
}
