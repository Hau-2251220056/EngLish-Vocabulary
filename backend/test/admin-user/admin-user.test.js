import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import cookieParser from "cookie-parser";
import express from "express";
import { createAdminUserController } from "../../src/controllers/admin-user-controller.js";
import { createAuthenticationMiddleware } from "../../src/middleware/authentication-middleware.js";
import { createRoleAuthorizationMiddleware } from "../../src/middleware/role-authorization-middleware.js";
import { createAdminUserRepository } from "../../src/repositories/admin-user-repository.js";
import { createAdminUserRouter } from "../../src/routes/admin-user-routes.js";
import { createAdminUserService } from "../../src/services/admin-user-service.js";
import { startHttpTestServer } from "../helpers/http-test-server.js";

const USER_ID = "00000000-0000-4000-8000-000000000001";
const ADMIN_ID = "00000000-0000-4000-8000-000000000002";
const OLDER_USER_ID = "00000000-0000-4000-8000-000000000003";
const EVALUATED_AT = new Date("2026-01-04T05:00:00.000Z");
const streakDates = new Map([
  [USER_ID, ["2026-01-03", "2026-01-02"]],
  [OLDER_USER_ID, []],
]);
const records = [
  user({ id: USER_ID, display_name: "An Nguyễn", email: "an@example.test", role: "USER", created_at: "2026-01-03T00:00:00.000Z" }),
  user({ id: ADMIN_ID, display_name: "System Admin", email: "admin@example.test", role: "ADMIN", created_at: "2026-01-02T00:00:00.000Z" }),
  user({ id: OLDER_USER_ID, display_name: "AN Older", email: "older@example.test", role: "USER", created_at: "2026-01-01T00:00:00.000Z" }),
];

let http;

before(async () => {
  const repository = inMemoryRepository(records, streakDates);
  const service = createAdminUserService({ adminUserRepository: repository, now: () => EVALUATED_AT });
  const controller = createAdminUserController({ adminUserService: service });
  const authenticationMiddleware = createAuthenticationMiddleware({
    authenticationService: {
      async getCurrentUser(token) {
        if (token === "admin-session") return { id: ADMIN_ID, role: "ADMIN" };
        if (token === "user-session") return { id: USER_ID, role: "USER" };
        const error = new Error("Authentication failed.");
        error.code = "AUTHENTICATION_FAILED";
        throw error;
      },
    },
  });
  const adminAuthorizationMiddleware = createRoleAuthorizationMiddleware({ allowedRoles: ["ADMIN"] });
  const app = express();
  app.use(cookieParser());
  app.use("/api/admin/users", createAdminUserRouter({
    adminUserController: controller,
    authenticationMiddleware,
    adminAuthorizationMiddleware,
  }));
  http = await startHttpTestServer(app);
});

after(async () => http?.close());

test("Admin User routes enforce authentication and ADMIN authorization", async () => {
  const guest = await http.request("/api/admin/users");
  assert.equal(guest.status, 401);
  assert.equal(guest.json.error.code, "AUTHENTICATION_FAILED");

  const normalUser = await requestAs("USER", "/api/admin/users");
  assert.equal(normalUser.status, 403);
  assert.equal(normalUser.json.error.code, "FORBIDDEN");

  const admin = await requestAs("ADMIN", "/api/admin/users");
  assert.equal(admin.status, 200);
  assert.equal(admin.json.success, true);
});

test("list returns filtered, stably ordered server-side pagination metadata", async () => {
  const response = await requestAs("ADMIN", "/api/admin/users?query=AN&role=USER&page=1&page_size=1");
  assert.equal(response.status, 200);
  assert.deepEqual(response.json.data.items.map(({ id }) => id), [USER_ID]);
  assert.equal(response.json.data.items[0].current_streak, 2);
  assert.deepEqual(response.json.data.pagination, {
    page: 1,
    page_size: 1,
    total_items: 2,
    total_pages: 2,
  });
  assert.deepEqual(response.json.data.filters, { query: "AN", role: "USER" });

  const secondPage = await requestAs("ADMIN", "/api/admin/users?query=an&role=USER&page=2&page_size=1");
  assert.deepEqual(secondPage.json.data.items.map(({ id }) => id), [OLDER_USER_ID]);
});

test("list defaults, email search, empty result, and case-insensitive matching are correct", async () => {
  const defaults = await requestAs("ADMIN", "/api/admin/users");
  assert.deepEqual(defaults.json.data.pagination, {
    page: 1,
    page_size: 10,
    total_items: 3,
    total_pages: 1,
  });
  assert.deepEqual(defaults.json.data.filters, { query: null, role: null });
  assert.deepEqual(defaults.json.data.items.map(({ role, current_streak }) => ({ role, current_streak })), [
    { role: "USER", current_streak: 2 },
    { role: "ADMIN", current_streak: null },
    { role: "USER", current_streak: 0 },
  ]);

  const email = await requestAs("ADMIN", "/api/admin/users?query=EXAMPLE.TEST");
  assert.equal(email.json.data.items.length, 3);

  const empty = await requestAs("ADMIN", "/api/admin/users?query=missing");
  assert.deepEqual(empty.json.data.items, []);
  assert.equal(empty.json.data.pagination.total_pages, 0);
});

test("list rejects unsupported, repeated, malformed, and oversized query parameters", async () => {
  for (const path of [
    "/api/admin/users?unknown=1",
    "/api/admin/users?page=1&page=2",
    "/api/admin/users?page=0",
    "/api/admin/users?page_size=101",
    "/api/admin/users?role=STAFF",
  ]) {
    const response = await requestAs("ADMIN", path);
    assert.equal(response.status, 400, path);
    assert.equal(response.json.error.code, "VALIDATION_ERROR", path);
  }
});

test("detail validates UUID, returns the approved projection, and handles missing users", async () => {
  const response = await requestAs("ADMIN", `/api/admin/users/${USER_ID}`);
  assert.equal(response.status, 200);
  assert.deepEqual(Object.keys(response.json.data).sort(), [
    "avatar_url", "created_at", "display_name", "email", "id", "is_active", "role", "updated_at",
  ]);

  const invalid = await requestAs("ADMIN", "/api/admin/users/not-a-uuid");
  assert.equal(invalid.status, 400);
  assert.equal(invalid.json.error.code, "VALIDATION_ERROR");

  const missing = await requestAs("ADMIN", "/api/admin/users/00000000-0000-4000-8000-000000000099");
  assert.equal(missing.status, 404);
  assert.equal(missing.json.error.code, "USER_NOT_FOUND");
});

test("responses exclude sensitive and private fields, and routes expose no mutation", async () => {
  const before = structuredClone(records);
  for (const path of ["/api/admin/users", `/api/admin/users/${USER_ID}`]) {
    const response = await requestAs("ADMIN", path);
    const body = JSON.stringify(response.json);
    for (const forbidden of ["password_hash", "session_identifier_hash", "auth_sessions", "learning_progress", "owned_vocabularies", "total_xp", "daily_xp_goal"]) {
      assert.equal(body.includes(forbidden), false, forbidden);
    }
  }

  const mutation = await http.request(`/api/admin/users/${USER_ID}`, {
    method: "PATCH",
    json: { role: "ADMIN" },
    cookie: "session_id=admin-session",
  });
  assert.equal(mutation.status, 404);
  assert.deepEqual(records, before);
});

test("Prisma repository uses explicit projections, one count/findMany transaction, and stable database ordering", async () => {
  const calls = [];
  const countResult = Promise.resolve(7);
  const findResult = Promise.resolve([]);
  const prisma = {
    uSER: {
      count(args) { calls.push(["count", args]); return countResult; },
      findMany(args) { calls.push(["findMany", args]); return findResult; },
      findUnique(args) { calls.push(["findUnique", args]); return Promise.resolve(null); },
    },
    sTREAK_DAY: {
      findMany(args) { calls.push(["streakFindMany", args]); return Promise.resolve([{ user_id: USER_ID, activity_date: new Date("2026-01-03T00:00:00.000Z") }]); },
    },
    async $transaction(operations) {
      calls.push(["transaction", operations]);
      return Promise.all(operations);
    },
  };
  const repository = createAdminUserRepository(prisma);
  const result = await repository.list({ page: 2, page_size: 20, query: "An", role: "USER" });
  assert.deepEqual(result, { items: [], total: 7 });

  const count = calls.find(([name]) => name === "count")[1];
  const find = calls.find(([name]) => name === "findMany")[1];
  assert.deepEqual(find.orderBy, [{ created_at: "desc" }, { id: "desc" }]);
  assert.equal(find.skip, 20);
  assert.equal(find.take, 20);
  assert.deepEqual(find.where, count.where);
  assert.deepEqual(find.select, {
    id: true,
    display_name: true,
    email: true,
    avatar_url: true,
    role: true,
    is_active: true,
    created_at: true,
  });
  assert.equal(calls.filter(([name]) => name === "count").length, 1);
  assert.equal(calls.filter(([name]) => name === "findMany").length, 1);
  assert.equal(calls.filter(([name]) => name === "transaction").length, 1);

  const streakResult = await repository.listStreakActivityDates([USER_ID], "2026-01-04");
  assert.deepEqual(streakResult, [{ user_id: USER_ID, activity_date: "2026-01-03" }]);
  const streakQuery = calls.find(([name]) => name === "streakFindMany")[1];
  assert.deepEqual(streakQuery.where.user_id, { in: [USER_ID] });
  assert.equal(streakQuery.where.activity_date.lte.toISOString(), "2026-01-04T00:00:00.000Z");
  assert.deepEqual(streakQuery.orderBy, [{ user_id: "asc" }, { activity_date: "desc" }]);
  assert.deepEqual(streakQuery.select, { user_id: true, activity_date: true });
  assert.equal(calls.filter(([name]) => name === "streakFindMany").length, 1);

  await repository.findById(USER_ID);
  const detail = calls.find(([name]) => name === "findUnique")[1];
  assert.equal(detail.select.updated_at, true);
  assert.equal(Object.hasOwn(detail.select, "password_hash"), false);
});

test("Current Streak reuses authoritative timezone, expiry, deduplication, and one evaluation instant", async () => {
  let nowCalls = 0;
  let batchArguments = null;
  const repository = {
    async list() { return { total: 3, items: records.map(({ updated_at: _updatedAt, ...record }) => projectSafeUser(record)) }; },
    async listStreakActivityDates(userIds, throughDate) {
      batchArguments = { userIds, throughDate };
      return [
        { user_id: USER_ID, activity_date: "2026-01-10" },
        { user_id: USER_ID, activity_date: "2026-01-10" },
        { user_id: USER_ID, activity_date: "2026-01-09" },
        { user_id: OLDER_USER_ID, activity_date: "2026-01-08" },
      ];
    },
  };
  const service = createAdminUserService({ adminUserRepository: repository, now: () => { nowCalls += 1; return new Date("2026-01-10T17:30:00.000Z"); } });
  const result = await service.listUsers({});
  assert.equal(nowCalls, 1);
  assert.deepEqual(batchArguments, { userIds: [USER_ID, OLDER_USER_ID], throughDate: "2026-01-11" });
  assert.deepEqual(result.items.map(({ current_streak }) => current_streak), [2, null, 0]);
});

test("Current Streak batch preserves long streaks without truncation and propagates aggregation failure", async () => {
  const activityDates = Array.from({ length: 120 }, (_, offset) => ({ user_id: USER_ID, activity_date: isoDateBefore("2026-05-01", offset) }));
  const service = createAdminUserService({
    adminUserRepository: {
      async list() { return { total: 1, items: [projectSafeUser(records[0])] }; },
      async listStreakActivityDates() { return activityDates; },
    },
    now: () => new Date("2026-05-01T05:00:00.000Z"),
  });
  const result = await service.listUsers({});
  assert.equal(result.items[0].current_streak, 120);

  const failed = createAdminUserService({
    adminUserRepository: {
      async list() { return { total: 1, items: [projectSafeUser(records[0])] }; },
      async listStreakActivityDates() { throw new Error("streak batch failed"); },
    },
    now: () => EVALUATED_AT,
  });
  await assert.rejects(() => failed.listUsers({}), /streak batch failed/);
});

test("Current Streak skips the batch query for empty and ADMIN-only pages", async () => {
  let batchCalls = 0;
  const repository = {
    page: [],
    async list() { return { total: this.page.length, items: this.page }; },
    async listStreakActivityDates() { batchCalls += 1; return []; },
  };
  const service = createAdminUserService({ adminUserRepository: repository, now: () => EVALUATED_AT });
  assert.deepEqual((await service.listUsers({})).items, []);
  repository.page = [projectSafeUser(records[1])];
  assert.equal((await service.listUsers({})).items[0].current_streak, null);
  assert.equal(batchCalls, 0);
});

function requestAs(role, path) {
  return http.request(path, { cookie: `session_id=${role === "ADMIN" ? "admin-session" : "user-session"}` });
}

function user(overrides) {
  return {
    id: overrides.id,
    display_name: overrides.display_name,
    email: overrides.email,
    avatar_url: null,
    role: overrides.role,
    is_active: true,
    created_at: overrides.created_at,
    updated_at: "2026-02-01T00:00:00.000Z",
    password_hash: "must-never-leak",
    auth_sessions: [{ session_identifier_hash: "must-never-leak" }],
    learning_progress: [{ id: "private" }],
    total_xp: 999,
  };
}

function inMemoryRepository(source, activityDatesByUser = new Map()) {
  const projectList = ({ updated_at: _updatedAt, password_hash: _passwordHash, auth_sessions: _sessions, learning_progress: _progress, total_xp: _xp, ...item }) => item;
  const projectDetail = ({ password_hash: _passwordHash, auth_sessions: _sessions, learning_progress: _progress, total_xp: _xp, ...item }) => item;
  return {
    async list({ page, page_size, query, role }) {
      const normalized = query?.toLocaleLowerCase("vi") ?? null;
      const filtered = source
        .filter((item) => !role || item.role === role)
        .filter((item) => !normalized || item.display_name.toLocaleLowerCase("vi").includes(normalized) || item.email.toLowerCase().includes(normalized))
        .toSorted((left, right) => right.created_at.localeCompare(left.created_at) || right.id.localeCompare(left.id));
      return {
        total: filtered.length,
        items: filtered.slice((page - 1) * page_size, page * page_size).map(projectList),
      };
    },
    async findById(id) {
      const found = source.find((item) => item.id === id);
      return found ? projectDetail(found) : null;
    },
    async listStreakActivityDates(userIds) {
      return userIds.flatMap((userId) => (activityDatesByUser.get(userId) ?? []).map((activity_date) => ({ user_id: userId, activity_date })));
    },
  };
}

function projectSafeUser(record) {
  const { updated_at: _updatedAt, password_hash: _passwordHash, auth_sessions: _sessions, learning_progress: _progress, total_xp: _xp, ...safe } = record;
  return safe;
}

function isoDateBefore(date, offset) {
  const instant = new Date(`${date}T00:00:00.000Z`);
  instant.setUTCDate(instant.getUTCDate() - offset);
  return instant.toISOString().slice(0, 10);
}
