import assert from "node:assert/strict";
import test from "node:test";
import { createAuthenticationStore } from "../src/auth/auth-store.js";
import { AuthenticationApiError } from "../src/services/auth-service.js";

test("bootstrap resolves a valid session to authenticated state", async () => {
  const store = createAuthenticationStore(
    createService({ getCurrentUser: async () => publicUser }),
  );

  assert.equal(store.getSnapshot().isLoading, true);
  await store.initialize();
  assert.deepEqual(store.getSnapshot(), authenticatedState);
});

test("bootstrap resolves authentication failure to Guest", async () => {
  const store = createAuthenticationStore(
    createService({
      getCurrentUser: async () => {
        throw authenticationFailure();
      },
    }),
  );

  await store.initialize();
  assert.deepEqual(store.getSnapshot(), guestState);
});

test("bootstrap preserves a sanitized operational error", async () => {
  const store = createAuthenticationStore(
    createService({
      getCurrentUser: async () => {
        throw operationalFailure();
      },
    }),
  );

  await store.initialize();
  assert.deepEqual(store.getSnapshot(), {
    ...guestState,
    authError: operationalStateError,
  });
});

test("registration does not authenticate the shared state", async () => {
  const store = createAuthenticationStore(createService());

  await store.register({
    display_name: "Learner",
    email: "learner@example.com",
    password: "password",
  });

  assert.deepEqual(store.getSnapshot(), {
    user: null,
    isAuthenticated: false,
    isLoading: true,
    authError: null,
    sessionExpired: false,
  });
});

test("registration errors are retained without authenticating", async () => {
  const error = new AuthenticationApiError({
    kind: "api",
    code: "EMAIL_ALREADY_EXISTS",
    message: "An account with this email already exists.",
    status: 409,
  });
  const store = createAuthenticationStore(
    createService({ register: async () => { throw error; } }),
  );

  await assert.rejects(store.register({}), error);
  assert.equal(store.getSnapshot().isAuthenticated, false);
  assert.equal(store.getSnapshot().authError.code, "EMAIL_ALREADY_EXISTS");
});

test("login authenticates and logout returns state to Guest", async () => {
  const store = createAuthenticationStore(
    createService({ login: async () => publicUser }),
  );

  assert.deepEqual(await store.login({}), publicUser);
  assert.deepEqual(store.getSnapshot(), authenticatedState);

  await store.logout();
  assert.deepEqual(store.getSnapshot(), guestState);
});

test("login failure remains unauthenticated with a safe error", async () => {
  const store = createAuthenticationStore(
    createService({ login: async () => { throw authenticationFailure(); } }),
  );

  await assert.rejects(store.login({}));
  assert.equal(store.getSnapshot().isAuthenticated, false);
  assert.equal(store.getSnapshot().authError.code, "AUTHENTICATION_FAILED");
});

test("refresh transitions an expired session to Guest", async () => {
  let expired = false;
  const store = createAuthenticationStore(
    createService({
      getCurrentUser: async () => {
        if (expired) {
          throw authenticationFailure();
        }
        return publicUser;
      },
    }),
  );

  await store.initialize();
  assert.equal(store.getSnapshot().isAuthenticated, true);

  expired = true;
  await store.refreshCurrentUser();
  assert.deepEqual(store.getSnapshot(), {
    ...guestState,
    sessionExpired: true,
  });
});

test("initialization is idempotent for React StrictMode", async () => {
  let calls = 0;
  const store = createAuthenticationStore(
    createService({
      getCurrentUser: async () => {
        calls += 1;
        return publicUser;
      },
    }),
  );

  await Promise.all([store.initialize(), store.initialize()]);
  assert.equal(calls, 1);
});

function createService(overrides = {}) {
  return {
    register: async () => ({ success: true }),
    login: async () => publicUser,
    logout: async () => undefined,
    getCurrentUser: async () => {
      throw authenticationFailure();
    },
    ...overrides,
  };
}

function authenticationFailure() {
  return new AuthenticationApiError({
    kind: "authentication",
    code: "AUTHENTICATION_FAILED",
    message: "Authentication failed.",
    status: 401,
  });
}

function operationalFailure() {
  return new AuthenticationApiError({
    kind: "operational",
    code: "AUTH_OPERATION_FAILED",
    message: "Authentication service is unavailable.",
    status: null,
  });
}

const publicUser = Object.freeze({
  id: "user-1",
  email: "learner@example.com",
  display_name: "Learner",
  role: "USER",
});

const authenticatedState = Object.freeze({
  user: publicUser,
  isAuthenticated: true,
  isLoading: false,
  authError: null,
  sessionExpired: false,
});

const guestState = Object.freeze({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  authError: null,
  sessionExpired: false,
});

const operationalStateError = Object.freeze({
  kind: "operational",
  code: "AUTH_OPERATION_FAILED",
  message: "Authentication service is unavailable.",
  status: null,
});
