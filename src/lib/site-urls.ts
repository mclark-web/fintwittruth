import type { Metadata } from "next";
import { PRODUCT_NAME } from "@/lib/brand";

/**
 * Public GradedCalls origins.
 *
 * SITE_URL is this board (FinTwit). HUB_URL is the hub home the logo and Hub
 * link open. Sports lives on the hub at /sports. Analysts and GCBot are the
 * other boards. Each origin reads its NEXT_PUBLIC_* env var and otherwise
 * uses the gradedcalls.com host. Preview deployment hosts are not consulted.
 */
export function resolveSiteOrigin(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim().replace(/\/+$/, "") ?? "";
  return trimmed.length > 0 ? trimmed : fallback;
}

export const DEFAULT_SITE_URL = "https://fintwit.gradedcalls.com";
export const DEFAULT_HUB_URL = "https://www.gradedcalls.com";
export const DEFAULT_ANALYSTS_URL = "https://analysts.gradedcalls.com";
export const DEFAULT_BOT_URL = "https://bot.gradedcalls.com";

export const SITE_URL = resolveSiteOrigin(process.env.NEXT_PUBLIC_SITE_URL, DEFAULT_SITE_URL);
export const HUB_URL = resolveSiteOrigin(process.env.NEXT_PUBLIC_HUB_URL, DEFAULT_HUB_URL);
export const ANALYSTS_URL = resolveSiteOrigin(process.env.NEXT_PUBLIC_ANALYSTS_URL, DEFAULT_ANALYSTS_URL);
export const BOT_URL = resolveSiteOrigin(process.env.NEXT_PUBLIC_BOT_URL, DEFAULT_BOT_URL);

/** Absolute URL on this board. `pageUrl("/")` is SITE_URL with no trailing slash. */
export function pageUrl(path = "/"): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path.replace(/\/+$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  if (suffix === "/") return SITE_URL;
  return `${SITE_URL}${suffix}`;
}

/** Sports board. It is a path on the hub, not its own origin. */
export const SPORTS_URL = `${HUB_URL}/sports`;

/**
 * Share image served from public/. The app/opengraph-image file convention
 * follows the Vercel deployment host on preview builds, so the tags use this
 * absolute URL instead.
 */
export const SHARE_IMAGE = {
  url: `${SITE_URL}/opengraph-image.png`,
  width: 1200,
  height: 630,
  alt: "GradedCalls",
} as const;

/** Layout open-graph description. Kept here so each page can repeat it when it sets its own og:url. */
export const OG_DESCRIPTION =
  "Weekend market calls from FinTwit writers, graded against the prior trading-week close (Friday, or Thursday when Friday is a market holiday). Descriptive only. Grades are not for sale.";

const shareCard = {
  title: PRODUCT_NAME,
  description: OG_DESCRIPTION,
  siteName: PRODUCT_NAME,
  type: "website" as const,
  images: [SHARE_IMAGE],
};

const shareTwitter = {
  card: "summary_large_image" as const,
  images: [SHARE_IMAGE],
};

/** Canonical, og:url, and absolute share images for one route. */
export function pageMeta(path: string): Pick<Metadata, "alternates" | "openGraph" | "twitter"> {
  return {
    alternates: { canonical: pageUrl(path) },
    openGraph: {
      ...shareCard,
      url: pageUrl(path),
    },
    twitter: shareTwitter,
  };
}

/** Share tags for the 404. No canonical and no og:url. */
export function notFoundMeta(): Pick<Metadata, "openGraph" | "twitter"> {
  return {
    openGraph: shareCard,
    twitter: shareTwitter,
  };
}
