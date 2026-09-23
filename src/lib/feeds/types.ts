import type { Direction, LevelRole } from "../scoring";

export type FeedProviderId = "demo" | "x-api";
export type MarketProviderId = "demo" | "licensed-bars";

export type CollectWindow = {
  start: Date;
  end: Date;
};

/** A post from a licensed social feed. GradedCalls FinTwit does not scrape X. */
export type RawPost = {
  externalId: string;
  handle: string;
  displayName: string;
  postedAt: string;
  body: string;
  direction: Direction | "unclear";
  tickers: string[];
  levels: { symbol: string; price: number; role: LevelRole }[];
};

export type PricePrint = {
  symbol: string;
  price: number;
  asOf: string;
};

export interface SocialFeed {
  readonly id: FeedProviderId;
  /**
   * Page posts inside the locked collect window
   * (Wednesday 12:00 PM ET through Sunday 5:00 PM ET).
   * Return an empty list when this provider is the seeded demo.
   */
  fetchPosts(window: CollectWindow): Promise<RawPost[]>;
}

export interface MarketFeed {
  readonly id: MarketProviderId;
  /** Official prints used as the Friday reference, the Monday open, and the noon readouts. */
  fetchPrints(symbols: string[], asOf: Date): Promise<PricePrint[]>;
}
