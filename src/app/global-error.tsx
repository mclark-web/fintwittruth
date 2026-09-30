"use client";

import { LogoLink } from "@/components/logo-link";
import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" style={{ backgroundColor: "#0b0c0e" }}>
      <head>
        <title>GradedCalls</title>
      </head>
      <body style={{ margin: 0, backgroundColor: "#0b0c0e", color: "#f2f1ee" }}>
        <header
          className="site-header sticky top-0 z-20 border-b border-line bg-[#0b0c0e]"
          style={{ backgroundColor: "#0b0c0e" }}
        >
          <div
            className="mx-auto flex h-14 max-w-6xl items-center px-4 sm:px-7"
            style={{ display: "flex", alignItems: "center", height: 56, maxWidth: 1152, margin: "0 auto", padding: "0 16px" }}
          >
            <LogoLink />
          </div>
        </header>
        <main id="content" className="mx-auto max-w-3xl px-4 py-20">
          <h1 className="font-serif text-4xl text-ink">This page failed to load.</h1>
          <p className="mt-3 text-muted">The board could not render this view.</p>
          {error.digest ? <p className="mt-2 text-sm text-muted">Reference {error.digest}</p> : null}
          <button
            type="button"
            onClick={() => reset()}
            className="mt-6 inline-flex min-h-11 min-w-11 items-center rounded-full bg-pine px-5 text-sm text-lime"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
