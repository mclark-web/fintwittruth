import type { MarketFeed } from "./types";

/** Demo prices are stored on each cohort quote. This adapter does not call a vendor. */
export const demoMarketFeed: MarketFeed = {
  id: "demo",
  async fetchPrints() {
    return [];
  },
};
