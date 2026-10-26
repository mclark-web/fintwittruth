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

const root = join(import.meta.dirname, "..", "..");
const deploymentHost = ["vercel", "app"].join(".");
const retiredHosts = ["char" + "oof", "bank-tr" + "oof", "fintwit" + "truth", "char" + "oofbot"].map(
  (name) => `${name}.${deploymentHost}`,
);

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
  for (const path of files(root)) {
    const text = readFileSync(path, "utf8");
    if (text.toLowerCase().includes(deploymentHost) || retiredHosts.some((host) => text.includes(host))) {
      hits.push(relative(root, path));
    }
  }
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
