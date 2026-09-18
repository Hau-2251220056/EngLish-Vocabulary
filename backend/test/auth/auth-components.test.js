import assert from "node:assert/strict";
import test from "node:test";
import { createAuthenticationController } from "../../src/controllers/auth-controller.js";
import { createAuthenticationMiddleware } from "../../src/middleware/authentication-middleware.js";
import { createRoleAuthorizationMiddleware } from "../../src/middleware/role-authorization-middleware.js";
import { createAuthenticationService } from "../../src/services/authentication-service.js";

const PUBLIC_USER = Object.freeze({
  id: "user-id",
  email: "user@example.test",
  display_name: "Test User",
  role: "USER",
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
    userRepository: { findById: async () => null },
    authSessionRepository: {
      findBySessionIdentifierHash: async () => ({
        user_id: "missing-user",
        expires_at: new Date(Date.now() + 60_000),
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
    { name: "session_id", options: { path: "/" } },
  ]);
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
  };
}
