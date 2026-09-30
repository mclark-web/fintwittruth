"use client";

import { LogoLink } from "@/components/logo-link";
import "./globals.css";

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="en">
      <head>
        <title>GradedCalls</title>
      </head>
      <body>
        <header className="site-header sticky top-0 z-20 border-b border-line bg-[#0b0c0e]">
          <div className="mx-auto flex h-14 max-w-6xl items-center px-4 sm:px-7">
            <LogoLink />
          </div>
        </header>
        <main id="content" className="mx-auto max-w-3xl px-4 py-20">
          <h1 className="font-serif text-4xl text-ink">This page failed to load.</h1>
          <p className="mt-3 text-muted">The board could not render this view.</p>
          {error.digest ? <p className="mt-2 text-sm text-muted">Reference {error.digest}</p> : null}
          <button
            type="button"
            onClick={() => retry()}
            className="mt-6 inline-flex min-h-11 min-w-11 items-center rounded-full bg-pine px-5 text-sm text-lime"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
