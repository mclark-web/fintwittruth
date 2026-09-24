import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { createIntakeStore, fileIntakeStore, IntakeStoreError } from "./intake-store";
import { emptyBook } from "./intake-types";

test("the file store round-trips a book and starts empty", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "gc-intake-"));
  try {
    const store = fileIntakeStore(path.join(dir, "book.json"));
    assert.deepEqual(await store.read(), emptyBook());
    await store.write({ version: 1, posts: [] });
    assert.equal((await store.read()).version, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("Vercel without a blob token refuses to pretend a write landed", async () => {
  const store = createIntakeStore({ VERCEL: "1" } as NodeJS.ProcessEnv);
  assert.equal(store.kind, "unconfigured");
  assert.deepEqual(await store.read(), emptyBook());
  await assert.rejects(() => store.write(emptyBook()), IntakeStoreError);
});
