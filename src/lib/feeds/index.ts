import { demoMarketFeed } from "./demo-market-feed";
import { demoSocialFeed } from "./demo-social-feed";
import { licensedMarketFeed } from "./licensed-market-feed";
import type { MarketFeed, SocialFeed } from "./types";
import { xApiFeed } from "./x-api-feed";

export function getSocialFeed(): SocialFeed {
  return process.env.FEED_PROVIDER === "x-api" ? xApiFeed : demoSocialFeed;
}

export function getMarketFeed(): MarketFeed {
  return process.env.MARKET_DATA_PROVIDER === "licensed-bars"
    ? licensedMarketFeed
    : demoMarketFeed;
}

export type { MarketFeed, RawPost, SocialFeed } from "./types";
