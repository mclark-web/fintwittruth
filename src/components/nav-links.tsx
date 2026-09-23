"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ latestHref }: { latestHref: string }) {
  const pathname = usePathname();
  const items = [
    { href: "/", label: "Hub", match: (path: string) => path === "/" },
    {
      href: latestHref,
      label: "FinTwit",
      match: (path: string) => path === "/weeks" || path.startsWith("/weeks/") || path.startsWith("/calls/") || path.startsWith("/accounts/"),
    },
    { href: "/leaderboard", label: "Leaderboard", match: (path: string) => path === "/leaderboard" || path.startsWith("/leaderboard/") },
    { href: "/methodology", label: "Method", match: (path: string) => path === "/methodology" },
  ];

  return (
    <nav aria-label="Primary" className="nav flex w-max items-center gap-1">
      {items.map((item) => {
        const onPending = pathname === "/pending" || pathname.endsWith("/pending");
        const active = onPending ? false : item.match(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap rounded-lg px-3 py-2 text-[13.5px] ${
              active
                ? "bg-white/5 text-ink shadow-[inset_0_-2px_0_#eb6505]"
                : "text-muted hover:bg-white/5 hover:text-ink"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
