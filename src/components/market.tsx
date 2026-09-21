import Link from "next/link";
import { formatPct, formatPrice, formatShortDay, formatWhen } from "@/lib/format";
import { READOUT_META } from "@/lib/labels";
import type { QuoteView, ReadoutView } from "@/lib/queries";
import type { ReadoutKind } from "@/lib/scoring";

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
    { kicker: "Initial grade", title: "Monday", detail: "12:00 PM ET" },
    { kicker: "Mid-week update", title: "Wednesday", detail: "12:00 PM ET" },
    { kicker: "Final grade", title: "Friday", detail: "12:00 PM ET" },
  ];
  return (
    <ol className="grid gap-3 sm:grid-cols-5">
      {steps.map((step, index) => (
        <li key={`${step.title}-${step.kicker}`} className="panel px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-muted">
            {index + 1}. {step.kicker}
          </p>
          <p className="mt-1 font-serif text-xl text-ink">{step.title}</p>
          <p className="font-mono text-sm text-pine">{step.detail}</p>
        </li>
      ))}
    </ol>
  );
}

export function QuoteTape({
  quotes,
  kind,
}: {
  quotes: QuoteView[];
  kind: ReadoutKind | "latest";
}) {
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
      {quotes.map((quote) => {
        const now =
          kind === "latest"
            ? (quote.friday ?? quote.wednesday ?? quote.monday)
            : quote[kind];
        const move = now == null ? null : (now - quote.ref) / quote.ref;
        return (
          <li key={quote.symbol} className="rounded-xl border border-line bg-white px-3 py-2">
            <p className="font-mono text-[11px] uppercase tracking-wide text-muted">{quote.symbol}</p>
            <p className="font-mono text-lg text-ink">{now == null ? "—" : formatPrice(now)}</p>
            <p className="text-xs">{move == null ? <span className="text-muted">Pending</span> : <Move value={move} />}</p>
          </li>
        );
      })}
    </ul>
  );
}

export function PricePath({
  quote,
}: {
  quote: QuoteView;
}) {
  const points = [
    { label: "Sun ref", value: quote.ref },
    { label: "Mon", value: quote.monday },
    { label: "Wed", value: quote.wednesday },
    { label: "Fri", value: quote.friday },
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
        <span className="text-xs text-muted">Sunday reference through each noon print</span>
      </figcaption>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${quote.symbol} path from the Sunday reference`} className="w-full">
        <rect x="0" y="0" width={width} height={height} rx="16" fill="#ffffff" />
        <path d={path} fill="none" stroke="#14352b" strokeWidth="3" />
        {coords.map((point) => (
          <g key={point.label}>
            <circle cx={point.x} cy={point.y} r="5" fill="#dff56a" stroke="#14352b" strokeWidth="2" />
            <text x={point.x} y={height - 8} textAnchor="middle" fontSize="12" fill="#5c6b62">
              {point.label}
            </text>
          </g>
        ))}
      </svg>
      <ul className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        {points.map((point) => (
          <li key={point.label} className="font-mono text-ink">
            <span className="block text-[11px] uppercase text-muted">{point.label}</span>
            {point.value == null ? "Pending" : formatPrice(point.value)}
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
    <ul className="grid gap-3 md:grid-cols-3">
      {(["monday", "wednesday", "friday"] as const).map((kind) => {
        const readout = readouts[kind];
        const meta = READOUT_META[kind];
        const current = active === kind;
        return (
          <li key={kind}>
            <Link
              href={`/weeks/${slug}/${kind}`}
              className={`panel block h-full p-4 ${current ? "ring-2 ring-pine" : "hover:border-pine"}`}
            >
              <p className="text-[11px] uppercase tracking-wide text-muted">{meta.role}</p>
              <p className="mt-1 font-serif text-2xl text-ink">{meta.label}</p>
              <p className="font-mono text-sm text-pine">{formatWhen(readout.at)}</p>
              <p className="mt-3 text-sm text-ink">
                {readout.status === "published" ? (
                  <>
                    SPY <Move value={readout.benchmarkMovePct} /> · tape {readout.realizedDirection}
                  </>
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
