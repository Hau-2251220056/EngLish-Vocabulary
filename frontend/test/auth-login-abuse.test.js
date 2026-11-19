import assert from "node:assert/strict";
import test from "node:test";
import { getAuthErrorPresentation } from "../src/auth/ui/auth-error-messages.js";
import { AuthenticationApiError, createAuthService } from "../src/services/auth-service.js";

test("auth service preserves bounded warning and lockout guidance", async () => {
  for (const scenario of [
    { status: 401, code: "AUTHENTICATION_WARNING", attempts_remaining: 2 },
    { status: 429, code: "AUTHENTICATION_LOCKED", retry_after_seconds: 299 },
  ]) {
    const service = createAuthService({
      async post() {
        throw { response: { status: scenario.status, data: { error: scenario } } };
      },
    });
    await assert.rejects(
      service.login({ email: "user@example.test", password: "private" }),
      (error) => {
        assert.equal(error instanceof AuthenticationApiError, true);
        assert.equal(error.code, scenario.code);
        assert.equal(error.attemptsRemaining, scenario.attempts_remaining ?? null);
        assert.equal(error.retryAfterSeconds, scenario.retry_after_seconds ?? null);
        return true;
      },
    );
  }
});

test("warning and lockout presentations are clear, bounded, and privacy safe", () => {
  const warning = getAuthErrorPresentation({ code: "AUTHENTICATION_WARNING", attemptsRemaining: 1 }, "login");
  const lockout = getAuthErrorPresentation({ code: "AUTHENTICATION_LOCKED", retryAfterSeconds: 9_999 }, "login");
  assert.match(warning.message, /1 lần thử/);
  assert.match(lockout.message, /5 phút/);
  assert.equal(JSON.stringify({ warning, lockout }).includes("user@example.test"), false);
});
