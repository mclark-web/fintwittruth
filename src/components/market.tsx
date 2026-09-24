import Link from "next/link";
import { formatPct, formatPrice, formatShortDay, formatWhen } from "@/lib/format";
import { READOUT_META } from "@/lib/labels";
import { checkpointPrints, checkpointSymbols, priceAt, type CallStance, TAPE_DISPLAY } from "@/lib/prints";
import { SignedMove } from "@/components/score";
import { PRICE_SOURCE_SHORT } from "@/lib/quotes";
import type { QuoteView, ReadoutView } from "@/lib/queries";
import { EQUITY_TAPE, READOUTS, equityTapeMove, tapeDirection, weekendNoise, type ReadoutKind, type Sentiment } from "@/lib/scoring";

export function PriceSource() {
  return <p className="mt-2 text-xs text-muted">{PRICE_SOURCE_SHORT}</p>;
}

/** Crowd call versus the tape. Color follows that result, not whether the tape rose. */
export function crowdTapeStance(consensus: string, move: number): CallStance {
  const realized = tapeDirection(move);
  if (consensus !== "bullish" && consensus !== "bearish") return "flat";
  if (realized === "flat") return "flat";
  return consensus === realized ? "with" : "against";
}

export function Move({ value }: { value: number }) {
  const up = value > 0.00005;
  const down = value < -0.00005;
  return (
    <span className={up ? "text-bull" : down ? "text-bear" : "text-muted"}>{formatPct(value)}</span>
  );
}

export function CalendarStrip() {
  const steps = [
    { kicker: "Collect opens", title: "Wednesday", detail: "12:00 PM ET" },
    { kicker: "Collect closes", title: "Sunday", detail: "5:00 PM ET" },
    ...READOUTS.map((kind) => ({
      kicker: READOUT_META[kind].role,
      title: READOUT_META[kind].short,
      detail: READOUT_META[kind].time,
    })),
  ];
  return (
    <ol className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {steps.map((step, index) => (
        <li key={`${step.title}-${step.kicker}`} className="panel px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-muted">
            {index + 1}. {step.kicker}
          </p>
          <p className="mt-1 font-serif text-xl text-ink">{step.title}</p>
          <p className="font-mono text-sm text-pine">{step.detail}</p>
        </li>
      ))}
    </ol>
  );
}

export function printAt(quote: QuoteView, kind: ReadoutKind | "latest"): number | null {
  if (kind === "latest") return quote.friday ?? quote.wednesday ?? quote.monday ?? quote.mondayOpen;
  return priceAt(quote, kind);
}

export function CheckpointPrints({
  quotes,
  kind,
  primary,
  tapeOnly = true,
  variant = "chips",
}: {
  quotes: QuoteView[];
  kind: ReadoutKind;
  primary?: string;
  tapeOnly?: boolean;
  variant?: "chips" | "line";
}) {
  const symbols = tapeOnly ? TAPE_DISPLAY : checkpointSymbols(primary);
  const prints = checkpointPrints(quotes, kind, symbols);
  const label = `${READOUT_META[kind].label} prints`;
  if (prints.length === 0) {
    return <p className="mt-1 text-xs text-muted">Not graded yet</p>;
  }
  if (variant === "line") {
    return (
      <p className="mt-1 font-mono text-xs leading-relaxed text-ink" aria-label={label}>
        {prints.map((print, index) => (
          <span key={print.symbol}>
            {index > 0 ? <span className="text-muted"> · </span> : null}
            <span className="text-[color:var(--orange-soft)]">{print.symbol}</span> {formatPrice(print.price)}
          </span>
        ))}
      </p>
    );
  }
  return (
    <ul className="checkpoint-prints" aria-label={label}>
      {prints.map((print) => (
        <li key={print.symbol}>
          <span className="sym">{print.symbol}</span>
          <span className="px">{formatPrice(print.price)}</span>
        </li>
      ))}
    </ul>
  );
}

export function CheckpointStrip({
  quotes,
  primary,
  tapeOnly = true,
}: {
  quotes: QuoteView[];
  primary?: string;
  tapeOnly?: boolean;
}) {
  return (
    <section aria-label="Prints used at each checkpoint">
      <h2 className="text-sm font-semibold text-ink">Prints used</h2>
      <p className="mt-1 max-w-3xl text-xs text-muted">
        Recorded print at each checkpoint. {READOUT_META.monday.short} is {READOUT_META.monday.time}.{" "}
        {READOUT_META.wednesday.short} and {READOUT_META.friday.short} are {READOUT_META.wednesday.time}.
      </p>
      <ol className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {READOUTS.map((kind) => (
          <li key={kind} className="rounded-xl border border-line bg-sheet px-3 py-3">
            <p className="text-xs uppercase tracking-wide text-muted">{READOUT_META[kind].short}</p>
            <p className="text-sm text-ink">{READOUT_META[kind].label}</p>
            <CheckpointPrints quotes={quotes} kind={kind} primary={primary} tapeOnly={tapeOnly} />
          </li>
        ))}
      </ol>
    </section>
  );
}

export function printLabel(kind: ReadoutKind | "latest"): string {
  if (kind === "latest") return "Latest recorded print";
  return `${READOUT_META[kind].label} · ${READOUT_META[kind].time}`;
}

const TILE_ORDER: readonly string[] = TAPE_DISPLAY;

function tileStamp(kind: ReadoutKind | "latest"): string {
  if (kind === "latest") return "Latest";
  return READOUT_META[kind].short;
}

export function QuoteTape({
  quotes,
  kind,
  variant = "grid",
}: {
  quotes: QuoteView[];
  kind: ReadoutKind | "latest";
  variant?: "grid" | "scoreboard";
}) {
  const ordered = [...quotes].sort((a, b) => {
    const left = TILE_ORDER.indexOf(a.symbol);
    const right = TILE_ORDER.indexOf(b.symbol);
    return (left === -1 ? 99 : left) - (right === -1 ? 99 : right);
  });
  if (variant === "scoreboard") {
    return (
      <div className="scoreboard" aria-label={`${printLabel(kind)} versus Friday session close`}>
        {ordered.map((quote) => {
          const now = printAt(quote, kind);
          const move = now == null ? null : (now - quote.ref) / quote.ref;
          return (
            <div key={quote.symbol} className="sb-tile">
              <div className="sym">{quote.symbol}</div>
              <div className="px">{now == null ? "—" : formatPrice(now)}</div>
              <div className={`chg ${move == null ? "" : move > 0.00005 ? "text-bull" : move < -0.00005 ? "text-bear" : "text-muted"}`}>
                {move == null ? "—" : formatPct(move)}
              </div>
              <div className="lbl">{now == null ? "Not graded" : tileStamp(kind)}</div>
            </div>
          );
        })}
      </div>
    );
  }
  return (
    <div>
      <p className="mb-2 text-xs uppercase tracking-wide text-muted">{printLabel(kind)} vs Friday session close</p>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ordered.map((quote) => {
          const now = printAt(quote, kind);
          const move = now == null ? null : (now - quote.ref) / quote.ref;
          return (
            <li key={quote.symbol} className="sb-tile text-left">
              <p className="sym">{quote.symbol}</p>
              <p className="font-mono text-lg text-ink">{now == null ? "—" : formatPrice(now)}</p>
              <p className="text-xs">{move == null ? <span className="text-muted">Not graded yet</span> : <Move value={move} />}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function PricePath({
  quote,
}: {
  quote: QuoteView;
}) {
  const points = [
    { label: "Fri ref", value: quote.ref },
    { label: READOUT_META["monday-gap"].short, value: quote.mondayOpen },
    { label: READOUT_META.monday.short, value: quote.monday },
    { label: READOUT_META.wednesday.short, value: quote.wednesday },
    { label: READOUT_META.friday.short, value: quote.friday },
  ];
  const present = points.filter((point): point is { label: string; value: number } => point.value != null);
  const min = Math.min(...present.map((point) => point.value));
  const max = Math.max(...present.map((point) => point.value));
  const span = max - min || Math.abs(min) * 0.01 || 1;
  const width = 640;
  const height = 160;
  const coords = present.map((point, index) => {
    const x = present.length === 1 ? width / 2 : (index / (present.length - 1)) * (width - 48) + 24;
    const y = height - 28 - ((point.value - min) / span) * (height - 56);
    return { ...point, x, y };
  });
  const path = coords.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");

  return (
    <figure>
      <figcaption className="mb-2 flex items-baseline justify-between gap-3">
        <span className="font-medium text-ink">
          {quote.symbol} <span className="font-normal text-muted">{quote.name}</span>
        </span>
        <span className="text-xs text-muted">Friday session close, then each checkpoint print</span>
      </figcaption>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${quote.symbol} path from Friday's regular-session close`} className="w-full">
        <rect x="0" y="0" width={width} height={height} rx="16" fill="#161820" />
        <path d={path} fill="none" stroke="#eb6505" strokeWidth="3" />
        {coords.map((point) => (
          <g key={point.label}>
            <circle cx={point.x} cy={point.y} r="5" fill="#fee0a8" stroke="#eb6505" strokeWidth="2" />
            <text x={point.x} y={height - 8} textAnchor="middle" fontSize="12" fill="#9a9aa3">
              {point.label}
            </text>
          </g>
        ))}
      </svg>
      <ul className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
        {points.map((point) => (
          <li key={point.label} className="font-mono text-ink">
            <span className="block text-xs uppercase text-muted">
              {quote.symbol} · {point.label}
            </span>
            {point.value == null ? "Not graded yet" : formatPrice(point.value)}
          </li>
        ))}
      </ul>
    </figure>
  );
}

export function ReadoutCards({
  slug,
  readouts,
  quotes,
  active,
}: {
  slug: string;
  readouts: Record<ReadoutKind, ReadoutView>;
  quotes?: QuoteView[];
  active?: ReadoutKind;
}) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {READOUTS.map((kind) => {
        const readout = readouts[kind];
        const meta = READOUT_META[kind];
        const current = active === kind;
        return (
          <li key={kind}>
            <Link
              href={`/weeks/${slug}/${kind}`}
              className={`panel block h-full p-4 ${current ? "ring-2 ring-pine" : "hover:border-pine/60"}`}
            >
              <p className="text-xs uppercase tracking-wide text-muted">{meta.role}</p>
              <p className="mt-1 font-serif text-2xl text-ink">{meta.label}</p>
              <p className="font-mono text-sm text-pine">{formatWhen(readout.at)}</p>
              <p className="mt-3 text-sm text-ink">
                {readout.status === "published" ? (
                  <>
                    Tape{" "}
                    <SignedMove
                      move={readout.benchmarkMovePct}
                      stance={crowdTapeStance(readout.consensusDirection, readout.benchmarkMovePct)}
                    />{" "}
                    · {readout.realizedDirection}
                  </>
                ) : (
                  <span className="text-muted">Scheduled · same cohort</span>
                )}
              </p>
              {quotes ? (
                <CheckpointPrints quotes={quotes} kind={kind} />
              ) : null}
              <p className="mt-2 text-xs text-muted">
                Crowd {readout.consensusDirection} · {Math.round(readout.consensusBullish * 100)}% bullish weight
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function tapeMove(quotes: QuoteView[], kind: "monday-gap" | "monday"): number | null {
  const moves = {} as Record<(typeof EQUITY_TAPE)[number], number>;
  for (const symbol of EQUITY_TAPE) {
    const quote = quotes.find((item) => item.symbol === symbol);
    const now = quote ? printAt(quote, kind) : null;
    if (!quote || now == null) return null;
    moves[symbol] = (now - quote.ref) / quote.ref;
  }
  return equityTapeMove(moves);
}

function vixMove(quotes: QuoteView[], kind: "monday-gap" | "monday"): number | null {
  const quote = quotes.find((item) => item.symbol === "VIX");
  const now = quote ? printAt(quote, kind) : null;
  if (!quote || now == null) return null;
  return (now - quote.ref) / quote.ref;
}

export function NoiseIndex({
  calls,
  quotes,
  compact = false,
}: {
  calls: { sentiment: Sentiment; engagement: number }[];
  quotes: QuoteView[];
  compact?: boolean;
}) {
  const noise = weekendNoise(
    calls.map((call) => call.sentiment),
    calls.map((call) => call.engagement),
  );
  const gap = tapeMove(quotes, "monday-gap");
  const noon = tapeMove(quotes, "monday");
  const vixGap = vixMove(quotes, "monday-gap");
  const vixNoon = vixMove(quotes, "monday");
  const stats = [
    { label: "Monday gap tape", value: gap },
    { label: "Monday noon tape", value: noon },
    { label: "VIX at the open", value: vixGap },
    { label: "VIX at noon", value: vixNoon },
  ];
  return (
    <section className="panel p-5" aria-labelledby="wni-heading">
      <h2 id="wni-heading" className="font-serif text-2xl text-ink">
        Weekend Noise Index
      </h2>
      <p className="mt-2 max-w-3xl text-sm text-muted">
        Share of this cohort tagged panic, crash, or selloff, next to the equal-weight SPY, QQQ, and DIA move
        from Friday&apos;s regular-session close. Descriptive only. Not a signal.
      </p>
      <div className={`mt-4 grid gap-4 ${compact ? "" : "md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]"}`}>
        <div>
          <div
            className="flex h-3 overflow-hidden rounded-full bg-line"
            role="img"
            aria-label={`${Math.round(noise.panicShare * 100)} percent panic and ${Math.round(noise.meltupShare * 100)} percent melt-up`}
          >
            <div className="bg-bear" style={{ width: `${noise.panicShare * 100}%` }} />
            <div className="bg-bull" style={{ width: `${noise.meltupShare * 100}%` }} />
          </div>
          <p className="mt-2 text-sm text-ink">
            {Math.round(noise.panicShare * 100)}% panic · {Math.round(noise.meltupShare * 100)}% melt-up
          </p>
          <p className="mt-1 text-xs text-muted">
            Engagement-weighted panic share {Math.round(noise.engagementPanicShare * 100)}%.
          </p>
        </div>
        {stats.some((stat) => stat.value != null) ? (
          <ul className="grid grid-cols-2 gap-2">
            {stats
              .filter((stat): stat is { label: string; value: number } => stat.value != null)
              .map((stat) => (
                <li key={stat.label} className="rounded-xl border border-line bg-sheet px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-muted">{stat.label}</p>
                  <p className="font-mono text-lg text-ink">
                    <Move value={stat.value} />
                  </p>
                </li>
              ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">The Monday tape is off this board until the session settles.</p>
        )}
      </div>
    </section>
  );
}

export function CohortWindow({
  collectStart,
  collectEnd,
  mondayAt,
}: {
  collectStart: Date;
  collectEnd: Date;
  mondayAt: Date;
}) {
  return (
    <p className="text-sm text-muted">
      Collect {formatWhen(collectStart)} → {formatWhen(collectEnd)}. Readout week of {formatShortDay(mondayAt)}.
    </p>
  );
}
