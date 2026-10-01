import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  createIntakeStore,
  fileIntakeStore,
  IntakeStoreError,
  UNCONFIGURED_DETAIL,
  UNCONFIGURED_PUBLIC,
  isOperatorStorageMessage,
} from "./intake-store";
import { emptyBook } from "./intake-types";

test("the file store round-trips a book and starts empty", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "gc-intake-"));
  try {
    const store = fileIntakeStore(path.join(dir, "book.json"));
    assert.deepEqual(await store.read(), emptyBook());
    await store.write(emptyBook());
    assert.equal((await store.read()).version, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("Vercel without a blob token refuses to pretend a write landed", async () => {
  const store = createIntakeStore({ VERCEL: "1" } as NodeJS.ProcessEnv);
  assert.equal(store.kind, "unconfigured");
  assert.equal(store.detail, UNCONFIGURED_DETAIL);
  assert.equal(isOperatorStorageMessage(store.detail), true);
  assert.equal(isOperatorStorageMessage(UNCONFIGURED_PUBLIC), false);
  assert.deepEqual(await store.read(), emptyBook());
  await assert.rejects(() => store.write(emptyBook()), (error: unknown) => {
    assert.ok(error instanceof IntakeStoreError);
    assert.equal(error.message, UNCONFIGURED_DETAIL);
    return true;
  });
});

test("the public watchlist hides the blob setup line", async () => {
  const previousVercel = process.env.VERCEL;
  const previousToken = process.env.BLOB_READ_WRITE_TOKEN;
  process.env.VERCEL = "1";
  delete process.env.BLOB_READ_WRITE_TOKEN;
  try {
    const { default: WatchlistPage } = await import("../app/watchlist/page");
    const html = renderToStaticMarkup(await WatchlistPage());
    assert.match(html, new RegExp(UNCONFIGURED_PUBLIC));
    assert.doesNotMatch(html, /BLOB_READ_WRITE_TOKEN/);
    assert.doesNotMatch(html, /Persistent intake storage/);
    assert.doesNotMatch(html, /create a Blob store/);
  } finally {
    if (previousVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = previousVercel;
    if (previousToken === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
    else process.env.BLOB_READ_WRITE_TOKEN = previousToken;
  }
});
