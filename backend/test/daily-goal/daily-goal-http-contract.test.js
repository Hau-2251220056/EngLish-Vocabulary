import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createDailyGoalController } from "../../src/controllers/daily-goal-controller.js";
import { createAuthenticationMiddleware } from "../../src/middleware/authentication-middleware.js";
import { createRoleAuthorizationMiddleware } from "../../src/middleware/role-authorization-middleware.js";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

test("existing middleware enforces 401 and USER-only 403 before a tracking handler", async () => {
  const authentication = createAuthenticationMiddleware({ authenticationService: { getCurrentUser: async () => ({ id: USER, role: "ADMIN" }) } });
  const authorizeUser = createRoleAuthorizationMiddleware({ allowedRoles: ["USER"] });
  const unauthenticated = response();
  await authentication({ cookies: {} }, unauthenticated, assertNoNext);
  assert.equal(unauthenticated.statusCode, 401);
  const request = { cookies: { session_id: "opaque" } };
  await authentication(request, response(), assertNoNext);
  const forbidden = response();
  authorizeUser(request, forbidden, assertNoNext);
  assert.equal(forbidden.statusCode, 403);
});

test("controller maps create/replay and safe 400/404/409 envelopes", async () => {
  const outcomes = [
    { value: internalResult(false) },
    { value: internalResult(true) },
    { code: "DAILY_GOAL_NOT_FOUND" },
    { code: "DAILY_GOAL_VALIDATION_ERROR" },
    { code: "TRACKING_OWNERSHIP_CONFLICT", details: { owner: false, current_generation: "2", retry_after_ms: 0 } },
  ];
  const controller = createDailyGoalController({ dailyGoalService: fakeService(() => outcomes.shift()) });
  const statuses = [];
  for (let i = 0; i < 5; i++) {
    const res = response();
    await controller.establish({ user: { id: USER }, body: {} }, res, assertNoNext);
    statuses.push(res.statusCode);
    assert.equal(res.body.success, i < 2);
    if (i < 2) {
      assert.deepEqual(Object.keys(res.body.data), ["tracking_session_id", "status", "owner", "generation", "projection"]);
      assert.equal(Object.hasOwn(res.body.data, "replayed"), false);
      assert.equal(Object.hasOwn(res.body.data, "dg1Passed"), false);
    }
  }
  assert.deepEqual(statuses, [201, 200, 404, 400, 409]);
});

test("endpoint-specific DTO builders expose only PLAN 8.2 keys", async () => {
  const result = internalResult(false);
  const service = {
    establish: async () => result, engage: async () => result, heartbeat: async () => result,
    pause: async () => result, close: async () => result,
  };
  const controller = createDailyGoalController({ dailyGoalService: service });
  const expected = {
    engage: ["tracking_session_id", "status", "owner", "generation", "lease_expires_at", "engagement_expires_at", "projection"],
    heartbeat: ["tracking_session_id", "status", "owner", "generation", "lease_expires_at", "engagement_expires_at", "credited_milliseconds", "projection"],
    pause: ["status", "owner", "projection"], close: ["status", "owner", "projection"],
  };
  for (const name of Object.keys(expected)) {
    const res = response();
    await controller[name]({ user: { id: USER }, params: { id: USER }, body: {} }, res, assertNoNext);
    assert.deepEqual(Object.keys(res.body.data), expected[name]);
    assert.equal(Object.hasOwn(res.body.data, "replayed"), false);
    assert.equal(Object.hasOwn(res.body.data, "dg1Passed"), false);
  }
});

test("production route source mounts only the five approved USER-protected tracking operations", async () => {
  const source = await readFile(new URL("../../src/routes/daily-goal-routes.js", import.meta.url), "utf8");
  assert.match(source, /router\.use\(authenticationMiddleware, userAuthorizationMiddleware\)/);
  for (const [path, controller] of [
    ['"/tracking-sessions"', "controller.establish"],
    ['"/tracking-sessions/:id/engagement"', "controller.engage"],
    ['"/tracking-sessions/:id/heartbeat"', "controller.heartbeat"],
    ['"/tracking-sessions/:id/pause"', "controller.pause"],
    ['"/tracking-sessions/:id/close"', "controller.close"],
  ]) assert.ok(source.includes(`router.post(${path}, ${controller})`));
  assert.doesNotMatch(source, /reward|reminder|notification|scheduler/i);
});

function fakeService(next) {
  return {
    establish: async () => { const result = next(); if (result?.code) { const error = new Error("Safe Daily Goal failure."); Object.assign(error, result); throw error; } return result.value; },
    engage: async () => ({}), heartbeat: async () => ({}), pause: async () => ({}), close: async () => ({}),
  };
}
function internalResult(replayed) { return { tracking_session_id: USER, status: "ACTIVE", owner: false, generation: null, lease_expires_at: null, engagement_expires_at: null, credited_milliseconds: "0", projection: { credited_milliseconds: "0" }, replayed, internal_receipt: "not-public" }; }
function response() { return { statusCode: null, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } }; }
function assertNoNext(error) { if (error) assert.fail(`Unexpected next(error): ${error.message}`); }
