import type { Metadata } from "next";
import { IBM_Plex_Mono, Outfit } from "next/font/google";
import { DemoBanner, SiteFooter, SiteHeader } from "@/components/chrome";
import { PRODUCT_NAME } from "@/lib/brand";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });
const plex = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://fintwittruth.vercel.app";

const shareImage = {
  url: "/opengraph-image.png",
  width: 1200,
  height: 630,
  alt: "GradedCalls",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: PRODUCT_NAME,
    template: `%s · ${PRODUCT_NAME}`,
  },
  description: `${PRODUCT_NAME} grades one weekly cohort on the Monday gap, Monday noon, the Wednesday close, and the Friday close. Grades describe the past. They are not for sale.`,
  applicationName: PRODUCT_NAME,
  icons: {
    icon: [
      { url: "/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: PRODUCT_NAME,
    description:
      "One weekend of calls. Graded on the Monday gap, at Monday noon, and at the Wednesday and Friday closes. Descriptive only. Grades are not for sale.",
    siteName: PRODUCT_NAME,
    type: "website",
    images: [shareImage],
  },
  twitter: {
    card: "summary_large_image",
    images: [shareImage],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${outfit.variable} ${plex.variable}`}>
      <body className="font-sans antialiased">
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-pine focus:px-3 focus:py-2 focus:text-lime"
        >
          Skip to content
        </a>
        <DemoBanner />
        <SiteHeader />
        <main id="content">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
