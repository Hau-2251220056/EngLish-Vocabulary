import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";

export async function runTask262HttpIntegration({ prisma } = {}) {
  if (!prisma?.$transaction) throw new TypeError("A real Prisma client is required.");
  const [{ createApp }, { startHttpTestServer }] = await Promise.all([
    import("../../src/create-app.js"),
    import("../helpers/http-test-server.js"),
  ]);
  const users = [];
  let assertions = 0;
  let primary;
  const now = new Date("2026-10-27T08:00:00.000Z");
  const http = await startHttpTestServer(createApp({ prisma, dailyGoalNow: () => new Date(now) }));
  try {
    const user = await createIdentity(prisma, users);
    await prisma.dAILY_GOAL_DAY.create({
      data: { user_id: user.id, activity_date: new Date("2026-10-27T00:00:00.000Z"), active_milliseconds: 600_000n, last_credited_at: now, last_engagement_at: now, last_activity_type: "NORMAL" },
    });

    const operationId = randomUUID();
    const payload = { operation_id: operationId, target_minutes: 10 };
    const unauthorized = await http.request("/api/daily-goal", { method: "PUT", json: payload });
    assert.equal(unauthorized.status, 401); assertions += 1;

    const [first, concurrentReplay] = await Promise.all([
      http.request("/api/daily-goal", { method: "PUT", cookie: user.cookie, json: payload }),
      http.request("/api/daily-goal", { method: "PUT", cookie: user.cookie, json: payload }),
    ]);
    assert.equal(first.status, 200); assertions += 1;
    assert.equal(concurrentReplay.status, 200); assertions += 1;
    assert.equal(await prisma.dAILY_GOAL_REWARD.count({ where: { user_id: user.id } }), 1); assertions += 1;
    assert.equal(await prisma.uSER_NOTIFICATION.count({ where: { user_id: user.id, type: "DAILY_GOAL_COMPLETED" } }), 1); assertions += 1;
    assert.equal((await prisma.uSER.findUniqueOrThrow({ where: { id: user.id }, select: { total_xp: true } })).total_xp, 10); assertions += 1;

    const replay = await http.request("/api/daily-goal", { method: "PUT", cookie: user.cookie, json: payload });
    assert.equal(replay.status, 200); assertions += 1;
    assert.deepEqual(replay.json.data, first.json.data); assertions += 1;

    const beforeConflict = await durableSnapshot(prisma, user.id);
    const conflict = await http.request("/api/daily-goal", { method: "PUT", cookie: user.cookie, json: { operation_id: operationId, target_minutes: 20 } });
    assert.equal(conflict.status, 409); assertions += 1;
    assert.equal(conflict.json.error.code, "OPERATION_CONFLICT"); assertions += 1;
    assert.deepEqual(await durableSnapshot(prisma, user.id), beforeConflict); assertions += 1;

    assert(assertions > 0);
    return { replayConflictRetry: Object.freeze({ status: "PASS", assertions }) };
  } catch (error) {
    primary = error;
    throw error;
  } finally {
    let cleanupError;
    try { await http.close(); } catch (error) { cleanupError = error; }
    try { await cleanupUsers(prisma, users); } catch (error) { cleanupError ??= error; }
    if (cleanupError) { if (primary) markCleanupFailure(primary); else throw cleanupError; }
  }
}
function markCleanupFailure(error) { try { Object.defineProperty(error, "task262CleanupFailed", { value: true }); } catch {} }

async function createIdentity(prisma, users) {
  const user = await prisma.uSER.create({
    data: { email: `task262-http-${randomUUID()}@example.test`, password_hash: "not-used", display_name: "TASK-262 HTTP", role: "USER" },
  });
  users.push(user.id);
  const token = randomBytes(32).toString("base64url");
  await prisma.aUTH_SESSION.create({
    data: { user_id: user.id, session_identifier_hash: createHash("sha256").update(token).digest("hex"), expires_at: new Date("2099-12-01T00:00:00.000Z") },
  });
  return { ...user, cookie: `session_id=${token}` };
}

async function durableSnapshot(prisma, userId) {
  const [user, days, rewards, notifications, receipts] = await Promise.all([
    prisma.uSER.findUnique({ where: { id: userId }, select: { total_xp: true, daily_goal_minutes: true } }),
    prisma.dAILY_GOAL_DAY.findMany({ where: { user_id: userId }, orderBy: { activity_date: "asc" } }),
    prisma.dAILY_GOAL_REWARD.findMany({ where: { user_id: userId }, orderBy: { activity_date: "asc" } }),
    prisma.uSER_NOTIFICATION.findMany({ where: { user_id: userId }, orderBy: { created_at: "asc" } }),
    prisma.dAILY_GOAL_OPERATION_RECEIPT.findMany({ where: { user_id: userId }, orderBy: { operation_id: "asc" } }),
  ]);
  return structuredClone({ user, days, rewards, notifications, receipts });
}

async function cleanupUsers(prisma, ids) {
  if (!ids.length) return;
  const where = { user_id: { in: ids } };
  await prisma.dAILY_GOAL_OPERATION_RECEIPT.deleteMany({ where });
  await prisma.dAILY_GOAL_OWNER.deleteMany({ where });
  await prisma.dAILY_GOAL_TRACKING_SESSION.deleteMany({ where });
  await prisma.dAILY_GOAL_MONITOR_SESSION.deleteMany({ where });
  await prisma.uSER_NOTIFICATION.deleteMany({ where });
  await prisma.dAILY_GOAL_REWARD.deleteMany({ where });
  await prisma.dAILY_GOAL_DAY.deleteMany({ where });
  await prisma.aUTH_SESSION.deleteMany({ where });
  await prisma.uSER.deleteMany({ where: { id: { in: ids } } });
}
