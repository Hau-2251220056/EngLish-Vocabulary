// @ts-nocheck
import { STREAK_TIME_ZONE, toApplicationDate } from "./streak-domain.js";

export const DAILY_GOAL_TIME_ZONE = STREAK_TIME_ZONE;
export const HEARTBEAT_INTERVAL_MILLISECONDS = 20_000;
export const OWNER_LEASE_MILLISECONDS = 45_000;
export const MAX_ACCOUNTING_GAP_MILLISECONDS = 25_000;
export const IDLE_THRESHOLD_MILLISECONDS = 120_000;

export const DAILY_GOAL_ACTIVITY_TYPES = Object.freeze([
  "NORMAL",
  "SRS",
  "QUIZ",
  "SPEAKING",
]);

export const DAILY_GOAL_ENGAGEMENT_EVENTS = Object.freeze({
  NORMAL: Object.freeze([
    "READY",
    "RESUME",
    "REVEAL",
    "NAVIGATE",
    "REFERENCE_PRONUNCIATION_PLAYBACK",
  ]),
  SRS: Object.freeze([
    "READY",
    "RESUME",
    "REVEAL",
    "REFERENCE_PRONUNCIATION_PLAYBACK",
    "RATE",
  ]),
  QUIZ: Object.freeze([
    "READY",
    "RESUME",
    "SELECT_ANSWER",
    "SUBMIT_ANSWER",
    "ADVANCE",
  ]),
  SPEAKING: Object.freeze([
    "READY",
    "RESUME",
    "SAMPLE_PLAYBACK_REQUEST",
    "RECOGNITION_START_REQUEST",
    "RECOGNITION_STOP_REQUEST",
    "TARGET_NAVIGATE",
  ]),
});

const ACTIVITY_TYPE_SET = new Set(DAILY_GOAL_ACTIVITY_TYPES);
const LIFECYCLE_EVENTS = new Set(["READY", "RESUME"]);
const VIETNAM_OFFSET_MILLISECONDS = 7 * 60 * 60 * 1_000;
const ISO_APPLICATION_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isSupportedActivityType(value) {
  return ACTIVITY_TYPE_SET.has(value);
}

export function isAllowedEngagementEvent(activityType, eventType) {
  return DAILY_GOAL_ENGAGEMENT_EVENTS[activityType]?.includes(eventType) ?? false;
}

export function isMeaningfulEngagementEvent(activityType, eventType) {
  return isAllowedEngagementEvent(activityType, eventType)
    && !LIFECYCLE_EVENTS.has(eventType);
}

export function createEngagementDeadline(receivedAtMs) {
  return addMilliseconds(receivedAtMs, IDLE_THRESHOLD_MILLISECONDS, "receivedAtMs");
}

export function createLeaseExpiry(receivedAtMs) {
  return addMilliseconds(receivedAtMs, OWNER_LEASE_MILLISECONDS, "receivedAtMs");
}

export function isLeaseExpired(receivedAtMs, leaseExpiresAtMs) {
  requireTimestamp(receivedAtMs, "receivedAtMs");
  requireTimestamp(leaseExpiresAtMs, "leaseExpiresAtMs");
  return receivedAtMs >= leaseExpiresAtMs;
}

export function isEngagementExpired(receivedAtMs, engagementExpiresAtMs) {
  requireTimestamp(receivedAtMs, "receivedAtMs");
  requireTimestamp(engagementExpiresAtMs, "engagementExpiresAtMs");
  return receivedAtMs >= engagementExpiresAtMs;
}

export function nextOwnershipGeneration(generation) {
  const normalized = requireNonnegativeBigInt(generation, "generation");
  return normalized + 1n;
}

export function classifyOwnershipFence(requestedGeneration, currentGeneration) {
  const requested = requireNonnegativeBigInt(requestedGeneration, "requestedGeneration");
  const current = requireNonnegativeBigInt(currentGeneration, "currentGeneration");
  if (requested === current) {
    return "CURRENT";
  }
  return requested < current ? "STALE" : "FUTURE_INVALID";
}

export function classifyOperationReplay({
  storedOperationType,
  storedFingerprint,
  requestedOperationType,
  requestedFingerprint,
}) {
  for (const [name, value] of Object.entries({
    storedOperationType,
    storedFingerprint,
    requestedOperationType,
    requestedFingerprint,
  })) {
    if (typeof value !== "string" || value.length === 0) {
      throw new TypeError(`${name} must be a nonempty string.`);
    }
  }
  return storedOperationType === requestedOperationType
    && storedFingerprint === requestedFingerprint
    ? "REPLAY"
    : "OPERATION_CONFLICT";
}

export function intervalDurationMilliseconds(startMs, endMs) {
  requireTimestamp(startMs, "startMs");
  requireTimestamp(endMs, "endMs");
  if (endMs < startMs) {
    throw new RangeError("endMs must be greater than or equal to startMs.");
  }
  return BigInt(endMs) - BigInt(startMs);
}

/**
 * Applies PLAN R1 section 5.3 to one server-observed owner interval.
 * The caller must perform receipt replay and generation/session validation first.
 */
export function evaluateAcceptedInterval({
  lastAccountedAtMs,
  receivedAtMs,
  leaseExpiresAtMs,
  engagementExpiresAtMs,
}) {
  requireTimestamp(lastAccountedAtMs, "lastAccountedAtMs");
  requireTimestamp(receivedAtMs, "receivedAtMs");
  requireTimestamp(leaseExpiresAtMs, "leaseExpiresAtMs");
  requireTimestamp(engagementExpiresAtMs, "engagementExpiresAtMs");

  if (receivedAtMs < lastAccountedAtMs) {
    return intervalDecision({
      classification: "OUT_OF_ORDER",
      nextCursorMs: lastAccountedAtMs,
      shouldFence: false,
      mayRenewLease: false,
    });
  }

  if (receivedAtMs >= leaseExpiresAtMs) {
    return intervalDecision({
      classification: "LEASE_EXPIRED",
      nextCursorMs: receivedAtMs,
      rejectedMilliseconds: intervalDurationMilliseconds(lastAccountedAtMs, receivedAtMs),
      shouldFence: true,
      mayRenewLease: false,
    });
  }

  const observedGap = receivedAtMs - lastAccountedAtMs;
  if (observedGap > MAX_ACCOUNTING_GAP_MILLISECONDS) {
    return intervalDecision({
      classification: "GAP_REJECTED",
      nextCursorMs: receivedAtMs,
      rejectedMilliseconds: BigInt(observedGap),
      shouldFence: false,
      mayRenewLease: true,
    });
  }

  const acceptedEndMs = Math.min(receivedAtMs, engagementExpiresAtMs);
  const acceptedInterval = acceptedEndMs > lastAccountedAtMs
    ? Object.freeze({ startMs: lastAccountedAtMs, endMs: acceptedEndMs })
    : null;
  const creditedMilliseconds = acceptedInterval
    ? intervalDurationMilliseconds(acceptedInterval.startMs, acceptedInterval.endMs)
    : 0n;

  if (receivedAtMs >= engagementExpiresAtMs) {
    return intervalDecision({
      classification: "IDLE_REACHED",
      nextCursorMs: receivedAtMs,
      creditedMilliseconds,
      rejectedMilliseconds: receivedAtMs > acceptedEndMs
        ? intervalDurationMilliseconds(acceptedEndMs, receivedAtMs)
        : 0n,
      acceptedInterval,
      shouldFence: true,
      mayRenewLease: false,
    });
  }

  return intervalDecision({
    classification: observedGap === 0 ? "ZERO_LENGTH" : "ACCEPTED",
    nextCursorMs: receivedAtMs,
    creditedMilliseconds,
    acceptedInterval,
    shouldFence: false,
    mayRenewLease: true,
  });
}

export function splitIntervalByApplicationDay(startMs, endMs) {
  const total = intervalDurationMilliseconds(startMs, endMs);
  if (total === 0n) {
    return Object.freeze([]);
  }

  const parts = [];
  let cursorMs = startMs;
  while (cursorMs < endMs) {
    const applicationDate = toApplicationDate(cursorMs);
    const boundaryMs = nextVietnamMidnightMs(applicationDate);
    const partEndMs = Math.min(endMs, boundaryMs);
    parts.push(Object.freeze({
      applicationDate,
      startMs: cursorMs,
      endMs: partEndMs,
      durationMilliseconds: intervalDurationMilliseconds(cursorMs, partEndMs),
    }));
    cursorMs = partEndMs;
  }

  return Object.freeze(parts);
}

export function projectDailyGoalProgress({
  activeMilliseconds,
  targetMinutes,
  rewardEarned = false,
}) {
  const active = requireNonnegativeBigInt(activeMilliseconds, "activeMilliseconds");
  if (targetMinutes !== null && (
    !Number.isInteger(targetMinutes)
    || targetMinutes < 10
    || targetMinutes > 240
  )) {
    throw new RangeError("targetMinutes must be null or an integer from 10 through 240.");
  }
  if (typeof rewardEarned !== "boolean") {
    throw new TypeError("rewardEarned must be a boolean.");
  }

  const targetMilliseconds = targetMinutes === null
    ? null
    : BigInt(targetMinutes) * 60_000n;
  const completed = targetMilliseconds !== null && active >= targetMilliseconds;
  const progressBasisPoints = targetMilliseconds === null
    ? 0n
    : minBigInt(10_000n, (active * 10_000n) / targetMilliseconds);

  return Object.freeze({
    activeMilliseconds: active,
    activeSeconds: active / 1_000n,
    targetMinutes,
    targetMilliseconds,
    completed,
    rewardEarned,
    progressBasisPoints,
  });
}

function intervalDecision({
  classification,
  nextCursorMs,
  creditedMilliseconds = 0n,
  rejectedMilliseconds = 0n,
  acceptedInterval = null,
  shouldFence,
  mayRenewLease,
}) {
  return Object.freeze({
    classification,
    nextCursorMs,
    creditedMilliseconds,
    rejectedMilliseconds,
    acceptedInterval,
    shouldFence,
    mayRenewLease,
  });
}

function nextVietnamMidnightMs(applicationDate) {
  const match = applicationDate.match(ISO_APPLICATION_DATE_PATTERN);
  if (!match) {
    throw new TypeError("applicationDate must use YYYY-MM-DD.");
  }
  const [, year, month, day] = match.map(Number);
  return Date.UTC(year, month - 1, day + 1) - VIETNAM_OFFSET_MILLISECONDS;
}

function addMilliseconds(value, delta, name) {
  requireTimestamp(value, name);
  const result = value + delta;
  requireTimestamp(result, `${name} plus duration`);
  return result;
}

function requireTimestamp(value, name) {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`${name} must be an integer millisecond instant within the JavaScript safe range.`);
  }
  return value;
}

function requireNonnegativeBigInt(value, name) {
  const normalized = typeof value === "bigint"
    ? value
    : Number.isSafeInteger(value)
      ? BigInt(value)
      : null;
  if (normalized === null || normalized < 0n) {
    throw new TypeError(`${name} must be a nonnegative bigint or safe integer.`);
  }
  return normalized;
}

function minBigInt(left, right) {
  return left < right ? left : right;
}
