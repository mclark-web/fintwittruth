import Link from "next/link";
import { Suspense } from "react";
import { NAV_NAME, PRODUCT_NAME, SIBLING_NAMES, UMBRELLA_NAME } from "@/lib/brand";
import { DATA_MODE } from "@/lib/labels";
import { getLatestCohort } from "@/lib/queries";
import { NavLinks } from "./nav-links";

export function BrandMark() {
  return (
    <span className="mark" aria-hidden>
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 3v3M12 18v3M5 12H2M22 12h-3" stroke="#ff6a00" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M7.5 8.5c1.8-2.2 7.2-2.2 9 0M7.5 15.5c1.8 2.2 7.2 2.2 9 0" stroke="#f2f1ee" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="12" cy="12" r="2.2" fill="#ff6a00" />
      </svg>
    </span>
  );
}

export function DemoBanner() {
  if (DATA_MODE !== "demo") return null;
  return (
    <div className="site-banner relative border-b border-pine/30 bg-pine/10 text-orange-soft">
      <p className="mx-auto max-w-6xl px-4 py-2 text-center text-sm tracking-wide text-ink">
        Demo weeks are fictional accounts. The latest board quotes verified public posts and links each source. Market prints are historical Yahoo Finance prices. Not investment advice. Not affiliated with X or Yahoo.{" "}
        <Link href="/demo" className="font-medium text-pine underline-offset-4 hover:underline">
          Fictional doom and melt-up book
        </Link>
      </p>
    </div>
  );
}

export async function SiteHeader() {
  const latest = await getLatestCohort();
  const latestHref = latest ? `/weeks/${latest.slug}` : "/weeks";
  const gradeHref = latest
    ? latest.readouts.monday.status === "published"
      ? `/weeks/${latest.slug}/monday`
      : latest.readouts["monday-gap"].status === "published"
        ? `/weeks/${latest.slug}/monday-gap`
        : latestHref
    : "/weeks";
  const tools = (
    <>
      <Link href="/weeks" className="btn header-tool">
        Weekend filter
      </Link>
      <Link href={gradeHref} className="btn btn-primary header-tool">
        Grade feed
      </Link>
    </>
  );
  return (
    <>
      <header className="site-header sticky top-0 z-20 border-b border-line bg-[#0b0c0e]/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-h-14 items-center gap-3 px-4 sm:px-7 max-w-6xl">
          <Link href="/" className="flex shrink-0 items-center gap-2.5 whitespace-nowrap" aria-label={PRODUCT_NAME}>
            <BrandMark />
            <span className="text-[17px] font-semibold tracking-tight text-ink">
              Graded<span className="text-orange-soft">Calls</span>
            </span>
          </Link>
          <div className="min-w-0 flex-1 overflow-x-auto">
            <Suspense fallback={<span className="block h-11" aria-hidden />}>
              <NavLinks latestHref={latestHref} />
            </Suspense>
          </div>
          <div className="hidden shrink-0 items-center gap-2 lg:flex">{tools}</div>
        </div>
      </header>
      <div className="header-tools flex gap-2 px-4 py-2 lg:hidden">{tools}</div>
    </>
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
            A {UMBRELLA_NAME} vertical, with {SIBLING_NAMES[0]} and {SIBLING_NAMES[1]}. {NAV_NAME} is this board.
          </p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-4 gap-y-2">
          <Link href="/" className="hover:text-orange-soft">
            Hub
          </Link>
          <Link href="/methodology" className="hover:text-orange-soft">
            Method
          </Link>
          <Link href="/pending" className="hover:text-orange-soft">
            Pending settle
          </Link>
          <Link href="/disclaimer" className="hover:text-orange-soft">
            Disclaimer
          </Link>
          <Link href="/terms" className="hover:text-orange-soft">
            Terms
          </Link>
          <Link href="/donate" className="hover:text-orange-soft">
            Donate
          </Link>
        </nav>
      </div>
    </footer>
  );
}
