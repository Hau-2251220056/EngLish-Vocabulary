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
const REMINDER_INACTIVITY_MILLISECONDS = 600_000;
const CLEANUP_WARM_WINDOW_MILLISECONDS = 600_000;
const TRACKING_ACTIVE_EXPIRY_MILLISECONDS = 24 * 60 * 60 * 1_000;
const TRACKING_PAUSED_EXPIRY_MILLISECONDS = 7 * TRACKING_ACTIVE_EXPIRY_MILLISECONDS;
const MONITOR_EXPIRY_MILLISECONDS = 24 * 60 * 60 * 1_000;
const LIFECYCLE_POLICY_VERSION = 1;
const LIFECYCLE_PAGE_LIMIT = 25;
const LIFECYCLE_ATTEMPT_LIMIT = 300;
const LIFECYCLE_TRANSITION_LIMIT = 100;
const VIETNAM_UTC_OFFSET_MILLISECONDS = 7 * 60 * 60 * 1_000;
const COMPLETION_NOTIFICATION = Object.freeze({
  title: "Daily Goal completed",
  body: "You completed your Daily Goal and earned 10 XP.",
});
const INACTIVITY_NOTIFICATION = Object.freeze({
  title: "Nhắc nhở học từ vựng",
  body: "Bạn chưa có hoạt động học từ vựng trong khoảng 10 phút. Hãy tiếp tục học để hoàn thành mục tiêu hôm nay nhé!",
});

class TrackingExpiryRollback extends Error {}

export class DailyGoalServiceError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

export function evaluateTrackingExpiryEligibility(session, instant) {
  const evaluatedAt = requireDate(instant);
  if (!session || session.expired_at != null || session.closed_at != null) return null;
  let eligibility;
  let anchor;
  let duration;
  if (session.status === "ACTIVE" && session.engagement_expires_at === null) {
    eligibility = "NEVER_READY";
    anchor = requireDate(session.created_at);
    duration = TRACKING_ACTIVE_EXPIRY_MILLISECONDS;
  } else if (session.status === "ACTIVE" && session.engagement_expires_at !== null) {
    eligibility = "ACTIVE_DEADLINE";
    anchor = requireDate(session.engagement_expires_at);
    duration = TRACKING_ACTIVE_EXPIRY_MILLISECONDS;
  } else if (session.status === "PAUSED" && session.paused_at !== null) {
    eligibility = "PAUSED";
    anchor = requireDate(session.paused_at);
    duration = TRACKING_PAUSED_EXPIRY_MILLISECONDS;
  } else {
    return null;
  }
  const eligibilityAt = new Date(anchor.getTime() + duration);
  return Object.freeze({ eligibility, anchor, eligibilityAt, eligible: evaluatedAt >= eligibilityAt });
}

export function evaluateMonitorExpiryEligibility(session, instant) {
  const evaluatedAt = requireDate(instant);
  if (!session || session.closed_at != null || session.expired_at != null) return null;
  const anchor = requireDate(session.last_seen_at);
  const eligibilityAt = new Date(anchor.getTime() + MONITOR_EXPIRY_MILLISECONDS);
  return Object.freeze({ anchor, eligibilityAt, eligible: evaluatedAt >= eligibilityAt });
}

export function createDailyGoalCleanupScheduler({
  dailyGoalRepository,
  monotonicNow = () => performance.now(),
  logFailure = () => console.error("Daily Goal operational cleanup failed."),
}) {
  if (!dailyGoalRepository?.withCleanupTransaction) throw new TypeError("Daily Goal cleanup repository is required.");
  if (typeof monotonicNow !== "function" || typeof logFailure !== "function") throw new TypeError("Daily Goal cleanup dependencies are invalid.");
  let reservedAt = Number.NEGATIVE_INFINITY;

  return function scheduleOperationalCleanup() {
    let observedAt;
    try { observedAt = monotonicNow(); } catch { safeCleanupLog(logFailure); return false; }
    if (!Number.isFinite(observedAt) || observedAt < reservedAt
      || observedAt - reservedAt < CLEANUP_WARM_WINDOW_MILLISECONDS) return false;
    reservedAt = observedAt;
    void Promise.resolve()
      .then(() => dailyGoalRepository.withCleanupTransaction((repository) => repository.cleanupExpiredOperationalState()))
      .catch(() => safeCleanupLog(logFailure));
    return true;
  };
}

export function createDailyGoalLifecycleMaintenanceRunner({
  dailyGoalRepository,
  leaseDurationMilliseconds,
  uuid = randomUUID,
  logFailure = () => console.error("Daily Goal lifecycle maintenance failed."),
}) {
  const required = [
    "claimLifecycleJournal", "checkLifecycleLease", "discoverLifecycleCandidates",
    "updateLifecycleJournal", "withUserTransaction", "withCleanupTransaction",
  ];
  if (required.some((method) => typeof dailyGoalRepository?.[method] !== "function")) {
    throw new TypeError("Daily Goal lifecycle maintenance repository is required.");
  }
  if (!Number.isSafeInteger(leaseDurationMilliseconds) || leaseDurationMilliseconds <= 0) {
    throw new TypeError("An explicit positive lease duration is required.");
  }
  if (typeof uuid !== "function" || typeof logFailure !== "function") {
    throw new TypeError("Daily Goal lifecycle maintenance dependencies are invalid.");
  }

  return async function runLifecycleMaintenance() {
    let expiry;
    try {
      expiry = await runExpiry();
    } catch {
      safeLifecycleLog(logFailure, "DAILY_GOAL_LIFECYCLE_EXPIRY_FAILED");
      expiry = Object.freeze({ classification: "FAILED", attempted: 0, transitioned: 0 });
    }
    let cleanup;
    try {
      cleanup = await dailyGoalRepository.withCleanupTransaction((repository) => (
        repository.cleanupExpiredOperationalState()
      ));
    } catch {
      safeLifecycleLog(logFailure, "DAILY_GOAL_LIFECYCLE_CLEANUP_FAILED");
      cleanup = Object.freeze({ classification: "FAILED" });
    }
    return Object.freeze({ expiry, cleanup });
  };

  async function runExpiry() {
    const leaseToken = uuid();
    requireUuid(leaseToken);
    const claim = await dailyGoalRepository.claimLifecycleJournal({
      policyVersion: LIFECYCLE_POLICY_VERSION,
      leaseToken,
      leaseDurationMilliseconds,
    });
    if (claim.classification !== "CLAIMED") {
      return Object.freeze({ classification: claim.classification, attempted: 0, transitioned: 0 });
    }
    const policy = validateLifecyclePolicy(claim.policy);
    let journal = validateLifecycleJournal(claim.journal, leaseToken);
    let attempted = 0;
    let transitioned = 0;
    let wraps = 0;

    while (attempted < LIFECYCLE_ATTEMPT_LIMIT && transitioned < LIFECYCLE_TRANSITION_LIMIT) {
      if (journal.pendingIndex >= journal.pendingDescriptors.length) {
        const cursor = journal.cursor;
        const rows = await dailyGoalRepository.discoverLifecycleCandidates({
          activatedAt: policy.activatedAt,
          evaluatedAt: policy.databaseNow,
          cursor,
          limit: LIFECYCLE_PAGE_LIMIT,
        });
        const descriptors = validateLifecycleDescriptors(rows, policy.activatedAt, cursor);
        if (descriptors.length === 0) {
          if (cursor === null || wraps === 1) break;
          const updated = await writeJournal(leaseToken, journal, [], 0, null, journal.wrappedEpoch + 1n);
          if (!updated) return Object.freeze({ classification: "LEASE_LOST", attempted, transitioned });
          journal = updated;
          wraps += 1;
          continue;
        }
        const updated = await writeJournal(leaseToken, journal, descriptors, 0, cursor, journal.wrappedEpoch);
        if (!updated) return Object.freeze({ classification: "LEASE_LOST", attempted, transitioned });
        journal = updated;
      }

      if (!await dailyGoalRepository.checkLifecycleLease({
        policyVersion: LIFECYCLE_POLICY_VERSION, leaseToken, revision: journal.revision,
      })) {
        return Object.freeze({ classification: "LEASE_LOST", attempted, transitioned });
      }
      const descriptor = journal.pendingDescriptors[journal.pendingIndex];
      const changed = await attemptLifecycleExpiry(dailyGoalRepository, descriptor, policy);
      attempted += 1;
      if (changed) transitioned += 1;
      const nextCursor = descriptorCursor(descriptor);
      const updated = await writeJournal(
        leaseToken,
        journal,
        journal.pendingDescriptors,
        journal.pendingIndex + 1,
        nextCursor,
        journal.wrappedEpoch,
      );
      if (!updated) return Object.freeze({ classification: "LEASE_LOST", attempted, transitioned });
      journal = updated;
    }
    return Object.freeze({ classification: "COMPLETED", attempted, transitioned });
  }

  async function writeJournal(leaseToken, journal, nextPendingDescriptors, nextPendingIndex, nextCursor, wrappedEpoch) {
    const update = await dailyGoalRepository.updateLifecycleJournal({
      policyVersion: LIFECYCLE_POLICY_VERSION,
      leaseToken,
      revision: journal.revision,
      pendingIndex: journal.pendingIndex,
      pendingDescriptors: journal.pendingDescriptors,
      nextPendingDescriptors,
      nextPendingIndex,
      nextCursor,
      wrappedEpoch,
    });
    if (update.count !== 1) return null;
    return Object.freeze({
      ...journal,
      pendingDescriptors: nextPendingDescriptors,
      pendingIndex: nextPendingIndex,
      cursor: nextCursor,
      wrappedEpoch,
      revision: journal.revision + 1n,
    });
  }
}

export function createDailyGoalService({ dailyGoalRepository, now = () => new Date(), uuid = randomUUID, scheduleOperationalCleanup = () => false }) {
  if (!dailyGoalRepository?.withUserTransaction) throw new TypeError("Daily Goal repository is required.");
  if (typeof scheduleOperationalCleanup !== "function") throw new TypeError("Daily Goal cleanup scheduler is invalid.");

  async function transact(userId, callback, cleanupEligible = false) {
    requireUuid(userId);
    const instant = requireDate(now());
    const outcome = await dailyGoalRepository.withUserTransaction(userId, (repository) => callback(repository, instant));
    if (outcome?.deferredError) throw outcome.deferredError;
    if (cleanupEligible) {
      try { scheduleOperationalCleanup(); } catch { /* Cleanup cannot change a successful command. */ }
    }
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
      }, true);
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
      }, true);
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
      }, true);
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
          continuity_started_at: instant, eligible_baseline_at: instant, closed_at: null, expired_at: null,
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
      }, true);
    },

    checkMonitor(userId, monitorSessionId, input) {
      requireUuid(monitorSessionId);
      const request = validateMonitorOperation(input);
      return transact(userId, async (repository, instant) => {
        const fingerprint = digest({ monitor_session_id: monitorSessionId, ...request });
        const replay = await replayOrConflict(repository, request.operation_id, "MONITOR_CHECK", fingerprint);
        if (replay) return replay;
        const session = await repository.findMonitorSession(monitorSessionId);
        if (!session || session.closed_at !== null || session.expired_at != null) throw notFound();
        const preference = await repository.findPreference();
        if (!preference) throw notFound();
        const longGap = instant.getTime() - requireDate(session.last_seen_at).getTime()
          > MONITOR_CONTINUITY_TOLERANCE_MILLISECONDS;
        const date = applicationDate(instant);
        const day = longGap ? null : await repository.findDay(date);
        const eligibleBaseline = longGap ? instant : latestDate(
          requireDate(session.continuity_started_at),
          laterMonitorBaseline(session.eligible_baseline_at, preference, instant),
          applicationDayStart(date),
          ...(day?.last_engagement_at ? [requireDate(day.last_engagement_at)] : []),
        );
        let reminderCreated = false;
        if (!longGap && await reminderEligible(repository, preference, day, date, eligibleBaseline, instant)) {
          await repository.createNotification({
            id: uuid(), type: "DAILY_GOAL_INACTIVITY_REMINDER", application_date: date,
            ...INACTIVITY_NOTIFICATION, created_at: instant, read_at: null,
          });
          reminderCreated = true;
        }
        const update = {
          last_seen_at: instant,
          ...(longGap ? { continuity_started_at: instant } : {}),
          ...(eligibleBaseline.getTime() !== requireDate(session.eligible_baseline_at).getTime()
            ? { eligible_baseline_at: eligibleBaseline } : {}),
        };
        const updated = await repository.updateMonitorSession(monitorSessionId, update);
        if (updated.count !== 1) throw notFound();
        const response = {
          reminder_created: reminderCreated,
          unread_count: await repository.countUnreadNotifications(),
          next_check_after_seconds: MONITOR_CHECK_AFTER_SECONDS,
        };
        await monitorReceipt(repository, request.operation_id, "MONITOR_CHECK", fingerprint, session.id, response, instant);
        return { ...response, replayed: false };
      }, true);
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
        if (session.expired_at != null) throw notFound();
        const closedAt = session.closed_at === null ? instant : requireDate(session.closed_at);
        if (session.closed_at === null) {
          const updated = await repository.updateMonitorSession(monitorSessionId, { closed_at: closedAt });
          if (updated.count !== 1) throw notFound();
        }
        const response = { monitor_session_id: session.id, closed_at: closedAt.toISOString() };
        await monitorReceipt(repository, request.operation_id, "MONITOR_CLOSE", fingerprint, session.id, response, instant);
        return { ...response, replayed: false };
      }, true);
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
          paused_at: null,
          expired_at: null,
        });
        const response = projection(session, null, 0n);
        await receipt(repository, request.operation_id, "CREATE", fingerprint, session.id, null, 0n, response, instant);
        return { ...response, replayed: false };
      }, true);
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
        if (session.status === "CLOSED" || session.status === "EXPIRED" || session.expired_at != null) throw notFound();
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
          last_meaningful_at: instant, closed_at: null, paused_at: null,
        });
        await repository.upsertOwner({
          create: { tracking_session_id: session.id, generation, lease_expires_at: new Date(createLeaseExpiry(instant.getTime())), last_accounted_at: instant },
          update: { tracking_session_id: session.id, generation, lease_expires_at: new Date(createLeaseExpiry(instant.getTime())), last_accounted_at: instant },
        });
        await touchEngagementDay(repository, instant, session.activity_type);
        const response = projection({ ...session, status: "ACTIVE", engagement_expires_at: deadline }, { tracking_session_id: session.id, generation, lease_expires_at: new Date(createLeaseExpiry(instant.getTime())) }, credited);
        await receipt(repository, request.operation_id, type, fingerprint, session.id, generation, credited, response, instant);
        return response;
      }, true);
    },

    heartbeat(userId, sessionId, input) {
      requireUuid(sessionId);
      const request = validateHeartbeat(input);
      return transact(userId, async (repository, instant) => {
        const session = await requireSessionAndContext(repository, sessionId, instant);
        const fingerprint = digest({ session_id: sessionId, ...request, generation: request.generation.toString() });
        const replay = await replayOrConflict(repository, request.operation_id, "HEARTBEAT", fingerprint);
        if (replay) return replay;
        if (session.status === "CLOSED" || session.status === "EXPIRED" || session.expired_at != null) throw notFound();
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
      }, true);
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
      if (!await repository.findAuthorizedActivityContext({ ...contextOf(session), observedAt: instant })) throw notFound();
      const fingerprint = digest({ session_id: sessionId, ...request, generation: request.generation.toString() });
      const replay = await replayOrConflict(repository, request.operation_id, type, fingerprint);
      if (replay) return replay;
      if (session.status === "EXPIRED" || session.expired_at != null) throw notFound();
      const owner = await repository.findOwner();
      if (owner?.tracking_session_id === session.id && owner.generation === request.generation) await fence(repository, session, owner, instant, closing ? "CLOSED" : "PAUSED");
      else if (!closing || session.status !== "CLOSED") throw ownership(owner?.generation ?? 0n);
      const response = projection({ ...session, status: closing ? "CLOSED" : "PAUSED" }, null, 0n);
      await receipt(repository, request.operation_id, type, fingerprint, session.id, request.generation, 0n, response, instant);
      return response;
    }, true);
  }
}

function safeCleanupLog(logFailure) {
  try { logFailure("DAILY_GOAL_OPERATIONAL_CLEANUP_FAILED"); } catch { /* Logging must remain non-fatal. */ }
}

function safeLifecycleLog(logFailure, code) {
  try { logFailure(code); } catch { /* Maintenance logging must remain non-fatal. */ }
}

function validateLifecyclePolicy(value) {
  requireExactRecordKeys(value, ["policy_version", "activated_at", "database_now"]);
  if (value.policy_version !== LIFECYCLE_POLICY_VERSION) throw new Error("Lifecycle policy version mismatch.");
  const activatedAt = requireDate(value.activated_at);
  const databaseNow = requireDate(value.database_now);
  if (activatedAt > databaseNow) throw new Error("Lifecycle activation instant is invalid.");
  return Object.freeze({ activatedAt, databaseNow });
}

function validateLifecycleJournal(value, leaseToken) {
  requireExactRecordKeys(value, [
    "policy_version", "scan_eligibility_at", "scan_candidate_kind", "scan_stable_id",
    "pending_descriptors", "pending_index", "lease_token", "lease_expires_at",
    "wrapped_epoch", "revision", "updated_at",
  ]);
  if (value.policy_version !== LIFECYCLE_POLICY_VERSION || value.lease_token !== leaseToken) {
    throw new Error("Lifecycle journal authority mismatch.");
  }
  const leaseExpiresAt = requireDate(value.lease_expires_at);
  requireDate(value.updated_at);
  if (typeof value.revision !== "bigint" || value.revision < 0n
    || typeof value.wrapped_epoch !== "bigint" || value.wrapped_epoch < 0n) {
    throw new Error("Lifecycle journal counters are invalid.");
  }
  const cursorNull = value.scan_eligibility_at === null
    && value.scan_candidate_kind === null && value.scan_stable_id === null;
  const cursorFull = value.scan_eligibility_at !== null
    && new Set(["TRACKING", "MONITOR"]).has(value.scan_candidate_kind)
    && typeof value.scan_stable_id === "string" && UUID.test(value.scan_stable_id);
  if (!cursorNull && !cursorFull) throw new Error("Lifecycle journal cursor is invalid.");
  const cursor = cursorNull ? null : Object.freeze({
    eligibilityAt: requireDate(value.scan_eligibility_at),
    candidateKind: value.scan_candidate_kind,
    candidateKindOrder: value.scan_candidate_kind === "TRACKING" ? 0 : 1,
    stableId: value.scan_stable_id.toLowerCase(),
  });
  if (!Array.isArray(value.pending_descriptors) || value.pending_descriptors.length > LIFECYCLE_PAGE_LIMIT
    || !Number.isSafeInteger(value.pending_index) || value.pending_index < 0
    || value.pending_index > value.pending_descriptors.length) {
    throw new Error("Lifecycle journal pending state is invalid.");
  }
  const pendingDescriptors = validateLifecycleDescriptors(value.pending_descriptors, null, null);
  if (cursor && value.pending_index < pendingDescriptors.length
    && compareLifecycleCursor(descriptorCursor(pendingDescriptors[value.pending_index]), cursor) <= 0) {
    throw new Error("Lifecycle journal cursor is incompatible with pending work.");
  }
  return Object.freeze({
    pendingDescriptors,
    pendingIndex: value.pending_index,
    cursor,
    leaseExpiresAt,
    wrappedEpoch: value.wrapped_epoch,
    revision: value.revision,
  });
}

function validateLifecycleDescriptors(rows, activatedAt, cursor) {
  if (!Array.isArray(rows) || rows.length > LIFECYCLE_PAGE_LIMIT) {
    throw new Error("Lifecycle descriptor page is invalid.");
  }
  const descriptors = rows.map((row) => {
    requireExactRecordKeys(row, [
      "user_id", "candidate_kind", "candidate_kind_order", "stable_id", "expected_state",
      "eligibility", "anchor", "eligibility_at",
    ]);
    requireUuid(row.user_id);
    requireUuid(row.stable_id);
    if ((row.candidate_kind === "TRACKING" && row.candidate_kind_order !== 0)
      || (row.candidate_kind === "MONITOR" && row.candidate_kind_order !== 1)) {
      throw new Error("Lifecycle descriptor kind is invalid.");
    }
    const expectedStates = row.candidate_kind === "TRACKING"
      ? { NEVER_READY: "ACTIVE", ACTIVE_DEADLINE: "ACTIVE", PAUSED: "PAUSED" }
      : { MONITOR: "OPEN" };
    if (expectedStates[row.eligibility] !== row.expected_state
      || (row.candidate_kind === "MONITOR" && row.expected_state !== "OPEN")) {
      throw new Error("Lifecycle descriptor state is invalid.");
    }
    const anchor = parseLifecycleInstant(row.anchor);
    const eligibilityAt = parseLifecycleInstant(row.eligibility_at);
    const duration = row.eligibility === "PAUSED"
      ? TRACKING_PAUSED_EXPIRY_MILLISECONDS : TRACKING_ACTIVE_EXPIRY_MILLISECONDS;
    if (eligibilityAt.getTime() !== anchor.getTime() + duration) {
      throw new Error("Lifecycle descriptor eligibility is invalid.");
    }
    if (activatedAt && anchor < activatedAt) throw new Error("Lifecycle descriptor predates activation.");
    return Object.freeze({
      user_id: row.user_id.toLowerCase(),
      candidate_kind: row.candidate_kind,
      candidate_kind_order: row.candidate_kind_order,
      stable_id: row.stable_id.toLowerCase(),
      expected_state: row.expected_state,
      eligibility: row.eligibility,
      anchor: anchor.toISOString(),
      eligibility_at: eligibilityAt.toISOString(),
    });
  });
  const identities = new Set();
  for (let index = 0; index < descriptors.length; index += 1) {
    const descriptor = descriptors[index];
    const identity = `${descriptor.candidate_kind}:${descriptor.stable_id}`;
    if (identities.has(identity)) throw new Error("Lifecycle descriptor is duplicated.");
    identities.add(identity);
    const current = descriptorCursor(descriptor);
    if ((index > 0 && compareLifecycleCursor(current, descriptorCursor(descriptors[index - 1])) <= 0)
      || (cursor && compareLifecycleCursor(current, cursor) <= 0)) {
      throw new Error("Lifecycle descriptor order is invalid.");
    }
  }
  return Object.freeze(descriptors);
}

function descriptorCursor(descriptor) {
  return Object.freeze({
    eligibilityAt: new Date(descriptor.eligibility_at),
    candidateKind: descriptor.candidate_kind,
    candidateKindOrder: descriptor.candidate_kind_order,
    stableId: descriptor.stable_id,
  });
}

function compareLifecycleCursor(left, right) {
  return left.eligibilityAt - right.eligibilityAt
    || left.candidateKindOrder - right.candidateKindOrder
    || (left.stableId < right.stableId ? -1 : left.stableId > right.stableId ? 1 : 0);
}

function parseLifecycleInstant(value) {
  if (value instanceof Date) return requireDate(value);
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    throw new Error("Lifecycle timestamp is invalid.");
  }
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime()) || instant.toISOString() !== value) {
    throw new Error("Lifecycle timestamp is invalid.");
  }
  return instant;
}

async function attemptLifecycleExpiry(dailyGoalRepository, descriptor, policy) {
  try {
    return await dailyGoalRepository.withUserTransaction(descriptor.user_id, async (repository) => {
      const anchor = new Date(descriptor.anchor);
      if (descriptor.candidate_kind !== "TRACKING") {
        const session = await repository.findMonitorSession(descriptor.stable_id);
        if (!session || requireDate(session.started_at) < policy.activatedAt) return false;
        const decision = evaluateMonitorExpiryEligibility(session, policy.databaseNow);
        if (!decision?.eligible || decision.anchor.getTime() !== anchor.getTime()) return false;
        const update = await repository.expireMonitorSession({
          monitorSessionId: session.id,
          expectedLastSeenAt: anchor,
          expiredAt: policy.databaseNow,
        });
        return update.count === 1;
      }
      const session = await repository.findTrackingSession(descriptor.stable_id);
      if (!session || requireDate(session.created_at) < policy.activatedAt) return false;
      const decision = evaluateTrackingExpiryEligibility(session, policy.databaseNow);
      if (!decision?.eligible || decision.eligibility !== descriptor.eligibility
        || decision.anchor.getTime() !== anchor.getTime() || session.status !== descriptor.expected_state) return false;
      const owner = await repository.findOwner();
      let ownerCleared = false;
      if (owner?.tracking_session_id === session.id) {
        const cleared = await repository.updateOwnerAtGeneration(owner.generation, {
          tracking_session_id: null,
          lease_expires_at: null,
          last_accounted_at: null,
          generation: nextOwnershipGeneration(owner.generation),
        });
        if (cleared.count !== 1) return false;
        ownerCleared = true;
      }
      const update = await repository.expireTrackingSession({
        sessionId: session.id,
        eligibility: descriptor.eligibility,
        expectedAnchor: anchor,
        expiredAt: policy.databaseNow,
      });
      if (update.count !== 1 && ownerCleared) throw new TrackingExpiryRollback();
      return update.count === 1;
    });
  } catch (error) {
    if (error instanceof TrackingExpiryRollback) return false;
    throw error;
  }
}

function requireExactRecordKeys(value, expected) {
  if (!isRecord(value)) throw new Error("Lifecycle persistence data is invalid.");
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new Error("Lifecycle persistence data is invalid.");
  }
}

async function requireSessionAndContext(repository, id, instant) {
  const session = await repository.findTrackingSession(id);
  if (!session || !await repository.findAuthorizedActivityContext({ ...contextOf(session), observedAt: instant })) throw notFound();
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
  await repository.updateTrackingSession(session.id, {
    status,
    paused_at: status === "PAUSED" ? instant : null,
    ...(status === "CLOSED" ? { closed_at: instant } : {}),
  });
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
  requireExactKeys(data, ["reminder_created", "unread_count", "next_check_after_seconds"]);
  if (typeof data.reminder_created !== "boolean"
    || !Number.isSafeInteger(data.unread_count) || data.unread_count < 0
    || data.next_check_after_seconds !== MONITOR_CHECK_AFTER_SECONDS) throw invalidReplay();
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

function applicationDayStart(date) {
  return new Date(requireDate(date).getTime() - VIETNAM_UTC_OFFSET_MILLISECONDS);
}

function latestDate(...values) {
  return new Date(Math.max(...values.map((value) => requireDate(value).getTime())));
}

async function reminderEligible(repository, preference, day, date, baseline, instant) {
  if ((preference.daily_goal_reminders_enabled ?? true) !== true || preference.daily_goal_minutes === null) return false;
  const activeMilliseconds = day?.active_milliseconds ?? 0n;
  if (activeMilliseconds >= BigInt(preference.daily_goal_minutes) * 60_000n) return false;
  if (instant.getTime() - baseline.getTime() < REMINDER_INACTIVITY_MILLISECONDS) return false;
  const owner = await repository.findOwner();
  if (owner?.tracking_session_id) {
    const tracking = await repository.findTrackingSession(owner.tracking_session_id);
    if (tracking?.status === "ACTIVE" && tracking.engagement_expires_at
      && instant.getTime() < requireDate(tracking.engagement_expires_at).getTime()) return false;
  }
  return await repository.findNotificationByTypeAndDate("DAILY_GOAL_INACTIVITY_REMINDER", date) === null;
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
