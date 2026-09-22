import Link from "next/link";
import { Suspense } from "react";
import { MARK, NAV_NAME, PRODUCT_NAME, SIBLING_NAMES, UMBRELLA_NAME } from "@/lib/brand";
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
        <Link href="/" className="flex items-center gap-2.5" aria-label={PRODUCT_NAME}>
          <span
            aria-hidden
            className="grid h-9 w-9 place-items-center rounded-lg bg-pine font-mono text-sm font-medium text-lime"
          >
            {MARK}
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-pine">{UMBRELLA_NAME}</span>
            <span className="font-serif text-xl tracking-tight text-ink">{NAV_NAME}</span>
          </span>
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
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-xl space-y-2">
          <p>
            {PRODUCT_NAME} grades a weekly book of calls. It is not a broker, a signal service, or a feed from X.
            Grades are not for sale.
          </p>
          <p>
            A {UMBRELLA_NAME} vertical, with {SIBLING_NAMES[0]} and {SIBLING_NAMES[1]}.
          </p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-4 gap-y-2">
          <Link href="/methodology" className="underline-offset-4 hover:text-ink hover:underline">
            Methodology
          </Link>
          <Link href="/pending" className="underline-offset-4 hover:text-ink hover:underline">
            Pending settle
          </Link>
          <Link href="/disclaimer" className="underline-offset-4 hover:text-ink hover:underline">
            Disclaimer
          </Link>
          <Link href="/terms" className="underline-offset-4 hover:text-ink hover:underline">
            Terms
          </Link>
          <Link href="/donate" className="underline-offset-4 hover:text-ink hover:underline">
            Donate
          </Link>
        </nav>
      </div>
    </footer>
  );
}
