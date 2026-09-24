import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  DisputeError,
  disputeEmail,
  disputeMailto,
  disputePath,
  disputeRateLimited,
  setDisputeStatus,
  submitDispute,
} from "./dispute";
import { fileIntakeStore } from "./intake-store";
import type { Dispute } from "./intake-types";

test("the dispute link stays on this site", () => {
  assert.equal(disputePath("status_20"), "/dispute?call=status_20");
  assert.equal(disputeEmail({} as NodeJS.ProcessEnv), null);
  assert.equal(disputeEmail({ DISPUTE_EMAIL: "corrections@gradedcalls.example" } as NodeJS.ProcessEnv), null);
  assert.equal(disputeMailto("status_20", {} as NodeJS.ProcessEnv), null);
  const href = disputeMailto("status_20", { DISPUTE_EMAIL: "grades@gradedcalls.com" } as NodeJS.ProcessEnv);
  assert.match(href ?? "", /^mailto:grades@gradedcalls.com/);
});

test("a honeypot is dropped, a reason is required, and a burst is refused", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "gc-dispute-"));
  const store = fileIntakeStore(path.join(dir, "book.json"));
  const now = new Date("2026-09-24T16:00:00.000Z");
  try {
    const dropped = await submitDispute(
      { callId: "status_20", name: "", email: "", reason: "The print is wrong.", company: "acme" },
      { store, now },
    );
    assert.equal(dropped.stored, false);
    assert.equal((await store.read()).disputes.length, 0);

    await assert.rejects(
      () => submitDispute({ callId: "status_20", name: "", email: "", reason: "  ", company: "" }, { store, now }),
      DisputeError,
    );

    const saved = await submitDispute(
      { callId: "status_20", name: "Ada", email: "", reason: "Wednesday close does not match the post.", company: "" },
      { store, now },
    );
    assert.equal(saved.stored, true);
    const open = (await store.read()).disputes[0];
    assert.equal(open?.status, "open");
    assert.equal(open?.callId, "status_20");

    const longReason = "x".repeat(2001);
    await assert.rejects(
      () => submitDispute({ callId: "status_20", name: "", email: "", reason: longReason, company: "" }, { store, now }),
      DisputeError,
    );

    const burst: Dispute[] = Array.from({ length: 5 }, (_, index) => ({
      id: `dispute_${index}`,
      callId: "status_20",
      name: "",
      email: "",
      reason: "again",
      status: "open",
      createdAt: now.toISOString(),
      resolvedAt: null,
    }));
    assert.equal(disputeRateLimited(burst, now), true);
    await store.write({ version: 1, posts: [], disputes: burst });
    await assert.rejects(
      () =>
        submitDispute(
          { callId: "status_21", name: "", email: "", reason: "One more.", company: "" },
          { store, now: new Date(now.getTime() + 1000) },
        ),
      /Too many disputes/,
    );

    const resolved = await setDisputeStatus("dispute_0", "resolved", { store, now });
    assert.equal(resolved.status, "resolved");
    assert.ok(resolved.resolvedAt);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
