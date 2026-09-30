/**
 * Future scheduled ingestion over the watchlist.
 * The xAI SDK exposes an X-search tool. This job does not call it.
 * Paste-URL intake is the only enabled path.
 */
export const X_SEARCH_JOB_ID = "xai-x-search" as const;

export type XSearchHit = {
  author: string;
  text: string;
  url: string;
};

export type XSearchJobResult = {
  enabled: false;
  id: typeof X_SEARCH_JOB_ID;
  reason: string;
  posts: [];
};

export interface XSearchIngestJob {
  readonly id: typeof X_SEARCH_JOB_ID;
  readonly enabled: false;
  run(handles: readonly string[]): Promise<XSearchJobResult>;
}

const DISABLED_REASON =
  "Scheduled X search is disabled. Paste a public status URL to add a post. This job does not call X.";

export const xaiXSearchJob: XSearchIngestJob = {
  id: X_SEARCH_JOB_ID,
  enabled: false,
  async run() {
    return {
      enabled: false,
      id: X_SEARCH_JOB_ID,
      reason: DISABLED_REASON,
      posts: [],
    };
  },
};
