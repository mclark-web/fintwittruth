import type { Metadata } from "next";
import { cookies } from "next/headers";
import { adminConfigured, ADMIN_COOKIE, sessionMatches } from "@/lib/admin-auth";
import { getIntakeStore, UNCONFIGURED_DETAIL } from "@/lib/intake-store";
import type { Dispute, IntakePost } from "@/lib/intake-types";
import { disputeStatusAction, ingestAction, loginAction, logoutAction, manualIngestAction, reviewAction } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Intake",
  robots: { index: false, follow: false },
};

const fieldClass =
  "mt-1 w-full rounded-lg border border-line bg-sheet px-3 py-2 text-sm text-ink outline-none focus:border-pine";

function ReviewForm({ post }: { post: IntakePost }) {
  const seed = post.suggestion ?? post.extraction;
  const target = seed.levels.find((level) => level.role === "target")?.price ?? "";
  const invalidation = seed.levels.find((level) => level.role === "invalidation")?.price ?? "";
  return (
    <form action={reviewAction} className="mt-4 grid gap-3">
      <input type="hidden" name="id" value={post.id} />
      <label className="text-sm text-muted">
        Symbol
        <input className={fieldClass} name="symbol" defaultValue={post.review?.symbol ?? seed.symbol ?? ""} />
      </label>
      <label className="text-sm text-muted">
        Direction
        <select className={fieldClass} name="direction" defaultValue={post.review?.direction ?? seed.direction ?? ""}>
          <option value="">Choose</option>
          <option value="bullish">bullish</option>
          <option value="bearish">bearish</option>
        </select>
      </label>
      <label className="text-sm text-muted">
        Window
        <input className={fieldClass} name="horizon" defaultValue={post.review?.horizon ?? seed.horizon ?? ""} />
      </label>
      <label className="text-sm text-muted">
        Conviction
        <select className={fieldClass} name="conviction" defaultValue={post.review?.conviction ?? seed.conviction ?? ""}>
          <option value="">Choose</option>
          <option value="high">high</option>
          <option value="medium">medium</option>
          <option value="low">low</option>
        </select>
      </label>
      <label className="text-sm text-muted">
        Sentiment
        <select className={fieldClass} name="sentiment" defaultValue={seed.sentiment ?? ""}>
          <option value="">From direction</option>
          <option value="panic">panic</option>
          <option value="meltup">meltup</option>
        </select>
      </label>
      <label className="text-sm text-muted">
        Posted at (ISO, with a time)
        <input className={fieldClass} name="postedAt" defaultValue={post.review?.postedAt ?? ""} placeholder="2026-09-18T16:00:00.000Z" />
      </label>
      <p className="text-xs text-muted">
        oEmbed date label: {post.postedAtLabel || "none"}. That label is a date, not a clock time. Enter a timestamp you can verify. This board does not invent one.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm text-muted">
          Target
          <input className={fieldClass} name="target" defaultValue={target} />
        </label>
        <label className="text-sm text-muted">
          Invalidation
          <input className={fieldClass} name="invalidation" defaultValue={invalidation} />
        </label>
      </div>
      <label className="text-sm text-muted">
        Note
        <input className={fieldClass} name="note" />
      </label>
      <div className="flex flex-wrap gap-2">
        <button className="rounded-lg bg-pine px-3 py-2 text-sm font-semibold text-lime" name="action" value="confirm" type="submit">
          Confirm
        </button>
        <button className="rounded-lg border border-line px-3 py-2 text-sm text-ink" name="action" value="reject" type="submit">
          Reject
        </button>
      </div>
    </form>
  );
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string; manual?: string; url?: string }>;
}) {
  const query = await searchParams;
  const configured = adminConfigured();
  const jar = await cookies();
  const signedIn = sessionMatches(jar.get(ADMIN_COOKIE)?.value);
  const store = getIntakeStore();
  let posts: IntakePost[] = [];
  let disputes: Dispute[] = [];
  let readError: string | null = null;
  if (signedIn && store.kind !== "unconfigured") {
    try {
      const book = await store.read();
      posts = book.posts;
      disputes = [...book.disputes].sort((a, b) => {
        if (a.status !== b.status) return a.status === "open" ? -1 : 1;
        return b.createdAt.localeCompare(a.createdAt);
      });
    } catch (error) {
      readError = error instanceof Error ? error.message : "The intake store could not be read.";
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-xs uppercase tracking-wide text-pine">Operator</p>
      <h1 className="mt-2 font-serif text-4xl text-ink">Paste a status URL</h1>
      <p className="mt-3 text-sm text-muted">
        Fetch the public post through X oEmbed. If that host is down, paste the post text yourself. Confirm the parsed call before it can be graded. This page is not linked from the public nav.
      </p>
      {query.error ? <p className="mt-4 rounded-lg border border-bear/40 bg-bear/10 px-3 py-2 text-sm text-ink">{query.error}</p> : null}
      {query.notice ? <p className="mt-4 rounded-lg border border-pine/40 bg-pine/10 px-3 py-2 text-sm text-ink">{query.notice}</p> : null}

      {!configured ? (
        <div className="panel mt-6 p-5 text-sm text-muted">
          <p>Set ADMIN_TOKEN to a long random string in the environment, then redeploy. Intake stays closed until that is set.</p>
        </div>
      ) : null}

      {configured && !signedIn ? (
        <form action={loginAction} className="panel mt-6 grid gap-3 p-5">
          <label className="text-sm text-muted">
            ADMIN_TOKEN
            <input className={fieldClass} name="token" type="password" autoComplete="current-password" required />
          </label>
          <button className="w-fit rounded-lg bg-pine px-3 py-2 text-sm font-semibold text-lime" type="submit">
            Unlock intake
          </button>
        </form>
      ) : null}

      {signedIn ? (
        <div className="mt-6 grid gap-4">
          <form action={logoutAction}>
            <button className="text-sm text-muted underline-offset-4 hover:underline" type="submit">
              Lock intake
            </button>
          </form>
          <p className="text-sm text-muted">{store.detail}</p>
          {store.kind === "unconfigured" ? (
            <div className="panel p-5 text-sm text-muted">
              <p>{UNCONFIGURED_DETAIL}</p>
              <p className="mt-2">The watchlist still renders. Pastes are refused so a preview cannot pretend a post was saved.</p>
            </div>
          ) : (
            <>
            <form action={ingestAction} className="panel grid gap-3 p-5">
              <label className="text-sm text-muted">
                Status URL
                <input className={fieldClass} name="url" type="url" placeholder="https://x.com/handle/status/123" required />
              </label>
              <button className="w-fit rounded-lg bg-pine px-3 py-2 text-sm font-semibold text-lime" type="submit">
                Fetch with oEmbed
              </button>
            </form>
            <form action={manualIngestAction} className="panel grid gap-3 p-5">
              <p className="text-sm text-ink">If oEmbed does not return the post, paste the text</p>
              <p className="text-xs text-muted">
                The words have to be the public post. This board does not invent them, and it does not invent a clock time.
              </p>
              <label className="text-sm text-muted">
                Status URL
                <input
                  className={fieldClass}
                  name="url"
                  type="url"
                  placeholder="https://x.com/handle/status/123"
                  defaultValue={query.manual === "1" ? query.url ?? "" : ""}
                  required
                />
              </label>
              <label className="text-sm text-muted">
                Post text
                <textarea className={fieldClass} name="text" rows={5} required />
              </label>
              <label className="text-sm text-muted">
                Author name (optional)
                <input className={fieldClass} name="authorName" />
              </label>
              <button className="w-fit rounded-lg border border-line px-3 py-2 text-sm text-ink" type="submit">
                Store pasted text
              </button>
            </form>
            </>
          )}
          {readError ? <p className="text-sm text-bear">{readError}</p> : null}
          <ul className="grid gap-4">
            {posts.map((post) => (
              <li key={post.id} className="panel p-5">
                <p className="text-xs uppercase tracking-wide text-muted">{post.status}</p>
                <p className="mt-2 text-sm text-ink">
                  @{post.handle} · {post.authorName}
                </p>
                <p className="mt-2 text-sm text-ink/90">{post.text}</p>
                <p className="mt-2 text-xs text-muted">
                  <a href={post.sourceUrl} className="text-pine underline-offset-4 hover:underline">
                    {post.sourceUrl}
                  </a>
                </p>
                {post.extraction.reasons.length > 0 ? (
                  <ul className="mt-2 list-disc pl-5 text-xs text-muted">
                    {post.extraction.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-muted">Rules parser filled every field. Still confirm before grading.</p>
                )}
                {post.llmNote ? <p className="mt-2 text-xs text-muted">{post.llmNote}</p> : null}
                {post.status === "pending" || post.status === "confirmed" || post.status === "not_gradable" ? (
                  <ReviewForm post={post} />
                ) : (
                  <p className="mt-3 text-sm text-muted">Rejected. Paste the URL again if you want it back in review.</p>
                )}
              </li>
            ))}
          </ul>
          <section className="grid gap-3">
            <h2 className="font-serif text-2xl text-ink">Disputes</h2>
            {disputes.length === 0 ? <p className="text-sm text-muted">No disputes yet.</p> : null}
            <ul className="grid gap-3">
              {disputes.map((dispute) => (
                <li key={dispute.id} className="panel p-5">
                  <p className="text-xs uppercase tracking-wide text-muted">{dispute.status}</p>
                  <p className="mt-2 text-sm text-ink">
                    {dispute.callId}
                    {dispute.name ? ` · ${dispute.name}` : ""}
                    {dispute.email ? ` · ${dispute.email}` : ""}
                  </p>
                  <p className="mt-2 text-sm text-ink/90">{dispute.reason}</p>
                  <p className="mt-2 text-xs text-muted">{dispute.createdAt}</p>
                  <form action={disputeStatusAction} className="mt-3">
                    <input type="hidden" name="id" value={dispute.id} />
                    <button
                      className="rounded-lg border border-line px-3 py-2 text-sm text-ink"
                      name="status"
                      type="submit"
                      value={dispute.status === "open" ? "resolved" : "open"}
                    >
                      {dispute.status === "open" ? "Mark resolved" : "Reopen"}
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}
    </div>
  );
}
