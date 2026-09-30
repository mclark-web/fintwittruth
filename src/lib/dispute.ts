import { randomBytes } from "node:crypto";
import type { IntakeStore } from "./intake-store";
import { getIntakeStore } from "./intake-store";
import type { Dispute, DisputeStatus } from "./intake-types";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_IN_WINDOW = 5;

export class DisputeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DisputeError";
  }
}

export function disputePath(callId: string): string {
  return `/dispute?call=${encodeURIComponent(callId)}`;
}

/** A real inbox from the environment. Unset means the form is the only path. */
export function disputeEmail(env: NodeJS.ProcessEnv = process.env): string | null {
  const raw = env.DISPUTE_EMAIL?.trim() ?? "";
  if (!raw || raw.length > 120) return null;
  if (/\.example$/i.test(raw) || /@example\./i.test(raw)) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) return null;
  return raw;
}

export function disputeMailto(callId: string, env: NodeJS.ProcessEnv = process.env): string | null {
  const email = disputeEmail(env);
  if (!email) return null;
  const subject = `Dispute this grade ${callId}`;
  const body = `Call: ${callId}\n\nWhat looks wrong:\n`;
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function disputeRateLimited(disputes: Dispute[], now = new Date()): boolean {
  const cutoff = now.getTime() - WINDOW_MS;
  let count = 0;
  for (const dispute of disputes) {
    const at = new Date(dispute.createdAt).getTime();
    if (Number.isFinite(at) && at >= cutoff) count += 1;
  }
  return count >= MAX_IN_WINDOW;
}

export type DisputeDraft = {
  callId: string;
  name: string;
  email: string;
  reason: string;
};

export function parseDisputeFields(input: {
  callId: string;
  name: string;
  email: string;
  reason: string;
  company: string;
}): { honeypot: true } | { honeypot: false; draft: DisputeDraft } {
  if (input.company.trim()) return { honeypot: true };
  const callId = input.callId.trim();
  if (!/^[A-Za-z0-9_.:-]{1,120}$/.test(callId)) {
    throw new DisputeError("Enter the call id from the card.");
  }
  const reason = input.reason.trim();
  if (!reason) throw new DisputeError("A reason is required.");
  if (reason.length > 2000) throw new DisputeError("Keep the reason under 2000 characters.");
  const name = input.name.trim();
  if (name.length > 80) throw new DisputeError("Name is too long.");
  const email = input.email.trim();
  if (email.length > 120) throw new DisputeError("Email is too long.");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new DisputeError("That email does not look valid. Leave it blank if you prefer.");
  }
  return { honeypot: false, draft: { callId, name, email, reason } };
}

export async function submitDispute(
  input: { callId: string; name: string; email: string; reason: string; company: string },
  options: { store?: IntakeStore; now?: Date } = {},
): Promise<{ stored: boolean; id?: string }> {
  const parsed = parseDisputeFields(input);
  if (parsed.honeypot) return { stored: false };
  const store = options.store ?? getIntakeStore();
  const now = options.now ?? new Date();
  const book = await store.read();
  if (disputeRateLimited(book.disputes, now)) {
    throw new DisputeError("Too many disputes just came in. Try again later.");
  }
  const dispute: Dispute = {
    id: `dispute_${now.getTime().toString(36)}_${randomBytes(4).toString("hex")}`,
    callId: parsed.draft.callId,
    name: parsed.draft.name,
    email: parsed.draft.email,
    reason: parsed.draft.reason,
    status: "open",
    createdAt: now.toISOString(),
    resolvedAt: null,
  };
  await store.write({ version: 1, posts: book.posts, disputes: [...book.disputes, dispute] });
  return { stored: true, id: dispute.id };
}

export async function setDisputeStatus(
  id: string,
  status: DisputeStatus,
  options: { store?: IntakeStore; now?: Date } = {},
): Promise<Dispute> {
  const store = options.store ?? getIntakeStore();
  const now = options.now ?? new Date();
  const book = await store.read();
  const current = book.disputes.find((dispute) => dispute.id === id);
  if (!current) throw new DisputeError("That dispute is not in the book.");
  const next: Dispute = {
    ...current,
    status,
    resolvedAt: status === "resolved" ? now.toISOString() : null,
  };
  await store.write({
    version: 1,
    posts: book.posts,
    disputes: book.disputes.map((dispute) => (dispute.id === id ? next : dispute)),
  });
  return next;
}
