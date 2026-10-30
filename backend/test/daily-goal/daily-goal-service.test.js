import assert from "node:assert/strict";
import test from "node:test";

import { createDailyGoalService } from "../../src/services/daily-goal-service.js";

const USER = "11111111-1111-4111-8111-111111111111";
const OTHER = "11111111-1111-4111-8111-111111111112";
const SESSION = "22222222-2222-4222-8222-222222222222";
const SESSION_B = "22222222-2222-4222-8222-222222222223";
const LEARNING = "33333333-3333-4333-8333-333333333333";
const OPS = Array.from({ length: 12 }, (_, i) => `${String(i + 1).padStart(8, "0")}-4444-4444-8444-444444444444`);

test("notification list defaults to 20, caps at 50, and paginates by a validated opaque boundary", async () => {
  assert.deepEqual(await createService(createHarness()).listNotifications(USER, {}), {
    items: [], unread_count: 0, next_cursor: null,
  });
  const notifications = Array.from({ length: 52 }, (_, index) => notification(index));
  const harness = createHarness({ notifications });
  const service = createService(harness);
  const first = await service.listNotifications(USER, {});
  assert.equal(first.items.length, 20);
  assert.equal(first.unread_count, 52);
  assert.equal(typeof first.next_cursor, "string");
  assert.deepEqual(Object.keys(first.items[0]), ["id", "type", "title", "body", "application_date", "created_at", "read_at"]);
  const second = await service.listNotifications(USER, { page_size: "50", cursor: first.next_cursor });
  assert.equal(second.items.length, 32);
  assert.equal(second.items[0].id, notifications[20].id);
  assert.equal(second.next_cursor, null);
  assert.throws(() => service.listNotifications(USER, { page_size: "51" }), hasCode("VALIDATION_ERROR"));
  assert.throws(() => service.listNotifications(USER, { page_size: "0" }), hasCode("VALIDATION_ERROR"));
});

test("equal-timestamp keyset pagination yields exact descending IDs across three pages", async () => {
  const shared = new Date("2026-10-26T12:00:00.000Z");
  const rows = [notification(3), notification(0), notification(4), notification(1), notification(2)]
    .map((row) => ({ ...row, created_at: shared }));
  const expectedIds = [...rows].sort((left, right) => right.id.localeCompare(left.id)).map((row) => row.id);
  const service = createService(createHarness({ notifications: rows }));
  const first = await service.listNotifications(USER, { page_size: "2" });
  const middle = await service.listNotifications(USER, { page_size: "2", cursor: first.next_cursor });
  const last = await service.listNotifications(USER, { page_size: "2", cursor: middle.next_cursor });
  assert.notEqual(first.next_cursor, null);
  assert.notEqual(middle.next_cursor, null);
  assert.equal(last.next_cursor, null);
  const actualIds = [...first.items, ...middle.items, ...last.items].map((row) => row.id);
  assert.deepEqual(actualIds, expectedIds);
  assert.equal(new Set(actualIds).size, rows.length);
  assert.deepEqual([first.items.length, middle.items.length, last.items.length], [2, 2, 1]);
});

test("notification cursor rejects malformed, oversized, modified, repeated and unexpected query values", async () => {
  const service = createService(createHarness({ notifications: [notification(0), notification(1)] }));
  const page = await service.listNotifications(USER, { page_size: "1" });
  const changed = `${page.next_cursor.slice(0, -1)}${page.next_cursor.endsWith("A") ? "B" : "A"}`;
  for (const query of [
    { cursor: "not+base64url" }, { cursor: "x".repeat(513) }, { cursor: changed },
    { cursor: [page.next_cursor] }, { page_size: ["20"] }, { extra: "value" },
  ]) assert.throws(() => service.listNotifications(USER, query), hasCode("VALIDATION_ERROR"));
});

test("notification reads are owner-safe, idempotent, and return authoritative unread counts", async () => {
  const own = notification(0);
  const foreign = notification(1, OTHER);
  const harness = createHarness({ notifications: [own, foreign] });
  const service = createService(harness);
  const listed = await service.listNotifications(USER, {});
  assert.deepEqual(listed.items.map((row) => row.id), [own.id]);
  assert.deepEqual(await service.countUnreadNotifications(USER), { unread_count: 1 });
  const first = await service.markNotificationRead(USER, own.id, { read: true });
  assert.equal(first.notification.id, own.id);
  assert.equal(first.notification.read_at, "2026-10-26T00:00:00.000Z");
  assert.equal(first.unread_count, 0);
  const repeated = await service.markNotificationRead(USER, own.id, { read: true });
  assert.equal(repeated.notification.read_at, first.notification.read_at);
  assert.equal(harness.state.notificationUpdates, 1);
  for (const input of [{}, { read: false }, { read: true, user_id: USER }]) {
    assert.throws(() => service.markNotificationRead(USER, own.id, input), hasCode("VALIDATION_ERROR"));
  }
  assert.throws(() => service.markNotificationRead(USER, "not-a-uuid", { read: true }), hasCode("VALIDATION_ERROR"));
  for (const id of [foreign.id, SESSION_B]) {
    await assert.rejects(service.markNotificationRead(USER, id, { read: true }), hasCode("NOT_FOUND"));
  }
  assert.equal(harness.state.notifications.find((row) => row.id === foreign.id).read_at, null);
});

test("establish and READY use the locked production repository, issue server timing, and credit zero", async () => {
  const harness = createHarness();
  const service = createService(harness);
  const established = await service.establish(USER, { operation_id: OPS[0], activity_type: "NORMAL", learning_session_id: LEARNING });
  assert.equal(established.tracking_session_id, SESSION);
  assert.equal(established.credited_milliseconds, "0");
  const ready = await service.engage(USER, SESSION, { operation_id: OPS[1], event_type: "READY" });
  await assert.rejects(service.engage(USER, SESSION, { operation_id: OPS[4], generation: ready.generation, event_type: "RESUME" }), hasCode("TRACKING_SEQUENCE_CONFLICT"));
  assert.equal(ready.owner, true);
  assert.equal(ready.generation, "1");
  assert.equal(ready.engagement_expires_at, "2026-10-26T00:02:00.000Z");
  assert.equal(ready.credited_milliseconds, "0");
  assert.equal(harness.state.days[0].active_milliseconds, 0n);
});

test("ordinary event at the deadline fences with zero expired-gap credit and requires explicit RESUME", async () => {
  const harness = createHarness();
  let now = new Date("2026-10-26T00:00:00.000Z");
  const service = createService(harness, () => now);
  await service.establish(USER, establish(OPS[0]));
  await service.engage(USER, SESSION, { operation_id: OPS[1], event_type: "READY" });
  now = new Date("2026-10-26T00:02:00.000Z");
  await assert.rejects(service.engage(USER, SESSION, { operation_id: OPS[2], generation: "1", event_type: "REVEAL" }), hasCode("IDLE_RESUME_REQUIRED"));
  await assert.rejects(service.engage(USER, SESSION, { operation_id: OPS[2], generation: "1", event_type: "REVEAL" }), hasCode("IDLE_RESUME_REQUIRED"));
  assert.equal(harness.state.sessions[0].status, "PAUSED");
  assert.equal(harness.state.days[0].active_milliseconds, 0n);
  now = new Date("2026-10-26T00:02:01.000Z");
  const resumed = await service.engage(USER, SESSION, { operation_id: OPS[3], generation: "2", event_type: "RESUME" });
  assert.equal(resumed.generation, "3");
  assert.equal(resumed.credited_milliseconds, "0");
});

test("expired non-owner event pauses only its requester and cannot fence the current owner", async () => {
  const harness = createHarness();
  const ownerCursor = new Date("2026-10-26T00:00:10.000Z");
  const ownerLease = new Date("2026-10-26T00:01:00.000Z");
  harness.state.sessions.push(
    { id: SESSION, activity_type: "NORMAL", learning_session_id: LEARNING, status: "ACTIVE", engagement_expires_at: new Date("2026-10-26T00:02:00.000Z") },
    { id: SESSION_B, activity_type: "NORMAL", learning_session_id: LEARNING, status: "ACTIVE", engagement_expires_at: new Date("2026-10-25T23:59:59.000Z") },
  );
  harness.state.owner = { tracking_session_id: SESSION, generation: 7n, last_accounted_at: ownerCursor, lease_expires_at: ownerLease };
  const service = createService(harness);
  await assert.rejects(service.engage(USER, SESSION_B, { operation_id: OPS[5], event_type: "REVEAL" }), hasCode("IDLE_RESUME_REQUIRED"));
  assert.deepEqual(harness.state.owner, { tracking_session_id: SESSION, generation: 7n, last_accounted_at: ownerCursor, lease_expires_at: ownerLease });
  assert.equal(harness.state.sessions.find((row) => row.id === SESSION_B).status, "PAUSED");
});

test("expired meaningful event stores actual prefix credit and exact replay stays terminal without duplicate upsert", async () => {
  const harness = createHarness();
  let now = new Date("2026-10-26T00:00:00.000Z");
  const service = createService(harness, () => now);
  await service.establish(USER, establish(OPS[0]));
  const ready = await service.engage(USER, SESSION, { operation_id: OPS[1], event_type: "READY" });
  now = new Date("2026-10-26T00:01:40.000Z");
  const reclaimed = await service.heartbeat(USER, SESSION, heartbeat(OPS[2], ready.generation));
  now = new Date("2026-10-26T00:02:05.000Z");
  const request = { operation_id: OPS[3], generation: reclaimed.generation, event_type: "REVEAL" };
  await assert.rejects(service.engage(USER, SESSION, request), hasCode("IDLE_RESUME_REQUIRED"));
  const firstAmount = harness.state.days[0].active_milliseconds;
  assert.equal(firstAmount, 20_000n);
  assert.equal(harness.state.receipts.find((row) => row.operation_id === OPS[3]).credited_milliseconds, 20_000n);
  await assert.rejects(service.engage(USER, SESSION, request), hasCode("IDLE_RESUME_REQUIRED"));
  assert.equal(harness.state.days[0].active_milliseconds, firstAmount);
});

test("idle heartbeat and its exact replay both return terminal conflict without duplicate day credit", async () => {
  const harness = createHarness();
  let now = new Date("2026-10-26T00:00:00.000Z");
  const service = createService(harness, () => now);
  await service.establish(USER, establish(OPS[0]));
  const ready = await service.engage(USER, SESSION, { operation_id: OPS[1], event_type: "READY" });
  let generation = ready.generation;
  for (let second = 20, index = 2; second < 120; second += 20, index++) {
    now = new Date(`2026-10-26T00:${String(Math.floor(second / 60)).padStart(2, "0")}:${String(second % 60).padStart(2, "0")}.000Z`);
    generation = (await service.heartbeat(USER, SESSION, heartbeat(OPS[index], generation))).generation;
  }
  now = new Date("2026-10-26T00:02:00.000Z");
  const request = heartbeat(OPS[7], generation);
  await assert.rejects(service.heartbeat(USER, SESSION, request), hasCode("IDLE_RESUME_REQUIRED"));
  const firstAmount = harness.state.days[0].active_milliseconds;
  assert.equal(firstAmount, 120_000n);
  await assert.rejects(service.heartbeat(USER, SESSION, request), hasCode("IDLE_RESUME_REQUIRED"));
  assert.equal(harness.state.days[0].active_milliseconds, firstAmount);
});

test("heartbeat accepts 25 seconds, rejects a larger gap in full, and never extends engagement", async () => {
  const harness = createHarness();
  let now = new Date("2026-10-26T00:00:00.000Z");
  const service = createService(harness, () => now);
  await service.establish(USER, establish(OPS[0]));
  const ready = await service.engage(USER, SESSION, { operation_id: OPS[1], event_type: "READY" });
  now = new Date("2026-10-26T00:00:25.000Z");
  const accepted = await service.heartbeat(USER, SESSION, heartbeat(OPS[2], ready.generation));
  assert.equal(accepted.credited_milliseconds, "25000");
  assert.equal(accepted.engagement_expires_at, ready.engagement_expires_at);
  now = new Date("2026-10-26T00:00:51.000Z");
  const rejected = await service.heartbeat(USER, SESSION, heartbeat(OPS[3], ready.generation));
  assert.equal(rejected.credited_milliseconds, "0");
  assert.equal(harness.state.days[0].active_milliseconds, 25_000n);
});

test("early heartbeat is rate-bounded, credits zero, and does not move cursor or lease", async () => {
  const harness = createHarness();
  let now = new Date("2026-10-26T00:00:00.000Z");
  const service = createService(harness, () => now);
  await service.establish(USER, establish(OPS[0]));
  const ready = await service.engage(USER, SESSION, { operation_id: OPS[1], event_type: "READY" });
  const cursor = harness.state.owner.last_accounted_at;
  const lease = harness.state.owner.lease_expires_at;
  now = new Date("2026-10-26T00:00:09.999Z");
  const early = await service.heartbeat(USER, SESSION, heartbeat(OPS[2], ready.generation));
  assert.equal(early.credited_milliseconds, "0");
  assert.equal(harness.state.owner.last_accounted_at, cursor);
  assert.equal(harness.state.owner.lease_expires_at, lease);
});

test("timely meaningful interaction accounts under the old deadline before extending it", async () => {
  const harness = createHarness();
  let now = new Date("2026-10-26T00:00:00.000Z");
  const service = createService(harness, () => now);
  await service.establish(USER, establish(OPS[0]));
  const ready = await service.engage(USER, SESSION, { operation_id: OPS[1], event_type: "READY" });
  now = new Date("2026-10-26T00:00:20.000Z");
  const result = await service.engage(USER, SESSION, { operation_id: OPS[2], generation: ready.generation, event_type: "REVEAL" });
  assert.equal(result.credited_milliseconds, "20000");
  assert.equal(result.generation, ready.generation);
  assert.equal(result.engagement_expires_at, "2026-10-26T00:02:20.000Z");
  assert.equal(harness.state.days[0].active_milliseconds, 20_000n);
});

test("persisted exact replay succeeds, mismatched reuse conflicts, and stale ownership credits zero", async () => {
  const harness = createHarness();
  const service = createService(harness);
  await service.establish(USER, establish(OPS[0]));
  const first = await service.engage(USER, SESSION, { operation_id: OPS[1], event_type: "READY" });
  const replay = await service.engage(USER, SESSION, { operation_id: OPS[1], event_type: "READY" });
  assert.equal(replay.replayed, true);
  assert.equal(replay.generation, first.generation);
  await assert.rejects(service.engage(USER, SESSION, { operation_id: OPS[1], event_type: "RESUME" }), hasCode("OPERATION_CONFLICT"));
  await assert.rejects(service.heartbeat(USER, SESSION, heartbeat(OPS[2], "0")), hasCode("TRACKING_OWNERSHIP_CONFLICT"));
  await assert.rejects(service.engage(USER, SESSION, { operation_id: OPS[3], generation: "0", event_type: "REVEAL" }), hasCode("TRACKING_OWNERSHIP_CONFLICT"));
  assert.equal(harness.state.days[0].active_milliseconds, 0n);
});

test("valid SUCCESS receipts replay for create, interaction, heartbeat, pause and close", async () => {
  const harness = createHarness();
  let now = new Date("2026-10-26T00:00:00.000Z");
  const service = createService(harness, () => now);
  const createRequest = establish(OPS[0]);
  await service.establish(USER, createRequest);
  assert.equal((await service.establish(USER, createRequest)).replayed, true);
  const readyRequest = { operation_id: OPS[1], event_type: "READY" };
  const ready = await service.engage(USER, SESSION, readyRequest);
  assert.equal((await service.engage(USER, SESSION, readyRequest)).replayed, true);
  now = new Date("2026-10-26T00:00:20.000Z");
  const interactionRequest = { operation_id: OPS[2], generation: ready.generation, event_type: "REVEAL" };
  await service.engage(USER, SESSION, interactionRequest);
  assert.equal((await service.engage(USER, SESSION, interactionRequest)).replayed, true);
  now = new Date("2026-10-26T00:00:40.000Z");
  const heartbeatRequest = heartbeat(OPS[3], ready.generation);
  await service.heartbeat(USER, SESSION, heartbeatRequest);
  assert.equal((await service.heartbeat(USER, SESSION, heartbeatRequest)).replayed, true);
  const pauseRequest = { operation_id: OPS[4], generation: ready.generation, reason: "HIDDEN" };
  await service.pause(USER, SESSION, pauseRequest);
  assert.equal((await service.pause(USER, SESSION, pauseRequest)).replayed, true);
  const resume = await service.engage(USER, SESSION, { operation_id: OPS[5], generation: "2", event_type: "RESUME" });
  const closeRequest = { operation_id: OPS[6], generation: resume.generation };
  await service.close(USER, SESSION, closeRequest);
  assert.equal((await service.close(USER, SESSION, closeRequest)).replayed, true);
});

test("malformed persisted SUCCESS evidence fails closed without mutation or public success", async () => {
  const mutations = [
    (data) => { data.extra_receipt_metadata = "forbidden"; },
    (data) => { data.projection.secret = "forbidden"; },
    (data) => { data.owner = "true"; },
    (data) => { data.generation = "-1"; },
    (data) => { data.status = "UNKNOWN"; },
    (data) => { delete data.tracking_session_id; },
    (data) => { data.credited_milliseconds = "25001"; data.projection.credited_milliseconds = "25001"; },
    (data) => { data.projection.credited_milliseconds = "1"; },
  ];
  for (const mutate of mutations) {
    const harness = createHarness();
    const service = createService(harness);
    const request = establish(OPS[0]);
    await service.establish(USER, request);
    const receipt = harness.state.receipts[0];
    mutate(receipt.response_projection.data);
    const snapshot = structuredClone(harness.state);
    await assert.rejects(service.establish(USER, request), /Stored Daily Goal replay outcome is invalid/);
    assert.deepEqual(harness.state, snapshot);
  }
});

test("persisted SUCCESS generation is bounded to PostgreSQL signed bigint before replay", async () => {
  const maximum = "9223372036854775807";
  const tooLarge = "9223372036854775808";
  const veryLong = "9".repeat(10_000);

  const accepted = createHarness();
  const acceptedService = createService(accepted);
  await acceptedService.establish(USER, establish(OPS[0]));
  const readyRequest = { operation_id: OPS[1], event_type: "READY" };
  await acceptedService.engage(USER, SESSION, readyRequest);
  accepted.state.receipts.find((row) => row.operation_id === OPS[1]).response_projection.data.generation = maximum;
  assert.equal((await acceptedService.engage(USER, SESSION, readyRequest)).generation, maximum);

  for (const invalidGeneration of [tooLarge, veryLong]) {
    const harness = createHarness();
    const service = createService(harness);
    await service.establish(USER, establish(OPS[0]));
    await service.engage(USER, SESSION, readyRequest);
    harness.state.receipts.find((row) => row.operation_id === OPS[1]).response_projection.data.generation = invalidGeneration;
    const snapshot = structuredClone(harness.state);
    await assert.rejects(service.engage(USER, SESSION, readyRequest), /Stored Daily Goal replay outcome is invalid/);
    assert.deepEqual(harness.state, snapshot);
  }
});

test("persisted operation_type, not JSONB fields, selects the SUCCESS replay contract", async () => {
  const harness = createHarness();
  const service = createService(harness);
  const request = establish(OPS[0]);
  await service.establish(USER, request);
  const receipt = harness.state.receipts[0];
  receipt.response_projection.data.operation_type = "HEARTBEAT";
  await assert.rejects(service.establish(USER, request), /Stored Daily Goal replay outcome is invalid/);
  const restoredReceipt = harness.state.receipts[0];
  delete restoredReceipt.response_projection.data.operation_type;
  restoredReceipt.operation_type = "HEARTBEAT";
  await assert.rejects(service.establish(USER, request), hasCode("OPERATION_CONFLICT"));
});

test("non-owner supplied stale/future generation is refused; omitted generation may claim", async () => {
  const harness = createHarness();
  harness.state.sessions.push(
    { id: SESSION, activity_type: "NORMAL", learning_session_id: LEARNING, status: "ACTIVE", engagement_expires_at: new Date("2026-10-26T00:02:00.000Z") },
    { id: SESSION_B, activity_type: "NORMAL", learning_session_id: LEARNING, status: "ACTIVE", engagement_expires_at: new Date("2026-10-26T00:02:00.000Z") },
  );
  harness.state.owner = { tracking_session_id: SESSION, generation: 7n, last_accounted_at: new Date("2026-10-26T00:00:00.000Z"), lease_expires_at: new Date("2026-10-26T00:00:45.000Z") };
  const service = createService(harness);
  await assert.rejects(service.engage(USER, SESSION_B, { operation_id: OPS[8], generation: "6", event_type: "REVEAL" }), hasCode("TRACKING_OWNERSHIP_CONFLICT"));
  await assert.rejects(service.engage(USER, SESSION_B, { operation_id: OPS[9], generation: "8", event_type: "REVEAL" }), hasCode("TRACKING_OWNERSHIP_CONFLICT"));
  assert.equal(harness.state.owner.tracking_session_id, SESSION);
  const claimed = await service.engage(USER, SESSION_B, { operation_id: OPS[10], event_type: "REVEAL" });
  assert.equal(claimed.owner, true);
  assert.equal(claimed.generation, "8");
});

test("foreign/inaccessible context is safe not-found; validation rejects client time/date/owner fields", async () => {
  const harness = createHarness();
  harness.state.contextAccessible = false;
  const service = createService(harness);
  await assert.rejects(service.establish(USER, establish(OPS[0])), hasCode("DAILY_GOAL_NOT_FOUND"));
  for (const extra of [{ duration: 10 }, { timestamp: 1 }, { timezone: "UTC" }, { user_id: USER }, { application_date: "2026-10-26" }]) {
    assert.throws(() => service.establish(USER, { ...establish(OPS[0]), ...extra }), hasCode("DAILY_GOAL_VALIDATION_ERROR"));
  }
});

test("pause and close add no tail; close replay is idempotent; injected failure rolls back", async () => {
  const harness = createHarness();
  let now = new Date("2026-10-26T00:00:00.000Z");
  const service = createService(harness, () => now);
  await service.establish(USER, establish(OPS[0]));
  const ready = await service.engage(USER, SESSION, { operation_id: OPS[1], event_type: "READY" });
  now = new Date("2026-10-26T00:00:20.000Z");
  const closed = await service.close(USER, SESSION, { operation_id: OPS[2], generation: ready.generation });
  assert.equal(closed.status, "CLOSED");
  assert.equal(harness.state.days[0].active_milliseconds, 0n);
  assert.equal((await service.close(USER, SESSION, { operation_id: OPS[2], generation: ready.generation })).replayed, true);

  const failing = createHarness();
  failing.state.failReceipt = true;
  await assert.rejects(createService(failing).establish(USER, establish(OPS[0])), /injected receipt failure/);
  assert.equal(failing.state.sessions.length, 0);
});

test("goal projection floors seconds and minutes at the HUMAN-approved boundaries", async () => {
  for (const [seconds, minutes] of [[0, 0], [59, 0], [60, 1], [119, 1], [120, 2], [599, 9], [600, 10]]) {
    const harness = createHarness({ activeMilliseconds: BigInt(seconds) * 1_000n });
    const result = await createService(harness).getGoal(USER);
    assert.equal(result.active_seconds, seconds);
    assert.equal(result.actual_minutes, minutes);
    assert.equal(result.target_minutes, null);
    assert.equal(result.reminder_enabled, true);
  }
  const subsecond = createHarness({ activeMilliseconds: 60_999n });
  assert.deepEqual((({ active_seconds, actual_minutes }) => ({ active_seconds, actual_minutes }))(await createService(subsecond).getGoal(USER)), { active_seconds: 60, actual_minutes: 1 });
});

test("reminder preference defaults ON, persists OFF, and re-enable uses the server instant", async () => {
  const priorBaseline = new Date("2026-10-25T12:00:00.000Z");
  const harness = createHarness({ reminderEnabledAt: priorBaseline });
  let now = new Date("2026-10-26T00:00:00.000Z");
  const service = createService(harness, () => now);

  assert.equal((await service.getGoal(USER)).reminder_enabled, true);
  const disabled = await service.updateReminderPreference(USER, { operation_id: OPS[8], enabled: false });
  assert.deepEqual(disabled, { reminder_enabled: false, updated_at: now.toISOString(), replayed: false });
  assert.equal(harness.state.user.daily_goal_reminders_enabled, false);
  assert.equal(harness.state.user.daily_goal_reminders_enabled_at.getTime(), priorBaseline.getTime());
  assert.equal((await service.getGoal(USER)).reminder_enabled, false);

  now = new Date("2026-10-26T01:00:00.000Z");
  const enabled = await service.updateReminderPreference(USER, { operation_id: OPS[9], enabled: true });
  assert.deepEqual(enabled, { reminder_enabled: true, updated_at: now.toISOString(), replayed: false });
  assert.equal(harness.state.user.daily_goal_reminders_enabled, true);
  assert.equal(harness.state.user.daily_goal_reminders_enabled_at.getTime(), now.getTime());
  assert.equal((await service.getGoal(USER)).reminder_enabled, true);
});

test("reminder preference update replays exactly and conflicts across values or operation types", async () => {
  const harness = createHarness();
  const service = createService(harness);
  const request = { operation_id: OPS[8], enabled: false };
  const first = await service.updateReminderPreference(USER, request);
  const snapshot = structuredClone(harness.state);
  const replay = await service.updateReminderPreference(USER, { enabled: false, operation_id: OPS[8] });
  assert.deepEqual(replay, { ...first, replayed: true });
  assert.deepEqual(harness.state, snapshot);
  await assert.rejects(service.updateReminderPreference(USER, { ...request, enabled: true }), hasCode("OPERATION_CONFLICT"));

  await service.updateGoal(USER, { operation_id: OPS[9], target_minutes: 10 });
  await assert.rejects(
    service.updateReminderPreference(USER, { operation_id: OPS[9], enabled: true }),
    hasCode("OPERATION_CONFLICT"),
  );
});

test("reminder preference validates exact input, missing USER, and stored replay shape", async () => {
  const service = createService(createHarness());
  for (const request of [
    {},
    { operation_id: "invalid", enabled: true },
    { operation_id: OPS[8] },
    { operation_id: OPS[8], enabled: "true" },
    { operation_id: OPS[8], enabled: 1 },
    { operation_id: OPS[8], enabled: true, user_id: USER },
    { operation_id: OPS[8], enabled: true, updated_at: "2026-10-26T00:00:00.000Z" },
  ]) assert.throws(() => service.updateReminderPreference(USER, request), hasCode("DAILY_GOAL_VALIDATION_ERROR"));

  await assert.rejects(
    createService(createHarness({ userExists: false })).updateReminderPreference(USER, { operation_id: OPS[8], enabled: true }),
    hasCode("DAILY_GOAL_NOT_FOUND"),
  );

  const harness = createHarness();
  const guarded = createService(harness);
  const request = { operation_id: OPS[8], enabled: true };
  await guarded.updateReminderPreference(USER, request);
  harness.state.receipts[0].response_projection.data.updated_at = "not-an-instant";
  const snapshot = structuredClone(harness.state);
  await assert.rejects(guarded.updateReminderPreference(USER, request), /Stored Daily Goal replay outcome is invalid/);
  assert.deepEqual(harness.state, snapshot);
});

test("reminder preference update is isolated from goal, XP, rewards, notifications, and completion", async () => {
  const completion = notification(0);
  const harness = createHarness({
    activeMilliseconds: 600_000n, targetMinutes: 10, totalXp: 40, reward: true,
    reminderEnabled: true, notifications: [completion],
  });
  const before = structuredClone({
    days: harness.state.days, rewards: harness.state.rewards,
    notifications: harness.state.notifications, totalXp: harness.state.user.total_xp,
    goal: harness.state.user.daily_goal_minutes,
  });
  await createService(harness).updateReminderPreference(USER, { operation_id: OPS[8], enabled: false });
  assert.deepEqual({
    days: harness.state.days, rewards: harness.state.rewards,
    notifications: harness.state.notifications, totalXp: harness.state.user.total_xp,
    goal: harness.state.user.daily_goal_minutes,
  }, before);

  const rewardHarness = createHarness({ activeMilliseconds: 600_000n, totalXp: 40, reminderEnabled: false });
  const result = await createService(rewardHarness).updateGoal(USER, { operation_id: OPS[0], target_minutes: 10 });
  assert.equal(result.reward.earned_now, true);
  assert.equal(rewardHarness.state.notifications.length, 1);
  assert.equal(rewardHarness.state.notifications[0].type, "DAILY_GOAL_COMPLETED");

  const failing = createHarness({ reminderEnabled: true });
  failing.state.failReceipt = true;
  const failingBefore = structuredClone(failing.state);
  await assert.rejects(
    createService(failing).updateReminderPreference(USER, { operation_id: OPS[8], enabled: false }),
    /injected receipt failure/,
  );
  assert.deepEqual(failing.state, failingBefore);
});

test("599 seconds does not complete a ten-minute goal; 600 seconds rewards exactly once", async () => {
  const below = createHarness({ activeMilliseconds: 599_999n, targetMinutes: 10, totalXp: 49 });
  assert.equal((await createService(below).getGoal(USER)).completed, false);

  const reached = createHarness({ activeMilliseconds: 600_000n, totalXp: 49 });
  const service = createService(reached);
  const request = { operation_id: OPS[0], target_minutes: 10 };
  const first = await service.updateGoal(USER, request);
  assert.equal(first.completed, true);
  assert.deepEqual(first.reward, { earned_now: true, xp_earned: 10 });
  assert.equal(first.xp_level.total_xp, 59);
  assert.equal(first.xp_level.level, 2);
  assert.equal(reached.state.rewards.length, 1);
  assert.equal(reached.state.notifications.length, 1);
  assert.equal(reached.state.user.total_xp, 59);
  const replay = await service.updateGoal(USER, request);
  assert.equal(replay.replayed, true);
  assert.equal(reached.state.rewards.length, 1);
  assert.equal(reached.state.notifications.length, 1);
  assert.equal(reached.state.user.total_xp, 59);
  await assert.rejects(service.updateGoal(USER, { ...request, target_minutes: 11 }), hasCode("OPERATION_CONFLICT"));
});

test("goal update validates exact input and malformed persisted SUCCESS fails closed", async () => {
  const service = createService(createHarness());
  assert.equal((await service.updateGoal(USER, { operation_id: OPS[10], target_minutes: 240 })).target_minutes, 240);
  for (const target_minutes of [9, 241, 10.5, "10", null]) {
    assert.throws(() => service.updateGoal(USER, { operation_id: OPS[0], target_minutes }), hasCode("DAILY_GOAL_VALIDATION_ERROR"));
  }
  for (const extra of [{ user_id: USER }, { application_date: "2026-10-26" }, { duration: 1 }, { timestamp: 1 }, { xp: 10 }, { reward: true }, { completed: true }]) {
    assert.throws(() => service.updateGoal(USER, { operation_id: OPS[0], target_minutes: 10, ...extra }), hasCode("DAILY_GOAL_VALIDATION_ERROR"));
  }
  const harness = createHarness({ activeMilliseconds: 600_000n });
  const guarded = createService(harness);
  const request = { operation_id: OPS[0], target_minutes: 10 };
  await guarded.updateGoal(USER, request);
  harness.state.receipts[0].response_projection.data.actual_minutes = 11;
  const snapshot = structuredClone(harness.state);
  await assert.rejects(guarded.updateGoal(USER, request), /Stored Daily Goal replay outcome is invalid/);
  assert.deepEqual(harness.state, snapshot);
});

test("READY and zero-credit operations cannot fabricate reward; positive credit reevaluates completion", async () => {
  const harness = createHarness({ activeMilliseconds: 590_000n, targetMinutes: 10 });
  let now = new Date("2026-10-26T00:00:00.000Z");
  const service = createService(harness, () => now);
  await service.establish(USER, establish(OPS[0]));
  const ready = await service.engage(USER, SESSION, { operation_id: OPS[1], event_type: "READY" });
  assert.equal(harness.state.rewards.length, 0);
  now = new Date("2026-10-26T00:00:09.999Z");
  await service.heartbeat(USER, SESSION, heartbeat(OPS[2], ready.generation));
  assert.equal(harness.state.rewards.length, 0);
  now = new Date("2026-10-26T00:00:20.000Z");
  await service.heartbeat(USER, SESSION, heartbeat(OPS[3], ready.generation));
  assert.equal(harness.state.rewards.length, 1);
  assert.equal(harness.state.notifications.length, 1);
  assert.equal(harness.state.user.total_xp, 10);
});

test("raising a goal after reward changes completion without revoking or reissuing", async () => {
  const harness = createHarness({ activeMilliseconds: 600_000n, targetMinutes: 10, reward: true, totalXp: 10 });
  const result = await createService(harness).updateGoal(USER, { operation_id: OPS[0], target_minutes: 20 });
  assert.equal(result.completed, false);
  assert.equal(result.reward_earned, true);
  assert.deepEqual(result.reward, { earned_now: false, xp_earned: 0 });
  assert.equal(harness.state.rewards.length, 1);
  assert.equal(harness.state.notifications.length, 0);
  assert.equal(harness.state.user.total_xp, 10);
});

test("reducing a configured goal below accumulated time rewards exactly once without resetting time", async () => {
  const harness = createHarness({ activeMilliseconds: 900_000n, targetMinutes: 20, totalXp: 49 });
  const service = createService(harness);
  const result = await service.updateGoal(USER, { operation_id: OPS[0], target_minutes: 10 });

  assert.equal(result.target_minutes, 10);
  assert.equal(result.active_seconds, 900);
  assert.equal(result.actual_minutes, 15);
  assert.equal(result.completed, true);
  assert.equal(result.reward_earned, true);
  assert.deepEqual(result.reward, { earned_now: true, xp_earned: 10 });
  assert.equal(result.xp_level.total_xp, 59);
  assert.equal(harness.state.days[0].active_milliseconds, 900_000n);
  assert.equal(harness.state.rewards.length, 1);
  assert.equal(harness.state.notifications.length, 1);
  assert.equal(harness.state.user.total_xp, 59);

  const replay = await service.updateGoal(USER, { operation_id: OPS[0], target_minutes: 10 });
  assert.equal(replay.replayed, true);
  assert.equal(harness.state.days[0].active_milliseconds, 900_000n);
  assert.equal(harness.state.rewards.length, 1);
  assert.equal(harness.state.notifications.length, 1);
  assert.equal(harness.state.user.total_xp, 59);
});

test("reward, XP, notification, goal and receipt roll back together on injected failure", async () => {
  const harness = createHarness({ activeMilliseconds: 600_000n, totalXp: 40, failNotification: true });
  const before = structuredClone(harness.state);
  await assert.rejects(
    createService(harness).updateGoal(USER, { operation_id: OPS[0], target_minutes: 10 }),
    /injected notification failure/,
  );
  assert.deepEqual(harness.state, before);
});

function establish(operation_id) { return { operation_id, activity_type: "NORMAL", learning_session_id: LEARNING }; }
function heartbeat(operation_id, generation) { return { operation_id, generation, eligibility: "VISIBLE_FOCUSED_ACTIVE" }; }
function createService(harness, now = () => new Date("2026-10-26T00:00:00.000Z")) { return createDailyGoalService({ dailyGoalRepository: harness.repository, now, uuid: () => SESSION }); }
function hasCode(code) { return (error) => error?.code === code; }

function createHarness({ activeMilliseconds = null, targetMinutes = null, totalXp = 0, reward = false, failNotification = false, notifications = [], reminderEnabled = null, reminderEnabledAt = null, userExists = true } = {}) {
  const date = new Date("2026-10-26T00:00:00.000Z");
  const state = {
    sessions: [], owner: null, receipts: [],
    days: activeMilliseconds === null ? [] : [{ activity_date: date, active_milliseconds: activeMilliseconds }],
    rewards: reward ? [{ id: "reward", activity_date: date, source_operation_id: OPS[11], xp_amount: 10 }] : [],
    notifications: structuredClone(notifications), notificationUpdates: 0,
    user: userExists ? { id: USER, total_xp: totalXp, daily_goal_minutes: targetMinutes, daily_goal_reminders_enabled: reminderEnabled, daily_goal_reminders_enabled_at: reminderEnabledAt } : null,
    contextAccessible: true, failReceipt: false, failNotification,
  };
  const repository = {
    async withUserTransaction(userId, callback) {
      const before = structuredClone(state);
      try { return await callback(tx(userId)); } catch (error) { for (const key of Object.keys(state)) state[key] = before[key]; throw error; }
    },
  };
  function tx(userId) { return {
    findAuthorizedActivityContext: async () => state.contextAccessible ? { id: LEARNING } : null,
    findTrackingSession: async (id) => state.sessions.find((x) => x.id === id) ?? null,
    createTrackingSession: async (data) => { const row = { ...data, engagement_expires_at: null, last_meaningful_at: null, closed_at: null }; state.sessions.push(row); return row; },
    updateTrackingSession: async (id, data) => { Object.assign(state.sessions.find((x) => x.id === id), data); return { count: 1 }; },
    findOwner: async () => state.owner,
    upsertOwner: async ({ create, update }) => { state.owner = state.owner ? { ...state.owner, ...update } : { user_id: USER, ...create }; return state.owner; },
    updateOwnerAtGeneration: async (generation, data) => { if (state.owner?.generation !== generation) return { count: 0 }; Object.assign(state.owner, data); return { count: 1 }; },
    findOperationReplay: async ({ operationId, operationType, requestFingerprint }) => { const receipt = state.receipts.find((x) => x.operation_id === operationId); if (!receipt) return { classification: "MISSING", receipt: null }; return { classification: receipt.operation_type === operationType && receipt.request_fingerprint === requestFingerprint ? "REPLAY" : "OPERATION_CONFLICT", receipt }; },
    createOperationReceipt: async (data) => { if (state.failReceipt) throw new Error("injected receipt failure"); state.receipts.push(data); return data; },
    findDay: async (date) => state.days.find((x) => x.activity_date.getTime() === date.getTime()) ?? null,
    upsertDay: async (date, { create, update }) => { let row = state.days.find((x) => x.activity_date.getTime() === date.getTime()); if (!row) { row = { activity_date: date, ...create }; state.days.push(row); } else { for (const [key, value] of Object.entries(update)) row[key] = value?.increment !== undefined ? row[key] + value.increment : value; } return row; },
    findReward: async (date) => state.rewards.find((x) => x.activity_date.getTime() === date.getTime()) ?? null,
    createReward: async (data) => { state.rewards.push({ ...data, user_id: USER }); return data; },
    findPreference: async () => state.user,
    updatePreference: async (data) => { if (!state.user) return { count: 0 }; Object.assign(state.user, data); return { count: 1 }; },
    incrementTotalXp: async (amount) => { state.user.total_xp += amount; return { total_xp: state.user.total_xp }; },
    createNotification: async (data) => { if (state.failNotification) throw new Error("injected notification failure"); state.notifications.push({ ...data, user_id: userId }); return data; },
    listNotifications: async ({ before, take }) => state.notifications
      .filter((row) => row.user_id === userId)
      .filter((row) => !before || row.created_at < before.createdAt || (row.created_at.getTime() === before.createdAt.getTime() && row.id < before.id))
      .sort((left, right) => right.created_at - left.created_at || right.id.localeCompare(left.id))
      .slice(0, take),
    countUnreadNotifications: async () => state.notifications.filter((row) => row.user_id === userId && row.read_at === null).length,
    findNotification: async (id) => state.notifications.find((row) => row.id === id && row.user_id === userId) ?? null,
    markNotificationRead: async (id, readAt) => { const row = state.notifications.find((item) => item.id === id && item.user_id === userId); if (!row) return { count: 0 }; row.read_at = readAt; state.notificationUpdates += 1; return { count: 1 }; },
  }; }
  return { state, repository };
}

function notification(index, userId = USER) {
  return {
    id: `55555555-5555-4555-8555-${String(999_999_999_999 - index).padStart(12, "0")}`,
    user_id: userId,
    type: "DAILY_GOAL_COMPLETED",
    title: `Notification ${index}`,
    body: "Body",
    application_date: new Date("2026-10-26T00:00:00.000Z"),
    created_at: new Date(Date.parse("2026-10-26T12:00:00.000Z") - index * 1_000),
    read_at: null,
  };
}
