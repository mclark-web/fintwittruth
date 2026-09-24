import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import test from "node:test";

const chrome = ["/usr/local/bin/google-chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find((bin) => existsSync(bin));

test("grade pill text stays at least 4.5:1 at 390 and 1440", { skip: chrome ? false : "Chrome is not installed" }, () => {
  const result = spawnSync(process.execPath, ["scripts/pill-contrast.mjs"], {
    encoding: "utf8",
    timeout: 120_000,
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const report = JSON.parse(result.stdout);
  for (const grade of ["strong", "weak", "provisional", "exit", "label", "pct"]) {
    assert.ok(report[grade], `missing ${grade}`);
    assert.ok(report[grade].min >= 4.5, `${grade} contrast ${report[grade].min} is under 4.5`);
  }
});
