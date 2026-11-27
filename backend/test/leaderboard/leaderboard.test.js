import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import cookieParser from "cookie-parser";
import express from "express";
import { createApp } from "../../src/create-app.js";
import { createAuthenticationMiddleware } from "../../src/middleware/authentication-middleware.js";
import { createRoleAuthorizationMiddleware } from "../../src/middleware/role-authorization-middleware.js";
import { createLeaderboardRepository } from "../../src/repositories/leaderboard-repository.js";
import { createLeaderboardRouter } from "../../src/routes/leaderboard-routes.js";
import { createLeaderboardService } from "../../src/services/leaderboard-service.js";

const viewerId = "10000000-0000-4000-8000-000000000001";
const now = "2026-11-29T17:00:00.000Z";
const viewer = { id: viewerId, rank: null, position: null, xp: 0n, total: 0n,
  display_name: "Học viên kiểm thử", email: "owner@example.test" };

function service(rows = [viewer], activityDays = [], instant = now) {
  const requests = [];
  return { ...createLeaderboardService({
    now: () => instant,
    repository: { readSnapshot: async (input) => { requests.push(input); return { rows, activityDays }; } },
  }), requests };
}

test("weekly rollover is at Vietnam midnight on Monday", async () => {
  const before = await service(undefined, [], "2026-11-29T16:59:59.999Z").list(viewerId, {});
  const after = await service().list(viewerId, {});
  assert.equal(before.window.end, now);
  assert.equal(after.window.start, now);
  assert.equal(after.window.end, "2026-12-06T17:00:00.000Z");
  assert.equal(after.xp_basis, "period_rewards");
});

test("monthly rollover uses local midnight and all-time has no window", async () => {
  const boundary = "2026-11-30T17:00:00.000Z";
  const previous = await service().list(viewerId, { period: "monthly" });
  const current = await service(undefined, [], boundary).list(viewerId, { period: "monthly" });
  const all = await service().list(viewerId, { period: "all" });
  assert.equal(previous.window.end, boundary);
  assert.equal(current.window.start, boundary);
  assert.equal(current.window.end, "2026-12-31T17:00:00.000Z");
  assert.deepEqual(all.window, { start: null, end: null });
  assert.equal(all.xp_basis, "lifetime_total");
});

test("invalid and duplicate query values fail before a snapshot read", async () => {
  const app = service();
  for (const query of [{ page: "0" }, { page: "2147483648" }, { page: ["1", "2"] },
    { period: ["all", "weekly"] }, { period: "daily" }, { user_id: viewerId }]) {
    await assert.rejects(app.list(viewerId, query), { status: 400, code: "VALIDATION_ERROR" });
  }
  assert.deepEqual(app.requests, []);
});

test("one snapshot produces tied podium, selected page, personal rank and batch streak", async () => {
  const base = { ...viewer, total: 13n };
  const app = service([
    { ...base, id: "a", position: 1n, rank: 1n, xp: 20n },
    { ...base, id: "b", position: 2n, rank: 1n, xp: 20n },
    { ...base, id: "c", position: 3n, rank: 3n, xp: 19n },
    { ...base, id: "d", position: 11n, rank: 11n, xp: 3n },
    { ...base, position: 12n, rank: 12n, xp: 2n },
  ], ["2026-11-29", "2026-11-28"].map((date) => ({
    user_id: viewerId, activity_date: new Date(date),
  })));
  const first = await app.list(viewerId, { page: "1" });
  assert.deepEqual(first.top.map(({ rank }) => rank), [1, 1, 3]);
  assert.equal(first.me.page, 2);
  assert.equal(first.me.current_streak, 2);
  assert.ok(first.items.every(({ is_me }) => !is_me));
  const second = await app.list(viewerId, { page: "2" });
  assert.deepEqual(second.items.map(({ position }) => position), [11, 12]);
  assert.deepEqual(app.requests.map(({ first, last }) => [first, last]), [[1, 10], [11, 20]]);
  assert.deepEqual(second.pagination, { page: 2, page_size: 10, total_items: 13, total_pages: 2 });
});

test("zero XP is unranked and an out-of-range page stays a successful empty list", async () => {
  const result = await service().list(viewerId, { page: "4" });
  assert.deepEqual(result.items, []);
  assert.deepEqual(result.top, []);
  assert.equal(result.me.rank, null);
  assert.equal(result.me.position, null);
  assert.equal(result.me.page, null);
  assert.equal(result.me.xp, 0);
  assert.equal(result.pagination.page, 4);
  assert.equal(result.pagination.total_pages, 0);
});

test("unsafe names, email-derived names, UUIDs and unapproved avatars are suppressed", async () => {
  const base = { ...viewer, total: 4n, rank: 1n, xp: 10n, avatar_url: "https://external.invalid/image.png" };
  const app = service([
    { ...base, id: "a", position: 1n, display_name: "user＠example.test" },
    { ...base, id: "b", position: 2n, display_name: "Owner", email: "ow.ner@example.test" },
    { ...base, id: "c", position: 3n, display_name: viewerId },
    { ...base, position: 4n },
  ]);
  const result = await app.list(viewerId, {});
  assert.deepEqual(result.top.map(({ display_name }) => display_name), ["Học viên 1", "Học viên 2", "Học viên 3"]);
  assert.equal(result.me.display_name, viewer.display_name);
  assert.ok(result.items.every((row) => row.avatar_url === null && !("email" in row) && !("id" in row)));
  assert.doesNotMatch(JSON.stringify(result), /example\.test|external\.invalid|10000000-/);
});

test("repository uses one bounded read-only snapshot, bound half-open windows and one batch", async () => {
  const operations = [];
  const transaction = {
    $executeRaw: async (strings) => operations.push(strings.join("")),
    $queryRaw: async (strings, ...values) => {
      operations.push({ strings: strings.join("?"), values });
      return [viewer];
    },
    sTREAK_DAY: { findMany: async (args) => { operations.push(args); return []; } },
  };
  const prisma = { $transaction: (callback, options) => {
    operations.push(options);
    return callback(transaction);
  } };
  const repo = createLeaderboardRepository(prisma);
  const args = { userId: viewerId, period: "weekly", start: now, end: "2026-12-06T17:00:00.000Z",
    asOf: now, applicationDate: "2026-11-30", first: 1, last: 10 };
  await repo.readSnapshot(args);
  const [options, mode, timeout, query, batch] = operations;
  assert.equal(options.isolationLevel, "RepeatableRead");
  assert.equal(mode, "SET TRANSACTION READ ONLY");
  assert.match(timeout, /statement_timeout/);
  assert.match(query.strings, /role = 'USER' AND is_active/);
  assert.match(query.strings, /RANK\(\) OVER \(ORDER BY xp DESC\)/);
  assert.match(query.strings, /ROW_NUMBER\(\) OVER \(ORDER BY xp DESC, id ASC\)/);
  assert.match(query.strings, /created_at >= \?::timestamp[\s\S]*created_at < \?::timestamp[\s\S]*created_at <= \?::timestamp/);
  assert.deepEqual(query.values.slice(0, 5), [false, false, ...[now, args.end, now].map((value) => value.slice(0, -1))]);
  assert.ok(query.values.includes(viewerId));
  assert.deepEqual(batch.where.user_id.in, [viewerId]);
  assert.equal(operations.length, 5);
  operations.length = 0;
  await repo.readSnapshot({ ...args, period: "all", start: null, end: null });
  assert.match(operations[3].strings, /total_xp::bigint AS xp FROM eligible\s+WHERE \?::boolean/);
  assert.deepEqual(operations[3].values.slice(0, 5), [true, true, null, null, now.slice(0, -1)]);
});

test("HTTP auth and role guards run before the read and every response is private", async (t) => {
  const app = express();
  app.use(cookieParser());
  const leaderboard = service();
  app.use("/api/leaderboard", createLeaderboardRouter({
    service: leaderboard,
    authenticationMiddleware: createAuthenticationMiddleware({ authenticationService: {
      async getCurrentUser(token) {
        if (token === "inactive") throw Object.assign(new Error(), { code: "AUTHENTICATION_FAILED" });
        return { id: viewerId, role: token === "admin" ? "ADMIN" : "USER" };
      },
    } }),
    userAuthorizationMiddleware: createRoleAuthorizationMiddleware({ allowedRoles: ["USER"] }),
  }));
  const server = app.listen(0, "127.0.0.1");
  t.after(() => server.close());
  await once(server, "listening");
  const url = `http://127.0.0.1:${server.address().port}/api/leaderboard`;
  for (const [cookie, status] of [["", 401], ["session_id=inactive", 401], ["session_id=admin", 403], ["session_id=user", 200]]) {
    const response = await fetch(url, { headers: { cookie } });
    assert.equal(response.status, status);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    await response.json();
  }
  assert.equal(leaderboard.requests.length, 1);
  assert.equal(typeof createApp({
    prisma: {
      cEFR_LEARNING_PASS: {}, cEFR_LEARNING_PASS_ITEM: {}, cEFR_LEARNING_PATH_STATE: {},
      lEARNING_SESSION: {}, vOCABULARY_SET: {}, $queryRaw() { assert.fail("Offline app initialization used Prisma."); },
    },
    loginAbuseSecret: "offline test input used for app construction", loginAbuseProxyMode: "direct",
    googleClientId: "", googleAllowedOrigins: "", coverStorage: {},
  }), "function");
});
