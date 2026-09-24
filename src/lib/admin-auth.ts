import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_COOKIE = "gc_admin";

export function adminConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return typeof env.ADMIN_TOKEN === "string" && env.ADMIN_TOKEN.length >= 16;
}

export function tokenMatches(supplied: string, env: NodeJS.ProcessEnv = process.env): boolean {
  const expected = env.ADMIN_TOKEN ?? "";
  if (!adminConfigured(env)) return false;
  const left = Buffer.from(supplied);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function adminSessionValue(env: NodeJS.ProcessEnv = process.env): string {
  const token = env.ADMIN_TOKEN ?? "";
  return createHmac("sha256", token).update("gradedcalls-admin-v1").digest("hex");
}

export function sessionMatches(cookieValue: string | undefined, env: NodeJS.ProcessEnv = process.env): boolean {
  if (!cookieValue || !adminConfigured(env)) return false;
  const expected = adminSessionValue(env);
  const left = Buffer.from(cookieValue);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function bearerMatches(header: string | null, env: NodeJS.ProcessEnv = process.env): boolean {
  if (!header?.startsWith("Bearer ")) return false;
  return tokenMatches(header.slice("Bearer ".length).trim(), env);
}
