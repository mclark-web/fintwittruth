import Link from "next/link";
import { RealCallCard } from "@/components/real-call-card";
import type { RealCallView } from "@/lib/real-book";
import { TRACKING_EMPTY, profileUrl } from "@/lib/watchlist";

export function TrackedAccount({
  handle,
  authorName,
  calls,
}: {
  handle: string;
  authorName: string | null;
  calls: RealCallView[];
}) {
  const graded = calls.filter((call) => Object.keys(call.grades).length > 0);
  const name = authorName && authorName.toLowerCase() !== handle.toLowerCase() ? authorName : handle;
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <p className="text-sm text-muted">
        <Link href="/watchlist" className="hover:underline">
          Watchlist
        </Link>
      </p>
      <header className="mt-4">
        <p className="text-xs uppercase tracking-wide text-pine">Tracked X account</p>
        <h1 className="mt-2 font-serif text-4xl text-ink">{name}</h1>
        <p className="mt-2 text-muted">
          <a href={profileUrl(handle)} className="text-pine underline-offset-4 hover:underline">
            @{handle}
          </a>
        </p>
        <p className="mt-3 max-w-2xl text-ink/80">
          Public posts from this account are graded only after a status URL is fetched with oEmbed and a person confirms the call.
        </p>
      </header>
      {graded.length === 0 ? (
        <div className="panel mt-8 p-5">
          <h2 className="font-serif text-2xl text-ink">{TRACKING_EMPTY}</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            There is no score on this profile. Demo grades live on the demo board and are not copied here.
          </p>
        </div>
      ) : null}
      {calls.length > 0 ? (
        <div className="mt-8 grid gap-4">
          {calls.map((call) => (
            <RealCallCard key={call.id} call={call} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
