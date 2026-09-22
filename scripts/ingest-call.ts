import fs from "node:fs";
import path from "node:path";
import { excerptAppearsInDocument, parseOperatorPaste, toLiveCall, upsertLiveCall } from "../src/lib/ingest";
import type { LiveFile } from "../src/lib/live-book";

const bookPath = path.join(process.cwd(), "src/lib/live-calls.json");

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((item) => item.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

async function main() {
  const cohort = arg("cohort");
  if (!cohort || !/^\d{4}-\d{2}-\d{2}$/.test(cohort)) {
    throw new Error("Pass --cohort=YYYY-MM-DD for the readout Monday. Refusing to guess the week.");
  }
  const fileArg = arg("file");
  const raw = fileArg ? fs.readFileSync(fileArg, "utf8") : fs.readFileSync(0, "utf8");
  const parsed = parseOperatorPaste(raw);
  const response = await fetch(parsed.sourceUrl, { headers: { "user-agent": "CharoofFinTwit/ingest" } });
  if (!response.ok) {
    throw new Error(`Source ${parsed.sourceUrl} returned ${response.status}. Refusing to store an unread post.`);
  }
  const html = await response.text();
  if (!excerptAppearsInDocument(parsed.body, html)) {
    throw new Error("The pasted text is not on that source page. Refusing to store it.");
  }
  const data = JSON.parse(fs.readFileSync(bookPath, "utf8")) as LiveFile;
  const [year, month, day] = cohort.split("-").map(Number);
  const id = `${cohort}__${parsed.handle}`;
  const next = upsertLiveCall(
    data,
    {
      slug: cohort,
      historySlug: cohort,
      title: "Verified weekend book",
      summary:
        "Public posts from the Wednesday noon to Sunday 5pm ET window. Each card links its source. Fictional demo posts are not in this book.",
      monday: { year, month, day },
    },
    toLiveCall(parsed, id),
  );
  fs.writeFileSync(bookPath, `${JSON.stringify(next, null, 2)}\n`);
  console.log(`Stored @${parsed.handle} ${parsed.direction} ${parsed.primary} in ${cohort}.`);
  console.log("Rebuild with npm run db:reset so the board picks it up.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
