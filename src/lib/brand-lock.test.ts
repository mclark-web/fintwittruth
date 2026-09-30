import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";
import { GC_GRADE_LABEL } from "./grades";
import { GC_FACTOR } from "./labels";

const root = join(import.meta.dirname, "..", "..");

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
    const text = readFileSync(path, "utf8");
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
