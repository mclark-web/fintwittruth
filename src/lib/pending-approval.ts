import { readFileSync } from "node:fs";
import { join } from "node:path";

export type PendingApproval = {
  handle: string;
  displayName: string;
  postUrl: string;
  postedAtEt: string;
  ticker: string;
  direction: string;
  quote: string;
  reason: string;
};

const COLUMNS = ["handle", "display_name", "post_url", "posted_at_ET", "ticker", "direction", "quote", "reason"] as const;

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  while (i < text.length) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i += 1;
        continue;
      }
      field += char;
      i += 1;
      continue;
    }
    if (char === '"') {
      quoted = true;
      i += 1;
      continue;
    }
    if (char === ",") {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }
    if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i += 1;
      continue;
    }
    field += char;
    i += 1;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  if (rows.length > 0 && rows[rows.length - 1].every((cell) => cell === "")) rows.pop();
  return rows;
}

export function parsePendingApproval(text: string): PendingApproval[] {
  const [header, ...records] = parseCsv(text);
  const index = new Map((header ?? []).map((name, place) => [name, place]));
  for (const column of COLUMNS) {
    if (!index.has(column)) throw new Error(`pending-approval.csv is missing ${column}`);
  }
  return records
    .filter((record) => record.some((value) => value !== ""))
    .map((record) => ({
      handle: record[index.get("handle") ?? 0] ?? "",
      displayName: record[index.get("display_name") ?? 1] ?? "",
      postUrl: record[index.get("post_url") ?? 2] ?? "",
      postedAtEt: record[index.get("posted_at_ET") ?? 3] ?? "",
      ticker: record[index.get("ticker") ?? 4] ?? "",
      direction: record[index.get("direction") ?? 5] ?? "",
      quote: record[index.get("quote") ?? 6] ?? "",
      reason: record[index.get("reason") ?? 7] ?? "",
    }));
}

export function loadPendingApproval(): PendingApproval[] {
  const path = join(process.cwd(), "data/calls/pending-approval.csv");
  return parsePendingApproval(readFileSync(path, "utf8"));
}
