// @ts-nocheck
import { toApplicationDate } from "./streak-domain.js";
import {
  assertCompletionReplayMatches,
  assertSnapshotIntegrity,
} from "../repositories/learning-session-repository.js";
import { captureOperationTime } from "./learning-session-domain.js";

export async function completeLearningSessionAtomically({
  sessionRepository,
  streakRepository,
  sessionId,
  userId,
  completionEventId,
  captureTime,
  validateLockedSession,
}) {
  const session = await sessionRepository.lockOwnedSession(sessionId, userId);
  if (!session) return null;

  if (session.status === "COMPLETED") {
    const operationTime = captureRequiredOperationTime(captureTime);
    assertSnapshotIntegrity(session.snapshot_size, session.items);
    assertCompletionReplayMatches(session, {
      user_id: userId,
      session_id: sessionId,
      completion_event_id: completionEventId,
    });
    return Object.freeze({
      session,
      streak_day_inserted: false,
      replayed: true,
      operation_time: operationTime,
    });
  }

  const lockedItems = await sessionRepository.lockSessionItems(session.id);
  assertSnapshotIntegrity(session.snapshot_size, lockedItems);

  if (validateLockedSession) {
    await validateLockedSession(session, lockedItems);
  }

  const operationTime = captureRequiredOperationTime(captureTime);
  const acceptedAt = operationTime.instant;

  const competingReplay = await sessionRepository.findCompletionReplay(userId, completionEventId);
  assertCompletionReplayMatches(competingReplay, {
    user_id: userId,
    session_id: sessionId,
    completion_event_id: completionEventId,
  });

  const completion = await sessionRepository.completeSession({
    session,
    items: lockedItems,
    completionEventId,
    acceptedAt,
  });
  if (completion.count !== 1) {
    throw new Error("Learning Session completion lost its locked active row.");
  }

  const completedSession = Object.freeze({
    ...session,
    status: "COMPLETED",
    completed_at: new Date(acceptedAt.getTime()),
    completion_event_id: completionEventId,
  });
  const day = await streakRepository.insertDayForCompletedSession({
    session: completedSession,
    activityDate: toApplicationDate(acceptedAt),
    createdAt: acceptedAt,
  });

  return Object.freeze({
    session: completedSession,
    streak_day_inserted: day.inserted,
    replayed: false,
    operation_time: operationTime,
  });
}

function captureRequiredOperationTime(captureTime) {
  if (typeof captureTime !== "function") {
    throw new TypeError("An authoritative operation-time capture function is required.");
  }
  const operationTime = captureTime();
  if (
    !operationTime
    || !(operationTime.instant instanceof Date)
    || Number.isNaN(operationTime.instant.getTime())
  ) {
    throw new TypeError("A captured authoritative operation time is required.");
  }
  return captureOperationTime(() => operationTime.instant);
}
