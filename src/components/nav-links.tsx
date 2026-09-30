"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type Item = {
  href: string;
  label: string;
  match: (path: string) => boolean;
};

function linkClass(active: boolean) {
  return `inline-flex min-h-11 items-center whitespace-nowrap rounded-lg px-3 text-xs sm:text-[13.5px] ${
    active ? "bg-white/5 text-ink shadow-[inset_0_-2px_0_#eb6505]" : "text-muted hover:bg-white/5 hover:text-ink"
  }`;
}

export function NavLinks({ latestHref }: { latestHref: string }) {
  const pathname = usePathname();
  const items: Item[] = [
    { href: "/", label: "Hub", match: (path: string) => path === "/" },
    {
      href: latestHref,
      label: "FinTwit",
      match: (path: string) => path === "/weeks" || path.startsWith("/weeks/") || path.startsWith("/calls/") || path.startsWith("/accounts/"),
    },
    { href: "/watchlist", label: "Watchlist", match: (path: string) => path === "/watchlist" || path.startsWith("/real") },
    { href: "/leaderboard", label: "Leaderboard", match: (path: string) => path === "/leaderboard" || path.startsWith("/leaderboard/") },
    { href: "/methodology", label: "Method", match: (path: string) => path === "/methodology" },
  ];
  const wrapRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(items.length);
  const [open, setOpen] = useState(false);

  const activeFor = (item: Item) => {
    const onPending = pathname === "/pending" || pathname.endsWith("/pending");
    return onPending ? false : item.match(pathname);
  };

  useLayoutEffect(() => {
    const fit = () => {
      const wrap = wrapRef.current;
      if (!wrap) return;
      if (window.innerWidth >= 480) {
        setVisibleCount(items.length);
        return;
      }
      const probes = [...wrap.querySelectorAll<HTMLElement>("[data-nav-probe]")];
      const available = wrap.clientWidth;
      const gap = 4;
      const more = 44;
      let used = 0;
      let count = 0;
      for (let i = 0; i < probes.length; i++) {
        const next = used + (count > 0 ? gap : 0) + probes[i].offsetWidth;
        const moreNeeded = i < probes.length - 1;
        const limit = moreNeeded ? available - gap - more : available;
        if (next <= limit + 0.5) {
          used = next;
          count = i + 1;
        } else {
          break;
        }
      }
      setVisibleCount(count);
    };
    fit();
    const observer = new ResizeObserver(fit);
    if (wrapRef.current) observer.observe(wrapRef.current);
    window.addEventListener("resize", fit);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, [latestHref, pathname, items.length]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const shown = items.slice(0, visibleCount);
  const extra = items.slice(visibleCount);

  return (
    <div ref={wrapRef} className="relative min-w-0 flex-1">
      <div aria-hidden className="nav-probe">
        <div className="flex w-max items-center gap-1">
          {items.map((item) => (
            <span key={item.href} data-nav-probe className={linkClass(false)}>
              {item.label}
            </span>
          ))}
        </div>
      </div>
      <nav aria-label="Primary" className="nav flex items-center gap-1 overflow-visible">
        {shown.map((item) => (
          <Link key={item.href} href={item.href} aria-current={activeFor(item) ? "page" : undefined} className={linkClass(activeFor(item))}>
            {item.label}
          </Link>
        ))}
        {extra.length > 0 ? (
          <div className="relative">
            <button
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-xs text-muted hover:bg-white/5 hover:text-ink"
              aria-expanded={open}
              aria-haspopup="menu"
              onClick={() => setOpen((value) => !value)}
            >
              More
            </button>
            {open ? (
              <div role="menu" className="absolute right-0 top-full z-50 mt-1 min-w-40 rounded-xl border border-line bg-[#0b0c0e] p-1 shadow-lg">
                {extra.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    role="menuitem"
                    aria-current={activeFor(item) ? "page" : undefined}
                    className={`flex min-h-11 items-center rounded-lg px-3 text-xs ${
                      activeFor(item) ? "text-ink" : "text-muted hover:bg-white/5 hover:text-ink"
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </nav>
    </div>
  );
}
