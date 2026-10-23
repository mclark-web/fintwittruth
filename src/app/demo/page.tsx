import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Sourced calls only",
  description: "GradedCalls FinTwit publishes sourced public posts. Fictional calls are not on this board.",
  robots: { index: false, follow: false },
};

export default function DemoPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#c9c9cf]">GradedCalls FinTwit</p>
      <h1 className="mt-3 font-serif text-4xl text-ink">Sourced calls only</h1>
      <p className="mt-4 max-w-2xl text-ink/80">
        This board does not publish fictional calls, accounts, or stats. A graded card quotes a public post and
        links that source. An account with nothing confirmed reads Not graded yet.
      </p>
      <p className="mt-6">
        <Link href="/" className="accent-link hit-44 underline-offset-4 hover:underline">
          Home board
        </Link>
      </p>
    </div>
  );
}
