import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";
import { GC_GRADE_LABEL, UNGRADED_HORIZON } from "./grades";
import { GC_FACTOR, GC_SCALE_BANDS } from "./labels";
import { UNCONFIGURED_DETAIL, UNCONFIGURED_PUBLIC } from "./intake-store";

const root = join(import.meta.dirname, "..", "..");
const hubHref = 'href="https://' + "char" + 'oof.vercel.app"';

function files(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git" || name === ".next") continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files(path, out);
    else if (/\.(tsx?|css|md)$/.test(name)) out.push(path);
  }
  return out;
}

test("the tube label is GC Scale and the pills stay uppercase", () => {
  assert.equal(GC_FACTOR, "GC Scale");
  assert.deepEqual(GC_GRADE_LABEL, {
    strong: "STRONG",
    weak: "WEAK",
    provisional: "PROVISIONAL",
    exit: "EXIT LIQUIDITY",
  });
});

test("user-facing copy does not expand the scale name and has none of the retired names", () => {
  const banned = ["cha" + "d", "chu" + "d", "char" + "oof", "ch-" + "factor"].map(
    (word) => new RegExp(word, "i"),
  );
  const expansion = "Grade " + "Calibration";
  const hits: string[] = [];
  let expansions = 0;
  for (const path of files(root)) {
    const rel = relative(root, path);
    // BRAND.md names the retired words and the one allowed expansion. The UI lock is everything else.
    if (rel === "BRAND.md") continue;
    const text = readFileSync(path, "utf8").split(hubHref).join('href=""');
    for (const pattern of banned) {
      if (pattern.test(text)) hits.push(rel);
    }
    const count = text.split(expansion).length - 1;
    expansions += count;
    if (count > 0) hits.push(`${rel} expands the scale name`);
  }
  assert.equal(expansions, 0);
  assert.deepEqual(hits, []);

  const tube = readFileSync(join(root, "src", "app", "gc-scale.css"), "utf8");
  assert.match(tube, /#eb6505/);
  assert.match(tube, /\.gc-label\s*\{[^}]*text-transform:\s*none/);
});

test("the logo link href is the Hub in the same tab", () => {
  const logo = readFileSync(join(root, "src", "components", "logo-link.tsx"), "utf8");
  assert.ok(logo.includes(hubHref));
  assert.match(logo, /<a\b/);
  assert.match(logo, /aria-label="GradedCalls"/);
  assert.match(logo, /alt="GradedCalls"/);
  assert.doesNotMatch(logo, /target\s*=/);
  assert.match(logo, /src="\/gradedcalls-mark\.png"/);
  assert.match(logo, /height:\s*56/);
  assert.match(logo, /width:\s*44/);
  assert.match(logo, /backgroundColor:\s*"transparent"/);
  assert.doesNotMatch(logo, /backgroundColor:\s*"#/);

  const errorPage = readFileSync(join(root, "src", "app", "error.tsx"), "utf8");
  const globalError = readFileSync(join(root, "src", "app", "global-error.tsx"), "utf8");
  assert.match(errorPage, /reset\(\)/);
  assert.match(globalError, /reset\(\)/);
  assert.doesNotMatch(errorPage, /retry\(/);
  assert.doesNotMatch(globalError, /retry\(/);

  const chrome = readFileSync(join(root, "src", "components", "chrome.tsx"), "utf8");
  assert.match(chrome, /<LogoLink\b/);
  assert.doesNotMatch(chrome, /aria-label=\{PRODUCT_NAME\}/);
  assert.doesNotMatch(chrome, /function BrandMark/);

  assert.match(globalError, /<LogoLink\b/);
  assert.match(globalError, /<title>[^<]*GradedCalls[^<]*<\/title>/);
  assert.match(globalError, /title="GradedCalls"/);
  assert.ok(globalError.includes(hubHref));
  assert.match(globalError, />\s*Hub\s*</);

  let hrefs = 0;
  for (const path of files(root)) {
    hrefs += readFileSync(path, "utf8").split(hubHref).length - 1;
  }
  assert.equal(hrefs, 2);

  const layout = readFileSync(join(root, "src", "app", "layout.tsx"), "utf8");
  assert.match(layout, /NEXT_PUBLIC_SITE_URL \|\| "https:\/\/fintwittruth\.vercel\.app"/);
  assert.doesNotMatch(layout, /localhost:3000/);
  assert.match(layout, /alt:\s*"GradedCalls"/);
  assert.match(layout, /width:\s*1200/);
  assert.match(layout, /height:\s*630/);
  assert.match(layout, /openGraph:\s*\{[\s\S]*images:\s*\[shareImage\]/);
  assert.match(layout, /twitter:\s*\{[\s\S]*images:\s*\[shareImage\]/);
  assert.match(layout, /icons:\s*\{/);

  assert.equal(existsSync(join(root, "src", "app", "icon.tsx")), false);
  assert.equal(existsSync(join(root, "src", "app", "opengraph-image.tsx")), false);
  assert.equal(existsSync(join(root, "src", "app", "icon.png")), true);
  assert.equal(existsSync(join(root, "src", "app", "apple-icon.png")), true);
  assert.equal(existsSync(join(root, "src", "app", "opengraph-image.png")), true);
  assert.equal(existsSync(join(root, "src", "app", "favicon.ico")), true);
  const markPath = join(root, "public", "gradedcalls-mark.png");
  assert.equal(existsSync(markPath), true);
  const mark = readFileSync(markPath);
  assert.equal(mark.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  const markWidth = mark.readUInt32BE(16);
  const markHeight = mark.readUInt32BE(20);
  assert.ok(markWidth >= 96 && markWidth <= 132, `mark width ${markWidth}`);
  assert.ok(markHeight >= 96 && markHeight <= 132, `mark height ${markHeight}`);
  assert.equal(mark[25], 6, "mark PNG color type is RGBA");
  assert.ok(mark.length < 80_000, `mark is ${mark.length} bytes`);
  assert.equal(existsSync(join(root, "public", "gradedcalls-lockup.png")), false);
});

test("GC Scale band copy is the short legend", () => {
  assert.equal(
    GC_SCALE_BANDS,
    `${GC_FACTOR}: STRONG 70%+, PROVISIONAL 40–69%, WEAK under 40%; 0% is EXIT LIQUIDITY.`,
  );
  assert.equal(GC_SCALE_BANDS.includes("–"), true);

  const board = readFileSync(join(root, "src", "components", "fintwit-board.tsx"), "utf8");
  assert.match(board, /GC_SCALE_BANDS/);
  assert.doesNotMatch(board, /empty glass/);
  assert.doesNotMatch(board, /horizontal tube fills/);

  const readout = readFileSync(join(root, "src", "app", "weeks", "[slug]", "[readout]", "page.tsx"), "utf8");
  assert.doesNotMatch(readout, /STRONG is 70% or more/);
  assert.match(readout, /Watchlist and viral posts share this weekly board/);

  const method = readFileSync(join(root, "src", "app", "methodology", "page.tsx"), "utf8");
  assert.match(method, /EXIT LIQUIDITY at a graded 0/);
  assert.match(method, /A 1–10 badge sits beside the fill\./);
  assert.match(method, /UNGRADED_HORIZON/);
  assert.equal(UNGRADED_HORIZON, "Not graded yet");
  assert.doesNotMatch(method, /0–9 is badge 1/);
  assert.equal(method.includes("Grade " + "Calibration"), false);
  assert.doesNotMatch(method, /The badge runs from 1 to 10/);

  const leader = readFileSync(join(root, "src", "app", "leaderboard", "page.tsx"), "utf8");
  assert.doesNotMatch(leader, /STRONG is 70 or more/);
  assert.match(leader, /href="\/methodology"/);

  const pending = readFileSync(join(root, "src", "app", "pending", "page.tsx"), "utf8");
  assert.match(pending, /UNGRADED_HORIZON/);
  assert.doesNotMatch(pending, /not graded"/);
  assert.doesNotMatch(pending, /\$\{pending\.length\} not graded/);

  const watchlist = readFileSync(join(root, "src", "app", "watchlist", "page.tsx"), "utf8");
  assert.match(watchlist, /UNCONFIGURED_PUBLIC/);
  assert.doesNotMatch(watchlist, /loaded\.detail/);
  assert.doesNotMatch(watchlist, /BLOB_READ_WRITE_TOKEN/);
  assert.equal(UNCONFIGURED_PUBLIC.includes("BLOB"), false);
  assert.equal(UNCONFIGURED_DETAIL.includes("BLOB_READ_WRITE_TOKEN"), true);
});
