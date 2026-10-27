import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";

const DAY_MILLISECONDS = 86_400_000;
const HTTP_DIAGNOSTIC_LIMIT_BYTES = 256;
const HTTP_DIAGNOSTIC_PHASES = Object.freeze(new Set([
  "HTTP_FIXTURES", "HTTP_AUTHORIZATION", "HTTP_ESTABLISH", "HTTP_READY_REPLAY",
  "HTTP_CONFLICTS", "HTTP_HEARTBEATS", "HTTP_IDLE_TERMINAL", "HTTP_EVIDENCE",
  "HTTP_SERVER_CLOSE", "HTTP_FIXTURE_CLEANUP", "HTTP_UNCLASSIFIED",
]));

export async function runHttpIntegration({ prisma, diagnosticWriter } = {}) {
  const [{ createApp }, { startHttpTestServer }] = await Promise.all([
    import("../../src/create-app.js"),
    import("../helpers/http-test-server.js"),
  ]);
  const clock = { value: new Date() };
  const users = [];
  const http = await startHttpTestServer(createApp({ prisma, dailyGoalNow: () => new Date(clock.value) }));
  return runHttpDiagnosticLifecycle({
    diagnosticWriter,
    close: () => http.close(),
    cleanup: () => cleanup(prisma, users),
    async execute(runPhase) {
    const fixtureCreatedAt = new Date(clock.value);
    const { user, admin, other, learning, foreignLearning } = await runPhase("HTTP_FIXTURES", async () => {
      const user = await createIdentity(prisma, "USER", users);
      const admin = await createIdentity(prisma, "ADMIN", users);
      const other = await createIdentity(prisma, "USER", users);
      const learning = await createLearning(prisma, user.id, fixtureCreatedAt);
      const foreignLearning = await createLearning(prisma, other.id, fixtureCreatedAt);
      return { user, admin, other, learning, foreignLearning };
    });

    await runPhase("HTTP_AUTHORIZATION", async () => {
    assert.equal((await http.request("/api/daily-goal/tracking-sessions", { method: "POST", json: establish(randomUUID(), learning.id) })).status, 401);
    assert.equal((await http.request("/api/daily-goal/tracking-sessions", { method: "POST", cookie: admin.cookie, json: establish(randomUUID(), learning.id) })).status, 403);
    assert.equal((await http.request("/api/daily-goal/tracking-sessions", { method: "POST", cookie: user.cookie, json: establish(randomUUID(), foreignLearning.id) })).status, 404);
    });

    const sessionId = await runPhase("HTTP_ESTABLISH", async () => {
      const created = await http.request("/api/daily-goal/tracking-sessions", { method: "POST", cookie: user.cookie, json: establish(randomUUID(), learning.id) });
      assert.equal(created.status, 201);
      return created.json.data.tracking_session_id;
    });
    const readyOperation = randomUUID();
    const { ready, timeline } = await runPhase("HTTP_READY_REPLAY", async () => {
      const timelineStart = await alignReadyClock(prisma, clock, sessionId);
      const timeline = createHttpTimeline(timelineStart);
      const ready = await http.request(`/api/daily-goal/tracking-sessions/${sessionId}/engagement`, { method: "POST", cookie: user.cookie, json: { operation_id: readyOperation, event_type: "READY" } });
      assert.equal(ready.status, 200);
      const replay = await http.request(`/api/daily-goal/tracking-sessions/${sessionId}/engagement`, { method: "POST", cookie: user.cookie, json: { operation_id: readyOperation, event_type: "READY" } });
      assert.equal(replay.status, 200);
      return { ready, timeline };
    });
    await runPhase("HTTP_CONFLICTS", async () => {
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
    });

    await runPhase("HTTP_HEARTBEATS", async () => {
    for (const heartbeatAt of timeline.heartbeats) {
      clock.value = new Date(heartbeatAt);
      const heartbeatResponse = await http.request(`/api/daily-goal/tracking-sessions/${sessionId}/heartbeat`, { method: "POST", cookie: user.cookie, json: { operation_id: randomUUID(), generation: ready.json.data.generation, eligibility: "VISIBLE_FOCUSED_ACTIVE" } });
      assert.equal(heartbeatResponse.status, 200);
    }
    const prefixBefore = await dayMilliseconds(prisma, user.id);
    assert.equal(prefixBefore, 100_000n);
    });
    await runPhase("HTTP_IDLE_TERMINAL", async () => {
    clock.value = new Date(timeline.terminal);
    const idleOperation = randomUUID();
    const idle = await http.request(`/api/daily-goal/tracking-sessions/${sessionId}/engagement`, { method: "POST", cookie: user.cookie, json: { operation_id: idleOperation, generation: ready.json.data.generation, event_type: "REVEAL" } });
    assert.equal(idle.status, 409);
    assert.equal(idle.json.error.code, "IDLE_RESUME_REQUIRED");
    assert.equal(await dayMilliseconds(prisma, user.id), 120_000n);
    const terminalReceipt = await prisma.dAILY_GOAL_OPERATION_RECEIPT.findUnique({ where: { operation_id: idleOperation } });
    assert.equal(terminalReceipt.credited_milliseconds, 20_000n);
    assert.equal(await prisma.dAILY_GOAL_OPERATION_RECEIPT.count({ where: { user_id: user.id, operation_id: idleOperation } }), 1);
    });
    return runPhase("HTTP_EVIDENCE", () => buildHttpEvidenceForTest({ mismatchUnchanged: true, staleUnchanged: true, unknownUnchanged: true, idlePrefixBounded: true }, { httpAuthorization: pass(3), httpConflicts: pass(14) }));
    },
  });
}

async function createIdentity(prisma, role, users) { const user = await prisma.uSER.create({ data: { email: `${role.toLowerCase()}-${randomUUID()}@example.test`, password_hash: "not-used", display_name: role, role } }); users.push(user.id); const token = randomBytes(32).toString("base64url"); await prisma.aUTH_SESSION.create({ data: { user_id: user.id, session_identifier_hash: createHash("sha256").update(token).digest("hex"), expires_at: new Date("2099-12-01T00:00:00.000Z") } }); return { ...user, cookie: `session_id=${token}` }; }
function createLearning(prisma, userId, createdAt) { const instant = requireDate(createdAt); return prisma.lEARNING_SESSION.create({ data: { user_id: userId, set_id_snapshot: randomUUID(), mode: "NORMAL", status: "ACTIVE", create_operation_id: randomUUID(), snapshot_size: 1, created_at: instant, expires_at: new Date(instant.getTime() + (7 * DAY_MILLISECONDS)) } }); }
async function alignReadyClock(prisma, clock, trackingSessionId) { const session = await prisma.dAILY_GOAL_TRACKING_SESSION.findUnique({ where: { id: trackingSessionId }, select: { created_at: true } }); const createdAt = requireDate(session?.created_at); const current = requireDate(clock.value); clock.value = new Date(Math.max(current.getTime(), createdAt.getTime())); return clock.value.getTime(); }
function createHttpTimeline(timelineStart) { if (!Number.isSafeInteger(timelineStart)) throw new TypeError("Timeline start is invalid."); return Object.freeze({ heartbeats: Object.freeze([20, 40, 60, 80, 100].map((seconds) => timelineStart + (seconds * 1_000))), terminal: timelineStart + 120_000 }); }
function establish(operation_id, learning_session_id) { return { operation_id, activity_type: "NORMAL", learning_session_id }; }
function pass(assertions) { return Object.freeze({ status: "PASS", assertions }); }
async function dayMilliseconds(prisma, userId) { const result = await prisma.dAILY_GOAL_DAY.aggregate({ where: { user_id: userId }, _sum: { active_milliseconds: true } }); return result._sum.active_milliseconds ?? 0n; }
async function durableSnapshot(prisma, userId) { const [owner, sessions, days, receipts] = await Promise.all([prisma.dAILY_GOAL_OWNER.findUnique({ where: { user_id: userId } }), prisma.dAILY_GOAL_TRACKING_SESSION.findMany({ where: { user_id: userId }, orderBy: { id: "asc" } }), prisma.dAILY_GOAL_DAY.findMany({ where: { user_id: userId }, orderBy: { activity_date: "asc" } }), prisma.dAILY_GOAL_OPERATION_RECEIPT.findMany({ where: { user_id: userId }, orderBy: { operation_id: "asc" } })]); return structuredClone({ owner, sessions, days, receipts }); }
async function cleanup(prisma, ids) { if (!ids.length) return; await prisma.dAILY_GOAL_OPERATION_RECEIPT.deleteMany({ where: { user_id: { in: ids } } }); await prisma.dAILY_GOAL_OWNER.deleteMany({ where: { user_id: { in: ids } } }); await prisma.dAILY_GOAL_TRACKING_SESSION.deleteMany({ where: { user_id: { in: ids } } }); await prisma.dAILY_GOAL_DAY.deleteMany({ where: { user_id: { in: ids } } }); await prisma.lEARNING_SESSION.deleteMany({ where: { user_id: { in: ids } } }); await prisma.aUTH_SESSION.deleteMany({ where: { user_id: { in: ids } } }); await prisma.uSER.deleteMany({ where: { id: { in: ids } } }); }

async function runHttpDiagnosticLifecycle({ execute, close, cleanup, diagnosticWriter = defaultDiagnosticWriter }) {
  let primaryFailed = false; let primaryError; let primaryPhase; let result;
  const runPhase = async (phase, operation) => { assertHttpPhase(phase); try { return await operation(); } catch (error) { if (!primaryFailed) { primaryFailed = true; primaryError = error; primaryPhase = phase; } throw error; } };
  try { result = await execute(runPhase); }
  catch (error) { if (!primaryFailed) { primaryFailed = true; primaryError = error; primaryPhase = "HTTP_UNCLASSIFIED"; } }
  try { await close(); }
  catch (error) { if (!primaryFailed) { primaryFailed = true; primaryError = error; primaryPhase = "HTTP_SERVER_CLOSE"; } }
  try { await cleanup(); }
  catch (error) { if (!primaryFailed) { primaryFailed = true; primaryError = error; primaryPhase = "HTTP_FIXTURE_CLEANUP"; } }
  if (primaryFailed) { try { emitHttpDiagnostic(primaryPhase, diagnosticWriter); } catch {} throw primaryError; }
  return result;
}

function emitHttpDiagnostic(phase, writer) { assertHttpPhase(phase); if (typeof writer !== "function") throw new TypeError("HTTP diagnostic writer is required."); const line = `${JSON.stringify({ outcome: "DG2_HTTP_STAGE_REFUSED", httpStage: phase })}\n`; if (Buffer.byteLength(line, "utf8") > HTTP_DIAGNOSTIC_LIMIT_BYTES) throw new Error("HTTP diagnostic output exceeds its bound."); writer(line); }
function assertHttpPhase(phase) { if (!HTTP_DIAGNOSTIC_PHASES.has(phase)) throw new Error("HTTP diagnostic phase is not allowlisted."); }
function defaultDiagnosticWriter(line) { process.stdout.write(line); }
function requireDate(value) { if (!(value instanceof Date) || Number.isNaN(value.getTime())) throw new TypeError("Harness timestamp is invalid."); return new Date(value); }

export function buildHttpEvidenceForTest(checks, categories) {
  for (const key of ["mismatchUnchanged", "staleUnchanged", "unknownUnchanged", "idlePrefixBounded"]) if (checks?.[key] !== true) throw new Error("DG-2 HTTP durable evidence is incomplete.");
  for (const key of ["httpAuthorization", "httpConflicts"]) if (categories?.[key]?.status !== "PASS" || !Number.isInteger(categories[key].assertions) || categories[key].assertions < 1) throw new Error("DG-2 HTTP category evidence is incomplete.");
  return Object.freeze({ httpAuthorization: categories.httpAuthorization, httpConflicts: categories.httpConflicts });
}

export function createLearningForTest(options) { return createLearning(options.prisma, options.userId, options.createdAt); }
export function createIdentityForTest(options) { return createIdentity(options.prisma, options.role, options.users); }
export function alignReadyClockForTest(options) { return alignReadyClock(options.prisma, options.clock, options.trackingSessionId); }
export function createHttpTimelineForTest(timelineStart) { return createHttpTimeline(timelineStart); }
export function runHttpDiagnosticLifecycleForTest(options) { return runHttpDiagnosticLifecycle(options); }
export function httpDiagnosticLineForTest(phase) { let output = ""; emitHttpDiagnostic(phase, (line) => { output += line; }); return output; }
