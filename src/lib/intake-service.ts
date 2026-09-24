import { extractCall, needsModelHelp } from "./extract-call";
import { llmExtractionEnabled, suggestCallWithLlm } from "./extract-llm";
import { isGradableSymbol } from "./gradable";
import type { IntakeBook, IntakePost, ReviewedCall } from "./intake-types";
import { getIntakeStore, type IntakeStore } from "./intake-store";
import { fetchStatusOembed, parseStatusUrl } from "./oembed";
import type { Conviction, Direction, Level, LevelRole, Sentiment } from "./scoring";
import { canonicalHandle } from "./watchlist";

export class IntakeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IntakeError";
  }
}

export type ReviewFields = {
  symbol: string;
  direction: string;
  horizon: string;
  conviction: string;
  sentiment: string;
  postedAt: string;
  target: string;
  invalidation: string;
  note: string;
};

function postId(statusId: string): string {
  return `status_${statusId}`;
}

export function reviewFromFields(fields: ReviewFields, text: string): ReviewedCall {
  const symbol = fields.symbol.trim().replace(/^\$/, "").toUpperCase();
  if (!/^[A-Z]{1,5}$/.test(symbol)) throw new IntakeError("Symbol must be a ticker, like SPY.");
  if (fields.direction !== "bullish" && fields.direction !== "bearish") {
    throw new IntakeError("Direction must be bullish or bearish.");
  }
  if (fields.conviction !== "high" && fields.conviction !== "medium" && fields.conviction !== "low") {
    throw new IntakeError("Conviction must be high, medium, or low.");
  }
  const horizon = fields.horizon.trim();
  if (!horizon || horizon.length > 80) throw new IntakeError("Enter a window or horizon.");
  const postedAt = new Date(fields.postedAt);
  if (Number.isNaN(postedAt.getTime()) || !fields.postedAt.includes("T")) {
    throw new IntakeError("Enter a full timestamp. oEmbed often has a date only, and this board does not invent a clock time.");
  }
  const direction = fields.direction as Direction;
  const sentiment: Sentiment =
    fields.sentiment === "panic" || fields.sentiment === "meltup"
      ? fields.sentiment
      : direction === "bearish"
        ? "panic"
        : "meltup";
  const levels: Level[] = [];
  const add = (role: LevelRole, raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    const price = Number(trimmed);
    if (!Number.isFinite(price)) throw new IntakeError(`${role} needs a number, or leave it blank.`);
    levels.push({ symbol, price, role });
  };
  add("target", fields.target);
  add("invalidation", fields.invalidation);
  if (text.trim().length < 1) throw new IntakeError("The post has no text.");
  return {
    symbol,
    direction,
    horizon,
    conviction: fields.conviction as Conviction,
    sentiment,
    postedAt: postedAt.toISOString(),
    levels,
    gradable: isGradableSymbol(symbol),
  };
}

async function savePending(
  store: IntakeStore,
  input: {
    statusId: string;
    handle: string;
    authorName: string;
    text: string;
    postedAtLabel: string;
    textSource: "oembed" | "manual";
    now?: Date;
    allowLlm?: boolean;
  },
): Promise<IntakePost> {
  const text = input.text.trim();
  if (!text) throw new IntakeError("Paste the post text. This board does not invent words.");
  const extraction = extractCall(text);
  const allowLlm = input.allowLlm ?? llmExtractionEnabled();
  let suggestion = null;
  let llmNote = allowLlm ? "" : "Model extraction is off until XAI_API_KEY is set.";
  if (needsModelHelp(extraction) && allowLlm) {
    try {
      suggestion = await suggestCallWithLlm(text);
      llmNote = suggestion ? "Model suggestion is attached. It is not graded until you confirm it." : "Model extraction returned nothing.";
    } catch (error) {
      llmNote = error instanceof Error ? `Model suggestion failed: ${error.message}` : "Model suggestion failed.";
    }
  }
  const book = await store.read();
  const id = postId(input.statusId);
  const existing = book.posts.find((post) => post.id === id);
  if (existing && existing.status !== "rejected") {
    throw new IntakeError("That status URL is already in the intake book.");
  }
  const handle = canonicalHandle(input.handle);
  const post: IntakePost = {
    id,
    sourceUrl: `https://x.com/${handle}/status/${input.statusId}`,
    statusId: input.statusId,
    handle,
    authorName: input.authorName.trim() || handle,
    text,
    postedAtLabel: input.postedAtLabel,
    textSource: input.textSource,
    fetchedAt: (input.now ?? new Date()).toISOString(),
    status: "pending",
    extraction,
    suggestion,
    llmNote,
    review: null,
    rejectNote: "",
  };
  const posts = existing
    ? book.posts.map((item) => (item.id === id ? post : item))
    : [...book.posts, post];
  await store.write({ version: 1, posts });
  return post;
}

export async function ingestStatusUrl(
  rawUrl: string,
  options: { fetchImpl?: typeof fetch; store?: IntakeStore; now?: Date; allowLlm?: boolean } = {},
): Promise<IntakePost> {
  const store = options.store ?? getIntakeStore();
  const fetched = await fetchStatusOembed(rawUrl, options.fetchImpl);
  return savePending(store, {
    statusId: fetched.statusId,
    handle: fetched.handle,
    authorName: fetched.authorName,
    text: fetched.text,
    postedAtLabel: fetched.postedAtLabel,
    textSource: "oembed",
    now: options.now,
    allowLlm: options.allowLlm,
  });
}

export async function ingestManualText(
  rawUrl: string,
  text: string,
  options: { authorName?: string; store?: IntakeStore; now?: Date; allowLlm?: boolean } = {},
): Promise<IntakePost> {
  const parsed = parseStatusUrl(rawUrl);
  if (!parsed) throw new IntakeError("Paste an x.com or twitter.com status URL. Other links are refused.");
  const body = text.trim();
  if (!body) throw new IntakeError("Paste the post text. This board does not invent words.");
  if (body.length > 4000) throw new IntakeError("Post text is too long.");
  const store = options.store ?? getIntakeStore();
  return savePending(store, {
    statusId: parsed.id,
    handle: parsed.handle,
    authorName: options.authorName ?? parsed.handle,
    text: body,
    postedAtLabel: "",
    textSource: "manual",
    now: options.now,
    allowLlm: options.allowLlm,
  });
}

export async function reviewIntakePost(
  id: string,
  action: "confirm" | "reject",
  fields: ReviewFields,
  store: IntakeStore = getIntakeStore(),
): Promise<IntakePost> {
  const book = await store.read();
  const current = book.posts.find((post) => post.id === id);
  if (!current) throw new IntakeError("That post is not in the intake book.");
  if (current.status === "rejected" && action === "reject") {
    throw new IntakeError("That post is already rejected.");
  }
  let next: IntakePost;
  if (action === "reject") {
    next = { ...current, status: "rejected", review: null, rejectNote: fields.note.trim() };
  } else {
    const review = reviewFromFields(fields, current.text);
    next = {
      ...current,
      status: review.gradable ? "confirmed" : "not_gradable",
      review,
      rejectNote: "",
    };
  }
  const updated: IntakeBook = {
    version: 1,
    posts: book.posts.map((post) => (post.id === id ? next : post)),
  };
  await store.write(updated);
  return next;
}
