import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";
import { GC_GRADE_LABEL } from "./grades";
import { GC_FACTOR } from "./labels";

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

test("user-facing copy keeps one GC expansion and none of the retired names", () => {
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
    if (count > 0 && rel !== join("src", "app", "methodology", "page.tsx")) {
      hits.push(`${rel} expands the scale name`);
    }
  }
  assert.equal(expansions, 1);
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

  let hrefs = 0;
  for (const path of files(root)) {
    hrefs += readFileSync(path, "utf8").split(hubHref).length - 1;
  }
  assert.equal(hrefs, 1);

  const layout = readFileSync(join(root, "src", "app", "layout.tsx"), "utf8");
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
  assert.equal(existsSync(join(root, "public", "gradedcalls-mark.png")), true);
});
