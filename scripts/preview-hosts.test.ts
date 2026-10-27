import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import net from "node:net";
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

function withHostInHead(html: string): string {
  const end = html.toLowerCase().indexOf("</head>");
  assert.ok(end > 0, "expected a head element to mutate");
  return `${html.slice(0, end)}${deploymentHost}${html.slice(end)}`;
}

function withHostInBody(html: string): string {
  const start = html.toLowerCase().indexOf("<body");
  assert.ok(start > 0, "expected a body element to mutate");
  const open = html.indexOf(">", start);
  assert.ok(open > start, "expected a body tag to mutate");
  return `${html.slice(0, open + 1)}${deploymentHost}${html.slice(open + 1)}`;
}

function leakSnippet(text: string): string {
  const at = text.toLowerCase().indexOf(deploymentHost);
  if (at < 0) return "";
  return text.slice(Math.max(0, at - 70), at + deploymentHost.length + 70).replace(/\s+/g, " ");
}

/** Preview renders read a /tmp copy of the seeded sqlite file. Same-size edits must not reuse the previous copy. */
function forgetRuntimeDatabase(): void {
  rmSync("/tmp/fintwittruth.db", { force: true });
}

function listenPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("expected a TCP port"));
        return;
      }
      const { port } = address;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

function stopServer(child: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    if (!child.pid || child.exitCode !== null || child.signalCode !== null) {
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      try {
        process.kill(-child.pid!, "SIGKILL");
      } catch {
        child.kill("SIGKILL");
      }
    }, 5_000);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      child.kill("SIGTERM");
    }
  });
}

async function waitForPreview(port: number, child: ChildProcess, logs: { text: string }): Promise<void> {
  const deadline = Date.now() + 60_000;
  let last = "not started";
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`preview server exited ${child.exitCode}\n${logs.text}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/robots.txt`, { signal: AbortSignal.timeout(5_000) });
      if (response.ok) {
        const text = await response.text();
        if (text.includes("Sitemap:")) return;
        last = "robots.txt has no sitemap line";
      } else {
        last = `robots.txt ${response.status}`;
      }
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`preview server did not listen (${last})\n${logs.text}`);
}

type Fetched = { status: number; type: string; text: string; url: string };

async function fetchText(url: string, headers?: Record<string, string>): Promise<Fetched> {
  const response = await fetch(url, { headers, redirect: "follow", signal: AbortSignal.timeout(45_000) });
  return {
    status: response.status,
    type: response.headers.get("content-type") ?? "",
    text: await response.text(),
    url: response.url,
  };
}

async function fetchRsc(url: string): Promise<Fetched> {
  let current = url;
  for (let hop = 0; hop < 6; hop += 1) {
    const response = await fetch(current, {
      headers: { rsc: "1" },
      redirect: "manual",
      signal: AbortSignal.timeout(45_000),
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location) throw new Error(`RSC redirect from ${current} has no location`);
      current = new URL(location, current).href;
      continue;
    }
    return {
      status: response.status,
      type: response.headers.get("content-type") ?? "",
      text: await response.text(),
      url: response.url || current,
    };
  }
  throw new Error(`RSC redirect loop for ${url}`);
}

function sitemapPaths(xml: string): string[] {
  const paths: string[] = [];
  for (const match of xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)) {
    const loc = new URL(match[1].trim());
    assert.equal(loc.origin, origin, `sitemap loc left the site origin: ${match[1]}`);
    paths.push(loc.pathname);
  }
  return paths;
}

function nextDataPath(buildId: string, path: string): string {
  const trimmed = path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
  const page = trimmed === "/" ? "/index" : trimmed;
  return `/_next/data/${buildId}${page}.json`;
}

async function eachLimit<T>(items: T[], limit: number, run: (item: T) => Promise<void>): Promise<void> {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const current = cursor;
      cursor += 1;
      await run(items[current]);
    }
  });
  await Promise.all(workers);
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

test("preview build HTML, page data, robots, and sitemap stay on gradedcalls.com", { timeout: 480_000 }, async () => {
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
    forgetRuntimeDatabase();
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

  const staticLeaks: string[] = [];
  const canonicalMisses: string[] = [];
  let pages = 0;
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    if (containsDeploymentHost(text)) staticLeaks.push(`static ${relative(root, file)} :: ${leakSnippet(text)}`);
  }

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

  forgetRuntimeDatabase();
  const port = await listenPort();
  const logs = { text: "" };
  const server = spawn(process.execPath, [join(root, "node_modules/next/dist/bin/next"), "start", "-H", "127.0.0.1", "-p", String(port)], {
    cwd: root,
    env: { ...env, PORT: String(port), HOSTNAME: "127.0.0.1" },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  const note = (chunk: Buffer | string) => {
    logs.text = `${logs.text}${chunk}`.slice(-12_000);
  };
  server.stdout?.on("data", note);
  server.stderr?.on("data", note);
  const missingPath = "/no-such-board-page";
  const liveLeaks: string[] = [];
  try {
    await waitForPreview(port, server, logs);
    const buildId = readFileSync(join(root, distDir, "BUILD_ID"), "utf8").trim();
    assert.ok(buildId.length > 0, "expected a preview BUILD_ID");
    const base = `http://127.0.0.1:${port}`;
    const robotsLive = await fetchText(`${base}/robots.txt`);
    const sitemapLive = await fetchText(`${base}/sitemap.xml`);
    for (const [kind, body] of [
      ["robots", robotsLive],
      ["sitemap", sitemapLive],
    ] as const) {
      assert.equal(body.status, 200, `${kind} status ${body.status}`);
      if (containsDeploymentHost(body.text)) liveLeaks.push(`${kind} ${body.status} :: ${leakSnippet(body.text)}`);
    }
    const paths = [...new Set([...sitemapPaths(sitemapLive.text), "/", "/admin", "/dispute", missingPath])];
    assert.ok(paths.includes("/"), "sitemap fetch did not include /");
    assert.ok(paths.includes("/watchlist"), "request scan missed /watchlist");
    assert.ok(paths.includes("/real"), "request scan missed /real");
    assert.ok(paths.includes("/admin"), "request scan missed /admin");
    assert.ok(paths.includes("/dispute"), "request scan missed /dispute");
    assert.ok(
      paths.some((path) => path.startsWith("/accounts/") && path.length > "/accounts/".length),
      "request scan missed /accounts/[handle]",
    );
    assert.ok(
      paths.some((path) => path.startsWith("/calls/")),
      "request scan missed /calls/[id]",
    );
    assert.ok(
      paths.some((path) => /^\/weeks\/[^/]+/.test(path)),
      "request scan missed /weeks/[slug]",
    );
    assert.ok(!sitemapPaths(sitemapLive.text).includes(missingPath), "404 probe collided with a sitemap URL");

    const fetched = new Map<string, Fetched>();
    await eachLimit(paths, 4, async (path) => {
      const pageUrl = new URL(path, base).href;
      const html = await fetchText(pageUrl);
      const rsc = await fetchRsc(pageUrl);
      const data = await fetchText(new URL(nextDataPath(buildId, path), base).href);
      fetched.set(`html ${path}`, html);
      fetched.set(`rsc ${path}`, rsc);
      const expectedStatus = path === missingPath ? 404 : 200;
      if (html.status !== expectedStatus) liveLeaks.push(`html ${path} status ${html.status}, expected ${expectedStatus}`);
      if (rsc.status !== expectedStatus) liveLeaks.push(`rsc ${path} status ${rsc.status}, expected ${expectedStatus}`);
      if (!rsc.type.toLowerCase().includes("text/x-component")) {
        liveLeaks.push(`rsc ${path} content-type ${rsc.type || "(missing)"} status ${rsc.status}`);
      }
      for (const [kind, body] of [
        ["html", html],
        ["rsc", rsc],
        ["next-data", data],
      ] as const) {
        if (!containsDeploymentHost(body.text)) continue;
        liveLeaks.push(`${kind} ${path} ${body.status} :: ${leakSnippet(body.text)}`);
      }
      if (path === missingPath) {
        const head = headOf(html.text);
        const canonical = canonicals(head);
        const ogUrl = tags(head, /<meta\b[^>]*property="og:url"[^>]*content="([^"]*)"[^>]*>/gi);
        if (canonical.length > 0 || ogUrl.length > 0) {
          liveLeaks.push(`html ${path} 404 published canonical=${canonical.join(",")} og:url=${ogUrl.join(",")}`);
        }
        return;
      }
      if (html.status !== 200) return;
      const head = headOf(html.text);
      const canonical = canonicals(head);
      const ogUrl = tags(head, /<meta\b[^>]*property="og:url"[^>]*content="([^"]*)"[^>]*>/gi);
      const ogImage = tags(head, /<meta\b[^>]*property="og:image"[^>]*content="([^"]*)"[^>]*>/gi);
      const twitterImage = tags(head, /<meta\b[^>]*name="twitter:image"[^>]*content="([^"]*)"[^>]*>/gi);
      const expected = path === "/" ? origin : `${origin}${path}`;
      const imagesOk = ogImage.length === 1 && ogImage[0] === shareImage && twitterImage.length === 1 && twitterImage[0] === shareImage;
      if (canonical.length !== 1 || canonical[0] !== expected || ogUrl.length !== 1 || ogUrl[0] !== expected || !imagesOk) {
        liveLeaks.push(
          `html ${path} expected ${expected} canonical=${canonical.join(",")} og:url=${ogUrl.join(",")} og:image=${ogImage.join(",")} twitter:image=${twitterImage.join(",")}`,
        );
      }
    });

    const home = fetched.get("html /");
    const call = [...fetched.entries()].find(([key, body]) => key.startsWith("rsc /calls/") && body.status === 200);
    const dispute = fetched.get("html /dispute");
    assert.ok(home, "missing rendered /");
    assert.ok(call, "missing rendered call page data");
    assert.ok(dispute, "missing rendered /dispute");
    assert.match(home.text, /<head[\s>]/i);
    assert.match(dispute.text, /Dispute this grade/);
    assert.ok(call[1].text.length > 1000, "call page data was too small to be a rendered payload");
    assert.equal(containsDeploymentHost(withHostInHead(home.text)), true, "a deployment host in the head of / must fail");
    assert.equal(containsDeploymentHost(`${call[1].text}\n${deploymentHost}`), true, "a deployment host in call page data must fail");
    assert.equal(containsDeploymentHost(withHostInBody(dispute.text)), true, "a deployment host in an on-request body must fail");
    assert.deepEqual(
      liveLeaks,
      [],
      `request-rendered HTML or page data contains ${deploymentHost} or failed a response check:\n${liveLeaks.join("\n")}`,
    );
    assert.deepEqual(
      staticLeaks,
      [],
      `built HTML, page data, robots, or sitemap contains ${deploymentHost}:\n${staticLeaks.join("\n")}`,
    );
  } finally {
    await stopServer(server);
  }
});
