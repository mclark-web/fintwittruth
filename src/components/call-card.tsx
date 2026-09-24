import Link from "next/link";
import { formatWhen } from "@/lib/format";
import { gcGrade } from "@/lib/grades";
import type { CallView, QuoteView } from "@/lib/queries";
import type { ReadoutKind } from "@/lib/scoring";
import { Avatar, DirectionChip, Evolution, LevelList, ScoreMark } from "./score";
import { printAt, TapeMark } from "./market";

const TAPE = ["SPY", "DIA", "QQQ", "VIX"] as const;

export function CallCard({
  call,
  readout,
  quotes,
}: {
  call: CallView;
  readout: ReadoutKind;
  quotes?: QuoteView[];
}) {
  const grade = call.grades[readout];
  const moves = (quotes ?? [])
    .filter((quote) => (TAPE as readonly string[]).includes(quote.symbol))
    .map((quote) => {
      const now = printAt(quote, readout);
      const move = now == null ? null : (now - quote.ref) / quote.ref;
      return { symbol: quote.symbol, move };
    })
    .sort((a, b) => TAPE.indexOf(a.symbol as (typeof TAPE)[number]) - TAPE.indexOf(b.symbol as (typeof TAPE)[number]));

  return (
    <article className="panel p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar name={call.displayName} />
          <div>
            <Link href={`/accounts/${call.handle}`} className="font-medium text-ink hover:underline">
              {call.displayName} <span className="font-normal text-muted">@{call.handle}</span>
            </Link>
            <p className="mt-0.5 font-mono text-xs text-[#c9c9cf]">
              {formatWhen(call.postedAt)}
              {call.dataset === "demo" ? " · DEMO" : " · verified"}
              {grade ? ` · rank ${grade.peerRank} of ${grade.peerCount}` : " · not on this board"}
            </p>
          </div>
        </div>
        {grade ? (
          <ScoreMark
            variant="mini"
            score={grade.score}
            badge={grade.badge}
            isStrong={grade.isStrong}
            isWeak={grade.isWeak}
          />
        ) : (
          <ScoreMark variant="mini" score={0} badge={1} isStrong={false} isWeak />
        )}
      </div>
      <p className="mt-3 text-[15px] leading-relaxed text-ink">“{call.body}”</p>
      {moves.some((item) => item.move != null) ? (
        <div className="vs">
          {moves.map((item) =>
            item.move == null ? null : (
              <TapeMark key={item.symbol} direction={call.direction} move={item.move} label={item.symbol} />
            ),
          )}
        </div>
      ) : null}
      <div className="mt-3">
        <LevelList levels={call.levels} />
      </div>
      <div className="post-meta">
        <span className="tag">
          <DirectionChip direction={call.direction} /> {call.primary}
        </span>
        <span>{call.toneLabel || (call.sentiment === "panic" ? "Panic" : "Melt-up")} · {call.bucket === "viral" ? "Viral" : "Watchlist"}</span>
        <span className="uppercase tracking-wide">{call.conviction} conviction</span>
        {call.sourceUrl ? (
          <a href={call.sourceUrl} className="hit-44 underline-offset-4 hover:text-ink hover:underline">
            Source
          </a>
        ) : null}
        <Link href={`/calls/${call.id}`} className="underline-offset-4 hover:text-ink hover:underline">
          Call detail
        </Link>
        {grade ? <span>{gcGrade(grade) === "exit" ? "EXIT LIQUIDITY" : `Badge ${grade.badge}/10`}</span> : <span>Off the board</span>}
      </div>
      {grade ? <p className="mt-3 max-w-3xl text-sm text-muted">{grade.note}</p> : (
        <p className="mt-3 text-sm text-muted">
          This readout has not settled, so the GC Scale stays at 0%.{" "}
          <Link href={`/weeks/${call.cohortSlug}/pending`} className="text-pine underline-offset-4 hover:underline">
            Pending settle
          </Link>
        </p>
      )}
      <div className="mt-4">
        <Evolution grades={call.grades} slug={call.cohortSlug} active={readout} />
      </div>
    </article>
  );
}
