import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createLearningPathController } from "../../src/controllers/learning-path-controller.js";
import { createAuthenticationMiddleware } from "../../src/middleware/authentication-middleware.js";
import { createRoleAuthorizationMiddleware } from "../../src/middleware/role-authorization-middleware.js";

const USER_ID = "00000000-0000-4000-8000-000000000001";
const SET_ID = "00000000-0000-4000-8000-000000000002";
const PASS_ID = "00000000-0000-4000-8000-000000000003";
const OPERATION_ID = "00000000-0000-4000-8000-000000000004";

test("controller derives identity from req.user and preserves approved success statuses", async () => {
  const calls = [];
  const service = serviceDouble(calls);
  const controller = createLearningPathController({ learningPathService: service });
  const cases = [
    [controller.readPath, request(), 200],
    [controller.startPass, request({ setId: SET_ID }), 201],
    [controller.readPass, request({ passId: PASS_ID }), 200],
    [controller.createNextSession, request({ passId: PASS_ID }), 201],
    [controller.restartPass, request({ passId: PASS_ID }), 201],
    [controller.completePass, request({ passId: PASS_ID }), 200],
  ];
  for (const [handler, req, expectedStatus] of cases) {
    const res = response();
    await handler(req, res, failOnNext);
    assert.equal(res.statusCode, expectedStatus);
    assert.equal(res.body.success, true);
  }
  assert.ok(calls.every((call) => call.userId === USER_ID));
  assert.ok(calls.filter((call) => call.input).every((call) => (
    Object.keys(call.input).length === 1 && call.input.operation_id === OPERATION_ID
  )));
});

test("read path preserves recommendation and exposes additive next suggestion fields", async () => {
  const projection = {
    recommendation: { action: "RESUME", set_id: SET_ID, pass_id: PASS_ID },
    next_suggestion: { action: "START", set_id: OPERATION_ID, pass_id: null },
    next_suggestion_reason: null,
  };
  const controller = createLearningPathController({
    learningPathService: { getPath: async () => projection },
  });
  const res = response();
  await controller.readPath(request(), res, failOnNext);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.data, projection);
});

test("controller maps stable validation, concealment, lock and conflict errors", async () => {
  const expected = [
    ["CEFR_PATH_VALIDATION_ERROR", 400],
    ["CEFR_PASS_NOT_FOUND", 404],
    ["CEFR_LEVEL_LOCKED", 403],
    ["CEFR_CURRICULUM_NOT_CONFIGURED", 409],
    ["CEFR_PASS_RESTART_REQUIRED", 409],
    ["CEFR_PASS_INCOMPLETE", 409],
    ["CEFR_PASS_OPERATION_CONFLICT", 409],
  ];
  for (const [code, status] of expected) {
    const controller = createLearningPathController({
      learningPathService: { getPath: async () => { throw Object.assign(new Error(code), { code }); } },
    });
    const res = response();
    await controller.readPath(request(), res, failOnNext);
    assert.equal(res.statusCode, status);
    assert.deepEqual(res.body.error, { code, message: code });
  }
});

test("router statically applies authentication and USER role before exactly six approved routes", async () => {
  const source = await readFile(new URL("../../src/routes/learning-path-routes.js", import.meta.url), "utf8");
  assert.match(source, /router\.use\(authenticationMiddleware, userAuthorizationMiddleware\)/);
  const registrations = [...source.matchAll(/router\.(get|post)\("([^"]+)"/g)]
    .map((match) => [match[1], match[2]]);
  assert.deepEqual(registrations, [
    ["get", "/"],
    ["post", "/sets/:setId/passes"],
    ["get", "/passes/:passId"],
    ["post", "/passes/:passId/sessions"],
    ["post", "/passes/:passId/restart"],
    ["post", "/passes/:passId/complete"],
  ]);
});

test("Learning Path middleware contract returns Guest 401 and ADMIN 403", async () => {
  const guestResponse = response();
  const authenticate = createAuthenticationMiddleware({ authenticationService: { getCurrentUser: async () => null } });
  await authenticate({ cookies: {} }, guestResponse, failOnNext);
  assert.equal(guestResponse.statusCode, 401);
  assert.equal(guestResponse.body.error.code, "AUTHENTICATION_FAILED");

  const adminResponse = response();
  const authorizeUser = createRoleAuthorizationMiddleware({ allowedRoles: ["USER"] });
  authorizeUser({ user: { role: "ADMIN" } }, adminResponse, failOnNext);
  assert.equal(adminResponse.statusCode, 403);
  assert.equal(adminResponse.body.error.code, "FORBIDDEN");
});

test("application wiring mounts Learning Path and injects shared authorization into all activity services", async () => {
  const source = await readFile(new URL("../../src/create-app.js", import.meta.url), "utf8");
  assert.match(source, /app\.use\("\/api\/learning-path", learningPathRouter\)/);
  assert.match(source, /createLearningPathActivityAuthorizer\(\{\s*createLearningPathRepository,?\s*\}\)/);
  assert.equal((source.match(/authorizeSetActivity,/g) ?? []).length, 3);
});

test("repository scopes active contexts to unexpired SET NORMAL and SRS sessions", async () => {
  const source = await readFile(new URL("../../src/repositories/learning-path-repository.js", import.meta.url), "utf8");
  assert.match(source, /listCurrentCurriculum\(userId\)[\s\S]*where: \{ is_public: true, cefr_level: \{ in: LEVELS \} \}/);
  assert.match(source, /listActiveSetContexts\(userId, evaluatedAt\)/);
  assert.match(source, /status: "ACTIVE"/);
  assert.match(source, /expires_at: \{ gt: cloneDate\(evaluatedAt\) \}/);
  assert.match(source, /scope: "SET"/);
  assert.match(source, /mode: \{ in: \["NORMAL", "SRS"\] \}/);
  assert.match(source, /set_id_snapshot: \{ not: null \}/);
  assert.doesNotMatch(source, /mode: \{ in: \["NORMAL", "SRS", "QUIZ"\] \}/);
});

function serviceDouble(calls) {
  const record = (name, userId, setOrPassId, input) => {
    calls.push({ name, userId, setOrPassId, input });
    return { replayed: false, session: {}, pass: {} };
  };
  return {
    getPath: async (userId) => record("getPath", userId),
    startPass: async (userId, setId, input) => record("startPass", userId, setId, input),
    readPass: async (userId, passId) => record("readPass", userId, passId),
    createNextSession: async (userId, passId, input) => record("createNextSession", userId, passId, input),
    restartPass: async (userId, passId, input) => record("restartPass", userId, passId, input),
    completePass: async (userId, passId, input) => record("completePass", userId, passId, input),
  };
}

function request(params = {}) {
  return { user: { id: USER_ID }, params, body: { operation_id: OPERATION_ID } };
}

function response() {
  return {
    statusCode: null, body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function failOnNext(error) { throw error; }
