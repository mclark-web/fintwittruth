import Link from "next/link";
import type { ReactNode } from "react";
import { disputeEmail } from "@/lib/dispute";
import { LEGAL_DRAFT_LABEL } from "@/lib/legal";

const PAGES = [
  { href: "/disclaimer", label: "Disclaimer" },
  { href: "/terms", label: "Terms" },
  { href: "/donate", label: "Donate" },
] as const;

export function LegalPage({
  kicker,
  title,
  lede,
  children,
}: {
  kicker: string;
  title: string;
  lede: string;
  children: ReactNode;
}) {
  const mailbox = disputeEmail();
  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-xs uppercase tracking-wide text-muted">{kicker}</p>
      <p className="mt-3 inline-flex rounded-full border border-[rgba(154,154,163,.35)] bg-transparent px-3 py-1 text-sm font-semibold text-[#c9c9cf]">
        {LEGAL_DRAFT_LABEL}
      </p>
      <h1 className="mt-4 font-serif text-4xl text-ink sm:text-5xl">{title}</h1>
      <p className="mt-4 text-lg leading-relaxed text-ink/80">{lede}</p>
      <p className="mt-4 text-sm leading-relaxed text-muted">
        Counsel has not signed off on this page. It is published so the rules are readable in one place. It is
        not a finished legal opinion.
      </p>
      <div className="mt-8">{children}</div>
      <nav aria-label="Legal" className="mt-12 flex flex-wrap gap-x-4 gap-y-2 border-t border-line pt-6 text-sm">
        {PAGES.map((page) => (
          <Link key={page.href} href={page.href} className="text-pine underline-offset-4 hover:underline">
            {page.label}
          </Link>
        ))}
        <Link href="/methodology" className="text-pine underline-offset-4 hover:underline">
          Methodology
        </Link>
      </nav>
      <p className="mt-4 text-sm text-muted">
        <Link href="/dispute" className="text-pine underline-offset-4 hover:underline">
          Dispute a grade
        </Link>
        {mailbox ? (
          <>
            {" "}
            or{" "}
            <a className="text-pine underline-offset-4 hover:underline" href={`mailto:${mailbox}`}>
              {mailbox}
            </a>
          </>
        ) : null}
        .
      </p>
    </article>
  );
}

export function LegalSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-8" aria-labelledby={id}>
      <h2 id={id} className="font-serif text-2xl text-ink">
        {title}
      </h2>
      <div className="mt-3 space-y-3 leading-relaxed text-ink/80">{children}</div>
    </section>
  );
}
