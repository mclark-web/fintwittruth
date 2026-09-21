import type { SocialFeed } from "./types";

/**
 * Placeholder for a licensed X API (or other approved firehose).
 * Implement paging, allow-lists, and storage here. Do not scrape the website.
 */
export const xApiFeed: SocialFeed = {
  id: "x-api",
  async fetchPosts() {
    if (!process.env.X_BEARER_TOKEN) {
      throw new Error(
        "X API adapter is not configured. Set X_BEARER_TOKEN and implement fetchPosts before switching FEED_PROVIDER.",
      );
    }
    throw new Error(
      "X API adapter is not implemented. Map the licensed recent-search or filtered stream into RawPost, limited to the collect window.",
    );
  },
};
