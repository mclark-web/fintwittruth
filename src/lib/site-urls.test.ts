import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";
import {
  ANALYSTS_URL,
  BOT_URL,
  DEFAULT_ANALYSTS_URL,
  DEFAULT_BOT_URL,
  DEFAULT_HUB_URL,
  DEFAULT_SITE_URL,
  HUB_URL,
  SHARE_IMAGE,
  SITE_URL,
  SPORTS_URL,
  notFoundMeta,
  pageMeta,
  pageUrl,
  resolveSiteOrigin,
} from "./site-urls";

import nextConfig from "../../next.config";
import { getRedirectStatus, modifyRouteRegex } from "next/dist/lib/redirect-status";
import { formatUrl } from "next/dist/shared/lib/router/utils/format-url";
import { getPathMatch } from "next/dist/shared/lib/router/utils/path-match";
import { matchHas, prepareDestination } from "next/dist/shared/lib/router/utils/prepare-destination";
import { normalizeRepeatedSlashes } from "next/dist/shared/lib/utils";

const root = join(import.meta.dirname, "..", "..");
const deploymentHost = ["vercel", "app"].join(".");
const retiredHosts = ["char" + "oof", "bank-tr" + "oof", "fintwit" + "truth", "char" + "oofbot"].map(
  (name) => `${name}.${deploymentHost}`,
);
const legacyProductionHost = `${"fintwit" + "truth"}.${deploymentHost}`;
const allowedLegacyRedirectLine = `has: [{ type: "host", value: "${legacyProductionHost}" }],`;

function withoutAllowedLegacyRedirectLine(text: string): string {
  return text
    .split("\n")
    .filter((line) => line.trim() !== allowedLegacyRedirectLine)
    .join("\n");
}

function files(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git" || name === ".next" || name.startsWith(".next-")) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files(path, out);
    else if (/\.(tsx?|md|example|mjs)$/.test(name)) out.push(path);
  }
  return out;
}

test("site origins default to gradedcalls.com and honor env overrides", () => {
  assert.equal(resolveSiteOrigin(undefined, DEFAULT_SITE_URL), DEFAULT_SITE_URL);
  assert.equal(resolveSiteOrigin("   ", DEFAULT_SITE_URL), DEFAULT_SITE_URL);
  assert.equal(resolveSiteOrigin("https://fintwit.gradedcalls.com/", DEFAULT_HUB_URL), "https://fintwit.gradedcalls.com");
  assert.equal(resolveSiteOrigin("https://preview.example/board/", DEFAULT_SITE_URL), "https://preview.example/board");

  assert.equal(DEFAULT_SITE_URL, "https://fintwit.gradedcalls.com");
  assert.equal(DEFAULT_HUB_URL, "https://www.gradedcalls.com");
  assert.equal(DEFAULT_ANALYSTS_URL, "https://analysts.gradedcalls.com");
  assert.equal(DEFAULT_BOT_URL, "https://bot.gradedcalls.com");
  assert.equal(SITE_URL, resolveSiteOrigin(process.env.NEXT_PUBLIC_SITE_URL, DEFAULT_SITE_URL));
  assert.equal(HUB_URL, resolveSiteOrigin(process.env.NEXT_PUBLIC_HUB_URL, DEFAULT_HUB_URL));
  assert.equal(ANALYSTS_URL, resolveSiteOrigin(process.env.NEXT_PUBLIC_ANALYSTS_URL, DEFAULT_ANALYSTS_URL));
  assert.equal(BOT_URL, resolveSiteOrigin(process.env.NEXT_PUBLIC_BOT_URL, DEFAULT_BOT_URL));
  assert.equal(SPORTS_URL, `${HUB_URL}/sports`);
  assert.equal(pageUrl("/"), SITE_URL);
  assert.equal(pageUrl("/weeks"), `${SITE_URL}/weeks`);
  assert.equal(pageUrl("leaderboard"), `${SITE_URL}/leaderboard`);
  assert.equal(SHARE_IMAGE.url, `${SITE_URL}/opengraph-image.png`);
  assert.equal(SHARE_IMAGE.width, 1200);
  assert.equal(SHARE_IMAGE.height, 630);
  assert.equal(SHARE_IMAGE.alt, "GradedCalls");

  const home = pageMeta("/");
  assert.equal(home.alternates?.canonical, SITE_URL);
  assert.equal(home.openGraph && "url" in home.openGraph ? home.openGraph.url : undefined, SITE_URL);
  const week = pageMeta("/weeks");
  assert.equal(week.alternates?.canonical, `${SITE_URL}/weeks`);
  const missing = notFoundMeta();
  assert.equal("alternates" in missing, false);
  assert.equal(missing.openGraph && "url" in missing.openGraph ? missing.openGraph.url : undefined, undefined);

  const origins = [SITE_URL, HUB_URL, ANALYSTS_URL, BOT_URL, SPORTS_URL, SHARE_IMAGE.url].join(" ");
  assert.equal(origins.toLowerCase().includes(deploymentHost), false);
});

test("source, docs, and the share image stay off retired deployment hosts", () => {
  assert.equal(existsSync(join(root, "public", "opengraph-image.png")), true);
  assert.equal(existsSync(join(root, "src", "app", "opengraph-image.png")), false);
  assert.equal(existsSync(join(root, "src", "app", "twitter-image.png")), false);
  assert.equal(existsSync(join(root, "src", "app", "opengraph-image.alt.txt")), false);
  assert.equal(existsSync(join(root, "src", "app", "twitter-image.alt.txt")), false);

  const hits: string[] = [];
  let redirectLines = 0;
  for (const path of files(root)) {
    const text = readFileSync(path, "utf8");
    const rel = relative(root, path);
    const allowed = text.split("\n").filter((line) => line.trim() === allowedLegacyRedirectLine).length;
    redirectLines += allowed;
    if (allowed > 0 && rel !== "next.config.ts") hits.push(rel);
    const visible = withoutAllowedLegacyRedirectLine(text);
    if (visible.toLowerCase().includes(deploymentHost) || retiredHosts.some((host) => visible.includes(host))) {
      hits.push(rel);
    }
  }
  assert.equal(redirectLines, 1);
  assert.deepEqual(hits, []);

  const urls = readFileSync(join(root, "src", "lib", "site-urls.ts"), "utf8");
  assert.match(urls, /NEXT_PUBLIC_SITE_URL/);
  assert.match(urls, /NEXT_PUBLIC_HUB_URL/);
  assert.match(urls, /NEXT_PUBLIC_ANALYSTS_URL/);
  assert.match(urls, /NEXT_PUBLIC_BOT_URL/);

  const pages: [string, string][] = [
    ["src/app/page.tsx", 'pageMeta("/")'],
    ["src/app/weeks/page.tsx", 'pageMeta("/weeks")'],
    ["src/app/watchlist/page.tsx", 'pageMeta("/watchlist")'],
    ["src/app/leaderboard/page.tsx", 'pageMeta("/leaderboard")'],
    ["src/app/methodology/page.tsx", 'pageMeta("/methodology")'],
    ["src/app/pending/page.tsx", 'pageMeta("/pending")'],
    ["src/app/real/page.tsx", 'pageMeta("/real")'],
    ["src/app/terms/page.tsx", 'pageMeta("/terms")'],
    ["src/app/demo/page.tsx", 'pageMeta("/demo")'],
    ["src/app/disclaimer/page.tsx", 'pageMeta("/disclaimer")'],
    ["src/app/dispute/page.tsx", 'pageMeta("/dispute")'],
    ["src/app/donate/page.tsx", 'pageMeta("/donate")'],
    ["src/app/admin/page.tsx", 'pageMeta("/admin")'],
  ];
  for (const [file, call] of pages) {
    const source = readFileSync(join(root, file), "utf8");
    assert.ok(source.includes(call), `${file} canonical`);
  }

  const notFound = readFileSync(join(root, "src/app/not-found.tsx"), "utf8");
  assert.match(notFound, /notFoundMeta\(\)/);
  assert.doesNotMatch(notFound, /pageMeta\(/);
  assert.doesNotMatch(notFound, /canonical/);
});

type HostRedirect = {
  source: string;
  destination: string;
  permanent?: boolean;
  has?: { type: string; value?: string }[];
  missing?: unknown[];
};

function legacyRedirectLocation(route: HostRedirect, host: string, href: string): string | null {
  const url = new URL(href, "http://legacy.local");
  const matcher = getPathMatch(route.source, {
    strict: true,
    removeUnnamedParams: true,
    regexModifier: (regex: string) => modifyRouteRegex(regex, ["/_next"]),
    sensitive: false,
  });
  let params = matcher(url.pathname);
  const query = Object.fromEntries(url.searchParams.entries());
  if ((route.has || route.missing) && params) {
    const hasParams = matchHas({ headers: { host } }, query, route.has, route.missing);
    if (hasParams) Object.assign(params, hasParams);
    else params = false;
  }
  if (!params) return null;
  const { parsedDestination } = prepareDestination({
    appendParamsToQuery: false,
    destination: route.destination,
    params,
    query,
  });
  const destQuery = parsedDestination.query;
  delete parsedDestination.query;
  const search = new URLSearchParams(destQuery).toString();
  parsedDestination.search = search ? `?${search}` : "";
  parsedDestination.pathname = normalizeRepeatedSlashes(parsedDestination.pathname);
  return formatUrl(parsedDestination);
}

test("legacy production host redirects to the site origin", async () => {
  const redirects = await nextConfig.redirects();
  assert.equal(redirects.length, 1);
  const route = redirects[0] as HostRedirect;
  assert.equal(route.source, "/:path*");
  assert.equal(route.permanent, true);
  assert.equal(getRedirectStatus(route), 308);
  assert.deepEqual(route.has, [{ type: "host", value: legacyProductionHost }]);
  assert.equal(route.destination, `${SITE_URL}/:path*`);
  assert.equal(route.destination.includes(legacyProductionHost), false);
  assert.equal(new URL(SITE_URL).host === legacyProductionHost, false);

  const branchHost = `${"fintwit" + "truth"}-git-main-hoonu.${deploymentHost}`;
  const hashHost = `${"fintwit" + "truth"}-abc123-hoonu.${deploymentHost}`;
  const cases = [
    ["/", `${SITE_URL}/`],
    ["/?x=1&y=two", `${SITE_URL}/?x=1&y=two`],
    ["/weeks/2026-10-17?x=1&y=two", `${SITE_URL}/weeks/2026-10-17?x=1&y=two`],
    ["/weeks/2026-10-17/pending?readout=friday", `${SITE_URL}/weeks/2026-10-17/pending?readout=friday`],
    ["/accounts/someone?ref=old", `${SITE_URL}/accounts/someone?ref=old`],
    ["/opengraph-image.png", `${SITE_URL}/opengraph-image.png`],
  ] as const;
  for (const [href, expected] of cases) {
    assert.equal(legacyRedirectLocation(route, branchHost, href), null);
    assert.equal(legacyRedirectLocation(route, hashHost, href), null);
    assert.equal(legacyRedirectLocation(route, new URL(SITE_URL).host, href), null);
    const location = legacyRedirectLocation(route, legacyProductionHost, href);
    assert.ok(location);
    const actual = new URL(location);
    const want = new URL(expected);
    assert.equal(actual.origin, want.origin);
    assert.equal(actual.pathname, want.pathname);
    assert.equal(actual.search, want.search);
  }

  const location = legacyRedirectLocation(route, legacyProductionHost, "/weeks/2026-10-17?x=1&y=two");
  assert.ok(location);
  const destination = new URL(location);
  assert.equal(destination.origin, SITE_URL);
  assert.equal(destination.host === legacyProductionHost, false);
  assert.equal(legacyRedirectLocation(route, destination.host, `${destination.pathname}${destination.search}`), null);
});
