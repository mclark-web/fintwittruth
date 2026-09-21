import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

function demoDatabasePath(): string {
  return path.join(process.cwd(), "prisma", "fintwittruth.db");
}

/**
 * The demo ships a SQLite file created at build time.
 * Serverless instances can read the deployment bundle and can write only under /tmp,
 * so the file is copied there before Prisma opens it.
 * A postgres DATABASE_URL bypasses the file.
 */
function resolveDatabaseUrl(): string {
  const configured = process.env.DATABASE_URL ?? "";
  if (configured.startsWith("postgres://") || configured.startsWith("postgresql://")) {
    return configured;
  }

  const source = demoDatabasePath();
  // turbopackIgnore: the path is fixed, and next.config traces prisma/fintwittruth.db.
  if (!fs.existsSync(/*turbopackIgnore: true*/ source)) {
    throw new Error(
      "Charoof FinTwit demo database is missing. Run `npm run build` so prisma/fintwittruth.db is seeded and included in the server bundle.",
    );
  }

  if (process.env.VERCEL) {
    const dest = "/tmp/fintwittruth.db";
    const sourceStat = fs.statSync(/*turbopackIgnore: true*/ source);
    const destStat = fs.existsSync(/*turbopackIgnore: true*/ dest)
      ? fs.statSync(/*turbopackIgnore: true*/ dest)
      : null;
    if (!destStat || destStat.size !== sourceStat.size) {
      fs.copyFileSync(/*turbopackIgnore: true*/ source, dest);
    }
    return `file:${dest}`;
  }

  return `file:${source}`;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: resolveDatabaseUrl() } },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export const sqlitePath = path.join(process.cwd(), "prisma", "fintwittruth.db");
