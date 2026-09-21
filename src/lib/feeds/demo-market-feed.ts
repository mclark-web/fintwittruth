import type { MarketFeed } from "./types";

/**
 * The seeded board does not call a vendor at request time.
 * Prints are the committed Yahoo Finance series in src/lib/market-history.json.
 */
export const demoMarketFeed: MarketFeed = {
  id: "demo",
  async fetchPrints() {
    return [];
  },
};
