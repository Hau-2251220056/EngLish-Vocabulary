import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { createApp } from "../../src/app.js";
import { verifyPassword } from "../../src/utils/password-security.js";
import {
  createSessionFixture,
  createUserFixture,
  hashSessionToken,
  uniqueEmail,
} from "../helpers/auth-fixtures.js";
import { createTestDatabase } from "../helpers/test-database.js";
import {
  getCookiePair,
  getCookieValue,
  startHttpTestServer,
} from "../helpers/http-test-server.js";

const AUTHENTICATION_FAILURE = {
  success: false,
  error: {
    code: "AUTHENTICATION_FAILED",
    message: "Authentication failed.",
  },
};

let database;
let prisma;
let http;

before(async () => {
  database = await createTestDatabase();
  prisma = database.prisma;
  http = await startHttpTestServer(createApp({ prisma }));
});

beforeEach(async () => {
  await database.reset();
});

afterEach(async () => {
  await database.reset();
});

after(async () => {
  try {
    if (database) await database.reset();
  } finally {
    try {
      if (http) await http.close();
    } finally {
      if (database) await database.disconnect();
    }
  }
});

test("health route remains available through the importable application", async () => {
  const response = await http.request("/");
  assert.equal(response.status, 200);
  assert.deepEqual(response.json, { True: "OK" });
});

test("registration persists normalized USER defaults without login state", async () => {
  const email = uniqueEmail("register");
  const uppercaseEmail = email.toUpperCase();
  const password = "registration-password";
  const response = await register({
    display_name: "Registered User",
    email: uppercaseEmail,
    password,
  });

  assert.equal(response.status, 201);
  assert.deepEqual(response.json, {
    success: true,
    message: "Registration successful",
  });
  assert.equal(response.setCookies.length, 0);

  const user = await prisma.uSER.findUnique({ where: { email } });
  assert.ok(user);
  assert.equal(user.display_name, "Registered User");
  assert.equal(user.role, "USER");
  assert.equal(user.is_active, true);
  assert.equal(user.total_xp, 0);
  assert.equal(user.daily_xp_goal, 50);
  assert.notEqual(user.password_hash, password);
  assert.equal(await verifyPassword(password, user.password_hash), true);
  assert.equal(await prisma.aUTH_SESSION.count(), 0);
  assertNoSensitiveJson(response, [password, user.password_hash]);

  const me = await http.request("/api/auth/me");
  assert.equal(me.status, 401);
});

test("registration validation failures create no partial state", async () => {
  const invalidPayloads = [
    {},
    null,
    { display_name: "", email: uniqueEmail(), password: "password" },
    { display_name: 12, email: uniqueEmail(), password: "password" },
    { display_name: "User", email: "", password: "password" },
    { display_name: "User", email: 12, password: "password" },
    { display_name: "User", email: uniqueEmail(), password: 12 },
    { display_name: "User", email: uniqueEmail(), password: "1234567" },
  ];

  for (const payload of invalidPayloads) {
    const response = await register(payload);
    assert.equal(response.status, 400);
    assert.equal(response.json.error.code, "VALIDATION_ERROR");
    assert.equal(response.setCookies.length, 0);
  }

  assert.equal(await prisma.uSER.count(), 0);
  assert.equal(await prisma.aUTH_SESSION.count(), 0);
});

test("normalized duplicate and concurrent registration race use one conflict contract", async () => {
  const email = uniqueEmail("duplicate");
  const first = await register({
    display_name: "First",
    email: email.toUpperCase(),
    password: "password-123",
  });
  const duplicate = await register({
    display_name: "Duplicate",
    email,
    password: "password-123",
  });

  assert.equal(first.status, 201);
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.json.error.code, "EMAIL_ALREADY_EXISTS");
  assert.equal(await prisma.uSER.count({ where: { email } }), 1);

  await database.reset();
  const raceEmail = uniqueEmail("race");
  const responses = await Promise.all([
    register({
      display_name: "Race One",
      email: raceEmail,
      password: "password-123",
    }),
    register({
      display_name: "Race Two",
      email: raceEmail.toUpperCase(),
      password: "password-123",
    }),
  ]);

  assert.deepEqual(
    responses.map(({ status }) => status).sort(),
    [201, 409],
  );
  assert.equal(await prisma.uSER.count({ where: { email: raceEmail } }), 1);
  assert.equal(await prisma.aUTH_SESSION.count(), 0);
});

test("valid login creates a secure hash-only seven-day session contract", async () => {
  const password = "login-password";
  const user = await createUserFixture(prisma, {
    email: uniqueEmail("login"),
    password,
  });
  const beforeLogin = Date.now();
  const response = await login({
    email: user.email.toUpperCase(),
    password,
  });
  const afterLogin = Date.now();

  assert.equal(response.status, 200);
  assert.deepEqual(response.json, {
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        role: user.role,
      },
    },
  });

  const setCookie = response.setCookies.find((value) =>
    value.startsWith("session_id="),
  );
  assert.ok(setCookie);
  assert.match(setCookie, /; HttpOnly/i);
  assert.match(setCookie, /; Path=\//i);
  assert.match(setCookie, /; Max-Age=604800/i);
  assert.doesNotMatch(setCookie, /; Secure/i);

  const cookiePair = getCookiePair(response.setCookies);
  const rawToken = getCookieValue(cookiePair);
  assert.equal(Buffer.from(rawToken, "base64url").length, 32);

  const sessions = await prisma.aUTH_SESSION.findMany({
    where: { user_id: user.id },
  });
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].session_identifier_hash, hashSessionToken(rawToken));
  assert.notEqual(sessions[0].session_identifier_hash, rawToken);
  assert.match(sessions[0].session_identifier_hash, /^[a-f0-9]{64}$/);

  const lifetime = 7 * 24 * 60 * 60 * 1000;
  assert.equal(
    sessions[0].expires_at.getTime() >= beforeLogin + lifetime,
    true,
  );
  assert.equal(
    sessions[0].expires_at.getTime() <= afterLogin + lifetime + 1_000,
    true,
  );
  assertNoSensitiveJson(response, [
    password,
    user.password_hash,
    rawToken,
    sessions[0].session_identifier_hash,
  ]);
});

test("invalid login variants share one public response and create no session", async () => {
  const password = "valid-password";
  const active = await createUserFixture(prisma, { password });
  const inactive = await createUserFixture(prisma, {
    password,
    is_active: false,
  });
  const scenarios = [
    { email: uniqueEmail("unknown"), password },
    { email: active.email, password: "wrong-password" },
    { email: inactive.email, password },
    { password },
    { email: active.email },
    { email: 12, password },
    { email: active.email, password: 12 },
  ];

  for (const payload of scenarios) {
    const response = await login(payload);
    assert.equal(response.status, 401);
    assert.deepEqual(response.json, AUTHENTICATION_FAILURE);
    assert.equal(response.setCookies.length, 0);
  }

  assert.equal(await prisma.aUTH_SESSION.count(), 0);
});

test("multiple login sessions remain independent and /me trusts the session owner", async () => {
  const password = "multiple-session-password";
  const user = await createUserFixture(prisma, { password });
  const firstLogin = await login({ email: user.email, password });
  const secondLogin = await login({ email: user.email, password });
  const firstCookie = getCookiePair(firstLogin.setCookies);
  const secondCookie = getCookiePair(secondLogin.setCookies);

  assert.notEqual(firstCookie, secondCookie);
  assert.equal(
    await prisma.aUTH_SESSION.count({ where: { user_id: user.id } }),
    2,
  );

  const me = await http.request(
    "/api/auth/me?user_id=forged&owner_id=forged&role=ADMIN",
    {
      cookie: firstCookie,
      headers: { "x-user-id": "forged", "x-role": "ADMIN" },
    },
  );
  assert.equal(me.status, 200);
  assert.deepEqual(me.json.data, {
    id: user.id,
    email: user.email,
    display_name: user.display_name,
    role: "USER",
  });

  const logout = await http.request("/api/auth/logout", {
    method: "POST",
    cookie: firstCookie,
  });
  assertLogoutResponse(logout);
  assert.equal(
    await prisma.aUTH_SESSION.count({ where: { user_id: user.id } }),
    1,
  );

  const firstAfterLogout = await http.request("/api/auth/me", {
    cookie: firstCookie,
  });
  const secondAfterLogout = await http.request("/api/auth/me", {
    cookie: secondCookie,
  });
  assert.equal(firstAfterLogout.status, 401);
  assert.equal(secondAfterLogout.status, 200);
});

test("/me accepts USER and ADMIN and rejects invalid session states uniformly", async () => {
  const user = await createUserFixture(prisma, { role: "USER" });
  const admin = await createUserFixture(prisma, { role: "ADMIN" });
  const userSession = await createSessionFixture(prisma, user.id);
  const adminSession = await createSessionFixture(prisma, admin.id);

  for (const [identity, session] of [
    [user, userSession],
    [admin, adminSession],
  ]) {
    const response = await http.request("/api/auth/me", {
      cookie: `session_id=${session.rawToken}`,
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.data.id, identity.id);
    assert.equal(response.json.data.role, identity.role);
    assert.deepEqual(Object.keys(response.json.data).sort(), [
      "display_name",
      "email",
      "id",
      "role",
    ]);
  }

  const expired = await createSessionFixture(prisma, user.id, {
    expires_at: new Date("2000-01-01T00:00:00.000Z"),
  });
  const deleted = await createSessionFixture(prisma, user.id);
  await prisma.aUTH_SESSION.delete({ where: { id: deleted.session.id } });
  const inactive = await createUserFixture(prisma, { is_active: false });
  const inactiveSession = await createSessionFixture(prisma, inactive.id);
  const invalidCookies = [
    undefined,
    "session_id=",
    "session_id=malformed",
    "session_id=unknown-session-token",
    `session_id=${expired.rawToken}`,
    `session_id=${deleted.rawToken}`,
    `session_id=${inactiveSession.rawToken}`,
  ];

  for (const cookie of invalidCookies) {
    const response = await http.request("/api/auth/me", { cookie });
    assert.equal(response.status, 401);
    assert.deepEqual(response.json, AUTHENTICATION_FAILURE);
  }
});

test("logout is idempotent for missing, malformed, expired, and deleted sessions", async () => {
  const user = await createUserFixture(prisma);
  const expired = await createSessionFixture(prisma, user.id, {
    expires_at: new Date("2000-01-01T00:00:00.000Z"),
  });
  const deleted = await createSessionFixture(prisma, user.id);
  await prisma.aUTH_SESSION.delete({ where: { id: deleted.session.id } });
  const cookies = [
    undefined,
    "session_id=",
    "session_id=malformed",
    "session_id=unknown-session-token",
    `session_id=${expired.rawToken}`,
    `session_id=${deleted.rawToken}`,
  ];

  for (const cookie of cookies) {
    const first = await http.request("/api/auth/logout", {
      method: "POST",
      cookie,
    });
    const repeated = await http.request("/api/auth/logout", {
      method: "POST",
      cookie,
    });
    assertLogoutResponse(first);
    assertLogoutResponse(repeated);
  }
});

test("end-to-end register, login, me, logout flow preserves public contract", async () => {
  const email = uniqueEmail("e2e");
  const password = "end-to-end-password";
  assert.equal(
    (
      await register({
        display_name: "End To End",
        email,
        password,
      })
    ).status,
    201,
  );
  const loginResponse = await login({ email, password });
  const cookie = getCookiePair(loginResponse.setCookies);
  assert.equal((await http.request("/api/auth/me", { cookie })).status, 200);
  assertLogoutResponse(
    await http.request("/api/auth/logout", { method: "POST", cookie }),
  );
  assert.equal((await http.request("/api/auth/me", { cookie })).status, 401);
});

function register(json) {
  return http.request("/api/auth/register", { method: "POST", json });
}

function login(json) {
  return http.request("/api/auth/login", { method: "POST", json });
}

function assertLogoutResponse(response) {
  assert.equal(response.status, 204);
  assert.equal(response.text, "");
  const clearCookie = response.setCookies.find((value) =>
    value.startsWith("session_id="),
  );
  assert.ok(clearCookie);
  assert.match(clearCookie, /; Path=\//i);
  assert.doesNotMatch(response.text, /session/i);
}

function assertNoSensitiveJson(response, sensitiveValues) {
  const body = response.text;
  for (const value of sensitiveValues) {
    assert.equal(
      typeof value === "string" && value.length > 0 && body.includes(value),
      false,
      "sensitive authentication value leaked in JSON response",
    );
  }
  assert.equal(body.includes("password_hash"), false);
  assert.equal(body.includes("session_identifier_hash"), false);
}
