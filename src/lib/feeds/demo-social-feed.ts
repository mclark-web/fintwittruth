import type { SocialFeed } from "./types";

/** Demo posts already live in the seeded database. This adapter does not call a network. */
export const demoSocialFeed: SocialFeed = {
  id: "demo",
  async fetchPosts() {
    return [];
  },
};
