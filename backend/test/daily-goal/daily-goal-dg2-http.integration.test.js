import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";

import { createApp } from "../../src/create-app.js";
import { startHttpTestServer } from "../helpers/http-test-server.js";

export async function runHttpIntegration({ prisma }) {
  const clock = { value: new Date("2026-10-26T00:00:00.000Z") };
  const users = [];
  const http = await startHttpTestServer(createApp({ prisma, dailyGoalNow: () => new Date(clock.value) }));
  try {
    const user = await createIdentity(prisma, "USER"); users.push(user.id);
    const admin = await createIdentity(prisma, "ADMIN"); users.push(admin.id);
    const other = await createIdentity(prisma, "USER"); users.push(other.id);
    const learning = await createLearning(prisma, user.id);
    const foreignLearning = await createLearning(prisma, other.id);

    assert.equal((await http.request("/api/daily-goal/tracking-sessions", { method: "POST", json: establish(randomUUID(), learning.id) })).status, 401);
    assert.equal((await http.request("/api/daily-goal/tracking-sessions", { method: "POST", cookie: admin.cookie, json: establish(randomUUID(), learning.id) })).status, 403);
    assert.equal((await http.request("/api/daily-goal/tracking-sessions", { method: "POST", cookie: user.cookie, json: establish(randomUUID(), foreignLearning.id) })).status, 404);

    const created = await http.request("/api/daily-goal/tracking-sessions", { method: "POST", cookie: user.cookie, json: establish(randomUUID(), learning.id) });
    assert.equal(created.status, 201);
    const sessionId = created.json.data.tracking_session_id;
    const readyOperation = randomUUID();
    const ready = await http.request(`/api/daily-goal/tracking-sessions/${sessionId}/engagement`, { method: "POST", cookie: user.cookie, json: { operation_id: readyOperation, event_type: "READY" } });
    assert.equal(ready.status, 200);
    const replay = await http.request(`/api/daily-goal/tracking-sessions/${sessionId}/engagement`, { method: "POST", cookie: user.cookie, json: { operation_id: readyOperation, event_type: "READY" } });
    assert.equal(replay.status, 200);
    const mismatchBefore = await durableSnapshot(prisma, user.id);
    const mismatch = await http.request(`/api/daily-goal/tracking-sessions/${sessionId}/engagement`, { method: "POST", cookie: user.cookie, json: { operation_id: readyOperation, generation: ready.json.data.generation, event_type: "REVEAL" } });
    assert.equal(mismatch.status, 409);
    assert.equal(mismatch.json.error.code, "OPERATION_CONFLICT");
    assert.deepEqual(await durableSnapshot(prisma, user.id), mismatchBefore);
    const staleBefore = await durableSnapshot(prisma, user.id);
    const stale = await http.request(`/api/daily-goal/tracking-sessions/${sessionId}/heartbeat`, { method: "POST", cookie: user.cookie, json: { operation_id: randomUUID(), generation: "0", eligibility: "VISIBLE_FOCUSED_ACTIVE" } });
    assert.equal(stale.status, 409);
    assert.deepEqual(await durableSnapshot(prisma, user.id), staleBefore);
    const unknownBefore = await durableSnapshot(prisma, user.id);
    const unknown = await http.request(`/api/daily-goal/tracking-sessions/${sessionId}/heartbeat`, { method: "POST", cookie: user.cookie, json: { operation_id: randomUUID(), generation: ready.json.data.generation, eligibility: "VISIBLE_FOCUSED_ACTIVE", duration: 20_000 } });
    assert.equal(unknown.status, 400);
    assert.deepEqual(await durableSnapshot(prisma, user.id), unknownBefore);
    assert.deepEqual(Object.keys(ready.json.data).sort(), ["engagement_expires_at", "generation", "lease_expires_at", "owner", "projection", "status", "tracking_session_id"].sort());

    for (let seconds = 20; seconds <= 100; seconds += 20) {
      clock.value = new Date(`2026-10-26T00:0${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}.000Z`);
      const heartbeatResponse = await http.request(`/api/daily-goal/tracking-sessions/${sessionId}/heartbeat`, { method: "POST", cookie: user.cookie, json: { operation_id: randomUUID(), generation: ready.json.data.generation, eligibility: "VISIBLE_FOCUSED_ACTIVE" } });
      assert.equal(heartbeatResponse.status, 200);
    }
    const prefixBefore = await dayMilliseconds(prisma, user.id);
    assert.equal(prefixBefore, 100_000n);
    clock.value = new Date("2026-10-26T00:02:00.000Z");
    const idleOperation = randomUUID();
    const idle = await http.request(`/api/daily-goal/tracking-sessions/${sessionId}/engagement`, { method: "POST", cookie: user.cookie, json: { operation_id: idleOperation, generation: ready.json.data.generation, event_type: "REVEAL" } });
    assert.equal(idle.status, 409);
    assert.equal(idle.json.error.code, "IDLE_RESUME_REQUIRED");
    assert.equal(await dayMilliseconds(prisma, user.id), 120_000n);
    const terminalReceipt = await prisma.dAILY_GOAL_OPERATION_RECEIPT.findUnique({ where: { operation_id: idleOperation } });
    assert.equal(terminalReceipt.credited_milliseconds, 20_000n);
    assert.equal(await prisma.dAILY_GOAL_OPERATION_RECEIPT.count({ where: { user_id: user.id, operation_id: idleOperation } }), 1);
    return buildHttpEvidenceForTest({ mismatchUnchanged: true, staleUnchanged: true, unknownUnchanged: true, idlePrefixBounded: true }, { httpAuthorization: pass(3), httpConflicts: pass(14) });
  } finally {
    await http.close();
    await cleanup(prisma, users);
  }
}

async function createIdentity(prisma, role) { const user = await prisma.uSER.create({ data: { email: `${role.toLowerCase()}-${randomUUID()}@example.test`, password_hash: "not-used", display_name: role, role } }); const token = randomBytes(32).toString("base64url"); await prisma.aUTH_SESSION.create({ data: { user_id: user.id, session_identifier_hash: createHash("sha256").update(token).digest("hex"), expires_at: new Date("2099-12-01T00:00:00.000Z") } }); return { ...user, cookie: `session_id=${token}` }; }
function createLearning(prisma, userId) { return prisma.lEARNING_SESSION.create({ data: { user_id: userId, set_id_snapshot: randomUUID(), mode: "NORMAL", status: "ACTIVE", create_operation_id: randomUUID(), snapshot_size: 1, expires_at: new Date("2026-12-01T00:00:00.000Z") } }); }
function establish(operation_id, learning_session_id) { return { operation_id, activity_type: "NORMAL", learning_session_id }; }
function pass(assertions) { return Object.freeze({ status: "PASS", assertions }); }
async function dayMilliseconds(prisma, userId) { const result = await prisma.dAILY_GOAL_DAY.aggregate({ where: { user_id: userId }, _sum: { active_milliseconds: true } }); return result._sum.active_milliseconds ?? 0n; }
async function durableSnapshot(prisma, userId) { const [owner, sessions, days, receipts] = await Promise.all([prisma.dAILY_GOAL_OWNER.findUnique({ where: { user_id: userId } }), prisma.dAILY_GOAL_TRACKING_SESSION.findMany({ where: { user_id: userId }, orderBy: { id: "asc" } }), prisma.dAILY_GOAL_DAY.findMany({ where: { user_id: userId }, orderBy: { activity_date: "asc" } }), prisma.dAILY_GOAL_OPERATION_RECEIPT.findMany({ where: { user_id: userId }, orderBy: { operation_id: "asc" } })]); return structuredClone({ owner, sessions, days, receipts }); }
async function cleanup(prisma, ids) { if (!ids.length) return; await prisma.dAILY_GOAL_OPERATION_RECEIPT.deleteMany({ where: { user_id: { in: ids } } }); await prisma.dAILY_GOAL_OWNER.deleteMany({ where: { user_id: { in: ids } } }); await prisma.dAILY_GOAL_TRACKING_SESSION.deleteMany({ where: { user_id: { in: ids } } }); await prisma.dAILY_GOAL_DAY.deleteMany({ where: { user_id: { in: ids } } }); await prisma.lEARNING_SESSION.deleteMany({ where: { user_id: { in: ids } } }); await prisma.aUTH_SESSION.deleteMany({ where: { user_id: { in: ids } } }); await prisma.uSER.deleteMany({ where: { id: { in: ids } } }); }

export function buildHttpEvidenceForTest(checks, categories) {
  for (const key of ["mismatchUnchanged", "staleUnchanged", "unknownUnchanged", "idlePrefixBounded"]) if (checks?.[key] !== true) throw new Error("DG-2 HTTP durable evidence is incomplete.");
  for (const key of ["httpAuthorization", "httpConflicts"]) if (categories?.[key]?.status !== "PASS" || !Number.isInteger(categories[key].assertions) || categories[key].assertions < 1) throw new Error("DG-2 HTTP category evidence is incomplete.");
  return Object.freeze({ httpAuthorization: categories.httpAuthorization, httpConflicts: categories.httpConflicts });
}
