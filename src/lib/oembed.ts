export class OembedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OembedError";
  }
}

export type ParsedStatusUrl = {
  handle: string;
  id: string;
  canonical: string;
};

export type OembedPost = {
  sourceUrl: string;
  statusId: string;
  handle: string;
  authorName: string;
  text: string;
  postedAtLabel: string;
};

/** Current host, then the old host. Both are followed if they redirect. */
const OEMBED_ENDPOINTS = ["https://publish.x.com/oembed", "https://publish.twitter.com/oembed"];

export class OembedUnavailableError extends OembedError {
  readonly sourceUrl: string;
  readonly handle: string;
  readonly statusId: string;

  constructor(message: string, parsed: ParsedStatusUrl) {
    super(message);
    this.name = "OembedUnavailableError";
    this.sourceUrl = parsed.canonical;
    this.handle = parsed.handle;
    this.statusId = parsed.id;
  }
}

export function parseStatusUrl(input: string): ParsedStatusUrl | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "");
  if (host !== "x.com" && host !== "twitter.com" && host !== "mobile.twitter.com") return null;
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 3 || parts[1] !== "status") return null;
  const handle = parts[0] ?? "";
  const id = (parts[2] ?? "").replace(/\D/g, "");
  if (!/^[A-Za-z0-9_]{1,15}$/.test(handle)) return null;
  if (!/^\d{1,25}$/.test(id)) return null;
  return { handle, id, canonical: `https://x.com/${handle}/status/${id}` };
}

export function decodeHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, digits: string) => String.fromCodePoint(Number(digits)))
    .replace(/\s+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function textFromOembedHtml(html: string): { text: string; postedAtLabel: string } {
  const paragraph = html.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
  const text = decodeHtml(paragraph?.[1] ?? "");
  const anchor = html.match(/<a\b[^>]*href="[^"]*\/status\/\d+[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
  const postedAtLabel = decodeHtml(anchor?.[1] ?? "");
  return { text, postedAtLabel };
}

type OembedPayload = {
  url?: string;
  author_name?: string;
  author_url?: string;
  html?: string;
};

export function readOembedPayload(payload: OembedPayload, parsed: ParsedStatusUrl): OembedPost {
  const html = payload.html ?? "";
  const { text, postedAtLabel } = textFromOembedHtml(html);
  if (!text) throw new OembedError("oEmbed returned no post text. Refusing to invent the words.");
  const authorHandle = payload.author_url?.match(/\/([A-Za-z0-9_]{1,15})\/?$/)?.[1];
  return {
    sourceUrl: parsed.canonical,
    statusId: parsed.id,
    handle: authorHandle || parsed.handle,
    authorName: (payload.author_name ?? "").trim() || parsed.handle,
    text,
    postedAtLabel,
  };
}

async function requestOembed(
  endpoint: string,
  parsed: ParsedStatusUrl,
  fetchImpl: typeof fetch,
): Promise<Response> {
  const url = new URL(endpoint);
  url.searchParams.set("url", parsed.canonical);
  url.searchParams.set("omit_script", "true");
  return fetchImpl(url, {
    headers: { accept: "application/json", "user-agent": "GradedCallsFinTwit/1.0" },
    cache: "no-store",
    redirect: "follow",
  });
}

export async function fetchStatusOembed(
  rawUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<OembedPost> {
  const parsed = parseStatusUrl(rawUrl);
  if (!parsed) {
    throw new OembedError("Paste an x.com or twitter.com status URL. Other links are refused.");
  }
  let lastStatus: number | null = null;
  let reached = false;
  for (const endpoint of OEMBED_ENDPOINTS) {
    let response: Response;
    try {
      response = await requestOembed(endpoint, parsed, fetchImpl);
    } catch {
      continue;
    }
    reached = true;
    if (!response.ok) {
      lastStatus = response.status;
      continue;
    }
    const payload = (await response.json()) as OembedPayload;
    return readOembedPayload(payload, parsed);
  }
  const message = reached
    ? `oEmbed returned ${lastStatus ?? "an error"}. Paste the post text yourself. Nothing was stored.`
    : "oEmbed could not be reached. Paste the post text yourself. Nothing was stored.";
  throw new OembedUnavailableError(message, parsed);
}
