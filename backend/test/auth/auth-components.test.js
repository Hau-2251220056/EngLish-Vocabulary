import assert from "node:assert/strict";
import test from "node:test";
import { createAuthenticationController } from "../../src/controllers/auth-controller.js";
import { createAuthenticationMiddleware } from "../../src/middleware/authentication-middleware.js";
import { createRoleAuthorizationMiddleware } from "../../src/middleware/role-authorization-middleware.js";
import {
  createRequestDiagnosticsMiddleware,
  createUnexpectedErrorMiddleware,
  logUnexpectedRequestError,
} from "../../src/middleware/request-diagnostics-middleware.js";
import { createAuthSessionRepository } from "../../src/repositories/auth-session-repository.js";
import { createAuthenticationService as createAuthenticationServiceFactory } from "../../src/services/authentication-service.js";

const PUBLIC_USER = Object.freeze({
  id: "user-id",
  email: "user@example.test",
  display_name: "Test User",
  role: "USER",
});

test("unexpected request diagnostics emit only sanitized structured fields", () => {
  const entries = [];
  const req = {
    method: "GET",
    originalUrl: "/api/learning-path/passes/11111111-1111-4111-8111-111111111111?token=secret-query",
    headers: { "x-vercel-id": "iad1::safe-request-id" },
    cookies: { session_id: "secret-cookie" },
    body: { password: "secret-password" },
  };
  let nextCalled = false;
  createRequestDiagnosticsMiddleware({ now: () => 10 })(req, {}, () => { nextCalled = true; });
  const error = Object.assign(new Error("SELECT secret-sql DATABASE_URL=secret-url"), {
    name: "PrismaClientKnownRequestError",
    code: "P2024",
  });

  const event = logUnexpectedRequestError({
    error,
    req,
    logger: { error: (entry) => entries.push(entry) },
    now: () => 27.6,
  });

  assert.equal(nextCalled, true);
  assert.equal(entries.length, 1);
  assert.deepEqual(JSON.parse(entries[0]), event);
  assert.deepEqual(event, {
    event: "unexpected_request_error",
    schema_version: 1,
    correlation_id: "iad1::safe-request-id",
    method: "GET",
    route: "/api/learning-path/passes/:id",
    error_name: "PrismaClientKnownRequestError",
    prisma_code: "P2024",
    category: "prisma_connection",
    elapsed_ms: 18,
    instance_request: "FIRST",
  });
  const output = entries[0];
  for (const secret of ["secret-query", "secret-cookie", "secret-password", "secret-sql", "secret-url"]) {
    assert.equal(output.includes(secret), false, `${secret} leaked`);
  }
});

test("unexpected request diagnostics classify Prisma initialization and sanitize untrusted identity", () => {
  const req = { method: "not safe", originalUrl: "/api/topics/private-user-value", headers: { "x-vercel-id": "unsafe id" } };
  createRequestDiagnosticsMiddleware({ now: () => 5, uuid: () => "safe-fallback-id" })(req, {}, () => {});
  const event = logUnexpectedRequestError({
    error: { name: "PrismaClientInitializationError", code: "untrusted-code", message: "secret" },
    req,
    logger: { error() {} },
    now: () => 8,
  });

  assert.equal(event.correlation_id, "safe-fallback-id");
  assert.equal(event.method, "UNKNOWN");
  assert.equal(event.route, "/api/topics/:segment");
  assert.equal(event.error_name, "PrismaClientInitializationError");
  assert.equal(event.prisma_code, null);
  assert.equal(event.category, "prisma_initialization");
  assert.equal(event.instance_request, "SUBSEQUENT");
});

test("unexpected error middleware preserves the generic HTTP 500 contract", () => {
  const entries = [];
  const req = { method: "GET", originalUrl: "/api/topics", headers: {} };
  createRequestDiagnosticsMiddleware({ now: () => 1, uuid: () => "generated-id" })(req, {}, () => {});
  const res = createResponseSpy();

  createUnexpectedErrorMiddleware({ logger: { error: (entry) => entries.push(entry) } })(
    new Error("private failure detail"), req, res, () => {},
  );

  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, {
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred.",
    },
  });
  assert.equal(entries.length, 1);
  assert.equal(entries[0].includes("private failure detail"), false);
});

test("registration maps a Prisma P2002 race to the approved conflict", async () => {
  const service = createAuthenticationService({
    userRepository: {
      findByNormalizedEmail: async () => null,
      createUser: async () => {
        throw Object.assign(new Error("unique"), { code: "P2002" });
      },
    },
    authSessionRepository: {},
    passwordSecurity: {
      validatePasswordPolicy: () => true,
      hashPassword: async () => "safe-hash",
    },
  });

  await assert.rejects(
    service.register({
      display_name: "Test User",
      email: "USER@EXAMPLE.TEST",
      password: "password",
    }),
    (error) => error?.code === "EMAIL_ALREADY_EXISTS",
  );
});

test("logout treats P2025 deletion races as idempotent", async () => {
  const service = createAuthenticationService({
    userRepository: {},
    authSessionRepository: {
      findBySessionIdentifierHash: async () => ({
        expires_at: new Date(Date.now() + 60_000),
      }),
      deleteBySessionIdentifierHash: async () => {
        throw Object.assign(new Error("gone"), { code: "P2025" });
      },
    },
    passwordSecurity: {},
  });

  await assert.doesNotReject(service.logout("session-token"));
});

test("service propagates unexpected repository errors unchanged", async () => {
  const expected = new Error("repository unavailable");
  const service = createAuthenticationService({
    userRepository: {
      findByNormalizedEmail: async () => {
        throw expected;
      },
    },
    authSessionRepository: {},
    passwordSecurity: {},
  });

  await assert.rejects(service.login({ email: "x", password: "y" }), expected);
});

test("missing persisted user is rejected for an otherwise valid session", async () => {
  const service = createAuthenticationService({
    userRepository: {},
    authSessionRepository: {
      findWithUserBySessionIdentifierHash: async () => ({
        expires_at: new Date(Date.now() + 60_000),
        user: null,
      }),
    },
    passwordSecurity: {},
  });

  await assert.rejects(
    service.getCurrentUser("session-token"),
    (error) => error?.code === "AUTHENTICATION_FAILED",
  );
});

test("current-user lookup preserves post-read expiry and active-user checks with one repository call", async () => {
  const calls = [];
  const service = createAuthenticationService({
    userRepository: {},
    authSessionRepository: {
      findWithUserBySessionIdentifierHash: async (sessionHash) => {
        calls.push(sessionHash);
        return {
          expires_at: new Date(Date.now() + 60_000),
          user: { ...PUBLIC_USER, is_active: true },
        };
      },
    },
    passwordSecurity: {},
  });

  assert.deepEqual(await service.getCurrentUser("session-token"), PUBLIC_USER);
  assert.equal(calls.length, 1);
  assert.match(calls[0], /^[a-f0-9]{64}$/);
});

test("current-user repository lookup returns expiry and user in one relation query", async () => {
  const queries = [];
  const repository = createAuthSessionRepository({
    aUTH_SESSION: {
      findUnique: async (query) => {
        queries.push(query);
        return null;
      },
    },
  });

  await repository.findWithUserBySessionIdentifierHash("hashed-session");

  assert.equal(queries.length, 1);
  assert.deepEqual(queries[0].where, {
    session_identifier_hash: "hashed-session",
  });
  assert.equal(queries[0].select.expires_at, true);
  assert.equal(queries[0].select.user.select.is_active, true);
});

test("current-user lookup rejects a session that expired before the repository returned", async () => {
  const service = createAuthenticationService({
    userRepository: {},
    authSessionRepository: {
      findWithUserBySessionIdentifierHash: async () => ({
        expires_at: new Date(Date.now() - 1),
        user: { ...PUBLIC_USER, is_active: true },
      }),
    },
    passwordSecurity: {},
  });

  await assert.rejects(
    service.getCurrentUser("session-token"),
    (error) => error?.code === "AUTHENTICATION_FAILED",
  );
});

test("authentication middleware accepts only service-established identity", async () => {
  const middleware = createAuthenticationMiddleware({
    authenticationService: { getCurrentUser: async () => PUBLIC_USER },
  });
  const req = {
    cookies: { session_id: "valid" },
    body: { user_id: "forged", role: "ADMIN" },
    query: { owner_id: "forged" },
  };
  const res = createResponseSpy();
  let nextCount = 0;

  await middleware(req, res, () => {
    nextCount += 1;
  });

  assert.equal(nextCount, 1);
  assert.deepEqual(req.user, PUBLIC_USER);
  assert.deepEqual(Object.keys(req.user).sort(), [
    "display_name",
    "email",
    "id",
    "role",
  ]);
});

test("authentication middleware maps known failure and stops downstream", async () => {
  const middleware = createAuthenticationMiddleware({
    authenticationService: {
      getCurrentUser: async () => {
        throw Object.assign(new Error("Authentication failed."), {
          code: "AUTHENTICATION_FAILED",
        });
      },
    },
  });
  const res = createResponseSpy();
  let nextCount = 0;

  await middleware({ cookies: { session_id: "invalid" } }, res, () => {
    nextCount += 1;
  });

  assert.equal(nextCount, 0);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error.code, "AUTHENTICATION_FAILED");
});

test("authentication middleware forwards unexpected errors unchanged", async () => {
  const expected = new Error("unexpected");
  const middleware = createAuthenticationMiddleware({
    authenticationService: {
      getCurrentUser: async () => {
        throw expected;
      },
    },
  });
  let forwarded;

  await middleware(
    { cookies: { session_id: "token" } },
    createResponseSpy(),
    (error) => {
      forwarded = error;
    },
  );

  assert.equal(forwarded, expected);
});

test("controllers forward unexpected errors and logout clears its cookie first", async () => {
  const expected = new Error("unexpected");
  const controller = createAuthenticationController({
    authenticationService: {
      register: async () => {
        throw expected;
      },
      login: async () => {
        throw expected;
      },
      logout: async () => {
        throw expected;
      },
    },
  });

  for (const name of ["register", "login"]) {
    const res = createResponseSpy();
    let forwarded;
    await controller[name]({ body: {} }, res, (error) => {
      forwarded = error;
    });
    assert.equal(forwarded, expected);
  }

  const logoutResponse = createResponseSpy();
  let forwarded;
  await controller.logout(
    { cookies: { session_id: "token" } },
    logoutResponse,
    (error) => {
      forwarded = error;
    },
  );
  assert.equal(forwarded, expected);
  assert.deepEqual(logoutResponse.clearedCookies, [
    { name: "session_id", options: { path: "/", sameSite: "lax" } },
  ]);
});

test("login controller returns bounded lockout metadata and Retry-After", async () => {
  const controller = createAuthenticationController({
    authenticationService: {
      login: async () => {
        throw Object.assign(new Error("Login attempts are temporarily blocked. Try again later."), {
          code: "AUTHENTICATION_LOCKED",
          details: { retry_after_seconds: 300 },
        });
      },
    },
  });
  const res = createResponseSpy();
  await controller.login({ body: {}, socket: { remoteAddress: "127.0.0.1" } }, res, (error) => { throw error; });
  assert.equal(res.statusCode, 429);
  assert.equal(res.headers["Retry-After"], "300");
  assert.deepEqual(res.body.error, {
    code: "AUTHENTICATION_LOCKED",
    message: "Login attempts are temporarily blocked. Try again later.",
    retry_after_seconds: 300,
  });
});

test("secure requests set the approved Secure session cookie", async () => {
  const controller = createAuthenticationController({
    authenticationService: {
      login: async () => ({ user: PUBLIC_USER, sessionToken: "raw-token" }),
    },
  });
  const res = createResponseSpy();

  await controller.login(
    { secure: true, body: { email: "x", password: "y" } },
    res,
    (error) => {
      throw error;
    },
  );

  assert.equal(res.cookies[0].name, "session_id");
  assert.equal(res.cookies[0].options.secure, true);
  assert.equal(res.cookies[0].options.httpOnly, true);
  assert.equal(res.cookies[0].options.maxAge, 604_800_000);
  assert.equal(res.cookies[0].options.sameSite, "lax");
});

test("production context sets the approved Secure session cookie", async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const controller = createAuthenticationController({
    authenticationService: {
      login: async () => ({ user: PUBLIC_USER, sessionToken: "raw-token" }),
    },
  });
  const res = createResponseSpy();

  try {
    process.env.NODE_ENV = "production";
    await controller.login(
      { secure: false, body: { email: "x", password: "y" } },
      res,
      (error) => {
        throw error;
      },
    );
  } finally {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  }

  assert.equal(res.cookies[0].name, "session_id");
  assert.equal(res.cookies[0].options.secure, true);
});

test("role authorization uses authenticated req.user only", () => {
  const cases = [
    { allowedRoles: ["USER"], role: "USER", next: true },
    { allowedRoles: ["ADMIN"], role: "ADMIN", next: true },
    { allowedRoles: ["ADMIN"], role: "USER", status: 403 },
    { allowedRoles: ["UNKNOWN"], role: "UNKNOWN", status: 403 },
  ];

  for (const scenario of cases) {
    const middleware = createRoleAuthorizationMiddleware({
      allowedRoles: scenario.allowedRoles,
    });
    const res = createResponseSpy();
    let nextArgument = "not-called";
    middleware(
      {
        user: { ...PUBLIC_USER, role: scenario.role },
        body: { role: "ADMIN" },
      },
      res,
      (error) => {
        nextArgument = error;
      },
    );

    if (scenario.next) assert.equal(nextArgument, undefined);
    else {
      assert.equal(nextArgument, "not-called");
      assert.equal(res.statusCode, scenario.status);
      assert.equal(res.body.error.code, "FORBIDDEN");
    }
  }
});

test("role authorization forwards missing identity as a composition error", () => {
  const middleware = createRoleAuthorizationMiddleware({
    allowedRoles: ["USER"],
  });
  let forwarded;
  middleware({}, createResponseSpy(), (error) => {
    forwarded = error;
  });
  assert.match(forwarded.message, /Authenticated user is required/);
});

test("representative Authentication success and failure emit no sensitive logs", async () => {
  const passwordMarker = "sensitive-password-marker";
  const failedPasswordMarker = "failed-password-marker";
  const credentialMarker = "credential-marker@example.test";
  const fixtureMarker = "sensitive-fixture-marker";
  const captured = [];
  const originals = new Map();
  let rawToken;

  try {
    for (const name of ["log", "info", "warn", "error"]) {
      originals.set(name, console[name]);
      console[name] = (...args) => captured.push(args.map(String).join(" "));
    }

    const authenticationService = createAuthenticationService({
      userRepository: {
        findByNormalizedEmail: async () => ({
          ...PUBLIC_USER,
          email: credentialMarker,
          is_active: true,
          password_hash: fixtureMarker,
        }),
      },
      authSessionRepository: {
        createSession: async () => ({ id: "session-id" }),
      },
      passwordSecurity: {
        verifyPassword: async (password) => password === passwordMarker,
      },
    });
    const controller = createAuthenticationController({
      authenticationService,
    });
    const successResponse = createResponseSpy();
    await controller.login(
      { secure: false, body: { email: credentialMarker, password: passwordMarker } },
      successResponse,
      (error) => {
        throw error;
      },
    );
    rawToken = successResponse.cookies[0].value;

    const failureResponse = createResponseSpy();
    await controller.login(
      {
        secure: false,
        body: { email: credentialMarker, password: failedPasswordMarker },
      },
      failureResponse,
      (error) => {
        throw error;
      },
    );
    assert.equal(failureResponse.statusCode, 401);
    assert.equal(failureResponse.body.error.code, "AUTHENTICATION_FAILED");
  } finally {
    for (const [name, original] of originals) console[name] = original;
  }

  const output = captured.join("\n");
  assert.equal(output.includes(passwordMarker), false, "password marker leaked");
  assert.equal(
    output.includes(failedPasswordMarker),
    false,
    "failed password marker leaked",
  );
  assert.equal(output.includes(credentialMarker), false, "credential marker leaked");
  assert.equal(output.includes(fixtureMarker), false, "fixture marker leaked");
  assert.equal(
    typeof rawToken === "string" && output.includes(rawToken),
    false,
    "raw session token leaked",
  );
});

function createResponseSpy() {
  return {
    statusCode: 200,
    body: undefined,
    cookies: [],
    clearedCookies: [],
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    send(body) {
      this.body = body;
      return this;
    },
    cookie(name, value, options) {
      this.cookies.push({ name, value, options });
      return this;
    },
    clearCookie(name, options) {
      this.clearedCookies.push({ name, options });
      return this;
    },
    set(name, value) {
      this.headers[name] = value;
      return this;
    },
  };
}

function createAuthenticationService(options) {
  const states = new Map();
  const loginAbuseRepository = {
    async lock() {},
    async find(identifierKey, sourceKey) { return states.get(`${identifierKey}:${sourceKey}`) ?? null; },
    async save(value) {
      states.set(`${value.identifierKey}:${value.sourceKey}`, {
        failure_count: value.failureCount,
        last_failed_at: value.lastFailedAt,
        blocked_until: value.blockedUntil,
      });
    },
    async delete(identifierKey, sourceKey) { states.delete(`${identifierKey}:${sourceKey}`); },
    async deleteForIdentifier(identifierKey) {
      for (const key of states.keys()) if (key.startsWith(`${identifierKey}:`)) states.delete(key);
    },
  };
  return createAuthenticationServiceFactory({
    ...options,
    loginAbuseKeys: { identifier: (value) => value, source: () => "unit-source" },
    withLoginTransaction: (callback) => callback({
      userRepository: options.userRepository,
      authSessionRepository: options.authSessionRepository,
      loginAbuseRepository,
    }),
  });
}
