// @ts-nocheck
import { createHash, randomUUID } from "node:crypto";

import {
  createEngagementDeadline,
  createLeaseExpiry,
  evaluateAcceptedInterval,
  isAllowedEngagementEvent,
  isMeaningfulEngagementEvent,
  isSupportedActivityType,
  nextOwnershipGeneration,
  splitIntervalByApplicationDay,
} from "./daily-goal-domain.js";
import { projectXpLevel } from "./xp-level-service.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ELIGIBILITY = "VISIBLE_FOCUSED_ACTIVE";
const MIN_USEFUL_HEARTBEAT_MILLISECONDS = 10_000;
const PAUSE_REASONS = new Set(["HIDDEN", "BLURRED", "IDLE", "ROUTE_EXIT", "LOGOUT", "SLEEP", "COMPLETED", "ERROR"]);
const REPLAYABLE_TERMINAL_CODES = new Set(["IDLE_RESUME_REQUIRED"]);
const POSTGRESQL_BIGINT_MAX = 9_223_372_036_854_775_807n;
const DAILY_GOAL_REWARD_XP = 10;
const DEFAULT_NOTIFICATION_PAGE_SIZE = 20;
const MAX_NOTIFICATION_PAGE_SIZE = 50;
const MAX_NOTIFICATION_CURSOR_LENGTH = 512;
const NOTIFICATION_CURSOR_VERSION = 1;
const MONITOR_CHECK_AFTER_SECONDS = 60;
const MONITOR_CONTINUITY_TOLERANCE_MILLISECONDS = 150_000;
const COMPLETION_NOTIFICATION = Object.freeze({
  title: "Daily Goal completed",
  body: "You completed your Daily Goal and earned 10 XP.",
});

export class DailyGoalServiceError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

export function createDailyGoalService({ dailyGoalRepository, now = () => new Date(), uuid = randomUUID }) {
  if (!dailyGoalRepository?.withUserTransaction) throw new TypeError("Daily Goal repository is required.");

  async function transact(userId, callback) {
    requireUuid(userId);
    const instant = requireDate(now());
    const outcome = await dailyGoalRepository.withUserTransaction(userId, (repository) => callback(repository, instant));
    if (outcome?.deferredError) throw outcome.deferredError;
    return outcome;
  }

  return Object.freeze({
    listNotifications(userId, query) {
      const request = validateNotificationListQuery(query);
      const before = request.cursor ? decodeNotificationCursor(request.cursor) : null;
      return transact(userId, async (repository) => {
        const rows = await repository.listNotifications({ before, take: request.pageSize + 1 });
        const hasNextPage = rows.length > request.pageSize;
        const items = rows.slice(0, request.pageSize).map(notificationProjection);
        const boundary = hasNextPage ? rows[request.pageSize - 1] : null;
        return {
          items,
          unread_count: await repository.countUnreadNotifications(),
          next_cursor: boundary ? encodeNotificationCursor(boundary) : null,
        };
      });
    },

    countUnreadNotifications(userId) {
      return transact(userId, async (repository) => ({
        unread_count: await repository.countUnreadNotifications(),
      }));
    },

    markNotificationRead(userId, notificationId, input) {
      requireUuid(notificationId, notificationValidation);
      validateMarkNotificationRead(input);
      return transact(userId, async (repository, instant) => {
        const notification = await repository.findNotification(notificationId);
        if (!notification) throw notificationNotFound();
        const readAt = notification.read_at ?? instant;
        if (notification.read_at === null) {
          const updated = await repository.markNotificationRead(notificationId, readAt);
          if (updated.count !== 1) throw notificationNotFound();
        }
        return {
          notification: notificationProjection({ ...notification, read_at: readAt }),
          unread_count: await repository.countUnreadNotifications(),
        };
      });
    },

    getGoal(userId) {
      return transact(userId, async (repository, instant) => projectGoal(repository, applicationDate(instant)));
    },

    updateGoal(userId, input) {
      const request = validateGoalUpdate(input);
      return transact(userId, async (repository, instant) => {
        const date = applicationDate(instant);
        const fingerprint = digest(request);
        const replay = await repository.findOperationReplay({
          operationId: request.operation_id,
          operationType: "GOAL_UPDATE",
          requestFingerprint: fingerprint,
        });
        if (replay.classification === "REPLAY") return replayResult(replay);
        if (replay.classification === "OPERATION_CONFLICT") throw conflict("OPERATION_CONFLICT");
        const updated = await repository.updatePreference({ daily_goal_minutes: request.target_minutes });
        if (updated.count !== 1) throw notFound();
        const earnedNow = await awardCompletion(repository, date, request.operation_id, instant, uuid);
        const goal = await projectGoal(repository, date);
        const response = { ...goal, reward: { earned_now: earnedNow, xp_earned: earnedNow ? DAILY_GOAL_REWARD_XP : 0 } };
        await receipt(repository, request.operation_id, "GOAL_UPDATE", fingerprint, null, null, 0n, response, instant);
        return { ...response, replayed: false };
      });
    },

    updateReminderPreference(userId, input) {
      const request = validateReminderPreferenceUpdate(input);
      return transact(userId, async (repository, instant) => {
        const fingerprint = digest(request);
        const replay = await repository.findOperationReplay({
          operationId: request.operation_id,
          operationType: "REMINDER_PREFERENCE_UPDATE",
          requestFingerprint: fingerprint,
        });
        if (replay.classification === "REPLAY") return replayResult(replay);
        if (replay.classification === "OPERATION_CONFLICT") throw conflict("OPERATION_CONFLICT");
        const updated = await repository.updatePreference({
          daily_goal_reminders_enabled: request.enabled,
          ...(request.enabled ? { daily_goal_reminders_enabled_at: instant } : {}),
        });
        if (updated.count !== 1) throw notFound();
        const response = { reminder_enabled: request.enabled, updated_at: instant.toISOString() };
        await receipt(repository, request.operation_id, "REMINDER_PREFERENCE_UPDATE", fingerprint, null, null, 0n, response, instant);
        return { ...response, replayed: false };
      });
    },

    establishMonitor(userId, input) {
      const request = validateMonitorOperation(input);
      return transact(userId, async (repository, instant) => {
        const fingerprint = digest(request);
        const replay = await replayOrConflict(repository, request.operation_id, "MONITOR_CREATE", fingerprint);
        if (replay) return replay;
        const preference = await repository.findPreference();
        if (!preference) throw notFound();
        const session = await repository.createMonitorSession({
          id: uuid(), started_at: instant, last_seen_at: instant,
          continuity_started_at: instant, eligible_baseline_at: instant, closed_at: null,
        });
        const response = {
          monitor_session_id: session.id,
          reminder_enabled: preference.daily_goal_reminders_enabled ?? true,
          target_configured: preference.daily_goal_minutes !== null,
          unread_count: await repository.countUnreadNotifications(),
          check_after_seconds: MONITOR_CHECK_AFTER_SECONDS,
        };
        await monitorReceipt(repository, request.operation_id, "MONITOR_CREATE", fingerprint, session.id, response, instant);
        return { ...response, replayed: false };
      });
    },

    checkMonitor(userId, monitorSessionId, input) {
      requireUuid(monitorSessionId);
      const request = validateMonitorOperation(input);
      return transact(userId, async (repository, instant) => {
        const fingerprint = digest({ monitor_session_id: monitorSessionId, ...request });
        const replay = await replayOrConflict(repository, request.operation_id, "MONITOR_CHECK", fingerprint);
        if (replay) return replay;
        const session = await repository.findMonitorSession(monitorSessionId);
        if (!session || session.closed_at !== null) throw notFound();
        const preference = await repository.findPreference();
        if (!preference) throw notFound();
        const longGap = instant.getTime() - requireDate(session.last_seen_at).getTime()
          > MONITOR_CONTINUITY_TOLERANCE_MILLISECONDS;
        const eligibleBaseline = longGap
          ? instant
          : laterMonitorBaseline(session.eligible_baseline_at, preference, instant);
        const update = {
          last_seen_at: instant,
          ...(longGap ? { continuity_started_at: instant } : {}),
          ...(eligibleBaseline.getTime() !== requireDate(session.eligible_baseline_at).getTime()
            ? { eligible_baseline_at: eligibleBaseline } : {}),
        };
        const updated = await repository.updateMonitorSession(monitorSessionId, update);
        if (updated.count !== 1) throw notFound();
        const response = {
          monitor_session_id: session.id,
          last_seen_at: instant.toISOString(),
          continuity_started_at: (longGap ? instant : requireDate(session.continuity_started_at)).toISOString(),
          eligible_baseline_at: eligibleBaseline.toISOString(),
        };
        await monitorReceipt(repository, request.operation_id, "MONITOR_CHECK", fingerprint, session.id, response, instant);
        return { ...response, replayed: false };
      });
    },

    closeMonitor(userId, monitorSessionId, input) {
      requireUuid(monitorSessionId);
      const request = validateMonitorOperation(input);
      return transact(userId, async (repository, instant) => {
        const session = await repository.findMonitorSession(monitorSessionId);
        if (!session) throw notFound();
        const fingerprint = digest({ monitor_session_id: monitorSessionId, ...request });
        const replay = await replayOrConflict(repository, request.operation_id, "MONITOR_CLOSE", fingerprint);
        if (replay) return replay;
        const closedAt = session.closed_at === null ? instant : requireDate(session.closed_at);
        if (session.closed_at === null) {
          const updated = await repository.updateMonitorSession(monitorSessionId, { closed_at: closedAt });
          if (updated.count !== 1) throw notFound();
        }
        const response = { monitor_session_id: session.id, closed_at: closedAt.toISOString() };
        await monitorReceipt(repository, request.operation_id, "MONITOR_CLOSE", fingerprint, session.id, response, instant);
        return { ...response, replayed: false };
      });
    },

    establish(userId, input) {
      const request = validateEstablish(input);
      return transact(userId, async (repository, instant) => {
        const fingerprint = digest(request);
        const replay = await repository.findOperationReplay({ operationId: request.operation_id, operationType: "CREATE", requestFingerprint: fingerprint });
        if (replay.classification === "REPLAY") return replayResult(replay);
        if (replay.classification === "OPERATION_CONFLICT") throw conflict("OPERATION_CONFLICT");
        if (!await repository.findAuthorizedActivityContext({ ...contextOf(request), observedAt: instant })) throw notFound();
        const session = await repository.createTrackingSession({
          id: uuid(), activity_type: request.activity_type,
          learning_session_id: request.learning_session_id ?? null,
          set_id: request.set_id ?? null, vocabulary_id: request.vocabulary_id ?? null,
          status: "ACTIVE",
          created_at: instant,
        });
        const response = projection(session, null, 0n);
        await receipt(repository, request.operation_id, "CREATE", fingerprint, session.id, null, 0n, response, instant);
        return { ...response, replayed: false };
      });
    },

    engage(userId, sessionId, input) {
      requireUuid(sessionId);
      const request = validateEngagement(input);
      return transact(userId, async (repository, instant) => {
        const session = await requireSessionAndContext(repository, sessionId, instant);
        if (!isAllowedEngagementEvent(session.activity_type, request.event_type)) throw validation();
        const type = request.event_type === "READY" ? "READY" : request.event_type === "RESUME" ? "RESUME" : "INTERACTION";
        const fingerprint = digest({ session_id: sessionId, ...request });
        const replay = await replayOrConflict(repository, request.operation_id, type, fingerprint);
        if (replay) return replay;
        const owner = await repository.findOwner();
        const currentGeneration = owner?.generation ?? 0n;
        if (request.generation !== undefined && request.generation !== currentGeneration) {
          throw ownership(currentGeneration);
        }
        if (request.event_type === "READY" && session.engagement_expires_at) throw conflict("TRACKING_SEQUENCE_CONFLICT");
        if (request.event_type === "RESUME" && session.status !== "PAUSED") throw conflict("TRACKING_SEQUENCE_CONFLICT");
        if (request.event_type !== "READY" && request.event_type !== "RESUME") {
          if (!session.engagement_expires_at) throw conflict("TRACKING_SEQUENCE_CONFLICT");
          const expired = instant.getTime() >= session.engagement_expires_at.getTime();
          if (expired) {
            let credited = 0n;
            if (owner?.tracking_session_id === session.id && owner.last_accounted_at && owner.lease_expires_at) {
              const decision = evaluateAcceptedInterval({
                lastAccountedAtMs: owner.last_accounted_at.getTime(), receivedAtMs: instant.getTime(),
                leaseExpiresAtMs: owner.lease_expires_at.getTime(), engagementExpiresAtMs: session.engagement_expires_at.getTime(),
              });
              if (decision.acceptedInterval) await creditInterval(repository, decision.acceptedInterval, session.activity_type, request.operation_id, instant, uuid);
              credited = decision.creditedMilliseconds;
            }
            const requestingOwner = owner?.tracking_session_id === session.id ? owner : null;
            await fence(repository, session, requestingOwner, instant, "PAUSED");
            const response = projection({ ...session, status: "PAUSED" }, null, credited);
            await receipt(repository, request.operation_id, type, fingerprint, session.id, requestingOwner?.generation ?? request.generation ?? null, credited, response, instant, "IDLE_RESUME_REQUIRED");
            return { deferredError: conflict("IDLE_RESUME_REQUIRED") };
          }
        }
        if (request.event_type === "RESUME" && session.status === "CLOSED") throw notFound();
        let generation = nextOwnershipGeneration(currentGeneration);
        let credited = 0n;
        if (isMeaningfulEngagementEvent(session.activity_type, request.event_type)
          && owner?.tracking_session_id === session.id
          && (request.generation === undefined || request.generation === owner.generation)
          && owner.last_accounted_at && owner.lease_expires_at) {
          const decision = evaluateAcceptedInterval({
            lastAccountedAtMs: owner.last_accounted_at.getTime(), receivedAtMs: instant.getTime(),
            leaseExpiresAtMs: owner.lease_expires_at.getTime(), engagementExpiresAtMs: session.engagement_expires_at.getTime(),
          });
          if (decision.shouldFence) throw conflict("IDLE_RESUME_REQUIRED");
          if (decision.acceptedInterval) await creditInterval(repository, decision.acceptedInterval, session.activity_type, request.operation_id, instant, uuid);
          credited = decision.creditedMilliseconds;
          generation = owner.generation;
        }
        const deadline = new Date(createEngagementDeadline(instant.getTime()));
        await repository.updateTrackingSession(session.id, {
          status: "ACTIVE", engagement_expires_at: deadline,
          last_meaningful_at: instant, closed_at: null,
        });
        await repository.upsertOwner({
          create: { tracking_session_id: session.id, generation, lease_expires_at: new Date(createLeaseExpiry(instant.getTime())), last_accounted_at: instant },
          update: { tracking_session_id: session.id, generation, lease_expires_at: new Date(createLeaseExpiry(instant.getTime())), last_accounted_at: instant },
        });
        await touchEngagementDay(repository, instant, session.activity_type);
        const response = projection({ ...session, status: "ACTIVE", engagement_expires_at: deadline }, { tracking_session_id: session.id, generation, lease_expires_at: new Date(createLeaseExpiry(instant.getTime())) }, credited);
        await receipt(repository, request.operation_id, type, fingerprint, session.id, generation, credited, response, instant);
        return response;
      });
    },

    heartbeat(userId, sessionId, input) {
      requireUuid(sessionId);
      const request = validateHeartbeat(input);
      return transact(userId, async (repository, instant) => {
        const session = await requireSessionAndContext(repository, sessionId, instant);
        const fingerprint = digest({ session_id: sessionId, ...request, generation: request.generation.toString() });
        const replay = await replayOrConflict(repository, request.operation_id, "HEARTBEAT", fingerprint);
        if (replay) return replay;
        const owner = await repository.findOwner();
        if (!owner || owner.tracking_session_id !== session.id || owner.generation !== request.generation) {
          throw ownership(owner?.generation ?? 0n);
        }
        if (!owner.last_accounted_at || !owner.lease_expires_at || !session.engagement_expires_at || session.status !== "ACTIVE") throw ownership(owner.generation);
        const observedGap = instant.getTime() - owner.last_accounted_at.getTime();
        if (observedGap >= 0 && observedGap < MIN_USEFUL_HEARTBEAT_MILLISECONDS) {
          const response = projection(session, owner, 0n);
          await receipt(repository, request.operation_id, "HEARTBEAT", fingerprint, session.id, owner.generation, 0n, response, instant);
          return response;
        }
        const decision = evaluateAcceptedInterval({
          lastAccountedAtMs: owner.last_accounted_at.getTime(), receivedAtMs: instant.getTime(),
          leaseExpiresAtMs: owner.lease_expires_at.getTime(), engagementExpiresAtMs: session.engagement_expires_at.getTime(),
        });
        if (decision.acceptedInterval) await creditInterval(repository, decision.acceptedInterval, session.activity_type, request.operation_id, instant, uuid);
        let nextOwner = owner;
        if (decision.classification === "LEASE_EXPIRED" && instant.getTime() < session.engagement_expires_at.getTime()) {
          const generation = nextOwnershipGeneration(owner.generation);
          await repository.upsertOwner({
            create: { tracking_session_id: session.id, generation, lease_expires_at: new Date(createLeaseExpiry(instant.getTime())), last_accounted_at: instant },
            update: { tracking_session_id: session.id, generation, lease_expires_at: new Date(createLeaseExpiry(instant.getTime())), last_accounted_at: instant },
          });
          nextOwner = { tracking_session_id: session.id, generation, lease_expires_at: new Date(createLeaseExpiry(instant.getTime())) };
        } else if (decision.shouldFence) {
          await fence(repository, session, owner, instant, "PAUSED");
          nextOwner = null;
        } else {
          const lease = new Date(createLeaseExpiry(instant.getTime()));
          await repository.updateOwnerAtGeneration(owner.generation, { last_accounted_at: new Date(decision.nextCursorMs), lease_expires_at: lease });
          nextOwner = { ...owner, lease_expires_at: lease };
        }
        const response = projection({ ...session, ...(nextOwner ? {} : { status: "PAUSED" }) }, nextOwner, decision.creditedMilliseconds);
        const terminalCode = decision.classification === "IDLE_REACHED" ? "IDLE_RESUME_REQUIRED" : null;
        await receipt(repository, request.operation_id, "HEARTBEAT", fingerprint, session.id, owner.generation, decision.creditedMilliseconds, response, instant, terminalCode);
        if (terminalCode) return { deferredError: conflict(terminalCode) };
        return response;
      });
    },

    pause(userId, sessionId, input) { return endSession(userId, sessionId, input, false); },
    close(userId, sessionId, input) { return endSession(userId, sessionId, input, true); },
  });

  function endSession(userId, sessionId, input, closing) {
    requireUuid(sessionId);
    const request = validateEnd(input, closing);
    const type = closing ? "CLOSE" : "PAUSE";
    return transact(userId, async (repository, instant) => {
      const session = await repository.findTrackingSession(sessionId);
      if (!session) throw notFound();
      const fingerprint = digest({ session_id: sessionId, ...request, generation: request.generation.toString() });
      const replay = await replayOrConflict(repository, request.operation_id, type, fingerprint);
      if (replay) return replay;
      const owner = await repository.findOwner();
      if (owner?.tracking_session_id === session.id && owner.generation === request.generation) await fence(repository, session, owner, instant, closing ? "CLOSED" : "PAUSED");
      else if (!closing || session.status !== "CLOSED") throw ownership(owner?.generation ?? 0n);
      const response = projection({ ...session, status: closing ? "CLOSED" : "PAUSED" }, null, 0n);
      await receipt(repository, request.operation_id, type, fingerprint, session.id, request.generation, 0n, response, instant);
      return response;
    });
  }
}

async function requireSessionAndContext(repository, id, instant) {
  const session = await repository.findTrackingSession(id);
  if (!session || session.status === "CLOSED" || !await repository.findAuthorizedActivityContext({ ...contextOf(session), observedAt: instant })) throw notFound();
  return session;
}
function contextOf(value) { return { activityType: value.activity_type, learningSessionId: value.learning_session_id, setId: value.set_id, vocabularyId: value.vocabulary_id }; }
async function replayOrConflict(repository, operationId, operationType, requestFingerprint) {
  const result = await repository.findOperationReplay({ operationId, operationType, requestFingerprint });
  if (result.classification === "OPERATION_CONFLICT") throw conflict("OPERATION_CONFLICT");
  return result.classification === "REPLAY" ? replayResult(result) : null;
}
function replayResult(result) {
  const stored = result.receipt.response_projection;
  if (!stored || stored.outcome === "TERMINAL_ERROR") {
    if (!REPLAYABLE_TERMINAL_CODES.has(stored?.code)) throw new Error("Stored Daily Goal replay outcome is invalid.");
    throw conflict(stored.code);
  }
  if (stored.outcome !== "SUCCESS") throw invalidReplay();
  return { ...validateStoredSuccess(result.receipt.operation_type, stored.data), replayed: true };
}
async function receipt(repository, operationId, operationType, requestFingerprint, trackingSessionId, generation, credited, response, instant, terminalCode = null) {
  if (terminalCode !== null && !REPLAYABLE_TERMINAL_CODES.has(terminalCode)) throw new Error("Terminal replay code is not allowlisted.");
  const replayOutcome = terminalCode
    ? { outcome: "TERMINAL_ERROR", code: terminalCode, data: response }
    : { outcome: "SUCCESS", data: response };
  await repository.createOperationReceipt({ operation_id: operationId, tracking_session_id: trackingSessionId, generation, operation_type: operationType, request_fingerprint: requestFingerprint, credited_milliseconds: credited, response_projection: replayOutcome, created_at: instant });
}
async function monitorReceipt(repository, operationId, operationType, requestFingerprint, monitorSessionId, response, instant) {
  await repository.createOperationReceipt({
    operation_id: operationId, monitor_session_id: monitorSessionId, generation: null,
    operation_type: operationType, request_fingerprint: requestFingerprint,
    credited_milliseconds: 0n, response_projection: { outcome: "SUCCESS", data: response }, created_at: instant,
  });
}
async function fence(repository, session, owner, instant, status) {
  if (owner) await repository.updateOwnerAtGeneration(owner.generation, { tracking_session_id: null, lease_expires_at: null, last_accounted_at: null, generation: nextOwnershipGeneration(owner.generation) });
  await repository.updateTrackingSession(session.id, { status, ...(status === "CLOSED" ? { closed_at: instant } : {}) });
}
async function creditInterval(repository, interval, activityType, operationId, instant, uuid) {
  for (const part of splitIntervalByApplicationDay(interval.startMs, interval.endMs)) {
    const date = new Date(`${part.applicationDate}T00:00:00.000Z`);
    await repository.upsertDay(date, { create: { active_milliseconds: part.durationMilliseconds, last_credited_at: new Date(part.endMs), last_activity_type: activityType }, update: { active_milliseconds: { increment: part.durationMilliseconds }, last_credited_at: new Date(part.endMs), last_activity_type: activityType } });
    await awardCompletion(repository, date, operationId, instant, uuid);
  }
}
async function touchEngagementDay(repository, instant, activityType) {
  const part = splitIntervalByApplicationDay(instant.getTime(), instant.getTime() + 1)[0];
  const date = new Date(`${part.applicationDate}T00:00:00.000Z`);
  await repository.upsertDay(date, { create: { active_milliseconds: 0n, last_engagement_at: instant, last_activity_type: activityType }, update: { last_engagement_at: instant, last_activity_type: activityType } });
}
function projection(session, owner, credited) { return { tracking_session_id: session.id, status: session.status, owner: owner?.tracking_session_id === session.id, generation: owner ? owner.generation.toString() : null, lease_expires_at: owner?.lease_expires_at?.toISOString?.() ?? null, engagement_expires_at: session.engagement_expires_at?.toISOString?.() ?? null, credited_milliseconds: credited.toString(), projection: { credited_milliseconds: credited.toString() } }; }
function validateStoredSuccess(operationType, data) {
  if (operationType === "GOAL_UPDATE") return validateStoredGoalUpdate(data);
  if (operationType === "REMINDER_PREFERENCE_UPDATE") return validateStoredReminderPreferenceUpdate(data);
  if (operationType === "MONITOR_CREATE") return validateStoredMonitorCreate(data);
  if (operationType === "MONITOR_CHECK") return validateStoredMonitorCheck(data);
  if (operationType === "MONITOR_CLOSE") return validateStoredMonitorClose(data);
  const operations = new Set(["CREATE", "READY", "RESUME", "INTERACTION", "HEARTBEAT", "PAUSE", "CLOSE"]);
  if (!operations.has(operationType) || !isRecord(data)) throw invalidReplay();
  const keys = ["tracking_session_id", "status", "owner", "generation", "lease_expires_at", "engagement_expires_at", "credited_milliseconds", "projection"];
  requireExactKeys(data, keys);
  if (typeof data.tracking_session_id !== "string" || !UUID.test(data.tracking_session_id)) throw invalidReplay();
  if (!new Set(["ACTIVE", "PAUSED", "CLOSED"]).has(data.status) || typeof data.owner !== "boolean") throw invalidReplay();
  if (data.generation !== null && !isPersistedGeneration(data.generation)) throw invalidReplay();
  if (data.lease_expires_at !== null && !isCanonicalInstant(data.lease_expires_at)) throw invalidReplay();
  if (data.engagement_expires_at !== null && !isCanonicalInstant(data.engagement_expires_at)) throw invalidReplay();
  if (!isUnsignedDecimal(data.credited_milliseconds)) throw invalidReplay();
  const credited = BigInt(data.credited_milliseconds);
  if (credited > 25_000n || !isRecord(data.projection)) throw invalidReplay();
  requireExactKeys(data.projection, ["credited_milliseconds"]);
  if (data.projection.credited_milliseconds !== data.credited_milliseconds) throw invalidReplay();

  if (operationType === "CREATE") {
    if (data.status !== "ACTIVE" || data.owner || data.generation !== null || data.lease_expires_at !== null || data.engagement_expires_at !== null || credited !== 0n) throw invalidReplay();
  } else if (["READY", "RESUME", "INTERACTION", "HEARTBEAT"].includes(operationType)) {
    if (data.status !== "ACTIVE" || !data.owner || data.generation === null || data.lease_expires_at === null || data.engagement_expires_at === null) throw invalidReplay();
    if (["READY", "RESUME"].includes(operationType) && credited !== 0n) throw invalidReplay();
  } else {
    const expectedStatus = operationType === "CLOSE" ? "CLOSED" : "PAUSED";
    if (data.status !== expectedStatus || data.owner || data.generation !== null || data.lease_expires_at !== null || credited !== 0n) throw invalidReplay();
  }
  return {
    tracking_session_id: data.tracking_session_id,
    status: data.status,
    owner: data.owner,
    generation: data.generation,
    lease_expires_at: data.lease_expires_at,
    engagement_expires_at: data.engagement_expires_at,
    credited_milliseconds: data.credited_milliseconds,
    projection: { credited_milliseconds: data.credited_milliseconds },
  };
}
function validateStoredMonitorCreate(data) {
  if (!isRecord(data)) throw invalidReplay();
  requireExactKeys(data, ["monitor_session_id", "reminder_enabled", "target_configured", "unread_count", "check_after_seconds"]);
  requireUuid(data.monitor_session_id, invalidReplay);
  if (typeof data.reminder_enabled !== "boolean" || typeof data.target_configured !== "boolean"
    || !Number.isSafeInteger(data.unread_count) || data.unread_count < 0
    || data.check_after_seconds !== MONITOR_CHECK_AFTER_SECONDS) throw invalidReplay();
  return structuredClone(data);
}
function validateStoredMonitorCheck(data) {
  if (!isRecord(data)) throw invalidReplay();
  requireExactKeys(data, ["monitor_session_id", "last_seen_at", "continuity_started_at", "eligible_baseline_at"]);
  requireUuid(data.monitor_session_id, invalidReplay);
  if (![data.last_seen_at, data.continuity_started_at, data.eligible_baseline_at].every(isCanonicalInstant)) throw invalidReplay();
  return structuredClone(data);
}
function validateStoredMonitorClose(data) {
  if (!isRecord(data)) throw invalidReplay();
  requireExactKeys(data, ["monitor_session_id", "closed_at"]);
  requireUuid(data.monitor_session_id, invalidReplay);
  if (!isCanonicalInstant(data.closed_at)) throw invalidReplay();
  return structuredClone(data);
}
function validateStoredReminderPreferenceUpdate(data) {
  if (!isRecord(data)) throw invalidReplay();
  requireExactKeys(data, ["reminder_enabled", "updated_at"]);
  if (typeof data.reminder_enabled !== "boolean" || !isCanonicalInstant(data.updated_at)) throw invalidReplay();
  return { reminder_enabled: data.reminder_enabled, updated_at: data.updated_at };
}

async function projectGoal(repository, date) {
  const preference = await repository.findPreference();
  if (!preference) throw notFound();
  const day = await repository.findDay(date);
  const reward = await repository.findReward(date);
  const activeMilliseconds = day?.active_milliseconds ?? 0n;
  const activeSeconds = Number(activeMilliseconds / 1_000n);
  const targetMinutes = preference.daily_goal_minutes ?? null;
  return {
    application_date: date.toISOString().slice(0, 10),
    target_minutes: targetMinutes,
    active_seconds: activeSeconds,
    actual_minutes: Math.floor(activeSeconds / 60),
    completed: targetMinutes !== null && activeSeconds >= targetMinutes * 60,
    reward_earned: reward !== null,
    reminder_enabled: preference.daily_goal_reminders_enabled ?? true,
    xp_level: projectXpLevel(preference.total_xp),
  };
}

async function awardCompletion(repository, date, operationId, instant, uuid = randomUUID) {
  const preference = await repository.findPreference();
  if (!preference?.daily_goal_minutes) return false;
  const day = await repository.findDay(date);
  const activeSeconds = Number((day?.active_milliseconds ?? 0n) / 1_000n);
  if (activeSeconds < preference.daily_goal_minutes * 60 || await repository.findReward(date)) return false;
  await repository.createReward({
    id: uuid(), activity_date: date, source_operation_id: operationId,
    xp_amount: DAILY_GOAL_REWARD_XP, created_at: instant,
  });
  await repository.incrementTotalXp(DAILY_GOAL_REWARD_XP);
  await repository.createNotification({
    id: uuid(), type: "DAILY_GOAL_COMPLETED", application_date: date,
    ...COMPLETION_NOTIFICATION, created_at: instant, read_at: null,
  });
  return true;
}

function applicationDate(instant) {
  const part = splitIntervalByApplicationDay(instant.getTime(), instant.getTime() + 1)[0];
  return new Date(`${part.applicationDate}T00:00:00.000Z`);
}

function validateStoredGoalUpdate(data) {
  if (!isRecord(data)) throw invalidReplay();
  requireExactKeys(data, ["application_date", "target_minutes", "active_seconds", "actual_minutes", "completed", "reward_earned", "reminder_enabled", "xp_level", "reward"]);
  validateGoalProjection(data);
  if (!isRecord(data.reward)) throw invalidReplay();
  requireExactKeys(data.reward, ["earned_now", "xp_earned"]);
  if (typeof data.reward.earned_now !== "boolean" || ![0, DAILY_GOAL_REWARD_XP].includes(data.reward.xp_earned)
    || data.reward.xp_earned !== (data.reward.earned_now ? DAILY_GOAL_REWARD_XP : 0)) throw invalidReplay();
  return structuredClone(data);
}

function validateGoalProjection(data) {
  if (typeof data.application_date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(data.application_date)
    || new Date(`${data.application_date}T00:00:00.000Z`).toISOString().slice(0, 10) !== data.application_date) throw invalidReplay();
  if (!Number.isInteger(data.target_minutes) || data.target_minutes < 10 || data.target_minutes > 240) throw invalidReplay();
  if (!Number.isSafeInteger(data.active_seconds) || data.active_seconds < 0) throw invalidReplay();
  if (!Number.isSafeInteger(data.actual_minutes) || data.actual_minutes !== Math.floor(data.active_seconds / 60)) throw invalidReplay();
  if (typeof data.completed !== "boolean" || data.completed !== (data.active_seconds >= data.target_minutes * 60)) throw invalidReplay();
  if (typeof data.reward_earned !== "boolean" || typeof data.reminder_enabled !== "boolean") throw invalidReplay();
  if (!isRecord(data.xp_level) || !Number.isSafeInteger(data.xp_level.total_xp) || data.xp_level.total_xp < 0) throw invalidReplay();
  const expectedXp = projectXpLevel(data.xp_level.total_xp);
  requireExactKeys(data.xp_level, Object.keys(expectedXp));
  if (Object.keys(expectedXp).some((key) => data.xp_level[key] !== expectedXp[key])) throw invalidReplay();
}

function validateGoalUpdate(input) {
  const request = exact(input, ["operation_id", "target_minutes"], ["operation_id", "target_minutes"]);
  requireUuid(request.operation_id);
  if (!Number.isInteger(request.target_minutes) || request.target_minutes < 10 || request.target_minutes > 240) throw validation();
  return request;
}
function validateReminderPreferenceUpdate(input) {
  const request = exact(input, ["operation_id", "enabled"], ["operation_id", "enabled"]);
  requireUuid(request.operation_id);
  if (typeof request.enabled !== "boolean") throw validation();
  return { operation_id: request.operation_id, enabled: request.enabled };
}
function validateMonitorOperation(input) {
  const request = exact(input, ["operation_id"], ["operation_id"]);
  requireUuid(request.operation_id);
  return request;
}
function laterMonitorBaseline(currentBaseline, preference, instant) {
  const current = requireDate(currentBaseline);
  if (preference.daily_goal_reminders_enabled !== true || preference.daily_goal_reminders_enabled_at === null) return current;
  const enabledAt = requireDate(preference.daily_goal_reminders_enabled_at);
  return enabledAt.getTime() > current.getTime() && enabledAt.getTime() <= instant.getTime() ? enabledAt : current;
}
function validateNotificationListQuery(query) {
  if (!isRecord(query) || Object.keys(query).some((key) => !["cursor", "page_size"].includes(key))) {
    throw notificationValidation();
  }
  if (query.cursor !== undefined && (typeof query.cursor !== "string" || query.cursor.length === 0)) {
    throw notificationValidation();
  }
  let pageSize = DEFAULT_NOTIFICATION_PAGE_SIZE;
  if (query.page_size !== undefined) {
    if (typeof query.page_size !== "string" || !/^[1-9]\d*$/.test(query.page_size)) throw notificationValidation();
    pageSize = Number(query.page_size);
    if (!Number.isSafeInteger(pageSize) || pageSize > MAX_NOTIFICATION_PAGE_SIZE) throw notificationValidation();
  }
  return { cursor: query.cursor, pageSize };
}
function validateMarkNotificationRead(input) {
  const request = exact(input, ["read"], ["read"], notificationValidation);
  if (request.read !== true) throw notificationValidation();
}
function notificationProjection(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    application_date: dateOnly(row.application_date),
    created_at: requireDate(row.created_at).toISOString(),
    read_at: row.read_at === null ? null : requireDate(row.read_at).toISOString(),
  };
}
function encodeNotificationCursor(row) {
  const payload = {
    v: NOTIFICATION_CURSOR_VERSION,
    created_at: requireDate(row.created_at).toISOString(),
    id: requireUuid(row.id, notificationValidation),
  };
  const serializedPayload = JSON.stringify(payload);
  const envelope = { payload, checksum: createHash("sha256").update(serializedPayload).digest("hex") };
  return Buffer.from(JSON.stringify(envelope), "utf8").toString("base64url");
}
function decodeNotificationCursor(cursor) {
  if (cursor.length > MAX_NOTIFICATION_CURSOR_LENGTH || !/^[A-Za-z0-9_-]+$/.test(cursor)) throw notificationValidation();
  let envelope;
  try {
    const bytes = Buffer.from(cursor, "base64url");
    if (bytes.toString("base64url") !== cursor) throw new Error("Non-canonical cursor encoding.");
    envelope = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw notificationValidation();
  }
  if (!isRecord(envelope) || !isRecord(envelope.payload)) throw notificationValidation();
  try {
    requireExactKeys(envelope, ["payload", "checksum"]);
    requireExactKeys(envelope.payload, ["v", "created_at", "id"]);
  } catch {
    throw notificationValidation();
  }
  const { payload, checksum } = envelope;
  if (payload.v !== NOTIFICATION_CURSOR_VERSION || !isCanonicalInstant(payload.created_at)
    || typeof checksum !== "string" || !/^[0-9a-f]{64}$/.test(checksum)) throw notificationValidation();
  requireUuid(payload.id, notificationValidation);
  const expected = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  if (checksum !== expected) throw notificationValidation();
  return { createdAt: new Date(payload.created_at), id: payload.id };
}
function dateOnly(value) {
  const instant = requireDate(value);
  return instant.toISOString().slice(0, 10);
}
function requireExactKeys(value, expected) {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) throw invalidReplay();
}
function isRecord(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function isUnsignedDecimal(value) { return typeof value === "string" && /^(0|[1-9]\d*)$/.test(value); }
function isPersistedGeneration(value) {
  if (!isUnsignedDecimal(value) || value.length > 19) return false;
  return BigInt(value) <= POSTGRESQL_BIGINT_MAX;
}
function isCanonicalInstant(value) { if (typeof value !== "string") return false; const instant = new Date(value); return !Number.isNaN(instant.getTime()) && instant.toISOString() === value; }
function invalidReplay() { return new Error("Stored Daily Goal replay outcome is invalid."); }
function digest(value) { return createHash("sha256").update(JSON.stringify(value, (_key, item) => typeof item === "bigint" ? item.toString() : item)).digest("hex"); }
function validateEstablish(input) { const x = exact(input, ["operation_id", "activity_type", "learning_session_id", "set_id", "vocabulary_id"], ["operation_id", "activity_type"]); requireUuid(x.operation_id); if (!isSupportedActivityType(x.activity_type)) throw validation(); if (x.activity_type === "SPEAKING") { requireUuid(x.set_id); requireUuid(x.vocabulary_id); if (x.learning_session_id !== undefined) throw validation(); } else { requireUuid(x.learning_session_id); if (x.set_id !== undefined || x.vocabulary_id !== undefined) throw validation(); } return x; }
function validateEngagement(input) { const x = exact(input, ["operation_id", "generation", "event_type"], ["operation_id", "event_type"]); requireUuid(x.operation_id); if (typeof x.event_type !== "string") throw validation(); if (x.generation !== undefined) x.generation = generation(x.generation); return x; }
function validateHeartbeat(input) { const x = exact(input, ["operation_id", "generation", "eligibility"], ["operation_id", "generation", "eligibility"]); requireUuid(x.operation_id); x.generation = generation(x.generation); if (x.eligibility !== ELIGIBILITY) throw validation(); return x; }
function validateEnd(input, closing) { const allowed = closing ? ["operation_id", "generation"] : ["operation_id", "generation", "reason"]; const x = exact(input, allowed, allowed); requireUuid(x.operation_id); x.generation = generation(x.generation); if (!closing && !PAUSE_REASONS.has(x.reason)) throw validation(); return x; }
function exact(input, allowed, required, errorFactory = validation) { if (!input || typeof input !== "object" || Array.isArray(input)) throw errorFactory(); if (Object.keys(input).some((key) => !allowed.includes(key)) || required.some((key) => !Object.hasOwn(input, key))) throw errorFactory(); return { ...input }; }
function requireUuid(value, errorFactory = validation) { if (typeof value !== "string" || !UUID.test(value)) throw errorFactory(); return value; }
function generation(value) { if (!(typeof value === "string" && /^(0|[1-9]\d*)$/.test(value))) throw validation(); return BigInt(value); }
function requireDate(value) { if (!(value instanceof Date) || Number.isNaN(value.getTime())) throw new TypeError("Server clock returned an invalid Date."); return new Date(value); }
function validation() { return new DailyGoalServiceError("DAILY_GOAL_VALIDATION_ERROR", "The request is invalid."); }
function notFound() { return new DailyGoalServiceError("DAILY_GOAL_NOT_FOUND", "Daily Goal tracking session or activity context was not found."); }
function notificationValidation() { return new DailyGoalServiceError("VALIDATION_ERROR", "The notification request is invalid."); }
function notificationNotFound() { return new DailyGoalServiceError("NOT_FOUND", "Notification was not found."); }
function conflict(code) { return new DailyGoalServiceError(code, "The Daily Goal tracking operation conflicts with current state."); }
function ownership(currentGeneration) { const error = conflict("TRACKING_OWNERSHIP_CONFLICT"); error.details = { owner: false, current_generation: currentGeneration.toString(), retry_after_ms: 0 }; return error; }
