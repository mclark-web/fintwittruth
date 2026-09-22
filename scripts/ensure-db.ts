import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const dbPath = path.join(process.cwd(), "prisma", "fintwittruth.db");

function reset() {
  execSync("npx prisma db push --skip-generate --accept-data-loss", { stdio: "inherit" });
  execSync("npx tsx prisma/seed.ts", { stdio: "inherit" });
}

async function main() {
  if (!fs.existsSync(dbPath)) {
    reset();
    return;
  }
  const prisma = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
  try {
    const count = await prisma.cohort.count();
    if (count === 0) reset();
  } catch {
    reset();
  } finally {
    await prisma.$disconnect();
  }
}

main();
