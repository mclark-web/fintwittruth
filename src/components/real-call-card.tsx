import Link from "next/link";
import { matureScore } from "@/lib/board";
import { ReadoutBubbles, TimeframePills } from "@/components/call-readouts";
import { disputePath } from "@/lib/dispute";
import { formatScopeWhen } from "@/lib/format";
import { quotesForCohort } from "@/lib/quotes";
import type { QuoteView } from "@/lib/queries";
import { type RealCallView } from "@/lib/real-book";
import { EQUITY_TAPE, type Direction } from "@/lib/scoring";
import { profileUrl } from "@/lib/watchlist";

function quotesFor(call: RealCallView): QuoteView[] {
  if (!call.cohortSlug) return [];
  try {
    return quotesForCohort(call.cohortSlug, [...EQUITY_TAPE, "VIX", call.symbol]).map((quote) => ({
      symbol: quote.symbol,
      name: quote.symbol,
      ref: quote.ref,
      mondayOpen: quote.mondayOpen,
      monday: quote.monday,
      wednesday: quote.wednesday,
      friday: quote.friday,
    }));
  } catch {
    return [];
  }
}

export function RealCallCard({ call }: { call: RealCallView }) {
  const score = matureScore(call.grades);
  const quotes = quotesFor(call);
  const direction: Direction | undefined = call.direction === "bullish" || call.direction === "bearish" ? call.direction : undefined;
  const xProfile = profileUrl(call.handle);
  return (
    <article className="panel p-5">
      <p className="text-xs uppercase tracking-wide text-[#c9c9cf]">{call.label}</p>
      <h2 className="mt-2 text-xl text-ink">
        <Link href={`/accounts/${call.handle}`} className="hover:underline">
          {call.authorName} <span className="font-normal text-muted">@{call.handle}</span>
        </Link>
      </h2>
      <p className="mt-1 text-xs text-muted">
        {formatScopeWhen(call.postedAt)}
        {call.cohortSlug ? ` · readout week ${call.cohortSlug}` : ""} · {call.horizon}
      </p>
      <p className="mt-3 text-[15px] leading-relaxed text-ink">“{call.text}”</p>
      <p className="mt-3 text-sm text-muted">
        {call.direction} {call.symbol} · {call.conviction} conviction
        {call.levels.length > 0
          ? ` · ${call.levels.map((level) => `${level.role} ${level.price}`).join(", ")}`
          : ""}
      </p>
      <TimeframePills grades={call.grades} />
      <ReadoutBubbles grades={call.grades} quotes={quotes} primary={call.symbol} direction={direction} />
      {score == null ? <p className="mt-3 text-sm text-muted">{call.ungradedReason ?? "Not graded yet"}</p> : null}
      <p className="post-meta">
        <a href={call.sourceUrl} className="hit-44 underline-offset-4 hover:text-ink hover:underline">
          Original post
        </a>
        {xProfile ? (
          <a href={xProfile} className="hit-44 underline-offset-4 hover:text-ink hover:underline">
            Profile on X
          </a>
        ) : null}
        <Link href={`/real/${call.id}`} className="hit-44 underline-offset-4 hover:text-ink hover:underline">
          Call detail
        </Link>
        {score != null ? (
          <a href={disputePath(call.id)} className="hit-44 underline-offset-4 hover:text-ink hover:underline">
            Dispute this grade
          </a>
        ) : null}
      </p>
    </article>
  );
}
