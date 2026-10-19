import file from "./watchlist.json";

/** Shown when a tracked account has no graded call. Never replace this with a made-up score. */
export const TRACKING_EMPTY = "Tracking — no graded calls yet";

export const NOT_GRADABLE_LABEL = "Not gradable yet";

export type WatchAccount = {
  handle: string;
  profileUrl: string;
};

type WatchFile = {
  version: number;
  accounts: { handle: string }[];
};

const HANDLE = /^[A-Za-z0-9_]{1,15}$/;

/** Plain x.com link for a handle listed in watchlist.json. A missing handle gets no URL. */
export function profileUrl(handle: string): string {
  return findWatchAccount(handle)?.profileUrl ?? "";
}

export function loadWatchlist(data: WatchFile = file as WatchFile): WatchAccount[] {
  if (data.version !== 1 || !Array.isArray(data.accounts)) {
    throw new Error("watchlist.json is not a version 1 list.");
  }
  const seen = new Set<string>();
  return data.accounts.map((account) => {
    const handle = account.handle?.trim() ?? "";
    if (!HANDLE.test(handle)) {
      throw new Error(`Watchlist handle @${handle} is not a public X handle.`);
    }
    const key = handle.toLowerCase();
    if (seen.has(key)) throw new Error(`Watchlist handle @${handle} is listed twice.`);
    seen.add(key);
    return { handle, profileUrl: `https://x.com/${handle}` };
  });
}

export const WATCHLIST = loadWatchlist();

export type RosterSource = {
  handle: string;
  /** Canonical post URL from the call book. Used when the writer is not listed in watchlist.json. */
  sourceUrl?: string;
};

/** Watchlist file plus any live handle that already has a call. Home and /watchlist share this list. */
export function trackedRoster(extra: Iterable<string | RosterSource> = []): WatchAccount[] {
  const rows: WatchAccount[] = [];
  const seen = new Set<string>();
  for (const account of WATCHLIST) {
    seen.add(account.handle.toLowerCase());
    rows.push(account);
  }
  for (const item of extra) {
    const handle = (typeof item === "string" ? item : item.handle).trim();
    const sourceUrl = typeof item === "string" ? "" : (item.sourceUrl?.trim() ?? "");
    if (!handle) continue;
    const key = handle.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const listed = findWatchAccount(handle);
    rows.push({
      handle,
      profileUrl: listed?.profileUrl || (sourceUrl.startsWith("https://") ? sourceUrl : ""),
    });
  }
  return rows;
}

export function findWatchAccount(handle: string): WatchAccount | undefined {
  const key = handle.toLowerCase();
  return WATCHLIST.find((account) => account.handle.toLowerCase() === key);
}

/** Keep the casing from the watchlist when the paste uses different case. */
export function canonicalHandle(handle: string): string {
  return findWatchAccount(handle)?.handle ?? handle;
}
