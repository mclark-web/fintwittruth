import Link from "next/link";
import { Suspense } from "react";
import { DATA_MODE } from "@/lib/labels";
import { getLatestCohort } from "@/lib/queries";
import { NavLinks } from "./nav-links";

export function DemoBanner() {
  if (DATA_MODE !== "demo") return null;
  return (
    <div className="bg-pine text-lime">
      <p className="mx-auto max-w-6xl px-4 py-2 text-center text-sm font-medium tracking-wide">
        Demo posts — fictional accounts. Market prints are historical Yahoo Finance prices. Not investment advice. Not affiliated with X or Yahoo.
      </p>
    </div>
  );
}

export async function SiteHeader() {
  const latest = await getLatestCohort();
  const latestHref = latest ? `/weeks/${latest.slug}` : "/weeks";
  return (
    <header className="sticky top-0 z-20 border-b border-line/80 bg-paper/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-pine font-mono text-sm font-medium text-lime">
            FT
          </span>
          <span className="font-serif text-xl tracking-tight text-ink">FinTwitTruth</span>
        </Link>
        <Suspense fallback={<span className="h-9 w-40" aria-hidden />}>
          <NavLinks latestHref={latestHref} />
        </Suspense>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>FinTwitTruth grades a weekly book of calls. It is not a broker, a signal service, or a feed from X.</p>
        <nav aria-label="Footer" className="flex gap-4">
          <Link href="/methodology" className="underline-offset-4 hover:text-ink hover:underline">
            Methodology
          </Link>
          <Link href="/disclaimer" className="underline-offset-4 hover:text-ink hover:underline">
            Disclaimer
          </Link>
        </nav>
      </div>
    </footer>
  );
}
