"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20">
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
    </div>
  );
}
