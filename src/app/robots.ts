import type { MetadataRoute } from "next";
import { SITE_URL, pageUrl } from "@/lib/site-urls";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api/admin/"] },
    sitemap: pageUrl("/sitemap.xml"),
    host: new URL(SITE_URL).host,
  };
}
