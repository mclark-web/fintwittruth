import Link from "next/link";
import { Suspense } from "react";
import { getLatestCohort } from "@/lib/queries";
import { LogoLink } from "./logo-link";
import { NavLinks } from "./nav-links";

export async function SiteHeader() {
  const latest = await getLatestCohort();
  const latestHref = latest ? `/weeks/${latest.slug}` : "/weeks";
  return (
    <header className="site-header sticky top-0 z-20 border-b border-line bg-[#0b0c0e]/95 backdrop-blur-md">
      <div className="header-bar mx-auto flex h-14 max-w-6xl items-center gap-x-3 px-4 sm:px-7">
        <LogoLink />
        <div className="flex h-14 min-w-0 flex-1 items-center">
          <Suspense fallback={<span className="block h-11 min-w-0 flex-1" aria-hidden />}>
            <NavLinks latestHref={latestHref} />
          </Suspense>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-3 px-4 py-6 text-sm text-muted sm:px-7">
        <p>Not investment advice. Prices: Yahoo Finance. Fictional examples live on the demo board.</p>
        <p className="text-sm text-[#c9c9cf]">Not affiliated with X or Yahoo.</p>
        <nav aria-label="Footer" className="footer-nav flex flex-wrap gap-x-4 gap-y-1">
          <a href="https://charoof.vercel.app" className="hit-44 hover:text-[#ee9a44]" aria-label="GradedCalls Hub">
            Hub
          </a>
          <Link href="/demo" className="hit-44 hover:text-[#ee9a44]">
            Demo board
          </Link>
          <Link href="/disclaimer" className="hit-44 hover:text-[#ee9a44]">
            Disclaimer
          </Link>
          <Link href="/terms" className="hit-44 hover:text-[#ee9a44]">
            Terms
          </Link>
          <Link href="/donate" className="hit-44 hover:text-[#ee9a44]">
            Donate
          </Link>
        </nav>
      </div>
    </footer>
  );
}
