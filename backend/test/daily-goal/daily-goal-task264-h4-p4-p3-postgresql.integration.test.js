import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { isIP } from "node:net";
import path from "node:path";
import test, { after, before } from "node:test";
import { pathToFileURL } from "node:url";

import { createDailyGoalRepository, createDailyGoalRepositoryForTest } from "../../src/repositories/daily-goal-repository.js";
import { createDailyGoalLifecycleMaintenanceRunner, createDailyGoalService } from "../../src/services/daily-goal-service.js";
import { DATABASE_IDENTITY, MIGRATIONS, validateLocalDatabaseTarget } from "./daily-goal-task264-h4-p4-p3-core.js";

const authorized = process.env.TASK264_P3_INTEGRATION_AUTHORIZED === "true";
if (!authorized) throw new Error("TASK-264 PostgreSQL integration execution is not authorized.");
validateLocalDatabaseTarget(process.env.TASK264_P3_JOB_DATABASE_URL);
const generated = process.env.TASK264_P3_GENERATED_CLIENT;
if (!path.isAbsolute(generated ?? "")) throw new Error("Disposable generated client path is invalid.");
const { PrismaClient } = await import(pathToFileURL(path.join(generated, "client.ts")).href);
const prisma = new PrismaClient({ datasourceUrl: process.env.TASK264_P3_JOB_DATABASE_URL });
const repository = createDailyGoalRepository(prisma);
const LEASE_MS = boundedInteger(process.env.TASK264_P3_TEST_ONLY_LEASE_MS, 100, 60_000);
const TIMEOUT_MS = boundedInteger(process.env.TASK264_P3_TEST_ONLY_TIMEOUT_MS, 1_000, 120_000);
const USER_A = "10000000-0000-4000-8000-000000000001";
const USER_B = "10000000-0000-4000-8000-000000000002";
const SESSION_A = "20000000-0000-4000-8000-000000000001";
const SESSION_B = "20000000-0000-4000-8000-000000000002";

before(async () => {
  await prisma.$connect();
  await resetFixturesStrict();
  await prisma.$executeRaw`INSERT INTO "USER" ("id","email","password_hash","display_name","updated_at") VALUES
    (${USER_A}::uuid, 'task264-a@example.invalid', 'not-a-real-password-hash', 'Task 264 A', clock_timestamp()),
    (${USER_B}::uuid, 'task264-b@example.invalid', 'not-a-real-password-hash', 'Task 264 B', clock_timestamp())`;
  await prisma.dAILY_GOAL_LIFECYCLE_POLICY.create({ data: { policy_version: 1, activated_at: new Date(Date.now() - 1000) } });
});

after(async () => {
  const failures = [];
  try { await resetFixturesStrict(); } catch (error) { failures.push(error); }
  try { await prisma.$disconnect(); } catch (error) { failures.push(error); }
  if (failures.length) throw new AggregateError(failures, "PostgreSQL fixture teardown failed.");
});

test("migration history contains the reviewed four-draft suffix and lifecycle delegates are usable", { timeout: TIMEOUT_MS }, async () => {
  const history = await prisma.$queryRaw`SELECT migration_name, checksum, finished_at, rolled_back_at FROM "_prisma_migrations" ORDER BY started_at`;
  const suffix = history.filter(({ migration_name: name }) => MIGRATIONS.some(({ name: expected }) => expected === name));
  assert.deepEqual(suffix.map(({ migration_name: name }) => name), MIGRATIONS.map(({ name }) => name));
  assert.deepEqual(suffix.map(({ checksum }) => checksum), MIGRATIONS.map(({ sha256 }) => sha256));
  assert.equal(suffix.every(({ finished_at, rolled_back_at }) => finished_at && rolled_back_at === null), true);
  assert.equal(await prisma.dAILY_GOAL_LIFECYCLE_POLICY.count(), 1);
  assert.equal(await prisma.dAILY_GOAL_LIFECYCLE_JOURNAL.count(), 0);
});

test("database identity is PostgreSQL 17 on the exact isolated target", { timeout: TIMEOUT_MS }, async () => {
  const [row] = await prisma.$queryRaw`SELECT current_database() AS database, current_user AS username,
    host(inet_server_addr()) AS host, inet_server_port()::int AS port,
    (current_setting('server_version_num')::int / 10000)::int AS major`;
  assert.deepEqual(
    { database: row.database, username: row.username, port: row.port, major: row.major },
    { database: DATABASE_IDENTITY.database, username: DATABASE_IDENTITY.username, port: 5432, major: 17 },
  );
  assert.notEqual(isIP(row.host), 0);
});

test("constraints reject malformed terminal, journal cursor, lease and pending state", { timeout: TIMEOUT_MS }, async () => {
  await rejectsDatabaseConstraint(prisma.$executeRaw`INSERT INTO "DAILY_GOAL_TRACKING_SESSION"
    ("id","user_id","activity_type","status","created_at","updated_at","closed_at","expired_at") VALUES
    (gen_random_uuid(),${USER_A}::uuid,'NORMAL','EXPIRED',clock_timestamp(),clock_timestamp(),clock_timestamp(),clock_timestamp())`, "DAILY_GOAL_TRACKING_SESSION_lifecycle_check");
  await rejectsDatabaseConstraint(prisma.$executeRaw`INSERT INTO "DAILY_GOAL_LIFECYCLE_JOURNAL"
    ("policy_version","scan_eligibility_at","pending_descriptors","pending_index","updated_at") VALUES
    (1,clock_timestamp(),'[]'::jsonb,0,clock_timestamp())`, "DAILY_GOAL_LIFECYCLE_JOURNAL_cursor_complete");
  await rejectsDatabaseConstraint(prisma.$executeRaw`INSERT INTO "DAILY_GOAL_LIFECYCLE_JOURNAL"
    ("policy_version","pending_descriptors","pending_index","lease_token","updated_at") VALUES
    (1,'[]'::jsonb,0,gen_random_uuid(),clock_timestamp())`, "DAILY_GOAL_LIFECYCLE_JOURNAL_lease_complete");
  await rejectsDatabaseConstraint(prisma.$executeRaw`INSERT INTO "DAILY_GOAL_LIFECYCLE_JOURNAL"
    ("policy_version","pending_descriptors","pending_index","updated_at") VALUES
    (1,'[]'::jsonb,1,clock_timestamp())`, "DAILY_GOAL_LIFECYCLE_JOURNAL_pending_index");
});

test("missing activation fails closed and concurrent journal initialization has one authority", { timeout: TIMEOUT_MS }, async () => {
  await prisma.dAILY_GOAL_LIFECYCLE_JOURNAL.deleteMany();
  await prisma.dAILY_GOAL_LIFECYCLE_POLICY.deleteMany();
  const missing = await repository.claimLifecycleJournal({ policyVersion: 1, leaseToken: crypto.randomUUID(), leaseDurationMilliseconds: LEASE_MS });
  assert.equal(missing.classification, "POLICY_MISSING");
  await prisma.dAILY_GOAL_LIFECYCLE_POLICY.create({ data: { policy_version: 1, activated_at: new Date(Date.now() - 1000) } });
  const tokens = [crypto.randomUUID(), crypto.randomUUID()];
  const results = await Promise.all(tokens.map((leaseToken) => repository.claimLifecycleJournal({ policyVersion: 1, leaseToken, leaseDurationMilliseconds: LEASE_MS })));
  assert.equal(results.filter(({ classification }) => classification === "CLAIMED").length, 1);
  assert.equal(results.filter(({ classification }) => classification === "LEASE_BUSY").length, 1);
  assert.equal(await prisma.dAILY_GOAL_LIFECYCLE_JOURNAL.count(), 1);
});

test("wrong policy version does not activate version 1 and activation boundary excludes only historical rows", { timeout: TIMEOUT_MS }, async () => {
  await resetTracking();
  await prisma.dAILY_GOAL_LIFECYCLE_POLICY.deleteMany();
  await prisma.dAILY_GOAL_LIFECYCLE_POLICY.create({ data: { policy_version: 2, activated_at: new Date(Date.now() - 1000) } });
  const wrong = await repository.claimLifecycleJournal({ policyVersion: 1, leaseToken: crypto.randomUUID(), leaseDurationMilliseconds: LEASE_MS });
  assert.equal(wrong.classification, "POLICY_MISSING");
  const activation = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  await prisma.dAILY_GOAL_LIFECYCLE_POLICY.create({ data: { policy_version: 1, activated_at: activation } });
  const old = new Date(activation.getTime() - 1);
  await prisma.dAILY_GOAL_TRACKING_SESSION.createMany({ data: [
    { id: SESSION_A, user_id: USER_A, activity_type: "NORMAL", status: "ACTIVE", created_at: activation, updated_at: activation },
    { id: SESSION_B, user_id: USER_B, activity_type: "NORMAL", status: "ACTIVE", created_at: old, updated_at: old },
  ] });
  const rows = await repository.discoverLifecycleCandidates({ activatedAt: activation, evaluatedAt: new Date() });
  assert.deepEqual(rows.map(({ stable_id }) => stable_id), [SESSION_A]);
  await prisma.dAILY_GOAL_LIFECYCLE_POLICY.delete({ where: { policy_version: 2 } });
});

test("expired lease takeover rejects stale token and revision finalization while preserving pending work", { timeout: TIMEOUT_MS }, async () => {
  await prisma.dAILY_GOAL_LIFECYCLE_JOURNAL.deleteMany();
  const initialToken = crypto.randomUUID();
  const initial = await repository.claimLifecycleJournal({ policyVersion: 1, leaseToken: initialToken, leaseDurationMilliseconds: LEASE_MS });
  assert.equal(initial.classification, "CLAIMED");
  const journal = await prisma.dAILY_GOAL_LIFECYCLE_JOURNAL.findUnique({ where: { policy_version: 1 } });
  await prisma.dAILY_GOAL_LIFECYCLE_JOURNAL.update({ where: { policy_version: 1 }, data: {
    pending_descriptors: [{ candidate_kind: "MONITOR" }], pending_index: 0, lease_expires_at: new Date(Date.now() - 1),
  } });
  const token = crypto.randomUUID();
  const takeover = await repository.claimLifecycleJournal({ policyVersion: 1, leaseToken: token, leaseDurationMilliseconds: LEASE_MS });
  assert.equal(takeover.classification, "CLAIMED");
  assert.deepEqual(takeover.journal.pending_descriptors, [{ candidate_kind: "MONITOR" }]);
  const stale = await repository.updateLifecycleJournal({
    policyVersion: 1, leaseToken: journal.lease_token, revision: journal.revision, pendingIndex: 0,
    pendingDescriptors: [{ candidate_kind: "MONITOR" }], nextPendingDescriptors: [], nextPendingIndex: 0,
    nextCursor: null, wrappedEpoch: journal.wrapped_epoch,
  });
  assert.equal(stale.count, 0);
});

test("candidate discovery is inclusive, globally ordered and continues across the 25/26 boundary", { timeout: TIMEOUT_MS }, async () => {
  await prisma.dAILY_GOAL_TRACKING_SESSION.deleteMany();
  const activation = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  await prisma.dAILY_GOAL_LIFECYCLE_POLICY.update({ where: { policy_version: 1 }, data: { activated_at: activation } });
  const anchor = new Date(Date.now() - 24 * 60 * 60 * 1000);
  for (let index = 1; index <= 26; index += 1) {
    const id = `30000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
    await prisma.dAILY_GOAL_TRACKING_SESSION.create({ data: { id, user_id: index % 2 ? USER_A : USER_B, activity_type: "NORMAL", status: "ACTIVE", created_at: anchor, updated_at: anchor } });
  }
  const first = await repository.discoverLifecycleCandidates({ activatedAt: activation, evaluatedAt: new Date(), limit: 25 });
  assert.equal(first.length, 25);
  const tail = first.at(-1);
  const second = await repository.discoverLifecycleCandidates({ activatedAt: activation, evaluatedAt: new Date(), cursor: {
    eligibilityAt: tail.eligibility_at, candidateKindOrder: tail.candidate_kind_order, stableId: tail.stable_id,
  }, limit: 25 });
  assert.equal(second.length, 1);
  assert.equal(new Set([...first, ...second].map(({ stable_id }) => stable_id)).size, 26);
});

test("equal-time candidates order tracking before monitor and UUIDs ascending within each kind", { timeout: TIMEOUT_MS }, async () => {
  await resetTracking(); await prisma.dAILY_GOAL_MONITOR_SESSION.deleteMany();
  const activation = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  await prisma.dAILY_GOAL_LIFECYCLE_POLICY.update({ where: { policy_version: 1 }, data: { activated_at: activation } });
  const anchor = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await prisma.dAILY_GOAL_TRACKING_SESSION.createMany({ data: [
    { id: SESSION_B, user_id: USER_B, activity_type: "NORMAL", status: "ACTIVE", created_at: anchor, updated_at: anchor },
    { id: SESSION_A, user_id: USER_A, activity_type: "NORMAL", status: "ACTIVE", created_at: anchor, updated_at: anchor },
  ] });
  await prisma.dAILY_GOAL_MONITOR_SESSION.createMany({ data: [
    { id: "50000000-0000-4000-8000-000000000002", user_id: USER_B, started_at: anchor, last_seen_at: anchor, continuity_started_at: anchor, eligible_baseline_at: anchor },
    { id: "50000000-0000-4000-8000-000000000001", user_id: USER_A, started_at: anchor, last_seen_at: anchor, continuity_started_at: anchor, eligible_baseline_at: anchor },
  ] });
  const rows = await repository.discoverLifecycleCandidates({ activatedAt: activation, evaluatedAt: new Date() });
  assert.deepEqual(rows.map(({ candidate_kind, stable_id }) => `${candidate_kind}:${stable_id}`), [
    `TRACKING:${SESSION_A}`, `TRACKING:${SESSION_B}`,
    "MONITOR:50000000-0000-4000-8000-000000000001", "MONITOR:50000000-0000-4000-8000-000000000002",
  ]);
});

test("cursor wrap resumes before the persisted high cursor without skipping an eligible descriptor", { timeout: TIMEOUT_MS }, async () => {
  await resetTracking(); await prisma.dAILY_GOAL_MONITOR_SESSION.deleteMany();
  const activation = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  await prisma.dAILY_GOAL_LIFECYCLE_POLICY.update({ where: { policy_version: 1 }, data: { activated_at: activation } });
  const created = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  await prisma.dAILY_GOAL_TRACKING_SESSION.create({ data: { id: SESSION_A, user_id: USER_A, activity_type: "NORMAL", status: "ACTIVE", created_at: created, updated_at: created } });
  await prisma.dAILY_GOAL_LIFECYCLE_JOURNAL.create({ data: {
    policy_version: 1, scan_eligibility_at: new Date("2999-01-01T00:00:00.000Z"), scan_candidate_kind: "MONITOR",
    scan_stable_id: "ffffffff-ffff-4fff-bfff-ffffffffffff", pending_descriptors: [], pending_index: 0, updated_at: new Date(),
  } });
  const result = await createDailyGoalLifecycleMaintenanceRunner({ dailyGoalRepository: repository, leaseDurationMilliseconds: LEASE_MS })();
  const journal = await prisma.dAILY_GOAL_LIFECYCLE_JOURNAL.findUnique({ where: { policy_version: 1 } });
  assert.equal(result.expiry.transitioned, 1); assert.equal(journal.wrapped_epoch, 1n);
  assert.equal((await prisma.dAILY_GOAL_TRACKING_SESSION.findUnique({ where: { id: SESSION_A } })).status, "EXPIRED");
});

test("F2 owner clear and zero-row expiry roll back atomically in PostgreSQL", { timeout: TIMEOUT_MS }, async () => {
  await resetTracking();
  const created = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  await seedTrackingOwner(created);
  await prisma.$executeRawUnsafe(`CREATE FUNCTION public.task264_skip_expiry() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.status = 'EXPIRED' THEN RETURN NULL; END IF; RETURN NEW; END $$`);
  await prisma.$executeRawUnsafe(`CREATE TRIGGER task264_skip_expiry BEFORE UPDATE ON "DAILY_GOAL_TRACKING_SESSION" FOR EACH ROW EXECUTE FUNCTION public.task264_skip_expiry()`);
  try {
    const runner = createDailyGoalLifecycleMaintenanceRunner({ dailyGoalRepository: repository, leaseDurationMilliseconds: LEASE_MS });
    const result = await runner();
    const owner = await prisma.dAILY_GOAL_OWNER.findUnique({ where: { user_id: USER_A } });
    const session = await prisma.dAILY_GOAL_TRACKING_SESSION.findUnique({ where: { id: SESSION_A } });
    assert.equal(result.expiry.attempted >= 1, true); assert.equal(result.expiry.transitioned, 0);
    assert.equal(owner.tracking_session_id, SESSION_A); assert.equal(owner.generation, 7n);
    assert.equal(session.status, "ACTIVE"); assert.equal(session.expired_at, null);
  } finally {
    await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS task264_skip_expiry ON "DAILY_GOAL_TRACKING_SESSION"`);
    await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS public.task264_skip_expiry()`);
  }
});

test("successful owner clear and tracking expiry commit together without durable side effects", { timeout: TIMEOUT_MS }, async () => {
  await resetTracking();
  const created = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  await seedTrackingOwner(created);
  await prisma.dAILY_GOAL_LIFECYCLE_JOURNAL.deleteMany();
  const runner = createDailyGoalLifecycleMaintenanceRunner({ dailyGoalRepository: repository, leaseDurationMilliseconds: LEASE_MS });
  const result = await runner();
  const owner = await prisma.dAILY_GOAL_OWNER.findUnique({ where: { user_id: USER_A } });
  const session = await prisma.dAILY_GOAL_TRACKING_SESSION.findUnique({ where: { id: SESSION_A } });
  assert.equal(result.expiry.transitioned, 1); assert.equal(owner.tracking_session_id, null); assert.equal(owner.generation, 8n);
  assert.equal(session.status, "EXPIRED"); assert.ok(session.expired_at);
  const [counts] = await prisma.$queryRaw`SELECT
    (SELECT count(*)::int FROM "DAILY_GOAL_REWARD") rewards,
    (SELECT count(*)::int FROM "USER_NOTIFICATION") notifications,
    (SELECT count(*)::int FROM "DAILY_GOAL_OPERATION_RECEIPT") receipts,
    (SELECT count(*)::int FROM "DAILY_GOAL_DAY") days`;
  assert.deepEqual(counts, { rewards: 0, notifications: 0, receipts: 0, days: 0 });
});

test("USER advisory lock serializes same-owner transactions", { timeout: TIMEOUT_MS }, async () => {
  let releaseFirst; let signalEntered;
  const firstEntered = new Promise((resolve) => { signalEntered = resolve; });
  const release = new Promise((resolve) => { releaseFirst = resolve; });
  let secondEntered = false;
  const first = repository.withUserTransaction(USER_A, async () => { signalEntered(); await release; });
  await firstEntered;
  let second;
  try {
    second = repository.withUserTransaction(USER_A, async () => { secondEntered = true; });
    await waitForAdvisoryContention();
    assert.equal(secondEntered, false);
  } finally {
    releaseFirst();
    await Promise.allSettled([first, ...(second ? [second] : [])]);
  }
  await Promise.all([first, second]);
  assert.equal(secondEntered, true);
});

test("ordinary transaction error rolls owner mutation back", { timeout: TIMEOUT_MS }, async () => {
  await resetTracking();
  const created = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); await seedTrackingOwner(created);
  await assert.rejects(repository.withUserTransaction(USER_A, async (transaction) => {
    const updated = await transaction.updateOwnerAtGeneration(7n, { generation: 8n, tracking_session_id: null });
    assert.equal(updated.count, 1); throw new Error("injected ordinary database-path failure");
  }), /injected ordinary database-path failure/);
  const owner = await prisma.dAILY_GOAL_OWNER.findUnique({ where: { user_id: USER_A } });
  assert.equal(owner.generation, 7n); assert.equal(owner.tracking_session_id, SESSION_A);
});

test("crash after USER commit but before journal finalization replays without duplicate transition", { timeout: TIMEOUT_MS }, async () => {
  await resetTracking();
  const activation = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  await prisma.dAILY_GOAL_LIFECYCLE_POLICY.update({ where: { policy_version: 1 }, data: { activated_at: activation } });
  const created = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  await prisma.dAILY_GOAL_TRACKING_SESSION.create({ data: { id: SESSION_A, user_id: USER_A, activity_type: "NORMAL", status: "ACTIVE", created_at: created, updated_at: created } });
  let failFinalization = true;
  const crashingRepository = Object.freeze({ ...repository,
    async updateLifecycleJournal(args) {
      if (failFinalization && args.nextPendingIndex === 1) { failFinalization = false; throw new Error("injected journal finalization crash"); }
      return repository.updateLifecycleJournal(args);
    },
  });
  const first = await createDailyGoalLifecycleMaintenanceRunner({ dailyGoalRepository: crashingRepository, leaseDurationMilliseconds: LEASE_MS })();
  assert.equal(first.expiry.classification, "FAILED");
  assert.equal((await prisma.dAILY_GOAL_TRACKING_SESSION.findUnique({ where: { id: SESSION_A } })).status, "EXPIRED");
  let journal = await prisma.dAILY_GOAL_LIFECYCLE_JOURNAL.findUnique({ where: { policy_version: 1 } });
  assert.equal(journal.pending_index, 0);
  await prisma.dAILY_GOAL_LIFECYCLE_JOURNAL.update({ where: { policy_version: 1 }, data: { lease_expires_at: new Date(Date.now() - 1) } });
  const second = await createDailyGoalLifecycleMaintenanceRunner({ dailyGoalRepository: repository, leaseDurationMilliseconds: LEASE_MS })();
  journal = await prisma.dAILY_GOAL_LIFECYCLE_JOURNAL.findUnique({ where: { policy_version: 1 } });
  assert.equal(second.expiry.transitioned, 0); assert.equal(journal.wrapped_epoch, 1n);
  assert.equal(journal.pending_index, 0); assert.deepEqual(journal.pending_descriptors, []);
  assert.equal(await prisma.dAILY_GOAL_TRACKING_SESSION.count({ where: { status: "EXPIRED" } }), 1);
});

test("cleanup uses a shared 100-row ceiling and preserves retained receipts and current owners", { timeout: TIMEOUT_MS }, async () => {
  await resetTracking();
  const old = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
  const rows = Array.from({ length: 100 }, (_, index) => ({ id: `40000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`, user_id: index % 2 ? USER_A : USER_B, activity_type: "NORMAL", status: "CLOSED", created_at: old, updated_at: old, closed_at: old }));
  const receiptProtected = "41000000-0000-4000-8000-000000000001";
  const ownerProtected = "41000000-0000-4000-8000-000000000002";
  await prisma.dAILY_GOAL_TRACKING_SESSION.createMany({ data: rows });
  await prisma.dAILY_GOAL_TRACKING_SESSION.createMany({ data: [
    { id: receiptProtected, user_id: USER_A, activity_type: "NORMAL", status: "CLOSED", created_at: old, updated_at: old, closed_at: old },
    { id: ownerProtected, user_id: USER_B, activity_type: "NORMAL", status: "CLOSED", created_at: old, updated_at: old, closed_at: old },
  ] });
  await prisma.dAILY_GOAL_OPERATION_RECEIPT.create({ data: {
    operation_id: "42000000-0000-4000-8000-000000000001", user_id: USER_A, tracking_session_id: receiptProtected,
    operation_type: "CREATE", request_fingerprint: "retained", response_projection: {}, created_at: new Date(),
  } });
  await prisma.dAILY_GOAL_OWNER.create({ data: { user_id: USER_B, tracking_session_id: ownerProtected, generation: 1n, updated_at: new Date() } });
  const result = await repository.withCleanupTransaction((transaction) => transaction.cleanupExpiredOperationalState());
  assert.equal(Object.values(result).reduce((sum, count) => sum + count, 0), 100);
  assert.equal(await prisma.dAILY_GOAL_TRACKING_SESSION.count({ where: { id: { in: rows.map(({ id }) => id) } } }), 0);
  assert.deepEqual((await prisma.dAILY_GOAL_TRACKING_SESSION.findMany({ where: { id: { in: [receiptProtected, ownerProtected] } }, orderBy: { id: "asc" }, select: { id: true } })).map(({ id }) => id), [receiptProtected, ownerProtected]);
});

test("cleanup deletes an expired receipt before its newly unprotected parent", { timeout: TIMEOUT_MS }, async () => {
  await resetTracking();
  const old = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
  await prisma.dAILY_GOAL_TRACKING_SESSION.create({ data: {
    id: SESSION_A, user_id: USER_A, activity_type: "NORMAL", status: "CLOSED",
    created_at: old, updated_at: old, closed_at: old,
  } });
  await prisma.dAILY_GOAL_OPERATION_RECEIPT.create({ data: {
    operation_id: "42000000-0000-4000-8000-000000000002", user_id: USER_A,
    tracking_session_id: SESSION_A, operation_type: "CREATE", request_fingerprint: "expired-child",
    response_projection: {}, created_at: old,
  } });
  const result = await repository.withCleanupTransaction((transaction) => transaction.cleanupExpiredOperationalState());
  assert.equal(result.receiptsDeleted, 1);
  assert.equal(result.trackingSessionsDeleted, 1);
  assert.equal(await prisma.dAILY_GOAL_OPERATION_RECEIPT.findUnique({ where: { operation_id: "42000000-0000-4000-8000-000000000002" } }), null);
  assert.equal(await prisma.dAILY_GOAL_TRACKING_SESSION.findUnique({ where: { id: SESSION_A } }), null);
});

test("cleanup retains rows exactly at 30/31-day cutoffs and deletes rows one millisecond older", { timeout: TIMEOUT_MS }, async () => {
  await resetTracking(); const now = new Date("2026-11-01T00:00:00.000Z");
  const cleanupRepository = createDailyGoalRepositoryForTest(prisma, { now: () => now });
  const parentBoundary = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000);
  const receiptBoundary = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  await prisma.dAILY_GOAL_TRACKING_SESSION.createMany({ data: [
    { id: SESSION_A, user_id: USER_A, activity_type: "NORMAL", status: "CLOSED", created_at: parentBoundary, updated_at: parentBoundary, closed_at: parentBoundary },
    { id: SESSION_B, user_id: USER_B, activity_type: "NORMAL", status: "CLOSED", created_at: new Date(parentBoundary.getTime() - 1), updated_at: new Date(parentBoundary.getTime() - 1), closed_at: new Date(parentBoundary.getTime() - 1) },
  ] });
  await prisma.dAILY_GOAL_OPERATION_RECEIPT.createMany({ data: [
    { operation_id: "43000000-0000-4000-8000-000000000001", user_id: USER_A, operation_type: "CREATE", request_fingerprint: "boundary", response_projection: {}, created_at: receiptBoundary },
    { operation_id: "43000000-0000-4000-8000-000000000002", user_id: USER_B, operation_type: "CREATE", request_fingerprint: "older", response_projection: {}, created_at: new Date(receiptBoundary.getTime() - 1) },
  ] });
  await cleanupRepository.withCleanupTransaction((transaction) => transaction.cleanupExpiredOperationalState());
  assert.ok(await prisma.dAILY_GOAL_TRACKING_SESSION.findUnique({ where: { id: SESSION_A } }));
  assert.equal(await prisma.dAILY_GOAL_TRACKING_SESSION.findUnique({ where: { id: SESSION_B } }), null);
  assert.ok(await prisma.dAILY_GOAL_OPERATION_RECEIPT.findUnique({ where: { operation_id: "43000000-0000-4000-8000-000000000001" } }));
  assert.equal(await prisma.dAILY_GOAL_OPERATION_RECEIPT.findUnique({ where: { operation_id: "43000000-0000-4000-8000-000000000002" } }), null);
});

test("cleanup advisory lock serializes concurrent cleanup transactions", { timeout: TIMEOUT_MS }, async () => {
  let releaseFirst; let signalEntered; let secondEntered = false;
  const entered = new Promise((resolve) => { signalEntered = resolve; });
  const release = new Promise((resolve) => { releaseFirst = resolve; });
  const first = repository.withCleanupTransaction(async () => { signalEntered(); await release; });
  await entered;
  let second;
  try {
    second = repository.withCleanupTransaction(async () => { secondEntered = true; });
    await waitForAdvisoryContention();
    assert.equal(secondEntered, false);
  } finally {
    releaseFirst();
    await Promise.allSettled([first, ...(second ? [second] : [])]);
  }
  await Promise.all([first, second]);
  assert.equal(secondEntered, true);
});

test("lifecycle runner commits at most 100 transitions per invocation", { timeout: TIMEOUT_MS }, async () => {
  await resetTracking(); const activation = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  await prisma.dAILY_GOAL_LIFECYCLE_POLICY.update({ where: { policy_version: 1 }, data: { activated_at: activation } });
  const old = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  await prisma.dAILY_GOAL_TRACKING_SESSION.createMany({ data: sessionRows(101, "60000000", old) });
  const result = await createDailyGoalLifecycleMaintenanceRunner({ dailyGoalRepository: repository, leaseDurationMilliseconds: LEASE_MS })();
  assert.equal(result.expiry.attempted, 100); assert.equal(result.expiry.transitioned, 100);
  assert.equal(await prisma.dAILY_GOAL_TRACKING_SESSION.count({ where: { status: "EXPIRED" } }), 100);
  assert.equal(await prisma.dAILY_GOAL_TRACKING_SESSION.count({ where: { status: "ACTIVE" } }), 1);
});

test("lifecycle runner stops after 300 attempted stale descriptors", { timeout: TIMEOUT_MS }, async () => {
  await resetTracking(); const activation = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  await prisma.dAILY_GOAL_LIFECYCLE_POLICY.update({ where: { policy_version: 1 }, data: { activated_at: activation } });
  const old = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  await prisma.dAILY_GOAL_TRACKING_SESSION.createMany({ data: sessionRows(301, "70000000", old) });
  const staleRepository = Object.freeze({ ...repository,
    async discoverLifecycleCandidates(args) {
      const rows = await repository.discoverLifecycleCandidates(args);
      await prisma.dAILY_GOAL_TRACKING_SESSION.updateMany({ where: { id: { in: rows.map(({ stable_id }) => stable_id) } }, data: { created_at: new Date() } });
      return rows;
    },
  });
  const result = await createDailyGoalLifecycleMaintenanceRunner({ dailyGoalRepository: staleRepository, leaseDurationMilliseconds: LEASE_MS })();
  assert.equal(result.expiry.attempted, 300); assert.equal(result.expiry.transitioned, 0);
  assert.equal(await prisma.dAILY_GOAL_TRACKING_SESSION.count({ where: { status: "EXPIRED" } }), 0);
});

test("G1 physical cleanup rolls every category back after a later failure and retry succeeds", { timeout: TIMEOUT_MS }, async () => {
  await resetTracking(); await prisma.dAILY_GOAL_MONITOR_SESSION.deleteMany();
  const old = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
  const monitorId = "81000000-0000-4000-8000-000000000001";
  await prisma.dAILY_GOAL_TRACKING_SESSION.create({ data: {
    id: SESSION_A, user_id: USER_A, activity_type: "NORMAL", status: "CLOSED",
    created_at: old, updated_at: old, closed_at: old,
  } });
  await prisma.dAILY_GOAL_MONITOR_SESSION.create({ data: {
    id: monitorId, user_id: USER_B, started_at: old, last_seen_at: old,
    continuity_started_at: old, eligible_baseline_at: old, closed_at: old,
  } });
  await prisma.dAILY_GOAL_OPERATION_RECEIPT.createMany({ data: [
    { operation_id: "81100000-0000-4000-8000-000000000001", user_id: USER_A, tracking_session_id: SESSION_A, operation_type: "CREATE", request_fingerprint: "g1-tracking", response_projection: {}, created_at: old },
    { operation_id: "81100000-0000-4000-8000-000000000002", user_id: USER_B, monitor_session_id: monitorId, operation_type: "MONITOR_CREATE", request_fingerprint: "g1-monitor", response_projection: {}, created_at: old },
  ] });
  await prisma.$executeRawUnsafe(`CREATE FUNCTION public.task264_fail_monitor_cleanup() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'task264 bounded monitor cleanup failure'; END $$`);
  await prisma.$executeRawUnsafe(`CREATE TRIGGER task264_fail_monitor_cleanup BEFORE DELETE ON "DAILY_GOAL_MONITOR_SESSION" FOR EACH ROW EXECUTE FUNCTION public.task264_fail_monitor_cleanup()`);
  try {
    await assert.rejects(repository.withCleanupTransaction((cleanup) => cleanup.cleanupExpiredOperationalState()));
    assert.equal(await prisma.dAILY_GOAL_OPERATION_RECEIPT.count({ where: { operation_id: { in: ["81100000-0000-4000-8000-000000000001", "81100000-0000-4000-8000-000000000002"] } } }), 2);
    assert.ok(await prisma.dAILY_GOAL_TRACKING_SESSION.findUnique({ where: { id: SESSION_A } }));
    assert.ok(await prisma.dAILY_GOAL_MONITOR_SESSION.findUnique({ where: { id: monitorId } }));
  } finally {
    await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS task264_fail_monitor_cleanup ON "DAILY_GOAL_MONITOR_SESSION"`);
    await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS public.task264_fail_monitor_cleanup()`);
  }
  const retry = await repository.withCleanupTransaction((cleanup) => cleanup.cleanupExpiredOperationalState());
  assert.deepEqual(retry, { receiptsDeleted: 2, trackingSessionsDeleted: 1, monitorSessionsDeleted: 1 });
});

test("G2 concurrent receipt and owner protection prevent stale cleanup deletion", { timeout: TIMEOUT_MS }, async () => {
  await resetTracking();
  const old = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
  await prisma.dAILY_GOAL_TRACKING_SESSION.create({ data: {
    id: SESSION_A, user_id: USER_A, activity_type: "NORMAL", status: "CLOSED",
    created_at: old, updated_at: old, closed_at: old,
  } });
  const blocker = new PrismaClient({ datasourceUrl: process.env.TASK264_P3_JOB_DATABASE_URL });
  await blocker.$connect();
  let release;
  const held = new Promise((resolve) => { release = resolve; });
  const lockHeld = blocker.$transaction(async (transaction) => {
    await transaction.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtextextended('daily-goal:cleanup', 0))`);
    await held;
  });
  await waitForCondition(async () => (await prisma.$queryRawUnsafe(`SELECT count(*)::int AS count FROM pg_locks WHERE locktype='advisory' AND granted`))[0].count >= 1);
  const cleanup = repository.withCleanupTransaction((candidate) => candidate.cleanupExpiredOperationalState());
  try {
    await waitForAdvisoryContention();
    await repository.withUserTransaction(USER_A, async (userRepository) => {
      await userRepository.createOperationReceipt({
        operation_id: "81200000-0000-4000-8000-000000000001", tracking_session_id: SESSION_A,
        operation_type: "CREATE", request_fingerprint: "g2-retained", response_projection: {}, created_at: new Date(),
      });
      await userRepository.upsertOwner({
        create: { tracking_session_id: SESSION_A, generation: 1n },
        update: { tracking_session_id: SESSION_A, generation: 1n },
      });
    });
  } finally {
    release(); await lockHeld;
  }
  assert.deepEqual(await cleanup, { receiptsDeleted: 0, trackingSessionsDeleted: 0, monitorSessionsDeleted: 0 });
  assert.ok(await prisma.dAILY_GOAL_TRACKING_SESSION.findUnique({ where: { id: SESSION_A } }));
  assert.ok(await prisma.dAILY_GOAL_OPERATION_RECEIPT.findUnique({ where: { operation_id: "81200000-0000-4000-8000-000000000001" } }));
  assert.equal((await prisma.dAILY_GOAL_OWNER.findUnique({ where: { user_id: USER_A } })).tracking_session_id, SESSION_A);
  await blocker.$disconnect();
});

test("G3 monitor cleanup matches strict retention receipt ordering and shared budget", { timeout: TIMEOUT_MS }, async () => {
  await resetTracking(); await prisma.dAILY_GOAL_MONITOR_SESSION.deleteMany();
  const now = new Date("2026-11-01T00:00:00.000Z");
  const boundary = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000);
  const older = new Date(boundary.getTime() - 1);
  const ids = ["81300000-0000-4000-8000-000000000001", "81300000-0000-4000-8000-000000000002", "81300000-0000-4000-8000-000000000003"];
  await prisma.dAILY_GOAL_MONITOR_SESSION.createMany({ data: [
    { id: ids[0], user_id: USER_A, started_at: boundary, last_seen_at: boundary, continuity_started_at: boundary, eligible_baseline_at: boundary, closed_at: boundary },
    { id: ids[1], user_id: USER_A, started_at: older, last_seen_at: older, continuity_started_at: older, eligible_baseline_at: older, closed_at: older },
    { id: ids[2], user_id: USER_B, started_at: older, last_seen_at: older, continuity_started_at: older, eligible_baseline_at: older, expired_at: older },
  ] });
  await prisma.dAILY_GOAL_OPERATION_RECEIPT.create({ data: {
    operation_id: "81310000-0000-4000-8000-000000000001", user_id: USER_B, monitor_session_id: ids[2],
    operation_type: "MONITOR_CREATE", request_fingerprint: "g3-retained", response_projection: {}, created_at: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
  } });
  const cleanupRepository = createDailyGoalRepositoryForTest(prisma, { now: () => now });
  const first = await cleanupRepository.withCleanupTransaction((cleanup) => cleanup.cleanupExpiredOperationalState());
  assert.deepEqual(first, { receiptsDeleted: 0, trackingSessionsDeleted: 0, monitorSessionsDeleted: 1 });
  assert.ok(await prisma.dAILY_GOAL_MONITOR_SESSION.findUnique({ where: { id: ids[0] } }));
  assert.equal(await prisma.dAILY_GOAL_MONITOR_SESSION.findUnique({ where: { id: ids[1] } }), null);
  assert.ok(await prisma.dAILY_GOAL_MONITOR_SESSION.findUnique({ where: { id: ids[2] } }));
  await prisma.dAILY_GOAL_OPERATION_RECEIPT.update({ where: { operation_id: "81310000-0000-4000-8000-000000000001" }, data: { created_at: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000 - 1) } });
  const second = await cleanupRepository.withCleanupTransaction((cleanup) => cleanup.cleanupExpiredOperationalState());
  assert.deepEqual(second, { receiptsDeleted: 1, trackingSessionsDeleted: 0, monitorSessionsDeleted: 1 });

  const budgetMonitors = Array.from({ length: 2 }, (_, index) => ({
    id: `81320000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    user_id: index === 0 ? USER_A : USER_B, started_at: older, last_seen_at: older,
    continuity_started_at: older, eligible_baseline_at: older, closed_at: older,
  }));
  await prisma.dAILY_GOAL_MONITOR_SESSION.createMany({ data: budgetMonitors });
  await prisma.dAILY_GOAL_OPERATION_RECEIPT.createMany({ data: Array.from({ length: 99 }, (_, index) => ({
    operation_id: `81330000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    user_id: index % 2 === 0 ? USER_A : USER_B, operation_type: "GOAL_UPDATE",
    request_fingerprint: `g3-budget-${index}`, response_projection: {}, created_at: new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000 - index),
  })) });
  const budget = await cleanupRepository.withCleanupTransaction((cleanup) => cleanup.cleanupExpiredOperationalState());
  assert.deepEqual(budget, { receiptsDeleted: 99, trackingSessionsDeleted: 0, monitorSessionsDeleted: 1 });
  assert.equal(Object.values(budget).reduce((sum, count) => sum + count, 0), 100);
  assert.equal(await prisma.dAILY_GOAL_MONITOR_SESSION.count({ where: { id: { in: budgetMonitors.map(({ id }) => id) } } }), 1);
});

test("G4 lifecycle matrix expires every approved kind at the inclusive boundary without side effects", { timeout: TIMEOUT_MS }, async () => {
  await resetTracking(); await prisma.dAILY_GOAL_MONITOR_SESSION.deleteMany();
  const evaluatedAt = new Date("2026-11-01T00:00:00.000Z");
  const activation = new Date(evaluatedAt.getTime() - 10 * 24 * 60 * 60 * 1000);
  await prisma.dAILY_GOAL_LIFECYCLE_POLICY.update({ where: { policy_version: 1 }, data: { activated_at: activation } });
  const tracking = [
    { id: "81400000-0000-4000-8000-000000000001", user_id: USER_A, activity_type: "NORMAL", status: "ACTIVE", created_at: new Date(evaluatedAt.getTime() - 24 * 60 * 60 * 1000), updated_at: activation },
    { id: "81400000-0000-4000-8000-000000000002", user_id: USER_B, activity_type: "NORMAL", status: "ACTIVE", created_at: activation, updated_at: activation, engagement_expires_at: new Date(evaluatedAt.getTime() - 24 * 60 * 60 * 1000) },
    { id: "81400000-0000-4000-8000-000000000003", user_id: USER_A, activity_type: "NORMAL", status: "PAUSED", created_at: activation, updated_at: activation, paused_at: new Date(evaluatedAt.getTime() - 7 * 24 * 60 * 60 * 1000) },
    { id: "81400000-0000-4000-8000-000000000004", user_id: USER_B, activity_type: "NORMAL", status: "ACTIVE", created_at: new Date(activation.getTime() - 1), updated_at: activation },
  ];
  await prisma.dAILY_GOAL_TRACKING_SESSION.createMany({ data: tracking });
  const monitorId = "81410000-0000-4000-8000-000000000001";
  await prisma.dAILY_GOAL_MONITOR_SESSION.create({ data: {
    id: monitorId, user_id: USER_B, started_at: activation, last_seen_at: new Date(evaluatedAt.getTime() - 24 * 60 * 60 * 1000),
    continuity_started_at: activation, eligible_baseline_at: activation,
  } });
  const trackingReplayOperation = "81420000-0000-4000-8000-000000000001";
  const trackingReplayRequest = {
    operation_id: trackingReplayOperation, activity_type: "SPEAKING",
    set_id: "81440000-0000-4000-8000-000000000001",
    vocabulary_id: "81440000-0000-4000-8000-000000000002",
  };
  const historicalTrackingProjection = {
    tracking_session_id: tracking[0].id, status: "ACTIVE", owner: false, generation: null,
    lease_expires_at: null, engagement_expires_at: null, credited_milliseconds: "0",
    projection: { credited_milliseconds: "0" },
  };
  const monitorReplayOperation = "81430000-0000-4000-8000-000000000001";
  const monitorReplayRequest = { operation_id: monitorReplayOperation };
  const historicalMonitorProjection = { reminder_created: false, unread_count: 0, next_check_after_seconds: 60 };
  await prisma.dAILY_GOAL_OPERATION_RECEIPT.createMany({ data: [
    {
      operation_id: trackingReplayOperation, user_id: USER_A, tracking_session_id: tracking[0].id,
      operation_type: "CREATE", request_fingerprint: sha256Json(trackingReplayRequest),
      response_projection: { outcome: "SUCCESS", data: historicalTrackingProjection }, created_at: evaluatedAt,
    },
    {
      operation_id: monitorReplayOperation, user_id: USER_B, monitor_session_id: monitorId,
      operation_type: "MONITOR_CHECK", request_fingerprint: sha256Json({ monitor_session_id: monitorId, ...monitorReplayRequest }),
      response_projection: { outcome: "SUCCESS", data: historicalMonitorProjection }, created_at: evaluatedAt,
    },
  ] });
  const clockedRepository = Object.freeze({
    ...repository,
    async claimLifecycleJournal(args) {
      const claim = await repository.claimLifecycleJournal(args);
      return claim.classification === "CLAIMED" ? { ...claim, policy: { ...claim.policy, database_now: evaluatedAt } } : claim;
    },
  });
  const result = await createDailyGoalLifecycleMaintenanceRunner({ dailyGoalRepository: clockedRepository, leaseDurationMilliseconds: LEASE_MS })();
  assert.equal(result.expiry.transitioned, 4);
  assert.equal(await prisma.dAILY_GOAL_TRACKING_SESSION.count({ where: { id: { in: tracking.slice(0, 3).map(({ id }) => id) }, status: "EXPIRED" } }), 3);
  assert.equal((await prisma.dAILY_GOAL_TRACKING_SESSION.findUnique({ where: { id: tracking[3].id } })).status, "ACTIVE");
  assert.ok((await prisma.dAILY_GOAL_MONITOR_SESSION.findUnique({ where: { id: monitorId } })).expired_at);
  const service = createDailyGoalService({ dailyGoalRepository: repository });
  const trackingReplay = await service.establish(USER_A, trackingReplayRequest);
  assert.deepEqual(trackingReplay, { ...historicalTrackingProjection, replayed: true });
  assert.notEqual(trackingReplay.status, "EXPIRED");
  const monitorReplay = await service.checkMonitor(USER_B, monitorId, monitorReplayRequest);
  assert.deepEqual(monitorReplay, { ...historicalMonitorProjection, replayed: true });
  await assert.rejects(
    service.checkMonitor(USER_B, monitorId, { operation_id: "81430000-0000-4000-8000-000000000002" }),
    (error) => error?.code === "DAILY_GOAL_NOT_FOUND",
  );
  assert.equal(await prisma.dAILY_GOAL_REWARD.count(), 0); assert.equal(await prisma.uSER_NOTIFICATION.count(), 0);
  assert.equal(await prisma.dAILY_GOAL_OPERATION_RECEIPT.count(), 2); assert.equal(await prisma.dAILY_GOAL_DAY.count(), 0);
});

test("G5 maintenance failures remain outside a committed authenticated USER mutation", { timeout: TIMEOUT_MS }, async () => {
  await resetTracking(); await prisma.uSER_NOTIFICATION.deleteMany();
  const notificationId = "81500000-0000-4000-8000-000000000001";
  await prisma.uSER_NOTIFICATION.create({ data: {
    id: notificationId, user_id: USER_A, type: "DAILY_GOAL_COMPLETED", application_date: new Date("2026-11-01T00:00:00.000Z"),
    title: "bounded", body: "bounded", created_at: new Date("2026-11-01T00:00:00.000Z"), read_at: null,
  } });
  const calls = []; const logs = []; let maintenance;
  const failingRepository = Object.freeze({
    ...repository,
    async claimLifecycleJournal() { calls.push("expiry"); throw new Error("injected expiry failure"); },
    withCleanupTransaction(callback) {
      calls.push("cleanup");
      return repository.withCleanupTransaction(callback);
    },
  });
  const runner = createDailyGoalLifecycleMaintenanceRunner({
    dailyGoalRepository: failingRepository, leaseDurationMilliseconds: LEASE_MS,
    logFailure: (code) => logs.push(code),
  });
  const service = createDailyGoalService({
    dailyGoalRepository: repository,
    scheduleOperationalCleanup: () => { maintenance = runner(); return true; },
  });
  const response = await service.markNotificationRead(USER_A, notificationId, { read: true });
  assert.equal(response.notification.id, notificationId); assert.ok(response.notification.read_at);
  const maintenanceResult = await maintenance;
  assert.equal(maintenanceResult.expiry.classification, "FAILED");
  assert.deepEqual(calls, ["expiry", "cleanup"]);
  assert.deepEqual(logs, ["DAILY_GOAL_LIFECYCLE_EXPIRY_FAILED"]);
  assert.ok((await prisma.uSER_NOTIFICATION.findUnique({ where: { id: notificationId } })).read_at);
  assert.doesNotMatch(JSON.stringify(logs), new RegExp(`${USER_A}|${notificationId}|postgresql|SELECT`, "i"));

  await prisma.uSER_NOTIFICATION.update({ where: { id: notificationId }, data: { read_at: null } });
  calls.length = 0; logs.length = 0; maintenance = null;
  const cleanupFailureRepository = Object.freeze({
    ...repository,
    async claimLifecycleJournal() { calls.push("expiry"); return { classification: "POLICY_MISSING" }; },
    async withCleanupTransaction() { calls.push("cleanup"); throw new Error("injected cleanup failure"); },
  });
  const cleanupFailureRunner = createDailyGoalLifecycleMaintenanceRunner({
    dailyGoalRepository: cleanupFailureRepository, leaseDurationMilliseconds: LEASE_MS,
    logFailure: (code) => logs.push(code),
  });
  const secondService = createDailyGoalService({
    dailyGoalRepository: repository,
    scheduleOperationalCleanup: () => { maintenance = cleanupFailureRunner(); return true; },
  });
  const secondResponse = await secondService.markNotificationRead(USER_A, notificationId, { read: true });
  assert.equal(secondResponse.notification.id, notificationId); assert.ok(secondResponse.notification.read_at);
  const cleanupFailureResult = await maintenance;
  assert.equal(cleanupFailureResult.expiry.classification, "POLICY_MISSING");
  assert.equal(cleanupFailureResult.cleanup.classification, "FAILED");
  assert.deepEqual(calls, ["expiry", "cleanup"]);
  assert.deepEqual(logs, ["DAILY_GOAL_LIFECYCLE_CLEANUP_FAILED"]);
  assert.ok((await prisma.uSER_NOTIFICATION.findUnique({ where: { id: notificationId } })).read_at);
  assert.doesNotMatch(JSON.stringify(logs), new RegExp(`${USER_A}|${notificationId}|postgresql|SELECT`, "i"));
});

async function seedTrackingOwner(created) {
  await prisma.dAILY_GOAL_TRACKING_SESSION.create({ data: { id: SESSION_A, user_id: USER_A, activity_type: "NORMAL", status: "ACTIVE", created_at: created, updated_at: created } });
  await prisma.dAILY_GOAL_OWNER.create({ data: { user_id: USER_A, tracking_session_id: SESSION_A, generation: 7n, lease_expires_at: new Date(Date.now() - 1000), updated_at: new Date() } });
}
async function resetTracking() {
  await prisma.dAILY_GOAL_LIFECYCLE_JOURNAL.deleteMany(); await prisma.dAILY_GOAL_OWNER.deleteMany();
  await prisma.dAILY_GOAL_OPERATION_RECEIPT.deleteMany(); await prisma.dAILY_GOAL_TRACKING_SESSION.deleteMany();
}
async function resetFixturesStrict() {
  await prisma.dAILY_GOAL_LIFECYCLE_JOURNAL.deleteMany();
  await prisma.dAILY_GOAL_OWNER.deleteMany();
  await prisma.dAILY_GOAL_OPERATION_RECEIPT.deleteMany();
  await prisma.dAILY_GOAL_TRACKING_SESSION.deleteMany();
  await prisma.dAILY_GOAL_MONITOR_SESSION.deleteMany();
  await prisma.dAILY_GOAL_REWARD.deleteMany();
  await prisma.uSER_NOTIFICATION.deleteMany();
  await prisma.dAILY_GOAL_DAY.deleteMany();
  await prisma.dAILY_GOAL_LIFECYCLE_POLICY.deleteMany();
  await prisma.uSER.deleteMany({ where: { id: { in: [USER_A, USER_B] } } });
}
async function rejectsDatabaseConstraint(operation, constraint) {
  await assert.rejects(operation, (error) => {
    const details = `${error?.message ?? ""} ${error?.meta?.message ?? ""} ${error?.meta?.database_error ?? ""}`;
    const sqlState = String(error?.meta?.code ?? error?.code ?? "");
    return details.includes(constraint) && (sqlState.includes("23514") || details.includes("check constraint"));
  });
}
function sessionRows(count, prefix, created) {
  return Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    user_id: index % 2 ? USER_A : USER_B, activity_type: "NORMAL", status: "ACTIVE",
    created_at: created, updated_at: created,
  }));
}
async function waitForAdvisoryContention() {
  const deadline = performance.now() + Math.min(5_000, Math.floor(TIMEOUT_MS / 4));
  while (performance.now() < deadline) {
    const [row] = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_locks AS waiting
        JOIN pg_catalog.pg_locks AS holding
          ON holding.locktype = waiting.locktype
         AND holding.database IS NOT DISTINCT FROM waiting.database
         AND holding.classid IS NOT DISTINCT FROM waiting.classid
         AND holding.objid IS NOT DISTINCT FROM waiting.objid
         AND holding.objsubid IS NOT DISTINCT FROM waiting.objsubid
         AND holding.pid <> waiting.pid
        WHERE waiting.locktype = 'advisory'
          AND waiting.granted = false
          AND holding.granted = true
      ) AS "contended"`;
    if (row?.contended === true) return;
    await delay(10);
  }
  throw new Error("Timed out waiting for bounded advisory-lock contention evidence.");
}
async function waitForCondition(predicate) {
  const deadline = performance.now() + Math.min(5_000, Math.floor(TIMEOUT_MS / 4));
  while (performance.now() < deadline) {
    if (await predicate()) return;
    await delay(10);
  }
  throw new Error("Timed out waiting for bounded PostgreSQL fixture state.");
}
function delay(milliseconds) { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }
function sha256Json(value) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
function boundedInteger(value, minimum, maximum) {
  if (!/^[1-9][0-9]*$/.test(String(value))) throw new Error("Explicit test-only timing is required.");
  const parsed = Number(value); if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) throw new Error("Test-only timing is out of bounds."); return parsed;
}
