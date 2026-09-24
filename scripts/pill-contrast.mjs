import { spawn } from "node:child_process";
import { inflateSync } from "node:zlib";
import { existsSync } from "node:fs";
const chromeBin = ["/usr/local/bin/google-chrome", "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"].find((bin) => existsSync(bin));
if (!chromeBin) {
  console.error("No Chrome binary found");
  process.exit(2);
}

const args = process.argv.slice(2);
const targets = args.length
  ? args
  : [new URL("./pill-contrast-fixture.html", import.meta.url).href];
const widths = [390, 1440];

const chrome = spawn(chromeBin, [
  "--headless=new",
  "--disable-gpu",
  "--no-sandbox",
  "--hide-scrollbars",
  "--force-device-scale-factor=1",
  "--window-size=1440,900",
  "--allow-file-access-from-files",
  "--remote-debugging-port=9241",
  "--user-data-dir=/tmp/chrome-pill-contrast-check",
], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let wsUrl;
for (let i = 0; i < 40; i++) {
  try {
    wsUrl = (await (await fetch("http://127.0.0.1:9241/json/version")).json()).webSocketDebuggerUrl;
    break;
  } catch {
    await sleep(150);
  }
}
if (!wsUrl) {
  chrome.kill();
  console.error("Chrome debugger did not start");
  process.exit(2);
}
const ws = new WebSocket(wsUrl);
await new Promise((r) => ws.addEventListener("open", r));
let id = 0;
const pending = new Map();
ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
});
const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
  const msgId = ++id;
  pending.set(msgId, (msg) => (msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result)));
  ws.send(JSON.stringify({ id: msgId, method, params, sessionId }));
});

function decodePNG(buf) {
  let pos = 8;
  let width = 0;
  let height = 0;
  let colorType = 6;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    pos += 4;
    const type = buf.toString("ascii", pos, pos + 4);
    pos += 4;
    const data = buf.subarray(pos, pos + len);
    pos += len + 4;
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data[9];
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const bpp = colorType === 6 ? 4 : 3;
  const stride = width * bpp;
  const out = new Uint8Array(width * height * 4);
  const paeth = (a, b, c) => {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  let i = 0;
  const prev = Buffer.alloc(stride);
  const scan = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[i++];
    for (let x = 0; x < stride; x++) {
      const left = x >= bpp ? scan[x - bpp] : 0;
      const up = prev[x];
      const ul = x >= bpp ? prev[x - bpp] : 0;
      const v = raw[i++];
      let n = v;
      if (filter === 1) n = (v + left) & 255;
      else if (filter === 2) n = (v + up) & 255;
      else if (filter === 3) n = (v + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) n = (v + paeth(left, up, ul)) & 255;
      scan[x] = n;
    }
    for (let x = 0; x < width; x++) {
      const s = x * bpp;
      const o = (y * width + x) * 4;
      out[o] = scan[s];
      out[o + 1] = scan[s + 1];
      out[o + 2] = scan[s + 2];
      out[o + 3] = bpp === 4 ? scan[s + 3] : 255;
    }
    scan.copy(prev);
  }
  return { width, height, out };
}

function lin(c) {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
function lum(r, g, b) {
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function contrast(a, b) {
  const hi = Math.max(lum(...a), lum(...b));
  const lo = Math.min(lum(...a), lum(...b));
  return (hi + 0.05) / (lo + 0.05);
}
function parseColor(color) {
  const m = String(color).match(/rgba?\(([^)]+)\)/);
  if (!m) return [242, 241, 238];
  const p = m[1].split(/[,/]/).map((s) => parseFloat(s));
  return [p[0], p[1], p[2]];
}
const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
await send("Page.enable", {}, sessionId);
await send("Runtime.enable", {}, sessionId);

const mins = {};
let failed = false;

for (const width of widths) {
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height: 900,
    deviceScaleFactor: 1,
    mobile: width < 500,
    screenWidth: width,
    screenHeight: 900,
  }, sessionId);
  for (const url of targets) {
    await send("Page.navigate", { url }, sessionId);
    await sleep(500);
    const metrics = await send("Page.getLayoutMetrics", {}, sessionId);
    const layoutWidth = metrics.cssLayoutViewport?.clientWidth ?? width;
    if (Math.abs(layoutWidth - width) > 1) {
      console.error(`viewport is ${layoutWidth}, expected ${width}`);
      failed = true;
      continue;
    }
    const listed = await send("Runtime.evaluate", {
      expression: `(() => {
        document.documentElement.style.scrollBehavior = "auto";
        const style = document.createElement("style");
        style.textContent = "*,*::before,*::after{animation:none!important;transition:none!important;}";
        document.head.appendChild(style);
        return [...document.querySelectorAll(".gc-grade-tag")].map((el, i) => {
          el.dataset.pillIndex = String(i);
          const color = getComputedStyle(el).color;
          el.style.color = "transparent";
          el.style.webkitTextFillColor = "transparent";
          el.style.textShadow = "none";
          const r = el.getBoundingClientRect();
          return { i, grade: el.dataset.grade || "unknown", text: (el.textContent || "").trim(), y: r.top + scrollY, color };
        });
      })()`,
      returnByValue: true,
    }, sessionId);
    for (const pill of listed.result?.value ?? []) {
      await send("Runtime.evaluate", {
        expression: `window.scrollTo(0, ${Math.max(0, pill.y - 220)})`,
        returnByValue: true,
      }, sessionId);
      const box = (await send("Runtime.evaluate", {
        expression: `(() => { const el = document.querySelector('[data-pill-index="${pill.i}"]'); const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })()`,
        returnByValue: true,
      }, sessionId)).result.value;
      if (box.y < 0 || box.y + box.h > 860 || box.w < 12) continue;
      const shot = await send("Page.captureScreenshot", { format: "png" }, sessionId);
      const png = decodePNG(Buffer.from(shot.data, "base64"));
      const shotScale = png.width / layoutWidth;
      const text = parseColor(pill.color);
      const samples = [];
      const x0 = Math.max(0, Math.round(box.x * shotScale) + 3);
      const y0 = Math.max(0, Math.round(box.y * shotScale) + 3);
      const x1 = Math.min(png.width, Math.round((box.x + box.w) * shotScale) - 3);
      const y1 = Math.min(png.height, Math.round((box.y + box.h) * shotScale) - 3);
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const o = (y * png.width + x) * 4;
          samples.push([png.out[o], png.out[o + 1], png.out[o + 2]]);
        }
      }
      if (!samples.length) continue;
      const avg = [0, 1, 2].map((c) => {
        const channel = samples.map((px) => px[c]).sort((a, b) => a - b);
        return channel[Math.floor(channel.length / 2)];
      });
      const ratio = contrast(text, avg);
      const prev = mins[pill.grade];
      if (prev == null || ratio < prev.ratio) {
        mins[pill.grade] = { ratio, width, bg: avg.map((n) => Math.round(n)) };
      }
      if (ratio < 4.5) failed = true;
    }
  }
}

chrome.kill();
ws.close();
const report = {};
for (const [grade, row] of Object.entries(mins)) {
  report[grade] = { min: Math.round(row.ratio * 100) / 100, width: row.width, interior: row.bg };
}
console.log(JSON.stringify(report, null, 2));
const missing = ["strong", "weak", "provisional"].filter((grade) => report[grade] == null);
if (missing.length) {
  console.error("Missing pill types: " + missing.join(", "));
  process.exit(1);
}
process.exit(failed ? 1 : 0);
