import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import express from "express";
import cookieParser from "cookie-parser";
import { projectNotificationEvents, streakQueryStart, VISIBILITY_MS } from "../../src/services/learner-notification-domain.js";
import { createLearnerNotificationService } from "../../src/services/learner-notification-service.js";
import { createLearnerNotificationController } from "../../src/controllers/learner-notification-controller.js";
import { createLearnerNotificationRouter } from "../../src/routes/learner-notification-routes.js";
import { createAuthenticationMiddleware } from "../../src/middleware/authentication-middleware.js";
import { createRoleAuthorizationMiddleware } from "../../src/middleware/role-authorization-middleware.js";

const now = new Date("2026-11-27T12:00:00.000Z");
const activation = "2026-11-01T00:00:00Z";
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const days = (...dates) => dates.map((day) => ({ day, qualified_at: new Date(`${day}T12:00:00+07:00`) }));
function events(streak, instant = now, cutoff = activation, progressDates = []) {
  return projectNotificationEvents({ days: streak, now: instant, eligibleSince: new Date(cutoff), progressDates });
}

test("positive streak interruptions respect Vietnam midnight and survive a new run", () => {
  for (const count of [1, 2, 9]) {
    const streak = days(...Array.from({ length: count }, (_, i) => `2026-11-${String(20 - count + i + 1).padStart(2, "0")}`));
    const at = (instant) => events(streak, new Date(instant)).filter((row) => row.type === "STREAK_INTERRUPTED");
    assert.equal(at("2026-11-21T16:59:59.999Z").length, 0);
    assert.equal(at("2026-11-21T17:00:00.000Z")[0].event_key, "2026-11-20");
    assert.equal(events([...streak, ...days("2026-11-23")]).filter((row) => row.type === "STREAK_INTERRUPTED").length, 2);
  }
  assert.deepEqual(events([]), []);
});

test("streak and vocabulary thresholds are independent and post-cutoff only", () => {
  const streak = days(...Array.from({ length: 30 }, (_, i) => `2026-10-${String(i + 1).padStart(2, "0")}`));
  const eligible = "2026-10-01T00:00:00Z";
  const rows = events(streak, now, eligible, [
    "2026-09-30T05:00:00Z", ...Array(5).fill("2026-11-02T05:00:00Z"),
  ]);
  assert.deepEqual(rows.filter((row) => row.type === "STREAK_MILESTONE").map((row) => row.payload.days), [3, 7, 14, 30]);
  assert.deepEqual(rows.filter((row) => row.type === "VOCABULARY_MILESTONE").map((row) => row.payload.started), [50, 100, 250, 500, 1000]);
  assert.deepEqual(events(streak, now, activation).filter((row) => row.type === "STREAK_MILESTONE"), []);
  assert.equal(streakQueryStart(new Date("2026-11-01T12:00:00Z")), "2026-10-02");
});

test("historical warm-up does not create new milestones for an uninterrupted streak", () => {
  const cutoff = "2026-11-25T00:00:00.000Z";
  const first = new Date("2026-10-26T00:00:00.000Z");
  const streak = days(...Array.from({ length: 33 }, (_, i) => {
    const date = new Date(+first + i * 86_400_000);
    return date.toISOString().slice(0, 10);
  }));
  assert.deepEqual(events(streak, now, cutoff), []);
  const thirdDay = days("2026-11-24", "2026-11-25", "2026-11-26");
  assert.equal(events(thirdDay, now, "2026-11-26T05:00:00.000Z").some((event) => event.payload.days === 3), true);
  assert.equal(events(thirdDay, now, "2026-11-26T05:00:00.001Z").some((event) => event.payload.days === 3), false);
});

function createMemoryRepo() {
  const data = [];
  const visible = (owner, since) => data.filter((row) => row.user_id === owner && row.occurred_at >= since);
  const sorted = (rows) => rows.sort((a, b) => b.occurred_at - a.occurred_at || b.id.localeCompare(a.id));
  const repo = {
    data,
    transact: (fn) => fn(repo),
    sources: async () => ({ days: days("2026-11-23", "2026-11-24", "2026-11-25"), progressDates: [] }),
    insert: async (owner, source) => {
      for (const event of source) {
        if (!data.some((row) => row.user_id === owner && row.type === event.type && row.event_key === event.event_key)) {
          data.push({ ...event, user_id: owner, id: id(200 + data.length), read_at: null });
        }
      }
    },
    async page(owner, since, cursor, limit) {
      const rows = sorted(visible(owner, since));
      const items = rows.filter((row) => !cursor || row.occurred_at < cursor.at
        || (+row.occurred_at === +cursor.at && row.id < cursor.id)).slice(0, limit);
      return { items, unread_count: await repo.unreadCount(owner, since) };
    },
    unreadCount: async (owner, since) => visible(owner, since).filter((row) => !row.read_at).length,
    async markOne(owner, id, since, instant) {
      const item = visible(owner, since).find((row) => row.id === id);
      if (!item) return null;
      item.read_at ??= instant;
      return { id, read_at: item.read_at };
    },
    async markAll(owner, since, instant) {
      for (const item of visible(owner, since)) item.read_at ??= instant;
    },
  };
  return repo;
}

test("mock concurrent refresh and replay dedupe, honor visibility, paginate ties and read unseen pages", async () => {
  const repo = createMemoryRepo();
  const service = createLearnerNotificationService({ repository: repo, activatedAt: activation, now: () => now });
  await Promise.all([service.refresh(id(1), {}), service.refresh(id(1), {}), service.refresh(id(1), {})]);
  assert.equal(repo.data.length, 2);
  for (let i = 1; i <= 9; i++) repo.data.push({
    id: id(300 + i), user_id: id(1), type: "VOCABULARY_MILESTONE", occurred_at: now, read_at: null,
  });
  repo.data.push({ id: id(7), user_id: id(1), occurred_at: new Date("2026-01-01"), read_at: null });
  const first = await service.list(id(1), {});
  assert.equal(first.items.length, 3);
  assert.equal(first.has_more, true);
  assert.equal(first.unread_count, 11);
  const next = await service.list(id(1), { cursor: first.next_cursor, limit: "3" });
  assert.equal(next.items.length, 3);
  const last = await service.list(id(1), { cursor: next.next_cursor, limit: "50" });
  assert.equal(last.items.length, 5);
  assert.equal(last.has_more, false);
  assert.equal(last.next_cursor, null);
  assert.equal(new Set([...first.items, ...next.items, ...last.items].map((row) => row.id)).size, 11);
  assert.deepEqual(await service.markOne(id(1), id(309)), await service.markOne(id(1), id(309)));
  assert.equal((await service.markAll(id(1))).unread_count, 0);
  assert.equal((await service.markAll(id(1))).unread_count, 0);
  assert.equal(repo.data.find((row) => row.id === id(7)).read_at, null);
  assert.throws(() => service.list(id(1), { limit: "51" }), /Invalid/);
  assert.throws(() => service.list(id(1), { cursor: "broken" }), /Invalid/);
});

test("missing activation prevents generation and source failure is isolated to refresh", async () => {
  const repo = createMemoryRepo();
  const enabled = createLearnerNotificationService({ repository: repo, activatedAt: activation, now: () => now });
  const disabled = createLearnerNotificationService({ repository: repo, now: () => now });
  assert.equal((await disabled.refresh(id(1), {})).items.length, 0);
  repo.sources = async () => { throw new Error("fixture notification source failure"); };
  await assert.rejects(enabled.refresh(id(1), {}), /fixture/);
  assert.equal((await enabled.list(id(1), {})).unread_count, 0);
});

test("visibility includes the 90-day boundary while older dedupe rows remain stored", async () => {
  const repo = createMemoryRepo();
  const service = createLearnerNotificationService({ repository: repo, now: () => now });
  for (const ms of [0, 1]) repo.data.push({
    id: id(10 + ms), user_id: id(1), type: "STREAK_INTERRUPTED",
    event_key: String(ms), occurred_at: new Date(+now - VISIBILITY_MS - ms), read_at: null,
  });
  assert.equal((await service.list(id(1), {})).unread_count, 1);
  await service.markAll(id(1));
  assert.equal(repo.data.length, 2);
  assert.equal(repo.data[1].read_at, null);
});

test("offline Express contract enforces guest, ADMIN, origin and owner boundaries", async () => {
  const repo = createMemoryRepo();
  const service = createLearnerNotificationService({ repository: repo, activatedAt: activation, now: () => now });
  const app = express();
  app.use(cookieParser(), createLearnerNotificationRouter({
    controller: createLearnerNotificationController(service),
    authenticationMiddleware: createAuthenticationMiddleware({
      authenticationService: { getCurrentUser: async (token) => ({
        id: token === "other" ? id(2) : id(1), role: token === "admin" ? "ADMIN" : "USER",
      }) },
    }),
    userAuthorizationMiddleware: createRoleAuthorizationMiddleware({ allowedRoles: ["USER"] }),
  }));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const send = async (path, token, options = {}) => {
      const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
        ...options, headers: { ...(token ? { Cookie: `session_id=${token}` } : {}), ...options.headers },
        signal: AbortSignal.timeout(4000),
      });
      const body = await response.json();
      return { status: response.status, body, cache: response.headers.get("cache-control") };
    };
    assert.equal((await send("/", null)).status, 401);
    assert.equal((await send("/", "admin")).status, 403);
    assert.equal((await send("/refresh", "user", { method: "POST" })).status, 403);
    const headers = { "x-elvocab-notification": "1" };
    assert.equal((await send("/refresh", "user", { method: "POST", headers: { ...headers, "sec-fetch-site": "same-site" } })).status, 403);
    const refreshed = await send("/refresh", "user", { method: "POST", headers });
    assert.equal(refreshed.status, 200);
    assert.match(refreshed.cache, /no-store/);
    const item = refreshed.body.data.items[0];
    assert.equal((await send(`/${item.id}/read`, "other", { method: "PATCH", headers })).status, 404);
    assert.equal((await send(`/${item.id}/read`, "user", { method: "PATCH", headers })).body.data.unread_count, 1);
  } finally {
    server.closeAllConnections();
    server.close();
  }
});
