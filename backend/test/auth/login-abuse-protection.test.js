import assert from "node:assert/strict";
import test from "node:test";
import { createLoginAbuseRepository } from "../../src/repositories/login-abuse-repository.js";
import { createLoginAbuseKeyFactory, resolveClientAddress } from "../../src/security/login-abuse-keys.js";
import { createAuthenticationService } from "../../src/services/authentication-service.js";

const SECRET = "offline-test-login-abuse-secret-32-characters";
const SOURCE = Object.freeze({ socket: { remoteAddress: "203.0.113.10" }, headers: {} });

test("advisory lock executes the void-returning query with one bound identifier key", async () => {
  const calls = [];
  const repository = createLoginAbuseRepository({
    async $executeRaw(strings, ...values) {
      calls.push({ sql: strings.join("?"), values });
      return 1;
    },
    async $queryRaw() {
      assert.fail("Advisory lock must not use $queryRaw for a void result.");
    },
  });

  await repository.lock("fixed-identifier-key", "unused-source-key");

  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /pg_advisory_xact_lock\(hashtextextended\(\?, 0\)\)/);
  assert.deepEqual(calls[0].values, ["fixed-identifier-key"]);
});

test("failures 1-5 use generic, warning, warning, then five-minute lock contracts", async () => {
  const harness = createHarness();
  harness.addUser({ email: "learner@example.test", password: "correct", role: "USER" });

  const errors = [];
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    errors.push(await failedLogin(harness.service(), "LEARNER@EXAMPLE.TEST", "wrong"));
  }

  assert.deepEqual(errors.map(({ code }) => code), [
    "AUTHENTICATION_FAILED",
    "AUTHENTICATION_FAILED",
    "AUTHENTICATION_WARNING",
    "AUTHENTICATION_WARNING",
    "AUTHENTICATION_LOCKED",
  ]);
  assert.deepEqual(errors.slice(2, 4).map(({ details }) => details.attempts_remaining), [2, 1]);
  assert.equal(errors[4].details.retry_after_seconds, 300);
  assert.deepEqual([...harness.states.values()].map(({ failure_count }) => failure_count), [5]);
  assert.equal(harness.sessions.length, 0);
});

test("unexpected errors roll back partial failure-state writes", async () => {
  const harness = createHarness();
  harness.addUser({ email: "learner@example.test", password: "correct", role: "USER" });
  const unexpected = new Error("simulated persistence failure");
  harness.failNextSave(unexpected);

  await assert.rejects(
    harness.service().login({
      email: "learner@example.test",
      password: "wrong",
      source: SOURCE,
    }),
    (error) => error === unexpected,
  );
  assert.equal(harness.states.size, 0);
  assert.equal(harness.sessions.length, 0);

  const next = await failedLogin(harness.service(), "learner@example.test", "wrong");
  assert.equal(next.code, "AUTHENTICATION_FAILED");
  assert.deepEqual([...harness.states.values()].map(({ failure_count }) => failure_count), [1]);
});

test("active lock blocks password verification, expiry permits login, and success resets every source", async () => {
  const harness = createHarness();
  harness.addUser({ email: "admin@example.test", password: "correct", role: "ADMIN" });
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await failedLogin(harness.service(), "admin@example.test", "wrong");
  }
  const verificationCount = harness.verificationCount;
  const locked = await failedLogin(harness.service(), "admin@example.test", "correct");
  assert.equal(locked.code, "AUTHENTICATION_LOCKED");
  assert.equal(harness.verificationCount, verificationCount);

  harness.advance(5 * 60 * 1000);
  const result = await harness.service().login({
    email: "admin@example.test",
    password: "correct",
    source: SOURCE,
  });
  assert.equal(result.user.role, "ADMIN");
  assert.equal(harness.states.size, 0);
  assert.equal(harness.sessions.length, 1);

  const next = await failedLogin(harness.service(), "admin@example.test", "wrong");
  assert.equal(next.code, "AUTHENTICATION_FAILED");
});

test("two service instances share state and concurrent failures serialize without lost updates", async () => {
  const harness = createHarness();
  harness.addUser({ email: "user@example.test", password: "correct", role: "USER" });
  const first = harness.service();
  const second = harness.service();

  const errors = await Promise.all(Array.from({ length: 5 }, (_, index) => (
    failedLogin(index % 2 === 0 ? first : second, "user@example.test", `wrong-${index}`)
  )));
  assert.deepEqual(errors.map(({ code }) => code).sort(), [
    "AUTHENTICATION_FAILED",
    "AUTHENTICATION_FAILED",
    "AUTHENTICATION_LOCKED",
    "AUTHENTICATION_WARNING",
    "AUTHENTICATION_WARNING",
  ].sort());
  assert.deepEqual([...harness.states.values()].map(({ failure_count }) => failure_count), [5]);
});

test("unknown and inactive accounts receive equivalent state and privacy-safe errors", async () => {
  const harness = createHarness();
  harness.addUser({ email: "inactive@example.test", password: "correct", role: "USER", is_active: false });
  const unknown = [];
  const inactive = [];
  for (let attempt = 0; attempt < 3; attempt += 1) {
    unknown.push(await failedLogin(harness.service(), "unknown@example.test", "secret-marker"));
    inactive.push(await failedLogin(harness.service(), "inactive@example.test", "secret-marker"));
  }
  assert.deepEqual(unknown.map(publicError), inactive.map(publicError));
  const serialized = JSON.stringify([...unknown, ...inactive]);
  for (const secret of ["unknown@example.test", "inactive@example.test", "secret-marker"]) {
    assert.equal(serialized.includes(secret), false);
  }
  for (const key of harness.states.keys()) assert.match(key, /^[a-f0-9]{64}:[a-f0-9]{64}$/);
});

test("source isolation prevents one network source from globally locking the account", async () => {
  const harness = createHarness();
  harness.addUser({ email: "user@example.test", password: "correct", role: "USER" });
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await failedLogin(harness.service(), "user@example.test", "wrong", SOURCE);
  }
  const otherSource = { socket: { remoteAddress: "203.0.113.11" }, headers: {} };
  const result = await harness.service().login({
    email: "user@example.test",
    password: "correct",
    source: otherSource,
  });
  assert.equal(result.user.role, "USER");
  assert.equal(harness.states.size, 0);
});

test("client address trust is explicit and forwarding headers are ignored in direct mode", () => {
  const request = {
    socket: { remoteAddress: "::ffff:127.0.0.1" },
    headers: { "x-forwarded-for": "198.51.100.5, 10.0.0.1" },
  };
  assert.equal(resolveClientAddress(request, "direct"), "127.0.0.1");
  assert.equal(resolveClientAddress(request, "render"), "198.51.100.5");
  assert.equal(resolveClientAddress({
    socket: {},
    headers: { "x-vercel-forwarded-for": "198.51.100.6" },
  }, "vercel"), "198.51.100.6");
  assert.throws(() => resolveClientAddress({
    socket: {},
    headers: { "x-vercel-forwarded-for": "198.51.100.6, 10.0.0.1" },
  }, "vercel"), /valid trusted client address/);
  assert.throws(
    () => resolveClientAddress({ socket: {}, headers: { "x-forwarded-for": "spoofed" } }, "render"),
    /valid trusted client address/,
  );
  assert.throws(
    () => createLoginAbuseKeyFactory({ secret: "short", proxyMode: "render" }),
    /at least 32/,
  );
});

function createHarness() {
  const users = new Map();
  const states = new Map();
  const sessions = [];
  const tails = new Map();
  let instant = new Date("2026-11-19T00:00:00.000Z");
  let verificationCount = 0;
  let nextSaveError = null;

  const userRepository = {
    async findByNormalizedEmail(email) { return users.get(email) ?? null; },
  };
  async function withLoginTransaction(callback) {
    let release = () => {};
    let transactionStates;
    const touchedStateKeys = new Set();
    const deletedIdentifierPrefixes = new Set();
    const transactionSessions = [];
    const repository = {
      async lock(identifierKey, sourceKey) {
        const key = identifierKey;
        const previous = tails.get(key) ?? Promise.resolve();
        let unlock;
        const gate = new Promise((resolve) => { unlock = resolve; });
        tails.set(key, previous.then(() => gate));
        await previous;
        transactionStates = new Map(
          [...states].map(([stateKey, value]) => [stateKey, { ...value }]),
        );
        release = () => { unlock(); if (tails.get(key) === gate) tails.delete(key); };
      },
      async find(identifierKey, sourceKey) {
        return transactionStates.get(`${identifierKey}:${sourceKey}`) ?? null;
      },
      async save(value) {
        const stateKey = `${value.identifierKey}:${value.sourceKey}`;
        transactionStates.set(stateKey, {
          failure_count: value.failureCount,
          last_failed_at: value.lastFailedAt,
          blocked_until: value.blockedUntil,
        });
        touchedStateKeys.add(stateKey);
        if (nextSaveError) {
          const error = nextSaveError;
          nextSaveError = null;
          throw error;
        }
      },
      async delete(identifierKey, sourceKey) {
        const stateKey = `${identifierKey}:${sourceKey}`;
        transactionStates.delete(stateKey);
        touchedStateKeys.add(stateKey);
      },
      async deleteForIdentifier(identifierKey) {
        const prefix = `${identifierKey}:`;
        deletedIdentifierPrefixes.add(prefix);
        for (const key of [...transactionStates.keys()]) {
          if (key.startsWith(prefix)) transactionStates.delete(key);
        }
      },
    };
    const transactionalSessions = {
      async createSession(session) {
        transactionSessions.push(session);
        return session;
      },
    };
    try {
      const result = await callback({
        userRepository,
        authSessionRepository: transactionalSessions,
        loginAbuseRepository: repository,
      });
      for (const prefix of deletedIdentifierPrefixes) {
        for (const key of [...states.keys()]) if (key.startsWith(prefix)) states.delete(key);
      }
      for (const key of touchedStateKeys) {
        if (transactionStates.has(key)) states.set(key, transactionStates.get(key));
        else states.delete(key);
      }
      sessions.push(...transactionSessions);
      return result;
    } finally {
      release();
    }
  }

  return {
    users,
    states,
    sessions,
    get verificationCount() { return verificationCount; },
    failNextSave(error) { nextSaveError = error; },
    addUser({ email, password, role, is_active = true }) {
      users.set(email, { id: email, email, password_hash: password, display_name: role, role, is_active });
    },
    advance(milliseconds) { instant = new Date(instant.getTime() + milliseconds); },
    service() {
      return createAuthenticationService({
        userRepository,
        authSessionRepository: {},
        loginAbuseKeys: createLoginAbuseKeyFactory({ secret: SECRET }),
        withLoginTransaction,
        passwordSecurity: {
          async verifyPassword(password, hash) { verificationCount += 1; return password === hash; },
        },
        now: () => new Date(instant),
      });
    },
  };
}

async function failedLogin(service, email, password, source = SOURCE) {
  try {
    await service.login({ email, password, source });
    assert.fail("Expected login to fail.");
  } catch (error) {
    return error;
  }
}

function publicError(error) {
  return { code: error.code, message: error.message, details: error.details };
}
