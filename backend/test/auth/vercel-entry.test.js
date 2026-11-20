import assert from "node:assert/strict";
import test from "node:test";

test("Vercel entry default-exports the composed Express application", async () => {
  const previous = process.env.LOGIN_ABUSE_HMAC_SECRET;
  process.env.LOGIN_ABUSE_HMAC_SECRET = "vercel-entry-test-secret-at-least-32-characters";
  const { default: app } = await import("../../src/index.js");
  if (previous === undefined) delete process.env.LOGIN_ABUSE_HMAC_SECRET;
  else process.env.LOGIN_ABUSE_HMAC_SECRET = previous;
  assert.equal(typeof app, "function");
  assert.equal(typeof app.listen, "function");
});
