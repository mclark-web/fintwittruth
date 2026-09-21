"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ latestHref }: { latestHref: string }) {
  const pathname = usePathname();
  const items = [
    { href: latestHref, label: "Latest" },
    { href: "/weeks", label: "Weeks" },
    { href: "/leaderboard", label: "Leaderboard" },
    { href: "/methodology", label: "Methodology" },
  ];

  return (
    <nav aria-label="Primary" className="flex flex-wrap items-center justify-end gap-1">
      {items.map((item) => {
        const active =
          item.href === "/weeks"
            ? pathname === "/weeks"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-full px-3 py-1.5 text-sm ${
              active ? "bg-pine text-lime" : "text-ink/80 hover:bg-white"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
