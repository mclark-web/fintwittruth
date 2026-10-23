import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api/admin/", "/pending"] },
    sitemap: "https://fintwittruth.vercel.app/sitemap.xml",
    host: "fintwittruth.vercel.app",
  };
}
