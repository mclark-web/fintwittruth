import type { Metadata } from "next";
import { IBM_Plex_Mono, Newsreader, Outfit } from "next/font/google";
import { DemoBanner, SiteFooter, SiteHeader } from "@/components/chrome";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });
const newsreader = Newsreader({ subsets: ["latin"], variable: "--font-newsreader" });
const plex = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "FinTwitTruth",
    template: "%s · FinTwitTruth",
  },
  description:
    "FinTwitTruth grades one weekly cohort of bullish and bearish market calls on Monday, Wednesday, and Friday.",
  applicationName: "FinTwitTruth",
  openGraph: {
    title: "FinTwitTruth",
    description:
      "One weekend of calls. Graded Monday, Wednesday, and Friday against the same market path.",
    siteName: "FinTwitTruth",
    type: "website",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${outfit.variable} ${newsreader.variable} ${plex.variable}`}>
      <body className="font-sans antialiased">
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-lime focus:px-3 focus:py-2"
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
