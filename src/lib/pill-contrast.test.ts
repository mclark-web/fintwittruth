import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import test from "node:test";

const chrome = ["/usr/local/bin/google-chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find((bin) => existsSync(bin));

test("grade pill text stays at least 4.5:1 at 390 and 1440", { skip: chrome ? false : "Chrome is not installed" }, (t) => {
  const result = spawnSync(process.execPath, ["scripts/pill-contrast.mjs"], {
    encoding: "utf8",
    timeout: 180_000,
  });
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  if (result.status === 2 && /Chrome debugger did not start|No Chrome binary found/.test(output)) {
    t.skip(output.trim().split("\n").filter(Boolean).slice(-4).join(" "));
    return;
  }
  assert.equal(result.status, 0, output);
  const report = JSON.parse(result.stdout);
  for (const grade of ["strong", "weak", "provisional", "exit", "label", "pct"]) {
    assert.ok(report[grade], `missing ${grade}`);
    assert.ok(report[grade].min >= 4.5, `${grade} contrast ${report[grade].min} is under 4.5`);
  }
});
