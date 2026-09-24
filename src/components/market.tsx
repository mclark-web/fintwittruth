import Link from "next/link";
import { formatPct, formatPrice, formatShortDay, formatWhen } from "@/lib/format";
import { READOUT_META } from "@/lib/labels";
import { TAPE_DISPLAY, checkpointPrints, checkpointSymbols } from "@/lib/prints";
import { PRICE_SOURCE_SHORT } from "@/lib/quotes";
import type { QuoteView, ReadoutView } from "@/lib/queries";
import { EQUITY_TAPE, READOUTS, equityTapeMove, weekendNoise, type ReadoutKind, type Sentiment } from "@/lib/scoring";

export function PriceSource() {
  return <p className="mt-2 text-xs text-muted">{PRICE_SOURCE_SHORT}</p>;
}

export function Move({ value }: { value: number }) {
  const up = value > 0.00005;
  const down = value < -0.00005;
  return (
    <span className="market-move">
      {up || down ? (
        <span className="market-move-glyph" aria-hidden="true">
          {up ? "▲" : "▼"}
        </span>
      ) : null}
      <span className="market-move-num tabular-nums">{formatPct(value)}</span>
    </span>
  );
}

const TAPE_HIT = 0.0008;
const VIX_HIT = 0.005;

/** Whether the tape moved with the call. Color follows the call, not the sign of the move. */
export function TapeMark({
  direction,
  move,
  label,
}: {
  direction: string;
  move: number;
  label?: string;
}) {
  const side = direction === "bullish" || direction === "bearish" ? direction : "split";
  const vix = label === "VIX";
  const hit = vix ? VIX_HIT : TAPE_HIT;
  const wantsUp = vix ? side === "bearish" : side === "bullish";
  const withCall = side === "split" ? false : wantsUp ? move >= hit : move <= -hit;
  const againstCall = side === "split" ? false : wantsUp ? move <= -hit : move >= hit;
  const verdict = withCall ? "with" : againstCall ? "against" : "flat";
  const glyph = verdict === "with" ? "✓" : verdict === "against" ? "✗" : "–";
  const words = verdict === "with" ? "with call" : verdict === "against" ? "against call" : "flat vs call";
  return (
    <span className={`tape-mark tape-mark-${verdict}`}>
      <span className="tape-glyph" aria-hidden="true">{glyph}</span>
      {label ? <span className="tape-ticker">{label}</span> : null}
      <span className="tape-pct tabular-nums">{formatPct(move)}</span>
      <span className="tape-tag">{words}</span>
    </span>
  );
}

export function CheckpointPrints({
  quotes,
  kind,
  primary,
  tapeOnly = true,
}: {
  quotes: QuoteView[];
  kind: ReadoutKind;
  primary?: string;
  tapeOnly?: boolean;
}) {
  const symbols = tapeOnly ? TAPE_DISPLAY : checkpointSymbols(primary);
  const prints = checkpointPrints(quotes, kind, symbols);
  const label = `${READOUT_META[kind].label} prints`;
  if (prints.length === 0) {
    return <p className="mt-1 text-xs text-muted">Not graded yet</p>;
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
            <p className="text-xs uppercase tracking-wide text-[#9a9aa3]">{READOUT_META[kind].short}</p>
            <p className="text-sm text-ink">{READOUT_META[kind].label}</p>
            <CheckpointPrints quotes={quotes} kind={kind} primary={primary} tapeOnly={tapeOnly} />
          </li>
        ))}
      </ol>
    </section>
  );
}

export function CalendarStrip() {
  const steps = [
    { kicker: "Collect opens", title: "Wednesday", detail: "12:00 PM ET" },
    { kicker: "Collect closes", title: "Sunday", detail: "5:00 PM ET" },
    { kicker: "Monday gap", title: "Monday", detail: "9:30 AM ET" },
    { kicker: "Weekend-noise grade", title: "Monday noon", detail: "12:00 PM ET" },
    { kicker: "Same cohort", title: "Wed close", detail: "4:00 PM ET" },
    { kicker: "Same cohort, final", title: "Fri close", detail: "4:00 PM ET" },
  ];
  return (
    <ol className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {steps.map((step, index) => (
        <li key={`${step.title}-${step.kicker}`} className="panel px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-[#9a9aa3]">
            {index + 1}. {step.kicker}
          </p>
          <p className="mt-1 font-serif text-xl text-ink">{step.title}</p>
          <p className="font-mono text-sm text-[#c9c9cf]">{step.detail}</p>
        </li>
      ))}
    </ol>
  );
}

export function printAt(quote: QuoteView, kind: ReadoutKind | "latest"): number | null {
  if (kind === "latest") return quote.friday ?? quote.wednesday ?? quote.monday ?? quote.mondayOpen;
  if (kind === "monday-gap") return quote.mondayOpen;
  return quote[kind];
}

export function printLabel(kind: ReadoutKind | "latest"): string {
  if (kind === "latest") return "Latest recorded print";
  if (kind === "monday-gap") return "Monday regular-session open";
  if (kind === "monday") return "Monday 12:00 PM ET print";
  if (kind === "wednesday") return "Wednesday official close";
  return "Friday official close";
}

const TILE_ORDER = ["SPY", "DIA", "QQQ", "VIX"];

function tileStamp(kind: ReadoutKind | "latest"): string {
  if (kind === "monday-gap") return "Mon open";
  if (kind === "monday") return "Mon noon";
  if (kind === "wednesday") return "Wed close";
  if (kind === "friday") return "Fri close";
  return "Latest";
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
    return (left === -1 ? 99 : left) - (right === -1 ? 99 : right) || a.symbol.localeCompare(b.symbol);
  });
  const primary = TILE_ORDER.flatMap((symbol) => ordered.filter((quote) => quote.symbol === symbol));
  const rest = ordered.filter((quote) => !TILE_ORDER.includes(quote.symbol));
  if (variant === "scoreboard") {
    const tile = (quote: QuoteView) => {
      const now = printAt(quote, kind);
      const move = now == null ? null : (now - quote.ref) / quote.ref;
      return (
        <div key={quote.symbol} className="sb-tile">
          <div className="sym">{quote.symbol}</div>
          <div className="chg">
            {move == null ? (
              "—"
            ) : (
              <>
                {move > 0.00005 || move < -0.00005 ? (
                  <span className="chg-glyph" aria-hidden="true">
                    {move > 0 ? "▲" : "▼"}
                  </span>
                ) : null}
                <span className="chg-num tabular-nums">{formatPct(move)}</span>
              </>
            )}
          </div>
          <div className="lbl">{now == null ? "Not graded" : tileStamp(kind)}</div>
        </div>
      );
    };
    return (
      <div className="scoreboard-stack" aria-label={`${printLabel(kind)} versus Friday session close`}>
        <p className="market-print-note">Market print · not a grade</p>
        <div className="scoreboard scoreboard-primary">{primary.map(tile)}</div>
        {rest.length > 0 ? <div className="scoreboard scoreboard-rest">{rest.map(tile)}</div> : null}
      </div>
    );
  }
  const cell = (quote: QuoteView) => {
    const now = printAt(quote, kind);
    const move = now == null ? null : (now - quote.ref) / quote.ref;
    return (
      <li key={quote.symbol} className="sb-tile text-left">
        <p className="sym">{quote.symbol}</p>
        <p className="font-mono text-lg text-ink">{now == null ? "—" : formatPrice(now)}</p>
        <p className="text-xs">{move == null ? <span className="text-[#9a9aa3]">Not graded yet</span> : <Move value={move} />}</p>
      </li>
    );
  };
  return (
    <section className="panel bg-panel p-4">
      <h2 className="mb-3 text-xs uppercase tracking-wide text-[#9a9aa3]">{printLabel(kind)} vs Friday session close</h2>
      <ul className="ticker-grid grid grid-cols-2 gap-3 min-[820px]:grid-cols-4">{primary.map(cell)}</ul>
      {rest.length > 0 ? (
        <ul className="ticker-rest mt-3 grid grid-cols-3 gap-3 min-[820px]:grid-cols-5">{rest.map(cell)}</ul>
      ) : null}
    </section>
  );
}

export function PricePath({
  quote,
}: {
  quote: QuoteView;
}) {
  const points = [
    { label: "Fri ref", value: quote.ref },
    { label: "Mon open", value: quote.mondayOpen },
    { label: "Mon noon", value: quote.monday },
    { label: "Wed close", value: quote.wednesday },
    { label: "Fri close", value: quote.friday },
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
        <span className="text-xs text-muted">Friday session close, Monday noon, then the official closes</span>
      </figcaption>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${quote.symbol} path from Friday's regular-session close`} className="w-full">
        <rect x="0" y="0" width={width} height={height} rx="16" fill="#161820" />
        <path d={path} fill="none" stroke="#eb6505" strokeWidth="3" />
        {coords.map((point) => (
          <g key={point.label}>
            <circle cx={point.x} cy={point.y} r="5" fill="#eb6505" stroke="#1a1005" strokeWidth="2" />
            <text x={point.x} y={height - 8} textAnchor="middle" fontSize="12" fill="#9a9aa3">
              {point.label}
            </text>
          </g>
        ))}
      </svg>
      <ul className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
        {points.map((point) => (
          <li key={point.label} className="font-mono text-ink">
            <span className="block font-mono text-xs uppercase text-[#9a9aa3]">{point.label}</span>
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
  active,
}: {
  slug: string;
  readouts: Record<ReadoutKind, ReadoutView>;
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
              <p className="text-xs uppercase tracking-wide text-[#9a9aa3]">{meta.role}</p>
              <p className="mt-1 font-serif text-2xl text-ink">{meta.label}</p>
              <p className="font-mono text-sm text-[#c9c9cf]">{formatWhen(readout.at)}</p>
              <p className="mt-3 text-sm text-ink">
                {readout.status === "published" ? (
                  <TapeMark direction={readout.consensusDirection} move={readout.benchmarkMovePct} label="Tape" />
                ) : (
                  <span className="text-muted">Scheduled · same cohort</span>
                )}
              </p>
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
            <div className="bg-[#3a342c]" style={{ width: `${noise.panicShare * 100}%` }} />
            <div className="bg-[#252a34]" style={{ width: `${noise.meltupShare * 100}%` }} />
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
                  <p className="text-xs uppercase tracking-wide text-[#9a9aa3]">{stat.label}</p>
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
