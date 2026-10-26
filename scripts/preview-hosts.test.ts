import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, relative } from "node:path";
import test from "node:test";

const root = join(import.meta.dirname, "..");
const deploymentHost = ["vercel", "app"].join(".");
const distDir = ".next-preview-head";
const origin = "https://fintwit.gradedcalls.com";
const shareImage = `${origin}/opengraph-image.png`;

function containsDeploymentHost(text: string): boolean {
  return text.toLowerCase().includes(deploymentHost);
}

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

function isPageData(file: string): boolean {
  if (file.endsWith(".nft.json")) return false;
  const ext = extname(file);
  return ext === ".html" || ext === ".rsc" || ext === ".meta" || ext === ".body" || ext === ".xml" || file.includes(".segments" + "/");
}

function isRobotsOrSitemap(file: string): boolean {
  const name = file.replaceAll("\\", "/");
  return name.includes("robots") || name.includes("sitemap");
}

function headOf(html: string): string {
  const end = html.toLowerCase().indexOf("</head>");
  return end === -1 ? html : html.slice(0, end);
}

function tags(head: string, pattern: RegExp): string[] {
  return [...head.matchAll(pattern)].map((match) => match[1]);
}

function canonicals(head: string): string[] {
  const links = [...head.matchAll(/<link\b[^>]*>/gi)].map((match) => match[0]);
  return links
    .filter((tag) => /rel="canonical"/i.test(tag))
    .map((tag) => tag.match(/href="([^"]*)"/i)?.[1])
    .filter((href): href is string => Boolean(href));
}

function routeFromHtml(file: string, appDir: string): string | null | "shell" {
  const rel = relative(appDir, file).replaceAll("\\", "/");
  if (!rel.endsWith(".html")) return null;
  if (rel === "_global-error.html" || rel.endsWith("/_global-error.html")) return "shell";
  if (rel === "_not-found.html" || rel.endsWith("/_not-found.html")) return null;
  let route = rel.slice(0, -".html".length);
  if (route === "index") return "/";
  if (route.endsWith("/index")) route = route.slice(0, -"/index".length);
  route = route
    .split("/")
    .map((part) => decodeURIComponent(part))
    .join("/");
  return route.startsWith("/") ? route : `/${route}`;
}

test("a mutated page, robots file, and sitemap fail the deployment-host check", () => {
  const clean = `<!doctype html><head><link rel="canonical" href="${origin}/weeks"><meta property="og:url" content="${origin}/weeks"><meta property="og:image" content="${shareImage}"><meta name="twitter:image" content="${shareImage}"></head>`;
  assert.equal(containsDeploymentHost(clean), false);
  const mutated = clean.replaceAll(origin, `https://fintwit-preview.${deploymentHost}`);
  assert.equal(containsDeploymentHost(mutated), true);
  const robots = `User-Agent: *\nAllow: /\nHost: fintwit.gradedcalls.com\nSitemap: ${origin}/sitemap.xml\n`;
  assert.equal(containsDeploymentHost(robots), false);
  assert.equal(containsDeploymentHost(robots.replace("fintwit.gradedcalls.com", `fintwit.${deploymentHost}`)), true);
  const sitemap = `<urlset><url><loc>${origin}/weeks</loc></url></urlset>`;
  assert.equal(containsDeploymentHost(sitemap), false);
  assert.equal(containsDeploymentHost(`${sitemap}\n<!-- ${deploymentHost} -->`), true);
});

test("preview build HTML, page data, robots, and sitemap stay on gradedcalls.com", { timeout: 300_000 }, () => {
  const tsconfigPath = join(root, "tsconfig.json");
  const nextEnvPath = join(root, "next-env.d.ts");
  const tsconfig = readFileSync(tsconfigPath);
  const nextEnv = existsSync(nextEnvPath) ? readFileSync(nextEnvPath) : null;
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const key of ["NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_HUB_URL", "NEXT_PUBLIC_ANALYSTS_URL", "NEXT_PUBLIC_BOT_URL"]) {
    delete env[key];
  }
  env.NEXT_DIST_DIR = distDir;
  env.VERCEL = "1";
  env.VERCEL_ENV = "preview";
  env.VERCEL_URL = `fintwit-preview.${deploymentHost}`;
  env.VERCEL_BRANCH_URL = `fintwit-git-preview.${deploymentHost}`;
  env.VERCEL_PROJECT_PRODUCTION_URL = `fintwit.${deploymentHost}`;

  let build;
  try {
    build = spawnSync("npm", ["run", "build"], {
      cwd: root,
      env,
      encoding: "utf8",
    });
  } finally {
    writeFileSync(tsconfigPath, tsconfig);
    if (nextEnv) writeFileSync(nextEnvPath, nextEnv);
  }
  assert.equal(
    build.status,
    0,
    `preview build failed\n${build.stdout?.slice(-4000) ?? ""}\n${build.stderr?.slice(-4000) ?? ""}`,
  );

  const appDir = join(root, distDir, "server", "app");
  const files = walk(appDir).filter((file) => isPageData(file) || isRobotsOrSitemap(file));
  const htmlFiles = files.filter((file) => file.endsWith(".html"));
  const pageData = files.filter((file) => file.endsWith(".rsc") || file.endsWith(".meta") || file.includes(`${".segments"}${""}`));
  const robots = files.filter((file) => file.replaceAll("\\", "/").includes("robots"));
  const sitemaps = files.filter((file) => file.replaceAll("\\", "/").includes("sitemap"));
  assert.ok(htmlFiles.length > 0, "expected built HTML");
  assert.ok(pageData.some((file) => file.endsWith(".rsc")), "expected RSC page data");
  assert.ok(robots.length > 0, `expected robots output under ${appDir}`);
  assert.ok(sitemaps.length > 0, `expected sitemap output under ${appDir}`);

  const leaks: string[] = [];
  const canonicalMisses: string[] = [];
  let pages = 0;
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    if (containsDeploymentHost(text)) leaks.push(relative(root, file));
  }
  assert.deepEqual(leaks, [], `built HTML, page data, robots, or sitemap contains ${deploymentHost}:\n${leaks.join("\n")}`);

  const sample = readFileSync(htmlFiles[0], "utf8");
  assert.equal(containsDeploymentHost(sample), false);
  assert.equal(containsDeploymentHost(`${sample}\n${deploymentHost}`), true, "mutation of built HTML must fail the check");

  for (const file of htmlFiles) {
    const html = readFileSync(file, "utf8");
    const head = headOf(html);
    const route = routeFromHtml(file, appDir);
    if (route === "shell") {
      pages += 1;
      const canonical = canonicals(head);
      const ogUrl = tags(head, /<meta\b[^>]*property="og:url"[^>]*content="([^"]*)"[^>]*>/gi);
      if (canonical.length > 0 || ogUrl.length > 0) canonicalMisses.push(`${relative(root, file)} error shell`);
      continue;
    }
    pages += 1;
    const canonical = canonicals(head);
    const ogUrl = tags(head, /<meta\b[^>]*property="og:url"[^>]*content="([^"]*)"[^>]*>/gi);
    const ogImage = tags(head, /<meta\b[^>]*property="og:image"[^>]*content="([^"]*)"[^>]*>/gi);
    const twitterImage = tags(head, /<meta\b[^>]*name="twitter:image"[^>]*content="([^"]*)"[^>]*>/gi);
    if (route === null) {
      if (canonical.length > 0 || ogUrl.length > 0 || ogImage.some((url) => url !== shareImage) || twitterImage.some((url) => url !== shareImage)) {
        canonicalMisses.push(`${relative(root, file)} 404 canonical=${canonical.join(",")} og:url=${ogUrl.join(",")} image=${ogImage.join(",")}`);
      }
      continue;
    }
    const expected = route === "/" ? origin : `${origin}${route}`;
    const imagesOk = ogImage.length === 1 && ogImage[0] === shareImage && twitterImage.length === 1 && twitterImage[0] === shareImage;
    if (canonical.length !== 1 || canonical[0] !== expected || ogUrl.length !== 1 || ogUrl[0] !== expected || !imagesOk) {
      canonicalMisses.push(
        `${relative(root, file)} expected ${expected} canonical=${canonical.join(",")} og:url=${ogUrl.join(",")} og:image=${ogImage.join(",")} twitter:image=${twitterImage.join(",")}`,
      );
    }
  }
  assert.ok(pages > 0, "expected HTML pages");
  assert.deepEqual(canonicalMisses, []);

  const robotsText = robots.map((file) => readFileSync(file, "utf8")).join("\n");
  const sitemapText = sitemaps.map((file) => readFileSync(file, "utf8")).join("\n");
  assert.equal(containsDeploymentHost(`${robotsText}\n${deploymentHost}`), true);
  assert.match(robotsText, new RegExp(String.raw`Sitemap:\s+${origin.replaceAll(".", "\\.")}/sitemap\.xml`));
  assert.match(robotsText, /Host:\s+fintwit\.gradedcalls\.com/);
  assert.match(sitemapText, new RegExp(`${origin.replaceAll(".", "\\.")}(?:/|<)`));
});
