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

export function profileUrl(handle: string): string {
  return `https://x.com/${handle}`;
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
    return { handle, profileUrl: profileUrl(handle) };
  });
}

export const WATCHLIST = loadWatchlist();

export function findWatchAccount(handle: string): WatchAccount | undefined {
  const key = handle.toLowerCase();
  return WATCHLIST.find((account) => account.handle.toLowerCase() === key);
}

/** Keep the casing from the watchlist when the paste uses different case. */
export function canonicalHandle(handle: string): string {
  return findWatchAccount(handle)?.handle ?? handle;
}
