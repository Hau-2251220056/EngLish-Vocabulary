import assert from "node:assert/strict";
import test from "node:test";

import {
  DAILY_GOAL_ENGAGEMENT_EVENTS,
  HEARTBEAT_INTERVAL_MILLISECONDS,
  IDLE_THRESHOLD_MILLISECONDS,
  MAX_ACCOUNTING_GAP_MILLISECONDS,
  OWNER_LEASE_MILLISECONDS,
  classifyOperationReplay,
  classifyOwnershipFence,
  createEngagementDeadline,
  createLeaseExpiry,
  evaluateAcceptedInterval,
  intervalDurationMilliseconds,
  isAllowedEngagementEvent,
  isEngagementExpired,
  isLeaseExpired,
  isMeaningfulEngagementEvent,
  nextOwnershipGeneration,
  projectDailyGoalProgress,
  splitIntervalByApplicationDay,
} from "../../src/services/daily-goal-domain.js";

test("exports the approved PLAN timing defaults", () => {
  assert.equal(HEARTBEAT_INTERVAL_MILLISECONDS, 20_000);
  assert.equal(OWNER_LEASE_MILLISECONDS, 45_000);
  assert.equal(MAX_ACCOUNTING_GAP_MILLISECONDS, 25_000);
  assert.equal(IDLE_THRESHOLD_MILLISECONDS, 120_000);
  assert.equal(createLeaseExpiry(1_000), 46_000);
  assert.equal(createEngagementDeadline(1_000), 121_000);
});

test("T1: accepts a normal 20-second server-observed interval", () => {
  assert.deepEqual(evaluateAcceptedInterval({
    lastAccountedAtMs: 0,
    receivedAtMs: 20_000,
    leaseExpiresAtMs: 45_000,
    engagementExpiresAtMs: 120_000,
  }), {
    classification: "ACCEPTED",
    nextCursorMs: 20_000,
    creditedMilliseconds: 20_000n,
    rejectedMilliseconds: 0n,
    acceptedInterval: { startMs: 0, endMs: 20_000 },
    shouldFence: false,
    mayRenewLease: true,
  });
});

test("T1: preserves 1 ms, exact-second, zero, fractional-instant, and large safe durations", () => {
  assert.equal(intervalDurationMilliseconds(100, 101), 1n);
  assert.equal(intervalDurationMilliseconds(100, 1_100), 1_000n);
  assert.equal(intervalDurationMilliseconds(100, 100), 0n);
  const fractionalInstant = Date.parse("2026-10-17T10:00:00.250Z");
  assert.equal(intervalDurationMilliseconds(fractionalInstant, fractionalInstant + 750), 750n);
  assert.equal(intervalDurationMilliseconds(0, Number.MAX_SAFE_INTEGER), BigInt(Number.MAX_SAFE_INTEGER));
});

test("T1: the exact 25-second ceiling is accepted but 25,001 ms is rejected in full", () => {
  const exact = evaluateAcceptedInterval({
    lastAccountedAtMs: 0,
    receivedAtMs: 25_000,
    leaseExpiresAtMs: 45_000,
    engagementExpiresAtMs: 120_000,
  });
  assert.equal(exact.creditedMilliseconds, 25_000n);

  const over = evaluateAcceptedInterval({
    lastAccountedAtMs: 0,
    receivedAtMs: 25_001,
    leaseExpiresAtMs: 45_000,
    engagementExpiresAtMs: 120_000,
  });
  assert.equal(over.classification, "GAP_REJECTED");
  assert.equal(over.creditedMilliseconds, 0n);
  assert.equal(over.rejectedMilliseconds, 25_001n);
  assert.equal(over.nextCursorMs, 25_001);
});

test("T2: rejects a live-lease 30-second gap in full and burns the cursor", () => {
  const result = evaluateAcceptedInterval({
    lastAccountedAtMs: 20_000,
    receivedAtMs: 50_000,
    leaseExpiresAtMs: 65_000,
    engagementExpiresAtMs: 120_000,
  });
  assert.equal(result.classification, "GAP_REJECTED");
  assert.equal(result.creditedMilliseconds, 0n);
  assert.equal(result.rejectedMilliseconds, 30_000n);
  assert.equal(result.nextCursorMs, 50_000);
  assert.equal(result.mayRenewLease, true);
});

test("T2: an expired lease rejects the full gap and fences ownership", () => {
  const beforeExpiry = evaluateAcceptedInterval({
    lastAccountedAtMs: 20_000,
    receivedAtMs: 44_999,
    leaseExpiresAtMs: 45_000,
    engagementExpiresAtMs: 120_000,
  });
  assert.equal(beforeExpiry.classification, "ACCEPTED");

  const atExpiry = evaluateAcceptedInterval({
    lastAccountedAtMs: 20_000,
    receivedAtMs: 45_000,
    leaseExpiresAtMs: 45_000,
    engagementExpiresAtMs: 120_000,
  });
  assert.equal(atExpiry.classification, "LEASE_EXPIRED");
  assert.equal(atExpiry.creditedMilliseconds, 0n);
  assert.equal(atExpiry.rejectedMilliseconds, 25_000n);
  assert.equal(atExpiry.shouldFence, true);
  assert.equal(isLeaseExpired(45_000, 45_000), true);
  assert.equal(isLeaseExpired(45_001, 45_000), true);
});

test("T3: accounts under the old deadline, then requires explicit resume", () => {
  const atDeadline = evaluateAcceptedInterval({
    lastAccountedAtMs: 100_000,
    receivedAtMs: 120_000,
    leaseExpiresAtMs: 145_000,
    engagementExpiresAtMs: 120_000,
  });
  assert.equal(atDeadline.classification, "IDLE_REACHED");
  assert.equal(atDeadline.creditedMilliseconds, 20_000n);
  assert.equal(atDeadline.rejectedMilliseconds, 0n);
  assert.equal(atDeadline.shouldFence, true);
  assert.equal(isEngagementExpired(120_000, 120_000), true);

  const afterDeadline = evaluateAcceptedInterval({
    lastAccountedAtMs: 115_000,
    receivedAtMs: 125_000,
    leaseExpiresAtMs: 145_000,
    engagementExpiresAtMs: 120_000,
  });
  assert.equal(afterDeadline.classification, "IDLE_REACHED");
  assert.equal(afterDeadline.creditedMilliseconds, 5_000n);
  assert.equal(afterDeadline.rejectedMilliseconds, 5_000n);
  assert.equal(afterDeadline.nextCursorMs, 125_000);
  assert.equal(createEngagementDeadline(130_000), 250_000);
});

test("T4: out-of-order input cannot rewind or duplicate the accounting cursor", () => {
  const result = evaluateAcceptedInterval({
    lastAccountedAtMs: 50_000,
    receivedAtMs: 49_999,
    leaseExpiresAtMs: 95_000,
    engagementExpiresAtMs: 120_000,
  });
  assert.equal(result.classification, "OUT_OF_ORDER");
  assert.equal(result.nextCursorMs, 50_000);
  assert.equal(result.creditedMilliseconds, 0n);
  assert.equal(result.mayRenewLease, false);
  assert.equal(nextOwnershipGeneration(9n), 10n);
  assert.equal(classifyOwnershipFence(9n, 10n), "STALE");
  assert.equal(classifyOwnershipFence(10n, 10n), "CURRENT");
  assert.equal(classifyOwnershipFence(11n, 10n), "FUTURE_INVALID");
});

test("T4: only the same command type and fingerprint is an idempotent replay", () => {
  const stored = {
    storedOperationType: "HEARTBEAT",
    storedFingerprint: "sha256:abc",
  };
  assert.equal(classifyOperationReplay({
    ...stored,
    requestedOperationType: "HEARTBEAT",
    requestedFingerprint: "sha256:abc",
  }), "REPLAY");
  assert.equal(classifyOperationReplay({
    ...stored,
    requestedOperationType: "PAUSE",
    requestedFingerprint: "sha256:abc",
  }), "OPERATION_CONFLICT");
  assert.equal(classifyOperationReplay({
    ...stored,
    requestedOperationType: "HEARTBEAT",
    requestedFingerprint: "sha256:different",
  }), "OPERATION_CONFLICT");
});

test("T4: duplicate timestamps credit zero and rejected time cannot be recovered", () => {
  const duplicate = evaluateAcceptedInterval({
    lastAccountedAtMs: 50_000,
    receivedAtMs: 50_000,
    leaseExpiresAtMs: 95_000,
    engagementExpiresAtMs: 120_000,
  });
  assert.equal(duplicate.classification, "ZERO_LENGTH");
  assert.equal(duplicate.creditedMilliseconds, 0n);
  assert.equal(duplicate.nextCursorMs, 50_000);

  const afterBurn = evaluateAcceptedInterval({
    lastAccountedAtMs: 50_000,
    receivedAtMs: 70_000,
    leaseExpiresAtMs: 95_000,
    engagementExpiresAtMs: 120_000,
  });
  assert.equal(afterBurn.creditedMilliseconds, 20_000n);
  assert.deepEqual(afterBurn.acceptedInterval, { startMs: 50_000, endMs: 70_000 });
});

test("T5: split conserves an 800 ms interval across Vietnam midnight", () => {
  const start = Date.parse("2026-10-17T16:59:59.600Z");
  const end = Date.parse("2026-10-17T17:00:00.400Z");
  const parts = splitIntervalByApplicationDay(start, end);
  assert.deepEqual(parts, [
    {
      applicationDate: "2026-10-17",
      startMs: start,
      endMs: Date.parse("2026-10-17T17:00:00.000Z"),
      durationMilliseconds: 400n,
    },
    {
      applicationDate: "2026-10-18",
      startMs: Date.parse("2026-10-17T17:00:00.000Z"),
      endMs: end,
      durationMilliseconds: 400n,
    },
  ]);
  assert.equal(parts.reduce((sum, part) => sum + part.durationMilliseconds, 0n), 800n);
});

test("T5: half-open exact-midnight and multi-day splits have no overlap or loss", () => {
  const midnight = Date.parse("2026-10-17T17:00:00.000Z");
  const endingAtMidnight = splitIntervalByApplicationDay(midnight - 1, midnight);
  assert.equal(endingAtMidnight.length, 1);
  assert.equal(endingAtMidnight[0].applicationDate, "2026-10-17");

  const startingAtMidnight = splitIntervalByApplicationDay(midnight, midnight + 1);
  assert.equal(startingAtMidnight.length, 1);
  assert.equal(startingAtMidnight[0].applicationDate, "2026-10-18");

  const start = midnight - 1;
  const end = midnight + (2 * 86_400_000) + 1;
  const parts = splitIntervalByApplicationDay(start, end);
  assert.deepEqual(parts.map((part) => part.durationMilliseconds), [1n, 86_400_000n, 86_400_000n, 1n]);
  assert.equal(parts.reduce((sum, part) => sum + part.durationMilliseconds, 0n), intervalDurationMilliseconds(start, end));
});

test("T5: application-day allocation uses Vietnam time rather than host local time", () => {
  const instant = Date.parse("2026-10-17T18:00:00.000Z");
  const [part] = splitIntervalByApplicationDay(instant, instant + 1_000);
  assert.equal(part.applicationDate, "2026-10-18");
});

test("T5: an interval within one Vietnam day remains one lossless segment", () => {
  const start = Date.parse("2026-10-17T01:00:00.125Z");
  const end = start + 20_250;
  const parts = splitIntervalByApplicationDay(start, end);
  assert.equal(parts.length, 1);
  assert.equal(parts[0].applicationDate, "2026-10-17");
  assert.equal(parts[0].durationMilliseconds, 20_250n);
});

test("T6: BigInt progress retains subsecond precision and caps visuals only", () => {
  const projection = projectDailyGoalProgress({
    activeMilliseconds: 1_800_999n,
    targetMinutes: 15,
    rewardEarned: true,
  });
  assert.equal(projection.activeMilliseconds, 1_800_999n);
  assert.equal(projection.activeSeconds, 1_800n);
  assert.equal(projection.completed, true);
  assert.equal(projection.rewardEarned, true);
  assert.equal(projection.progressBasisPoints, 10_000n);
  assert.equal(intervalDurationMilliseconds(0, Number.MAX_SAFE_INTEGER), BigInt(Number.MAX_SAFE_INTEGER));
});

test("activity/event allowlists distinguish lifecycle events from meaningful interactions", () => {
  assert.deepEqual(Object.keys(DAILY_GOAL_ENGAGEMENT_EVENTS), ["NORMAL", "SRS", "QUIZ", "SPEAKING"]);
  assert.equal(isAllowedEngagementEvent("NORMAL", "READY"), true);
  assert.equal(isMeaningfulEngagementEvent("NORMAL", "READY"), false);
  assert.equal(isMeaningfulEngagementEvent("NORMAL", "REVEAL"), true);
  assert.equal(isMeaningfulEngagementEvent("SRS", "RATE"), true);
  assert.equal(isMeaningfulEngagementEvent("QUIZ", "SUBMIT_ANSWER"), true);
  assert.equal(isMeaningfulEngagementEvent("SPEAKING", "RECOGNITION_START_REQUEST"), true);
  assert.equal(isAllowedEngagementEvent("NORMAL", "RATE"), false);
  assert.equal(isAllowedEngagementEvent("UNKNOWN", "READY"), false);
});

test("invalid intervals and projection inputs fail closed", () => {
  assert.throws(() => intervalDurationMilliseconds(2, 1), /endMs/);
  assert.throws(() => intervalDurationMilliseconds(0.5, 1), /startMs/);
  assert.throws(() => projectDailyGoalProgress({ activeMilliseconds: -1n, targetMinutes: 15 }), /activeMilliseconds/);
  assert.throws(() => projectDailyGoalProgress({ activeMilliseconds: 0n, targetMinutes: 9 }), /targetMinutes/);
});
