import type { Metadata } from "next";
import Link from "next/link";
import { disputeMailto } from "@/lib/dispute";
import { submitDisputeAction } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dispute a grade",
  description: "Tell GradedCalls a grade, a print, or a post looks wrong.",
};

const fieldClass =
  "mt-1 w-full rounded-lg border border-line bg-sheet px-3 py-2 text-sm text-ink outline-none focus:border-pine";

export default async function DisputePage({
  searchParams,
}: {
  searchParams: Promise<{ call?: string; error?: string; notice?: string }>;
}) {
  const query = await searchParams;
  const callId = query.call ?? "";
  const mailto = callId ? disputeMailto(callId) : null;

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <p className="text-sm text-muted">
        <Link href="/" className="hover:underline">
          GradedCalls
        </Link>
      </p>
      <h1 className="mt-2 font-serif text-4xl text-ink">Dispute this grade</h1>
      <p className="mt-3 text-sm text-muted">
        Monday is the open of the 12:00 PM ET 5-minute bar. Wednesday and Friday are the 4:00 PM ET close.
        Say which print or post looks wrong. A dispute does not change the score by itself.
      </p>
      {query.error ? <p className="mt-4 rounded-lg border border-bear/40 bg-bear/10 px-3 py-2 text-sm text-ink">{query.error}</p> : null}
      {query.notice ? <p className="mt-4 rounded-lg border border-pine/40 bg-pine/10 px-3 py-2 text-sm text-ink">{query.notice}</p> : null}
      <form action={submitDisputeAction} className="panel mt-6 grid gap-3 p-5">
        <label className="text-sm text-muted">
          Call id
          <input className={fieldClass} name="callId" defaultValue={callId} required maxLength={120} />
        </label>
        <label className="text-sm text-muted">
          Name or handle (optional)
          <input className={fieldClass} name="name" maxLength={80} autoComplete="name" />
        </label>
        <label className="text-sm text-muted">
          Email (optional)
          <input className={fieldClass} name="email" type="email" maxLength={120} autoComplete="email" />
        </label>
        <label className="text-sm text-muted">
          Reason
          <textarea className={fieldClass} name="reason" rows={6} required maxLength={2000} />
        </label>
        <div className="absolute -left-[9999px] h-px overflow-hidden" aria-hidden="true">
          <label>
            Company
            <input name="company" tabIndex={-1} autoComplete="off" />
          </label>
        </div>
        <button className="w-fit rounded-lg bg-pine px-3 py-2 text-sm font-semibold text-lime" type="submit">
          Send dispute
        </button>
      </form>
      {mailto ? (
        <p className="mt-4 text-sm text-muted">
          Or write{" "}
          <a className="text-pine underline-offset-4 hover:underline" href={mailto}>
            {mailto.replace(/^mailto:([^?]+).*/, "$1")}
          </a>
          .
        </p>
      ) : null}
    </div>
  );
}
