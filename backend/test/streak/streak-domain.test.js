import assert from "node:assert/strict";
import test from "node:test";
import {
  LEARNING_SESSION_LIFETIME_MS,
  captureOperationTime,
  deriveSessionExpiry,
  isSessionAcceptingAt,
  projectSessionLifecycle,
} from "../../src/services/learning-session-domain.js";
import {
  STREAK_TIME_ZONE,
  previousApplicationDate,
  projectCurrentStreak,
  toApplicationDate,
} from "../../src/services/streak-domain.js";

const EVALUATED_AT = new Date("2026-10-17T03:00:00.000Z");

test("one operation captures exactly one defensive server-clock instant", () => {
  const source = new Date("2026-10-17T03:00:00.123Z");
  let calls = 0;
  const operationTime = captureOperationTime(() => {
    calls += 1;
    return source;
  });

  assert.equal(calls, 1);
  assert.notEqual(operationTime.instant, source);
  assert.equal(operationTime.instant.toISOString(), source.toISOString());
  source.setUTCFullYear(2030);
  assert.equal(operationTime.instant.toISOString(), "2026-10-17T03:00:00.123Z");
});

test("session lifetime is exactly seven 24-hour periods and equality is expired", () => {
  const createdAt = new Date("2026-10-17T03:00:00.000Z");
  const expiresAt = deriveSessionExpiry(createdAt);

  assert.equal(LEARNING_SESSION_LIFETIME_MS, 604_800_000);
  assert.equal(expiresAt.toISOString(), "2026-10-24T03:00:00.000Z");
  assert.equal(isSessionAcceptingAt(expiresAt, new Date(expiresAt.getTime() - 1)), true);
  assert.equal(isSessionAcceptingAt(expiresAt, expiresAt), false);
  assert.equal(isSessionAcceptingAt(expiresAt, new Date(expiresAt.getTime() + 1)), false);
});

test("effective lifecycle leaves completion terminal and derives expiry without writes", () => {
  const expiresAt = new Date("2026-10-24T03:00:00.000Z");
  const active = { status: "ACTIVE", expires_at: expiresAt };

  assert.equal(
    projectSessionLifecycle(active, new Date(expiresAt.getTime() - 1)),
    "ACTIVE",
  );
  assert.equal(projectSessionLifecycle(active, expiresAt), "EXPIRED");
  assert.equal(
    projectSessionLifecycle({ status: "COMPLETED", expires_at: expiresAt }, expiresAt),
    "COMPLETED",
  );
  assert.deepEqual(active, { status: "ACTIVE", expires_at: expiresAt });
});

test("application day uses the explicit UTC+7 midnight boundary", () => {
  assert.equal(STREAK_TIME_ZONE, "Asia/Ho_Chi_Minh");
  assert.equal(toApplicationDate("2026-10-17T16:59:59.999Z"), "2026-10-17");
  assert.equal(toApplicationDate("2026-10-17T17:00:00.000Z"), "2026-10-18");
  assert.equal(previousApplicationDate("2026-03-01"), "2026-02-28");
  assert.equal(previousApplicationDate("2024-03-01"), "2024-02-29");
});

test("projection covers empty, first-day and duplicate same-day histories", () => {
  assert.deepEqual(projectCurrentStreak([], EVALUATED_AT), projection({}));
  assert.deepEqual(
    projectCurrentStreak(["2026-10-17"], EVALUATED_AT),
    projection({ currentStreak: 1, completedToday: true, lastQualifiedDate: "2026-10-17" }),
  );
  assert.deepEqual(
    projectCurrentStreak(["2026-10-17", "2026-10-17"], EVALUATED_AT),
    projection({ currentStreak: 1, completedToday: true, lastQualifiedDate: "2026-10-17" }),
  );
});

test("projection counts consecutive dates through today or yesterday", () => {
  const sequence = ["2026-10-17", "2026-10-16", "2026-10-15", "2026-10-13"];
  assert.deepEqual(
    projectCurrentStreak(sequence, EVALUATED_AT),
    projection({ currentStreak: 3, completedToday: true, lastQualifiedDate: "2026-10-17" }),
  );
  assert.deepEqual(
    projectCurrentStreak(sequence.slice(1), EVALUATED_AT),
    projection({ currentStreak: 2, completedToday: false, lastQualifiedDate: "2026-10-16" }),
  );
});

test("a full missed day reads zero without deleting retained history", () => {
  const retainedHistory = ["2026-10-15", "2026-10-14", "2026-10-13"];
  const before = structuredClone(retainedHistory);

  assert.deepEqual(
    projectCurrentStreak(retainedHistory, EVALUATED_AT),
    projection({ currentStreak: 0, lastQualifiedDate: "2026-10-15" }),
  );
  assert.deepEqual(retainedHistory, before);
  assert.deepEqual(
    projectCurrentStreak([...retainedHistory, "2026-10-17"], EVALUATED_AT),
    projection({ currentStreak: 1, completedToday: true, lastQualifiedDate: "2026-10-17" }),
  );
});

test("completion date comes from the accepted instant, not session creation", () => {
  const createdAt = "2026-10-17T16:59:59.999Z";
  const acceptedAt = "2026-10-17T17:00:00.000Z";

  assert.equal(toApplicationDate(createdAt), "2026-10-17");
  assert.equal(toApplicationDate(acceptedAt), "2026-10-18");
});

test("domain functions fail closed for invalid clocks, dates and lifecycle state", () => {
  assert.throws(() => captureOperationTime(() => new Date("invalid")), /clock/i);
  assert.throws(() => deriveSessionExpiry("invalid"), /createdAt/);
  assert.throws(() => toApplicationDate("2026-10-17T17:00:00"), /instant/);
  assert.throws(() => projectSessionLifecycle({ status: "UNKNOWN" }, EVALUATED_AT), /status/i);
  assert.throws(() => previousApplicationDate("2026-02-30"), /valid ISO/);
  assert.throws(() => projectCurrentStreak(["2026-10-18"], EVALUATED_AT), /future/);
  assert.throws(() => projectCurrentStreak("2026-10-17", EVALUATED_AT), /array/);
});

function projection({
  currentStreak = 0,
  completedToday = false,
  lastQualifiedDate = null,
}) {
  return {
    current_streak: currentStreak,
    completed_today: completedToday,
    last_qualified_date: lastQualifiedDate,
    timezone: "Asia/Ho_Chi_Minh",
    evaluated_at: "2026-10-17T03:00:00.000Z",
  };
}
