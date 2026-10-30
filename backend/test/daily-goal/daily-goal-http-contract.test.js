import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createDailyGoalController } from "../../src/controllers/daily-goal-controller.js";
import { createAuthenticationMiddleware } from "../../src/middleware/authentication-middleware.js";
import { createRoleAuthorizationMiddleware } from "../../src/middleware/role-authorization-middleware.js";
import { createDailyGoalRouter, createNotificationRouter } from "../../src/routes/daily-goal-routes.js";

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

test("notification router directly installs authentication and USER authorization middleware", async () => {
  const authentication = createAuthenticationMiddleware({ authenticationService: { getCurrentUser: async () => ({ id: USER, role: "ADMIN" }) } });
  const authorizeUser = createRoleAuthorizationMiddleware({ allowedRoles: ["USER"] });
  const router = createNotificationRouter({
    controller: {
      listNotifications: assertNoNext,
      countUnreadNotifications: assertNoNext,
      markNotificationRead: assertNoNext,
    },
    authenticationMiddleware: authentication,
    userAuthorizationMiddleware: authorizeUser,
  });
  const installedMiddleware = router.stack.filter((layer) => !layer.route).map((layer) => layer.handle);
  assert.deepEqual(installedMiddleware, [authentication, authorizeUser]);
  assert.deepEqual(router.stack.filter((layer) => layer.route).map((layer) => ({
    path: layer.route.path,
    methods: Object.keys(layer.route.methods),
  })), [
    { path: "/", methods: ["get"] },
    { path: "/unread-count", methods: ["get"] },
    { path: "/:id/read", methods: ["patch"] },
  ]);

  const unauthenticated = response();
  await installedMiddleware[0]({ cookies: {} }, unauthenticated, assertNoNext);
  assert.equal(unauthenticated.statusCode, 401);
  const request = { cookies: { session_id: "opaque" } };
  await installedMiddleware[0](request, response(), assertNoNext);
  const forbidden = response();
  installedMiddleware[1](request, forbidden, assertNoNext);
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

test("goal GET and PUT expose only PLAN 8.1 DTO keys", async () => {
  const goal = goalResult();
  const controller = createDailyGoalController({ dailyGoalService: {
    ...fakeService(() => ({ value: internalResult(false) })),
    getGoal: async () => ({ ...goal, internal_receipt: "hidden" }),
    updateGoal: async () => ({ ...goal, reward: { earned_now: true, xp_earned: 10, secret: true }, replayed: true }),
  } });
  const get = response();
  await controller.getGoal({ user: { id: USER } }, get, assertNoNext);
  assert.deepEqual(Object.keys(get.body.data), ["application_date", "target_minutes", "active_seconds", "actual_minutes", "completed", "reward_earned", "reminder_enabled", "xp_level"]);
  const put = response();
  await controller.updateGoal({ user: { id: USER }, body: {} }, put, assertNoNext);
  assert.deepEqual(Object.keys(put.body.data), [...Object.keys(get.body.data), "reward"]);
  assert.deepEqual(put.body.data.reward, { earned_now: true, xp_earned: 10 });
});

test("reminder preference controller derives owner, exposes only PLAN 8.1 keys, and maps safe errors", async () => {
  let captured;
  const controller = createDailyGoalController({ dailyGoalService: {
    updateReminderPreference: async (userId, body) => {
      captured = { userId, body };
      return { reminder_enabled: body.enabled, updated_at: "2026-10-30T00:00:00.000Z", replayed: false, secret: true };
    },
  } });
  const res = response();
  const body = { operation_id: USER, enabled: false };
  await controller.updateReminderPreference({ user: { id: USER }, body }, res, assertNoNext);
  assert.deepEqual(captured, { userId: USER, body });
  assert.deepEqual(res.body.data, { reminder_enabled: false, updated_at: "2026-10-30T00:00:00.000Z" });

  for (const [code, status] of [
    ["DAILY_GOAL_VALIDATION_ERROR", 400], ["DAILY_GOAL_NOT_FOUND", 404], ["OPERATION_CONFLICT", 409],
  ]) {
    const failing = createDailyGoalController({ dailyGoalService: { updateReminderPreference: async () => { const error = new Error("Safe preference failure."); error.code = code; throw error; } } });
    const failure = response();
    await failing.updateReminderPreference({ user: { id: USER }, body }, failure, assertNoNext);
    assert.equal(failure.statusCode, status);
    assert.equal(failure.body.error.code, code);
  }
});

test("reminder preference route uses exact PUT path and existing USER middleware", async () => {
  const authentication = createAuthenticationMiddleware({ authenticationService: { getCurrentUser: async () => ({ id: USER, role: "ADMIN" }) } });
  const authorizeUser = createRoleAuthorizationMiddleware({ allowedRoles: ["USER"] });
  const noop = (_req, _res, next) => next?.();
  const router = createDailyGoalRouter({
    controller: {
      getGoal: noop, updateGoal: noop, updateReminderPreference: noop,
      establish: noop, engage: noop, heartbeat: noop, pause: noop, close: noop,
    },
    authenticationMiddleware: authentication,
    userAuthorizationMiddleware: authorizeUser,
  });
  const installedMiddleware = router.stack.filter((layer) => !layer.route).map((layer) => layer.handle);
  assert.deepEqual(installedMiddleware, [authentication, authorizeUser]);
  assert.deepEqual(router.stack.filter((layer) => layer.route && layer.route.path === "/reminder-preference").map((layer) => ({
    path: layer.route.path,
    methods: Object.keys(layer.route.methods),
  })), [{ path: "/reminder-preference", methods: ["put"] }]);

  const unauthenticated = response();
  await installedMiddleware[0]({ cookies: {} }, unauthenticated, assertNoNext);
  assert.equal(unauthenticated.statusCode, 401);
  const request = { cookies: { session_id: "opaque" } };
  await installedMiddleware[0](request, response(), assertNoNext);
  const forbidden = response();
  installedMiddleware[1](request, forbidden, assertNoNext);
  assert.equal(forbidden.statusCode, 403);
});

test("notification controllers expose only PLAN 8.4 DTO keys and safe errors", async () => {
  const item = notificationResult();
  const controller = createDailyGoalController({ dailyGoalService: {
    listNotifications: async () => ({ items: [{ ...item, secret: "hidden" }], unread_count: 1, next_cursor: "opaque", secret: true }),
    countUnreadNotifications: async () => ({ unread_count: 1, secret: true }),
    markNotificationRead: async () => ({ notification: { ...item, secret: "hidden" }, unread_count: 0 }),
  } });
  const list = response();
  await controller.listNotifications({ user: { id: USER }, query: {} }, list, assertNoNext);
  assert.deepEqual(Object.keys(list.body.data), ["items", "unread_count", "next_cursor"]);
  assert.deepEqual(Object.keys(list.body.data.items[0]), ["id", "type", "title", "body", "application_date", "created_at", "read_at"]);
  const count = response();
  await controller.countUnreadNotifications({ user: { id: USER } }, count, assertNoNext);
  assert.deepEqual(count.body.data, { unread_count: 1 });
  const read = response();
  await controller.markNotificationRead({ user: { id: USER }, params: { id: USER }, body: { read: true } }, read, assertNoNext);
  assert.deepEqual(Object.keys(read.body.data), [...Object.keys(item), "unread_count"]);

  for (const [code, status] of [["VALIDATION_ERROR", 400], ["NOT_FOUND", 404]]) {
    const failing = createDailyGoalController({ dailyGoalService: { listNotifications: async () => { const error = new Error("Safe notification failure."); error.code = code; throw error; } } });
    const res = response();
    await failing.listNotifications({ user: { id: USER }, query: {} }, res, assertNoNext);
    assert.equal(res.statusCode, status);
    assert.equal(res.body.error.code, code);
  }
});

test("production route source mounts goal, tracking and notification operations behind USER middleware", async () => {
  const source = await readFile(new URL("../../src/routes/daily-goal-routes.js", import.meta.url), "utf8");
  assert.match(source, /router\.use\(authenticationMiddleware, userAuthorizationMiddleware\)/);
  assert.ok(source.includes('router.get("/", controller.getGoal)'));
  assert.ok(source.includes('router.put("/", controller.updateGoal)'));
  assert.ok(source.includes('router.put("/reminder-preference", controller.updateReminderPreference)'));
  for (const [path, controller] of [
    ['"/tracking-sessions"', "controller.establish"],
    ['"/tracking-sessions/:id/engagement"', "controller.engage"],
    ['"/tracking-sessions/:id/heartbeat"', "controller.heartbeat"],
    ['"/tracking-sessions/:id/pause"', "controller.pause"],
    ['"/tracking-sessions/:id/close"', "controller.close"],
  ]) assert.ok(source.includes(`router.post(${path}, ${controller})`));
  assert.ok(source.includes("export function createNotificationRouter"));
  assert.ok(source.includes('router.get("/", controller.listNotifications)'));
  assert.ok(source.includes('router.get("/unread-count", controller.countUnreadNotifications)'));
  assert.ok(source.includes('router.patch("/:id/read", controller.markNotificationRead)'));
  const appSource = await readFile(new URL("../../src/create-app.js", import.meta.url), "utf8");
  assert.ok(appSource.includes('app.use("/api/notifications", notificationRouter)'));
  assert.doesNotMatch(source, /scheduler/i);
});

function fakeService(next) {
  return {
    getGoal: async () => goalResult(), updateGoal: async () => ({ ...goalResult(), reward: { earned_now: false, xp_earned: 0 } }),
    updateReminderPreference: async () => ({ reminder_enabled: true, updated_at: "2026-10-30T00:00:00.000Z" }),
    establish: async () => { const result = next(); if (result?.code) { const error = new Error("Safe Daily Goal failure."); Object.assign(error, result); throw error; } return result.value; },
    engage: async () => ({}), heartbeat: async () => ({}), pause: async () => ({}), close: async () => ({}),
  };
}
function goalResult() { return { application_date: "2026-10-26", target_minutes: 10, active_seconds: 600, actual_minutes: 10, completed: true, reward_earned: true, reminder_enabled: true, xp_level: { total_xp: 10, level: 1, level_min_xp: 0, next_level_xp: 50, is_max_level: false } }; }
function notificationResult() { return { id: USER, type: "DAILY_GOAL_COMPLETED", title: "Daily Goal completed", body: "Completed", application_date: "2026-10-26", created_at: "2026-10-26T00:00:00.000Z", read_at: null }; }
function internalResult(replayed) { return { tracking_session_id: USER, status: "ACTIVE", owner: false, generation: null, lease_expires_at: null, engagement_expires_at: null, credited_milliseconds: "0", projection: { credited_milliseconds: "0" }, replayed, internal_receipt: "not-public" }; }
function response() { return { statusCode: null, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } }; }
function assertNoNext(error) { if (error) assert.fail(`Unexpected next(error): ${error.message}`); }
