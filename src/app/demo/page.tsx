import type { Metadata } from "next";
import Link from "next/link";
import { formatShortDay } from "@/lib/format";
import { getCohortList } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Demo book",
  description: "Fictional GradedCalls FinTwit posts. Labeled demo and kept off the live graded board.",
};

export default async function DemoPage() {
  const cohorts = (await getCohortList()).filter((cohort) => cohort.dataset === "demo");
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-ink">Demo</p>
      <h1 className="mt-3 font-serif text-4xl text-ink">Fictional weekend book</h1>
      <p className="mt-3 max-w-2xl text-muted">
        These handles and posts are made up, including the weekend doom and melt-up cards. The prices under
        them are real Yahoo Finance prints. None of these rows are the latest verified board.
      </p>
      <ul className="mt-8 grid gap-3">
        {cohorts.map((cohort) => (
          <li key={cohort.slug}>
            <article className="panel p-5">
              <p className="text-xs uppercase tracking-wide text-muted">
                Demo · week of {formatShortDay(cohort.mondayAt)}
              </p>
              <h2 className="mt-1 font-serif text-2xl text-ink">
                <Link href={`/weeks/${cohort.slug}`} className="hover:underline">
                  {cohort.title}
                </Link>
              </h2>
              <p className="mt-2 text-sm text-muted">{cohort.summary}</p>
            </article>
          </li>
        ))}
      </ul>
    </div>
  );
}
