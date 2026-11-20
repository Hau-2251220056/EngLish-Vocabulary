import assert from "node:assert/strict";
import test from "node:test";
import {
  AuthenticationApiError,
  createAuthService,
  isAuthenticationFailure,
} from "../src/services/auth-service.js";

test("auth service uses exact relative endpoints and normalizes email", async () => {
  const calls = [];
  const client = {
    async post(url, body) {
      calls.push({ method: "POST", url, body });

      if (url === "/api/auth/login") {
        return { data: { data: { user: publicUser } } };
      }

      return { data: { success: true } };
    },
    async get(url) {
      calls.push({ method: "GET", url });
      return { data: { data: publicUser } };
    },
  };
  const service = createAuthService(client);

  await service.register({
    display_name: "Learner",
    email: "LEARNER@EXAMPLE.COM",
    password: "password",
  });
  assert.deepEqual(await service.login({
    email: "LEARNER@EXAMPLE.COM",
    password: "password",
  }), publicUser);
  await service.logout();
  assert.deepEqual(await service.getCurrentUser(), publicUser);

  assert.deepEqual(calls, [
    {
      method: "POST",
      url: "/api/auth/register",
      body: {
        display_name: "Learner",
        email: "learner@example.com",
        password: "password",
      },
    },
    {
      method: "POST",
      url: "/api/auth/login",
      body: { email: "learner@example.com", password: "password" },
    },
    { method: "POST", url: "/api/auth/logout", body: undefined },
    { method: "GET", url: "/api/auth/me" },
  ]);
});

test("auth service maps authentication and operational failures", async () => {
  const authenticationService = createAuthService({
    async get() {
      throw {
        response: {
          status: 401,
          data: {
            error: {
              code: "AUTHENTICATION_FAILED",
              message: "Authentication failed.",
            },
          },
        },
      };
    },
  });

  await assert.rejects(authenticationService.getCurrentUser(), (error) => {
    assert.equal(error instanceof AuthenticationApiError, true);
    assert.equal(isAuthenticationFailure(error), true);
    assert.equal(error.status, 401);
    return true;
  });

  const operationalService = createAuthService({
    async get() {
      throw new Error("network details");
    },
  });

  await assert.rejects(operationalService.getCurrentUser(), (error) => {
    assert.equal(error.kind, "operational");
    assert.equal(error.code, "AUTH_OPERATION_FAILED");
    assert.equal(error.message, "Authentication service is unavailable.");
    return true;
  });
});

test("auth service returns only public identity from a credential-like login response", async () => {
  const service = createAuthService({
    async post() {
      return {
        data: {
          data: {
            user: publicUser,
            session_id: "raw-session-must-not-be-returned",
            password: "raw-password-must-not-be-returned",
          },
        },
      };
    },
  });

  assert.deepEqual(await service.login({
    email: "learner@example.com",
    password: "password",
  }), publicUser);
});

const publicUser = Object.freeze({
  id: "user-1",
  email: "learner@example.com",
  display_name: "Learner",
  role: "USER",
});
