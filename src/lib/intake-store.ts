import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { emptyBook, type IntakeBook } from "./intake-types";

export class IntakeStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IntakeStoreError";
  }
}

export type StoreKind = "blob" | "file" | "unconfigured";

export type IntakeStore = {
  kind: StoreKind;
  detail: string;
  read(): Promise<IntakeBook>;
  write(book: IntakeBook): Promise<void>;
};

export const UNCONFIGURED_DETAIL =
  "Persistent intake storage is not configured. On Vercel, create a Blob store and set BLOB_READ_WRITE_TOKEN. Locally, posts are saved to data/intake-book.json when VERCEL is unset.";

const BLOB_PATH = "intake/book.json";

export function normalizeBook(value: unknown): IntakeBook {
  if (!value || typeof value !== "object") {
    throw new IntakeStoreError("Intake book is not a JSON object.");
  }
  const book = value as IntakeBook;
  if (book.version !== 1 || !Array.isArray(book.posts)) {
    throw new IntakeStoreError("Intake book is not version 1.");
  }
  return {
    version: 1,
    posts: book.posts,
    disputes: Array.isArray(book.disputes) ? book.disputes : [],
  };
}

export function fileIntakeStore(filePath: string): IntakeStore {
  return {
    kind: "file",
    detail: `Posts are stored in ${filePath}.`,
    async read() {
      try {
        const text = await readFile(filePath, "utf8");
        return normalizeBook(JSON.parse(text));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyBook();
        throw new IntakeStoreError(
          error instanceof IntakeStoreError ? error.message : "The intake file could not be read.",
        );
      }
    },
    async write(book) {
      normalizeBook(book);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, JSON.stringify(book, null, 2));
    },
  };
}

function blobIntakeStore(): IntakeStore {
  return {
    kind: "blob",
    detail: "Posts are stored in a private Vercel Blob at intake/book.json.",
    async read() {
      const { get } = await import("@vercel/blob");
      const result = await get(BLOB_PATH, { access: "private", useCache: false });
      if (!result || result.statusCode !== 200 || !result.stream) return emptyBook();
      const text = await new Response(result.stream).text();
      if (!text.trim()) return emptyBook();
      return normalizeBook(JSON.parse(text));
    },
    async write(book) {
      normalizeBook(book);
      const { put } = await import("@vercel/blob");
      await put(BLOB_PATH, JSON.stringify(book), {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
        cacheControlMaxAge: 60,
      });
    },
  };
}

function unconfiguredStore(): IntakeStore {
  return {
    kind: "unconfigured",
    detail: UNCONFIGURED_DETAIL,
    async read() {
      return emptyBook();
    },
    async write() {
      throw new IntakeStoreError(UNCONFIGURED_DETAIL);
    },
  };
}

export function createIntakeStore(env: NodeJS.ProcessEnv = process.env): IntakeStore {
  if (env.BLOB_READ_WRITE_TOKEN) return blobIntakeStore();
  if (env.VERCEL) return unconfiguredStore();
  const filePath = env.INTAKE_FILE || path.join(process.cwd(), "data", "intake-book.json");
  return fileIntakeStore(filePath);
}

export function getIntakeStore(): IntakeStore {
  return createIntakeStore();
}
