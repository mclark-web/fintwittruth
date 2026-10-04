/**
 * Verified FinTwit call ledger. data/calls/calls.csv is the source of truth.
 * The exporter writes src/lib/live-calls.json in the shape the site already reads.
 * Checkpoint grades stay in the CSV. The fictional demo book is not in this file.
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  addCalendarDays,
  calendarDayString,
  marketHoliday,
  officialCloseClock,
  parseCalendarDay,
  readoutCheckpoint,
  settlementIsDue,
} from "../src/lib/calendar";
import { SYMBOLS } from "../src/lib/demo-data";
import { mentionedSymbols } from "../src/lib/extract-call";
import { GC_GRADE_LABEL, UNGRADED_HORIZON, gcGrade } from "../src/lib/grades";
import { READOUT_META } from "../src/lib/labels";
import { assertLiveFile, liveFile, type LiveCallRecord, type LiveCohortRecord, type LiveFile } from "../src/lib/live-book";
import { predictedReadout, priceAt, type PriceQuote } from "../src/lib/prints";
import { quotesForCohort, sessionFor } from "../src/lib/quotes";
import {
  EQUITY_TAPE,
  STRONG_LINE,
  WEAK_LINE,
  equityTapeMove,
  scoreCall,
  type Conviction,
  type Direction,
  type Level,
  type Sentiment,
} from "../src/lib/scoring";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export const CALLS_CSV_PATH = join(ROOT, "data/calls/calls.csv");
export const LIVE_JSON_PATH = join(ROOT, "src/lib/live-calls.json");

export const CHECKPOINTS = ["monday", "wednesday", "friday"] as const;
export type Checkpoint = (typeof CHECKPOINTS)[number];

export const CSV_COLUMNS = [
  "call_id",
  "cohort_slug",
  "history_slug",
  "cohort_title",
  "cohort_summary",
  "monday_year",
  "monday_month",
  "monday_day",
  "handle",
  "display_name",
  "bio",
  "posture",
  "accent",
  "bucket",
  "posted_at",
  "source_url",
  "direction",
  "conviction",
  "primary",
  "sentiment",
  "tone_label",
  "engagement",
  "tickers",
  "explicit",
  "levels",
  "body",
  "verification",
  "ref_price",
  "monday_date",
  "monday_status",
  "monday_price",
  "monday_score",
  "monday_grade",
  "monday_stance",
  "monday_text",
  "wednesday_date",
  "wednesday_status",
  "wednesday_price",
  "wednesday_score",
  "wednesday_grade",
  "wednesday_stance",
  "wednesday_text",
  "friday_date",
  "friday_status",
  "friday_price",
  "friday_score",
  "friday_grade",
  "friday_stance",
  "friday_text",
  "graded_at",
  "grade_method",
  "flags",
  "notes",
  "export_index",
] as const;

/** Dropped on export. The site recomputes the bubble and the GC Scale from the price tape. */
export const CSV_ONLY_COLUMNS = [
  "ref_price",
  "monday_date",
  "monday_status",
  "monday_price",
  "monday_score",
  "monday_grade",
  "monday_stance",
  "monday_text",
  "wednesday_date",
  "wednesday_status",
  "wednesday_price",
  "wednesday_score",
  "wednesday_grade",
  "wednesday_stance",
  "wednesday_text",
  "friday_date",
  "friday_status",
  "friday_price",
  "friday_score",
  "friday_grade",
  "friday_stance",
  "friday_text",
  "graded_at",
  "grade_method",
  "flags",
  "notes",
  "export_index",
] as const;

const GRADE_FIELDS = ["price", "score", "grade", "stance", "text"] as const;
const STATUSES = ["PENDING", "GRADED", "CLOSED"] as const;
const METHODS = ["recorded", "auto-yahoo"] as const;

/**
 * Closed whitelist. An index token grades on one print. Anything else stays pending.
 * SPX is the post's word; the board's print for that index is SPY.
 */
export const INDEX_PRINT: Readonly<Record<string, string>> = {
  SPX: "SPY",
  NDX: "QQQ",
  DJI: "DIA",
  RUT: "IWM",
};

export type CsvColumn = (typeof CSV_COLUMNS)[number];
export type CallRow = Record<CsvColumn, string>;

export type LedgerIssues = {
  errors: string[];
  warnings: string[];
};

export type TapePrint = {
  closed: boolean;
  ref: number | null;
  price: number | null;
  primaryRef: number | null;
  primaryNow: number | null;
  tapeMove: number | null;
  vixMove: number | null;
};

export type ComputedGrade = {
  ref: number;
  price: number;
  score: number;
  grade: string;
  stance: "with" | "against" | "flat";
  text: string;
};

export type CallClass = {
  mentions: string[];
  prints: string[];
  tickers: string[];
  errors: string[];
  ambiguous: boolean;
  proxy: boolean;
  tapeDefault: boolean;
  /** Set only when the post names exactly one print and that print is the row's primary. */
  autoPrint: string | null;
};

const EMPTY_TAPE: TapePrint = {
  closed: false,
  ref: null,
  price: null,
  primaryRef: null,
  primaryNow: null,
  tapeMove: null,
  vixMove: null,
};

export function checkpointCalendar(slug: string): Record<Checkpoint, string> {
  const monday = parseCalendarDay(slug);
  return {
    monday: calendarDayString(monday),
    wednesday: calendarDayString(addCalendarDays(monday, 2)),
    friday: calendarDayString(addCalendarDays(monday, 4)),
  };
}

export function checkpointDue(slug: string, kind: Checkpoint, now: Date): boolean {
  const day = parseCalendarDay(checkpointCalendar(slug)[kind]);
  const at = readoutCheckpoint(day, kind);
  if (kind === "monday") return now.getTime() >= at.getTime();
  return settlementIsDue(at, now);
}

export function splitTickers(value: string): string[] {
  if (value.trim() === "") return [];
  return value.split(";").map((ticker) => ticker.trim()).filter((ticker) => ticker !== "");
}

export function formatNumber(value: number): string {
  return JSON.stringify(value);
}

export function gradeLabel(score: number): string {
  return GC_GRADE_LABEL[gcGrade({ score })];
}

function emptyRow(): CallRow {
  const row = {} as CallRow;
  for (const column of CSV_COLUMNS) row[column] = "";
  return row;
}

export function parseLevels(value: string): Level[] {
  if (value === "" || value === "[]") return [];
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed)) throw new Error("levels must be a JSON array");
  return parsed.map((level) => {
    const record = level as Partial<Level>;
    return {
      symbol: String(record.symbol ?? ""),
      price: Number(record.price),
      role: record.role as Level["role"],
    };
  });
}

/** Prints the post actually named. Index tokens pass through INDEX_PRINT. Unknown tokens are ignored. */
export function resolvedPrints(text: string): string[] {
  const prints = new Set<string>();
  for (const token of mentionedSymbols(text)) {
    if (INDEX_PRINT[token]) {
      prints.add(INDEX_PRINT[token]);
      continue;
    }
    if (SYMBOLS.includes(token)) prints.add(token);
  }
  return [...prints].sort();
}

export function classifyCall(row: Pick<CallRow, "body" | "primary" | "tickers" | "explicit">): CallClass {
  const mentions = mentionedSymbols(row.body);
  const prints = resolvedPrints(row.body);
  const tickers = splitTickers(row.tickers);
  const errors: string[] = [];
  for (const ticker of tickers) {
    if (!mentions.includes(ticker)) {
      errors.push(`ticker ${ticker} is not in the post`);
    }
  }
  const tapeDefault = prints.length === 0 && row.primary === "SPY" && row.explicit === "false" && tickers.length === 0;
  if (!prints.includes(row.primary) && !tapeDefault) {
    errors.push(`primary ${row.primary || "(blank)"} does not match a ticker or index the post called`);
  }
  if (tapeDefault && row.explicit === "true") {
    errors.push("an explicit call cannot use the SPY tape default");
  }
  const proxy = prints.includes(row.primary) && !mentions.includes(row.primary);
  const ambiguous = prints.length > 1;
  const autoPrint = prints.length === 1 && prints[0] === row.primary ? row.primary : null;
  return { mentions, prints, tickers, errors, ambiguous, proxy, tapeDefault, autoPrint };
}

export function expectedFlags(row: CallRow): string {
  const call = classifyCall(row);
  const flags: string[] = [];
  if (call.ambiguous) flags.push("ambiguous-symbol");
  if (call.proxy) flags.push("index-proxy");
  if (call.tapeDefault) flags.push("tape-default");
  return flags.join(";");
}

export function loadTape(historySlug: string, primary: string, kind: Checkpoint, date: string): TapePrint {
  if (marketHoliday(date)) return { ...EMPTY_TAPE, closed: true };
  try {
    const session = sessionFor(historySlug, kind);
    if (session?.session === "closed") return { ...EMPTY_TAPE, closed: true };
    if (!session || session.date !== date || session.session !== "open") return EMPTY_TAPE;
    const symbols = [...new Set<string>([...EQUITY_TAPE, "VIX", primary])];
    const quotes = quotesForCohort(historySlug, symbols);
    const bySymbol = new Map(quotes.map((quote) => [quote.symbol, quote]));
    const moveOf = (symbol: string): number | null => {
      const quote = bySymbol.get(symbol);
      if (!quote) return null;
      const now = priceAt(quote, kind);
      if (now == null || quote.ref === 0) return null;
      return (now - quote.ref) / quote.ref;
    };
    const spy = moveOf("SPY");
    const qqq = moveOf("QQQ");
    const dia = moveOf("DIA");
    const vix = moveOf("VIX");
    const primaryQuote = bySymbol.get(primary);
    const primaryNow = primaryQuote ? priceAt(primaryQuote, kind) : null;
    if (spy == null || qqq == null || dia == null || vix == null || !primaryQuote || primaryNow == null) {
      return EMPTY_TAPE;
    }
    return {
      closed: false,
      ref: primaryQuote.ref,
      price: primaryNow,
      primaryRef: primaryQuote.ref,
      primaryNow,
      tapeMove: equityTapeMove({ SPY: spy, QQQ: qqq, DIA: dia }),
      vixMove: vix,
    };
  } catch {
    return EMPTY_TAPE;
  }
}

export function computeGrade(row: CallRow, kind: Checkpoint, tape: TapePrint): ComputedGrade | null {
  if (
    tape.closed ||
    tape.ref == null ||
    tape.price == null ||
    tape.primaryRef == null ||
    tape.primaryNow == null ||
    tape.tapeMove == null ||
    tape.vixMove == null
  ) {
    return null;
  }
  if (row.direction !== "bullish" && row.direction !== "bearish") return null;
  if (row.sentiment !== "panic" && row.sentiment !== "meltup") return null;
  let levels: Level[] = [];
  try {
    levels = parseLevels(row.levels);
  } catch {
    return null;
  }
  const parts = scoreCall(
    {
      direction: row.direction,
      sentiment: row.sentiment as Sentiment,
      primary: row.primary,
      tickers: splitTickers(row.tickers),
      levels,
      explicit: row.explicit === "true",
    },
    {
      tapeMove: tape.tapeMove,
      primaryRef: tape.primaryRef,
      primaryNow: tape.primaryNow,
      vixMove: tape.vixMove,
    },
  );
  const quote: PriceQuote = {
    symbol: row.primary,
    ref: tape.primaryRef,
    mondayOpen: null,
    monday: kind === "monday" ? tape.price : null,
    wednesday: kind === "wednesday" ? tape.price : null,
    friday: kind === "friday" ? tape.price : null,
  };
  const bubble = predictedReadout([quote], row.primary, kind, row.direction as Direction);
  if (!bubble?.stance || bubble.text === "") return null;
  return {
    ref: tape.ref,
    price: tape.price,
    score: parts.score,
    grade: gradeLabel(parts.score),
    stance: bubble.stance,
    text: bubble.text,
  };
}

function field(kind: Checkpoint, name: (typeof GRADE_FIELDS)[number] | "date" | "status"): CsvColumn {
  return `${kind}_${name}` as CsvColumn;
}

function clearGrade(row: CallRow, kind: Checkpoint) {
  for (const name of GRADE_FIELDS) row[field(kind, name)] = "";
}

function applyComputed(row: CallRow, kind: Checkpoint, computed: ComputedGrade) {
  row.ref_price = formatNumber(computed.ref);
  row[field(kind, "status")] = "GRADED";
  row[field(kind, "price")] = formatNumber(computed.price);
  row[field(kind, "score")] = String(computed.score);
  row[field(kind, "grade")] = computed.grade;
  row[field(kind, "stance")] = computed.stance;
  row[field(kind, "text")] = computed.text;
}

function latestGradedAt(slug: string, row: CallRow): string {
  for (const kind of ["friday", "wednesday", "monday"] as const) {
    if (row[field(kind, "status")] !== "GRADED") continue;
    const day = parseCalendarDay(row[field(kind, "date")]);
    return readoutCheckpoint(day, kind).toISOString();
  }
  void slug;
  return "";
}

function shellFromCall(cohort: LiveCohortRecord, call: LiveCallRecord, index: number): CallRow {
  const row = emptyRow();
  row.call_id = call.id;
  row.cohort_slug = cohort.slug;
  row.history_slug = cohort.historySlug;
  row.cohort_title = cohort.title;
  row.cohort_summary = cohort.summary;
  row.monday_year = String(cohort.monday.year);
  row.monday_month = String(cohort.monday.month);
  row.monday_day = String(cohort.monday.day);
  row.handle = call.handle;
  row.display_name = call.displayName;
  row.bio = call.bio;
  row.posture = call.posture;
  row.accent = call.accent;
  row.bucket = call.bucket;
  row.posted_at = call.postedAt;
  row.source_url = call.sourceUrl;
  row.direction = call.direction;
  row.conviction = call.conviction;
  row.primary = call.primary;
  row.sentiment = call.sentiment;
  row.tone_label = call.toneLabel;
  row.engagement = String(call.engagement);
  row.tickers = call.tickers.join(";");
  row.explicit = call.explicit ? "true" : "false";
  row.levels = JSON.stringify(call.levels);
  row.body = call.body;
  row.verification = call.verification;
  row.export_index = String(index);
  return row;
}

/** Build the committed ledger from the current live book and the recorded prints. */
export function gradedRowsFromLive(data: LiveFile = liveFile()): CallRow[] {
  const rows: CallRow[] = [];
  let index = 0;
  for (const cohort of data.cohorts) {
    const dates = checkpointCalendar(cohort.slug);
    for (const call of cohort.calls) {
      const row = shellFromCall(cohort, call, index);
      index += 1;
      for (const kind of CHECKPOINTS) {
        row[field(kind, "date")] = dates[kind];
        const tape = loadTape(cohort.historySlug, call.primary, kind, dates[kind]);
        if (tape.closed) {
          clearGrade(row, kind);
          row[field(kind, "status")] = "CLOSED";
          continue;
        }
        const computed = computeGrade(row, kind, tape);
        if (!computed) {
          clearGrade(row, kind);
          row[field(kind, "status")] = "PENDING";
          continue;
        }
        applyComputed(row, kind, computed);
      }
      const graded = CHECKPOINTS.some((kind) => row[field(kind, "status")] === "GRADED");
      row.grade_method = graded ? "recorded" : "";
      row.flags = expectedFlags(row);
      row.graded_at = latestGradedAt(cohort.slug, row);
      rows.push(row);
    }
  }
  return rows.sort((a, b) => (a.call_id < b.call_id ? -1 : a.call_id > b.call_id ? 1 : 0));
}

function renderTickers(value: string): string {
  return `[${splitTickers(value).map((ticker) => JSON.stringify(ticker)).join(", ")}]`;
}

function renderLevels(value: string): string {
  const levels = parseLevels(value);
  if (levels.length === 0) return "[]";
  return JSON.stringify(levels.map((level) => ({ symbol: level.symbol, price: level.price, role: level.role })));
}

function renderCall(row: CallRow): string {
  const lines = [
    `          "id": ${JSON.stringify(row.call_id)},`,
    `          "handle": ${JSON.stringify(row.handle)},`,
    `          "displayName": ${JSON.stringify(row.display_name)},`,
    `          "bio": ${JSON.stringify(row.bio)},`,
    `          "posture": ${JSON.stringify(row.posture)},`,
    `          "accent": ${JSON.stringify(row.accent)},`,
    `          "bucket": ${JSON.stringify(row.bucket)},`,
    `          "postedAt": ${JSON.stringify(row.posted_at)},`,
    `          "sourceUrl": ${JSON.stringify(row.source_url)},`,
    `          "direction": ${JSON.stringify(row.direction)},`,
    `          "conviction": ${JSON.stringify(row.conviction)},`,
    `          "primary": ${JSON.stringify(row.primary)},`,
    `          "sentiment": ${JSON.stringify(row.sentiment)},`,
    `          "toneLabel": ${JSON.stringify(row.tone_label)},`,
    `          "engagement": ${Number(row.engagement)},`,
    `          "tickers": ${renderTickers(row.tickers)},`,
    `          "explicit": ${row.explicit === "true"},`,
    `          "levels": ${renderLevels(row.levels)},`,
    `          "body": ${JSON.stringify(row.body)},`,
    `          "verification": ${JSON.stringify(row.verification)}`,
  ];
  return `        {\n${lines.join("\n")}\n        }`;
}

type CohortGroup = {
  slug: string;
  historySlug: string;
  title: string;
  summary: string;
  year: string;
  month: string;
  day: string;
  calls: CallRow[];
};

function cohortGroups(rows: CallRow[]): CohortGroup[] {
  const ordered = rows.slice().sort((a, b) => Number(a.export_index) - Number(b.export_index));
  const groups: CohortGroup[] = [];
  for (const row of ordered) {
    let group = groups.find((item) => item.slug === row.cohort_slug);
    if (!group) {
      group = {
        slug: row.cohort_slug,
        historySlug: row.history_slug,
        title: row.cohort_title,
        summary: row.cohort_summary,
        year: row.monday_year,
        month: row.monday_month,
        day: row.monday_day,
        calls: [],
      };
      groups.push(group);
    }
    group.calls.push(row);
  }
  return groups;
}

export function renderLiveJson(rows: CallRow[]): string {
  const cohorts = cohortGroups(rows).map((group) => {
    const calls = group.calls.map((row) => renderCall(row)).join(",\n");
    return [
      "    {",
      `      "slug": ${JSON.stringify(group.slug)},`,
      `      "historySlug": ${JSON.stringify(group.historySlug)},`,
      `      "title": ${JSON.stringify(group.title)},`,
      `      "summary": ${JSON.stringify(group.summary)},`,
      `      "monday": { "year": ${Number(group.year)}, "month": ${Number(group.month)}, "day": ${Number(group.day)} },`,
      "      \"calls\": [",
      calls,
      "      ]",
      "    }",
    ].join("\n");
  });
  return `{\n  "version": 1,\n  "cohorts": [\n${cohorts.join(",\n")}\n  ]\n}\n`;
}

export function toLiveCall(row: CallRow): LiveCallRecord {
  return {
    id: row.call_id,
    handle: row.handle,
    displayName: row.display_name,
    bio: row.bio,
    posture: row.posture,
    accent: row.accent,
    bucket: row.bucket === "viral" ? "viral" : "watchlist",
    postedAt: row.posted_at,
    sourceUrl: row.source_url,
    direction: row.direction as Direction,
    conviction: row.conviction as Conviction,
    primary: row.primary,
    sentiment: row.sentiment as Sentiment,
    toneLabel: row.tone_label,
    engagement: Number(row.engagement),
    tickers: splitTickers(row.tickers),
    explicit: row.explicit === "true",
    levels: parseLevels(row.levels),
    body: row.body,
    verification: row.verification,
  };
}

function escapeField(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}

export function serializeCallCsv(rows: CallRow[]): string {
  const lines = [CSV_COLUMNS.join(",")];
  for (const row of rows) lines.push(CSV_COLUMNS.map((column) => escapeField(row[column])).join(","));
  return `${lines.join("\n")}\n`;
}

/** RFC 4180 records. A trailing newline does not create an extra row. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let fieldValue = "";
  let quoted = false;
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  while (i < text.length) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          fieldValue += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i += 1;
        continue;
      }
      fieldValue += char;
      i += 1;
      continue;
    }
    if (char === '"') {
      quoted = true;
      i += 1;
      continue;
    }
    if (char === ",") {
      row.push(fieldValue);
      fieldValue = "";
      i += 1;
      continue;
    }
    if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(fieldValue);
      rows.push(row);
      row = [];
      fieldValue = "";
      i += 1;
      continue;
    }
    fieldValue += char;
    i += 1;
  }
  if (fieldValue.length > 0 || row.length > 0) {
    row.push(fieldValue);
    rows.push(row);
  }
  if (rows.length > 0 && rows[rows.length - 1].every((cell) => cell === "")) rows.pop();
  return rows;
}

export function parseCallCsv(text: string): CallRow[] {
  const table = parseCsv(text);
  if (table.length === 0) throw new Error("calls.csv is empty");
  const header = table[0].join(",");
  const expected = CSV_COLUMNS.join(",");
  if (header !== expected) throw new Error(`calls.csv header must be ${expected}`);
  return table.slice(1).map((cells, index) => {
    if (cells.length !== CSV_COLUMNS.length) {
      throw new Error(`calls.csv row ${index + 2} has ${cells.length} columns, expected ${CSV_COLUMNS.length}`);
    }
    const row = {} as CallRow;
    CSV_COLUMNS.forEach((column, columnIndex) => {
      row[column] = cells[columnIndex] ?? "";
    });
    return row;
  });
}

function finitePrice(value: string): number | null {
  if (value === "" || !/^-?\d+(\.\d+)?$/.test(value)) return null;
  const price = Number(value);
  if (!Number.isFinite(price)) return null;
  return price;
}

function rowLabel(row: CallRow, index: number): string {
  return row.call_id || `row ${index + 2}`;
}

function sameCohortMeta(rows: CallRow[], errors: string[]) {
  const groups = new Map<string, CallRow[]>();
  for (const row of rows) {
    const group = groups.get(row.cohort_slug) ?? [];
    group.push(row);
    groups.set(row.cohort_slug, group);
  }
  for (const [slug, group] of groups) {
    const first = group[0];
    for (const row of group.slice(1)) {
      for (const column of ["history_slug", "cohort_title", "cohort_summary", "monday_year", "monday_month", "monday_day"] as const) {
        if (row[column] !== first[column]) errors.push(`${row.call_id}: ${column} disagrees with the other rows in ${slug}`);
      }
    }
  }
}

function checkCheckpoint(row: CallRow, kind: Checkpoint, errors: string[]) {
  const label = row.call_id || "row";
  let dates: Record<Checkpoint, string>;
  try {
    dates = checkpointCalendar(row.cohort_slug);
  } catch {
    errors.push(`${label}: cohort_slug is not a calendar day`);
    return;
  }
  const date = row[field(kind, "date")];
  if (date !== dates[kind]) {
    errors.push(`${label}: ${kind}_date ${date || "(blank)"} is not the allowed ${dates[kind]}`);
  }
  const status = row[field(kind, "status")];
  if (!STATUSES.includes(status as (typeof STATUSES)[number])) {
    errors.push(`${label}: ${kind}_status must be PENDING, GRADED, or CLOSED`);
    return;
  }
  const price = finitePrice(row[field(kind, "price")]);
  const ref = finitePrice(row.ref_price);
  const scoreText = row[field(kind, "score")];
  const grade = row[field(kind, "grade")];
  const stance = row[field(kind, "stance")];
  const text = row[field(kind, "text")];
  if (status === "PENDING" || status === "CLOSED") {
    if (price != null || scoreText !== "" || grade !== "" || stance !== "" || text !== "") {
      errors.push(`${label}: a ${status} ${kind} checkpoint cannot store a price or a grade`);
    }
    if (status === "CLOSED" && date === dates[kind] && !marketHoliday(date)) {
      const session = safeSession(row.history_slug, kind);
      if (session?.session !== "closed") {
        errors.push(`${label}: ${kind} is CLOSED but ${date} is not a market holiday`);
      }
    }
    if (grade === "EXIT LIQUIDITY") {
      errors.push(`${label}: an ungraded ${kind} checkpoint reads ${UNGRADED_HORIZON}`);
    }
    return;
  }
  if (ref == null || ref <= 0 || price == null || price <= 0) {
    errors.push(`${label}: graded ${kind} is missing the price at the call or the price at the checkpoint`);
    return;
  }
  if (!/^\d+$/.test(scoreText)) {
    errors.push(`${label}: ${kind}_score must be an integer from 0 to 100`);
    return;
  }
  const score = Number(scoreText);
  if (score > 100) errors.push(`${label}: ${kind}_score ${score} is above 100`);
  if (grade !== gradeLabel(score)) {
    errors.push(`${label}: ${kind}_grade must be ${gradeLabel(score)} for score ${score}`);
  }
  if (score === 0 && grade !== "EXIT LIQUIDITY") {
    errors.push(`${label}: a graded 0% on ${kind} must be EXIT LIQUIDITY`);
  }
  const tape = loadTape(row.history_slug, row.primary, kind, date);
  const computed = computeGrade(row, kind, tape);
  if (!computed) {
    errors.push(`${label}: ${kind} is GRADED but the recorded print is missing. Refusing to invent one.`);
    return;
  }
  if (computed.price !== price || computed.ref !== ref) {
    errors.push(`${label}: ${kind} price does not match the recorded print`);
  }
  if (computed.score !== score) errors.push(`${label}: ${kind} score ${score} does not match the scorer (${computed.score})`);
  if (computed.grade !== grade) errors.push(`${label}: ${kind} grade does not match gcGrade`);
  if (computed.stance !== stance) errors.push(`${label}: ${kind} stance does not match the call`);
  if (computed.text !== text) errors.push(`${label}: ${kind} bubble text does not match the readout`);
}

function safeSession(historySlug: string, kind: Checkpoint) {
  try {
    return sessionFor(historySlug, kind);
  } catch {
    return null;
  }
}

export function checkGradeRules(errors: string[]) {
  if (STRONG_LINE !== 70 || WEAK_LINE !== 40) {
    errors.push(`grade bands must be 70 and 40, found ${STRONG_LINE} and ${WEAK_LINE}`);
  }
  if (READOUT_META.monday.time !== "12:00 PM ET") errors.push("Monday noon must stay 12:00 PM ET");
  if (READOUT_META.wednesday.time !== "4:00 PM ET" || READOUT_META.friday.time !== "4:00 PM ET") {
    errors.push("Wednesday and Friday closes must stay 4:00 PM ET");
  }
  if (UNGRADED_HORIZON !== "Not graded yet") {
    errors.push(`an ungraded horizon must read "Not graded yet"`);
  }
  const bands: Array<[number, string]> = [
    [100, "STRONG"],
    [70, "STRONG"],
    [69.9, "PROVISIONAL"],
    [69, "PROVISIONAL"],
    [40, "PROVISIONAL"],
    [39.9, "WEAK"],
    [39, "WEAK"],
    [1, "WEAK"],
    [0, "EXIT LIQUIDITY"],
  ];
  for (const [score, name] of bands) {
    if (gradeLabel(score) !== name) errors.push(`gcGrade(${score}) must be ${name}`);
  }
  const sample = "2026-09-23";
  const clock = officialCloseClock(sample);
  if (!clock || clock.hour !== 16 || clock.minute !== 0) {
    errors.push("a regular Wednesday close must be 4:00 PM ET");
  }
}

export function collectIssues(rows: CallRow[]): LedgerIssues {
  const errors: string[] = [];
  const warnings: string[] = [];
  const seenIds = new Set<string>();
  const indexes = new Set<number>();
  checkGradeRules(errors);

  const sorted = rows.map((row) => row.call_id);
  const ordered = sorted.slice().sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  if (sorted.some((id, index) => id !== ordered[index])) errors.push("calls.csv must be sorted by call_id");
  sameCohortMeta(rows, errors);

  rows.forEach((row, index) => {
    const label = rowLabel(row, index);
    if (row.call_id === "") errors.push(`${label}: call_id is required`);
    if (row.call_id !== `${row.cohort_slug}__${row.handle}`) {
      errors.push(`${label}: call_id must be cohort_slug__handle`);
    }
    if (seenIds.has(row.call_id)) errors.push(`${label}: duplicate call_id`);
    else if (row.call_id !== "") seenIds.add(row.call_id);
    const exportIndex = Number(row.export_index);
    if (!/^(0|[1-9]\d*)$/.test(row.export_index) || indexes.has(exportIndex)) {
      errors.push(`${label}: export_index must be a unique integer`);
    } else {
      indexes.add(exportIndex);
    }
    if (row.source_url === "" || !/^https:\/\/\S+$/.test(row.source_url)) {
      errors.push(`${label}: missing source URL`);
    }
    if (row.graded_at !== "" && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(row.graded_at)) {
      errors.push(`${label}: graded_at must be an ISO timestamp when set`);
    }
    const graded = CHECKPOINTS.filter((kind) => row[field(kind, "status")] === "GRADED");
    if (graded.length === 0) {
      if (row.grade_method !== "") errors.push(`${label}: a row with no graded checkpoint has no grade_method`);
    } else if (!METHODS.includes(row.grade_method as (typeof METHODS)[number])) {
      errors.push(`${label}: grade_method must be recorded or auto-yahoo`);
    }
    const call = classifyCall(row);
    for (const error of call.errors) errors.push(`${label}: ${error}`);
    if (row.flags !== expectedFlags(row)) {
      errors.push(`${label}: flags must be ${expectedFlags(row) || "(none)"}`);
    }
    if ((call.ambiguous || call.tapeDefault) && row.grade_method === "auto-yahoo") {
      errors.push(`${label}: ambiguous-symbol and tape-default rows stay recorded. They are not auto-graded.`);
    }
    for (const kind of CHECKPOINTS) checkCheckpoint(row, kind, errors);
    if (graded.length > 0 && finitePrice(row.ref_price) == null) {
      errors.push(`${label}: a graded row needs the price at the call`);
    }
  });

  for (let index = 0; index < rows.length; index += 1) {
    if (!indexes.has(index)) errors.push(`export_index is missing ${index}`);
  }

  try {
    const rendered = renderLiveJson(rows);
    assertLiveFile(JSON.parse(rendered) as LiveFile);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "live book check failed");
  }

  return { errors, warnings };
}

export type SettleAction = "unchanged" | "graded" | "synced" | "closed" | "flagged";

export function considerCheckpoint(
  row: CallRow,
  kind: Checkpoint,
  input: { now: Date; due: boolean; tape: TapePrint },
): { row: CallRow; action: SettleAction; detail: string } {
  const label = `${row.call_id} ${kind}`;
  let allowed = "";
  try {
    allowed = checkpointCalendar(row.cohort_slug)[kind];
  } catch {
    return { row, action: "flagged", detail: `${label}: cohort_slug is not a calendar day` };
  }
  if (row[field(kind, "date")] !== allowed) {
    return { row, action: "flagged", detail: `${label}: checkpoint date is not in the allowed set (${allowed})` };
  }
  const status = row[field(kind, "status")];
  if (status === "CLOSED") return { row, action: "unchanged", detail: "" };
  if (input.tape.closed || marketHoliday(allowed)) {
    if (status === "PENDING") {
      const next = { ...row };
      clearGrade(next, kind);
      next[field(kind, "status")] = "CLOSED";
      return { row: next, action: "closed", detail: `${label}: market closed, left ungraded` };
    }
    return { row, action: "flagged", detail: `${label}: session is closed but status is ${status}` };
  }
  if (status === "PENDING") {
    if (!input.due) return { row, action: "unchanged", detail: "" };
    const call = classifyCall(row);
    if (!call.autoPrint) {
      const why = call.tapeDefault
        ? "post names no ticker or index"
        : call.ambiguous
          ? "post names more than one print"
          : call.errors[0] ?? "symbol is not on the whitelist";
      return { row, action: "flagged", detail: `${label}: left pending, ${why}` };
    }
    const computed = computeGrade(row, kind, input.tape);
    if (!computed) {
      return { row, action: "flagged", detail: `${label}: print is missing. Refusing to invent one.` };
    }
    const next = { ...row };
    applyComputed(next, kind, computed);
    if (next.grade_method !== "recorded") next.grade_method = "auto-yahoo";
    next.flags = expectedFlags(next);
    next.graded_at = latestGradedAt(next.cohort_slug, next);
    return { row: next, action: "graded", detail: `${label}: ${computed.text} ${computed.grade}` };
  }
  if (status !== "GRADED") {
    return { row, action: "flagged", detail: `${label}: status ${status || "(blank)"} is not a checkpoint status` };
  }
  const computed = computeGrade(row, kind, input.tape);
  if (!computed) {
    return { row, action: "flagged", detail: `${label}: graded checkpoint has no recorded print` };
  }
  const drifted =
    row.ref_price !== formatNumber(computed.ref) ||
    row[field(kind, "price")] !== formatNumber(computed.price) ||
    row[field(kind, "score")] !== String(computed.score) ||
    row[field(kind, "grade")] !== computed.grade ||
    row[field(kind, "stance")] !== computed.stance ||
    row[field(kind, "text")] !== computed.text;
  if (!drifted) return { row, action: "unchanged", detail: "" };
  const next = { ...row };
  applyComputed(next, kind, computed);
  next.flags = expectedFlags(next);
  next.graded_at = latestGradedAt(next.cohort_slug, next);
  return { row: next, action: "synced", detail: `${label}: print moved to ${computed.text} ${computed.grade}` };
}

export function settleLedger(
  rows: CallRow[],
  input: {
    now: Date;
    tapeFor: (row: CallRow, kind: Checkpoint) => TapePrint;
    due?: (row: CallRow, kind: Checkpoint, now: Date) => boolean;
  },
): { rows: CallRow[]; lines: string[]; graded: number; synced: number; closed: number; flagged: number; pending: number } {
  const due = input.due ?? ((row, kind, now) => checkpointDue(row.cohort_slug, kind, now));
  let graded = 0;
  let synced = 0;
  let closed = 0;
  let flagged = 0;
  let pending = 0;
  const lines: string[] = [];
  const nextRows = rows.map((start) => {
    let row = start;
    for (const kind of CHECKPOINTS) {
      const result = considerCheckpoint(row, kind, {
        now: input.now,
        due: due(row, kind, input.now),
        tape: input.tapeFor(row, kind),
      });
      row = result.row;
      if (result.action === "graded") graded += 1;
      else if (result.action === "synced") synced += 1;
      else if (result.action === "closed") closed += 1;
      else if (result.action === "flagged") flagged += 1;
      if (result.detail) lines.push(result.detail);
      if (row[field(kind, "status")] === "PENDING") pending += 1;
    }
    return row;
  });
  return { rows: nextRows, lines, graded, synced, closed, flagged, pending };
}
