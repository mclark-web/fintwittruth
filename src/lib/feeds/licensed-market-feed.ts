import type { MarketFeed } from "./types";

/** Placeholder for a licensed bar vendor. Wire official closes here, then re-run grading. */
export const licensedMarketFeed: MarketFeed = {
  id: "licensed-bars",
  async fetchPrints() {
    throw new Error(
      "Licensed market adapter is not configured. Implement fetchPrints and set MARKET_DATA_PROVIDER=licensed-bars.",
    );
  },
};
