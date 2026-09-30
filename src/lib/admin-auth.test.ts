import assert from "node:assert/strict";
import test from "node:test";
import { adminConfigured, adminSessionValue, bearerMatches, sessionMatches, tokenMatches } from "./admin-auth";

const env = { ADMIN_TOKEN: "correct-horse-battery" } as NodeJS.ProcessEnv;

test("admin checks require a long token and do not accept a shorter one", () => {
  assert.equal(adminConfigured({ ADMIN_TOKEN: "short" } as NodeJS.ProcessEnv), false);
  assert.equal(tokenMatches("correct-horse-battery", env), true);
  assert.equal(tokenMatches("correct-horse-batterz", env), false);
  assert.equal(tokenMatches("nope", env), false);
  assert.equal(bearerMatches("Bearer correct-horse-battery", env), true);
  assert.equal(bearerMatches("Bearer nope-nope-nope-no", env), false);
  const session = adminSessionValue(env);
  assert.equal(sessionMatches(session, env), true);
  assert.equal(sessionMatches(`${session.slice(0, -1)}a`, env), false);
});
