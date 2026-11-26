import assert from "node:assert/strict";
import test from "node:test";
import { createGoogleAuthenticationService } from "../../src/services/google-authentication-service.js";
import { createGoogleIdTokenVerifier } from "../../src/security/google-id-token-verifier.js";
import { createAuthenticationController } from "../../src/controllers/auth-controller.js";

test("Google verifier accepts required claims and rejects invalid issuer, audience, expiry, and email verification", async () => {
  const base = {
    iss: "https://accounts.google.com",
    aud: "client-id",
    exp: Math.floor(Date.now() / 1000) + 300,
    sub: "google-subject",
    email: "Learner@Example.com",
    email_verified: true,
    nonce: "nonce",
    name: "Learner",
  };
  const payload = { ...base };
  const verifier = createGoogleIdTokenVerifier({
    clientId: "client-id",
    oauthClient: { verifyIdToken: async () => ({ getPayload: () => payload }) },
  });
  assert.deepEqual(await verifier.verify("credential"), {
    subject: "google-subject",
    email: "learner@example.com",
    displayName: "Learner",
    nonce: "nonce",
  });

  for (const invalid of [
    { iss: "https://attacker.invalid" },
    { aud: "wrong-client" },
    { exp: 1 },
    { email_verified: false },
    { sub: "" },
    { nonce: "" },
  ]) {
    Object.assign(payload, base, invalid);
    await assert.rejects(verifier.verify("credential"), { code: "GOOGLE_AUTHENTICATION_FAILED" });
  }
});

test("new Google identity atomically creates a USER-only account, identity, and opaque session", async () => {
  const harness = createHarness();
  const challenge = await harness.service.createChallenge(null, {});
  harness.identity.nonce = challenge.nonce;
  const result = await harness.service.authenticate({ credential: "credential", browserBinding: challenge.binding });

  assert.equal(result.user.role, "USER");
  assert.equal(result.user.password_hash, null);
  assert.equal(harness.createdIdentities.length, 1);
  assert.equal(harness.sessions.length, 1);
  assert.equal(harness.sessions[0].session_identifier_hash.length, 64);
  assert.equal(result.sessionToken.length, 43);
});

test("challenge is browser-bound, expires, and permits exactly one concurrent consumption", async () => {
  const harness = createHarness();
  const challenge = await harness.service.createChallenge(null, {});
  harness.identity.nonce = challenge.nonce;

  await assert.rejects(
    harness.service.authenticate({ credential: "credential", browserBinding: "x".repeat(43) }),
    { code: "GOOGLE_AUTHENTICATION_FAILED" },
  );
  const outcomes = await Promise.allSettled([
    harness.service.authenticate({ credential: "credential", browserBinding: challenge.binding }),
    harness.service.authenticate({ credential: "credential", browserBinding: challenge.binding }),
  ]);
  assert.equal(outcomes.filter(({ status }) => status === "fulfilled").length, 1);
  assert.equal(outcomes.filter(({ status }) => status === "rejected").length, 1);
  assert.equal(harness.sessions.length, 1);

  const expired = createHarness();
  const expiredChallenge = await expired.service.createChallenge(null, {});
  expired.identity.nonce = expiredChallenge.nonce;
  expired.advance(6 * 60 * 1000);
  await assert.rejects(
    expired.service.authenticate({ credential: "credential", browserBinding: expiredChallenge.binding }),
    { code: "GOOGLE_AUTHENTICATION_FAILED" },
  );
});

test("challenge issuance is transactionally rate limited by trusted source", async () => {
  const harness = createHarness();
  for (let index = 0; index < 10; index += 1) {
    await harness.service.createChallenge(null, {});
  }
  await assert.rejects(harness.service.createChallenge(null, {}), { code: "GOOGLE_AUTH_RATE_LIMITED" });
});

test("existing linked identity preserves USER id and updates only provider email snapshot", async () => {
  const harness = createHarness({ linked: true });
  const challenge = await harness.service.createChallenge(null, {});
  harness.identity.nonce = challenge.nonce;
  harness.identity.email = "changed@example.com";
  const result = await harness.service.authenticate({ credential: "credential", browserBinding: challenge.binding });
  assert.equal(result.user.id, "existing-user");
  assert.equal(result.user.email, "original@example.com");
  assert.deepEqual(harness.updatedIdentityEmails, ["changed@example.com"]);
});

test("email collision and ADMIN identity are rejected without duplicate account or session", async () => {
  const collision = createHarness({ emailCollision: true });
  let challenge = await collision.service.createChallenge(null, {});
  collision.identity.nonce = challenge.nonce;
  await assert.rejects(
    collision.service.authenticate({ credential: "credential", browserBinding: challenge.binding }),
    { code: "GOOGLE_ACCOUNT_LINK_REQUIRED" },
  );
  assert.equal(collision.createdUsers.length, 0);
  assert.equal(collision.sessions.length, 0);

  const admin = createHarness({ linked: true, linkedRole: "ADMIN" });
  challenge = await admin.service.createChallenge(null, {});
  admin.identity.nonce = challenge.nonce;
  await assert.rejects(
    admin.service.authenticate({ credential: "credential", browserBinding: challenge.binding }),
    { code: "GOOGLE_AUTHENTICATION_FAILED" },
  );
  assert.equal(admin.sessions.length, 0);
});

test("Google controller rejects foreign origins and uses protected binding/session cookies", async () => {
  let challengeCalls = 0;
  const controller = createAuthenticationController({
    authenticationService: {},
    googleAllowedOrigins: ["http://localhost:5173"],
    googleAuthenticationService: {
      async createChallenge() {
        challengeCalls += 1;
        return { nonce: "nonce", binding: "binding", expiresAt: new Date("2026-11-26T00:05:00.000Z") };
      },
      async authenticate() {
        return { user: { id: "user", email: "u@example.com", display_name: "U", role: "USER" }, sessionToken: "session" };
      },
    },
  });

  const foreign = responseHarness();
  await controller.createGoogleChallenge(requestHarness("https://attacker.invalid"), foreign.res, assert.fail);
  assert.equal(foreign.status, 403);
  assert.equal(challengeCalls, 0);

  const challenge = responseHarness();
  await controller.createGoogleChallenge(requestHarness("http://localhost:5173"), challenge.res, assert.fail);
  assert.equal(challenge.status, 201);
  assert.deepEqual(challenge.cookies[0], {
    name: "google_auth_binding",
    value: "binding",
    options: { httpOnly: true, maxAge: 300000, path: "/api/auth/google", sameSite: "strict", secure: false },
  });

  const login = responseHarness();
  await controller.googleLogin(requestHarness("http://localhost:5173"), login.res, assert.fail);
  assert.equal(login.status, 200);
  assert.equal(login.cookies.some(({ name, options }) => name === "session_id" && options.httpOnly && options.sameSite === "lax"), true);
});

function createHarness({ linked = false, linkedRole = "USER", emailCollision = false } = {}) {
  let currentTime = new Date("2026-11-26T00:00:00.000Z");
  const challenges = new Map();
  const sessions = [];
  const createdUsers = [];
  const createdIdentities = [];
  const updatedIdentityEmails = [];
  const identity = { subject: "google-subject", email: "learner@example.com", displayName: "Learner", nonce: "" };
  const challengeRepository = {
    async create({ nonce_hash, browser_binding_hash, source_key, expires_at, now }) {
      challenges.set(nonce_hash, { nonce_hash, browser_binding_hash, source_key, expires_at, issued_at: now, consumed: false });
    },
    async countRecentForSource(source_key, since) {
      return [...challenges.values()].filter((challenge) => challenge.source_key === source_key && challenge.issued_at > since).length;
    },
    async consume({ nonce_hash, browser_binding_hash, consumed_at }) {
      const challenge = challenges.get(nonce_hash);
      if (!challenge || challenge.browser_binding_hash !== browser_binding_hash || challenge.consumed || challenge.expires_at <= consumed_at) return { count: 0 };
      challenge.consumed = true;
      return { count: 1 };
    },
  };
  const existingUser = {
    id: "existing-user", email: "original@example.com", password_hash: "hash",
    display_name: "Existing", role: linkedRole, is_active: true,
  };
  const repositories = {
    challengeRepository,
    authIdentityRepository: {
      findGoogleIdentity: async () => linked ? { id: "identity", provider_email: "original@example.com", user: existingUser } : null,
      createGoogleIdentity: async (data) => { createdIdentities.push(data); },
      updateGoogleEmail: async (_id, email) => { updatedIdentityEmails.push(email); },
    },
    userRepository: {
      findByNormalizedEmail: async () => emailCollision ? existingUser : null,
      createGoogleUser: async ({ email, display_name }) => {
        const user = { id: "new-user", email, password_hash: null, display_name, role: "USER", is_active: true };
        createdUsers.push(user);
        return user;
      },
    },
    authSessionRepository: {
      createSession: async (session) => { sessions.push(session); },
    },
  };
  const service = createGoogleAuthenticationService({
    verifier: { verify: async () => ({ ...identity }) },
    withGoogleTransaction: async (callback) => callback(repositories),
    withChallengeTransaction: async (callback) => callback({
      challengeRepository,
      loginAbuseRepository: { lock: async () => undefined },
    }),
    loginAbuseKeys: { source: () => "b".repeat(64), identifier: () => "a".repeat(64) },
    now: () => new Date(currentTime),
  });
  return {
    service, identity, sessions, createdUsers, createdIdentities, updatedIdentityEmails,
    advance(milliseconds) { currentTime = new Date(currentTime.getTime() + milliseconds); },
  };
}

function requestHarness(origin) {
  return {
    body: { credential: "credential" },
    cookies: { google_auth_binding: "x".repeat(43) },
    get(name) { return name === "origin" ? origin : undefined; },
    secure: false,
  };
}

function responseHarness() {
  const state = { status: null, cookies: [] };
  state.res = {
    cookie(name, value, options) { state.cookies.push({ name, value, options }); },
    clearCookie(name, options) { state.cookies.push({ name, value: null, options }); },
    set() {},
    status(status) { state.status = status; return this; },
    json(body) { state.body = body; return this; },
  };
  Object.defineProperty(state, "status", {
    get() { return state._status; },
    set(value) { state._status = value; },
  });
  return state;
}
