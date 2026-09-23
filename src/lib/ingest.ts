import { buildCohortWindow } from "./calendar";
import type { LiveCallRecord, LiveCohortRecord, LiveFile } from "./live-book";
import { assertLiveCall } from "./live-book";
import type { Conviction, Direction, Sentiment } from "./scoring";

const BEARISH = /\b(crash|doomed|doom|sell the open|selloff|sell-off|bearish|pullback|breakdown|short the)\b/i;
const BULLISH = /\b(melt-?up|bullish|moon|all-time high|ath|rip higher|going higher)\b/i;

export type ParsedCall = {
  sourceUrl: string;
  handle: string;
  displayName: string;
  postedAt: string;
  direction: Direction;
  primary: string;
  tickers: string[];
  explicit: boolean;
  sentiment: Sentiment;
  conviction: Conviction;
  toneLabel: string;
  body: string;
  posture: string;
};

export class IngestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IngestError";
  }
}

function fieldMap(header: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of header.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z][\w-]*)\s*:\s*(.*?)\s*$/);
    if (match) map.set(match[1].toLowerCase(), match[2]);
  }
  return map;
}

function directionFromText(text: string, stated?: string): Direction {
  if (stated === "bullish" || stated === "bearish") {
    const bear = BEARISH.test(text);
    const bull = BULLISH.test(text);
    if (bear && bull) {
      throw new IngestError("The post argues both ways. Refusing to pick a direction.");
    }
    if (stated === "bearish" && bull && !bear) {
      throw new IngestError("Labeled bearish, but the text reads bullish. Refusing to store it.");
    }
    if (stated === "bullish" && bear && !bull) {
      throw new IngestError("Labeled bullish, but the text reads bearish. Refusing to store it.");
    }
    return stated;
  }
  const bear = BEARISH.test(text);
  const bull = BULLISH.test(text);
  if (bear === bull) {
    throw new IngestError("Direction is not bullish or bearish in the paste. Refusing to guess.");
  }
  return bear ? "bearish" : "bullish";
}

function handleFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    if (host === "x.com" || host === "twitter.com") {
      const handle = parsed.pathname.split("/").filter(Boolean)[0];
      if (handle && handle !== "i" && handle !== "search") return handle;
    }
    if (host.endsWith(".substack.com")) {
      return host.replace(".substack.com", "").replace(/[^A-Za-z0-9_]/g, "");
    }
  } catch {
    return null;
  }
  return null;
}

function tickersFromText(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(/\$([A-Za-z]{1,5})\b|\b(SPX|NDX|SPY|QQQ|DIA|IWM|VIX)\b/g)) {
    found.add((match[1] || match[2]).toUpperCase());
  }
  return [...found];
}

/**
 * Operator paste. A structured header plus the post text, or a URL plus the text.
 * Missing handle, timestamp, source URL, or direction is a refusal. Nothing is filled in.
 */
export function parseOperatorPaste(raw: string): ParsedCall {
  const text = raw.trim();
  if (!text) throw new IngestError("Empty paste.");
  const splitAt = text.indexOf("\n---");
  const header = splitAt === -1 ? text : text.slice(0, splitAt);
  const bodyBlock = splitAt === -1 ? "" : text.slice(splitAt + 4).trim();
  const fields = fieldMap(header);
  const sourceUrl = fields.get("source") || fields.get("url") || header.match(/https:\/\/\S+/)?.[0];
  if (!sourceUrl || !sourceUrl.startsWith("https://")) {
    throw new IngestError("Paste a source URL. Refusing to store a post without one.");
  }
  const handle = (fields.get("handle") || handleFromUrl(sourceUrl) || "").replace(/^@/, "");
  if (!handle) throw new IngestError("No handle in the paste or the URL. Refusing to invent one.");
  const postedAt = fields.get("posted") || fields.get("postedat") || fields.get("timestamp") || "";
  if (!postedAt || Number.isNaN(new Date(postedAt).getTime())) {
    throw new IngestError("Paste an ISO timestamp in posted:. Refusing to invent a clock time.");
  }
  const body = (bodyBlock || fields.get("body") || "").trim();
  if (body.length < 40) {
    throw new IngestError("Paste the post text under ---. Refusing to invent the words.");
  }
  const direction = directionFromText(body, fields.get("direction"));
  const primary = (fields.get("primary") || "SPY").toUpperCase();
  const statedTickers = fields.get("tickers");
  const tickers = statedTickers
    ? statedTickers.split(/[,\s]+/).map((item) => item.replace(/^\$/, "").toUpperCase()).filter(Boolean)
    : tickersFromText(body);
  const explicit = fields.get("explicit")
    ? fields.get("explicit") === "true"
    : tickers.length > 0;
  const sentiment: Sentiment =
    fields.get("sentiment") === "meltup" || fields.get("sentiment") === "panic"
      ? (fields.get("sentiment") as Sentiment)
      : direction === "bearish"
        ? "panic"
        : "meltup";
  const conviction = fields.get("conviction");
  if (conviction && conviction !== "high" && conviction !== "medium" && conviction !== "low") {
    throw new IngestError("Conviction must be high, medium, or low.");
  }
  return {
    sourceUrl: sourceUrl.replace(/[.,)]$/, ""),
    handle,
    displayName: fields.get("name") || fields.get("displayname") || handle,
    postedAt: new Date(postedAt).toISOString(),
    direction,
    primary,
    tickers: explicit ? tickers : [],
    explicit: explicit && tickers.length > 0,
    sentiment,
    conviction: (conviction as Conviction) || "medium",
    toneLabel: fields.get("tone") || (direction === "bearish" ? "Pullback" : "Melt-up"),
    body,
    posture: fields.get("posture") || (direction === "bearish" ? "Bearish call" : "Bullish call"),
  };
}

export function excerptAppearsInDocument(excerpt: string, documentText: string): boolean {
  const normalize = (value: string) =>
    value
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&nbsp;/g, " ")
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  const needle = normalize(excerpt);
  if (needle.length < 40) return false;
  return normalize(documentText).includes(needle);
}

export function toLiveCall(parsed: ParsedCall, id: string): LiveCallRecord {
  return {
    id,
    handle: parsed.handle,
    displayName: parsed.displayName,
    bio: "Verified public post added by the operator. The card quotes the paste and links the source.",
    posture: parsed.posture,
    accent: "#0f766e",
    bucket: "watchlist",
    postedAt: parsed.postedAt,
    sourceUrl: parsed.sourceUrl,
    direction: parsed.direction,
    conviction: parsed.conviction,
    primary: parsed.primary,
    sentiment: parsed.sentiment,
    toneLabel: parsed.toneLabel,
    engagement: 0,
    tickers: parsed.tickers,
    explicit: parsed.explicit,
    levels: [],
    body: parsed.body,
    verification: `Operator paste checked against ${parsed.sourceUrl}.`,
  };
}

export function upsertLiveCall(data: LiveFile, cohort: Omit<LiveCohortRecord, "calls">, call: LiveCallRecord): LiveFile {
  const window = buildCohortWindow(cohort.monday);
  const next: LiveFile = {
    version: 1,
    cohorts: data.cohorts.map((item) => ({ ...item, calls: [...item.calls] })),
  };
  let target = next.cohorts.find((item) => item.slug === cohort.slug);
  if (!target) {
    target = { ...cohort, calls: [] };
    next.cohorts.push(target);
  }
  const urls = new Set(next.cohorts.flatMap((item) => item.calls.map((itemCall) => itemCall.sourceUrl)));
  assertLiveCall(call, window, urls);
  target.calls.push(call);
  return next;
}
