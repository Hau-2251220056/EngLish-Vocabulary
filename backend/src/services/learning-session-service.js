// @ts-nocheck
import { randomUUID } from "node:crypto";
import { evaluateProgress } from "./srs-scheduler.js";
import {
  captureOperationTime,
  deriveSessionExpiry,
  projectSessionLifecycle,
} from "./learning-session-domain.js";
import { projectCurrentStreak, toApplicationDate } from "./streak-domain.js";
import { completeLearningSessionAtomically } from "./learning-session-persistence.js";
import {
  assertEvidenceReplayMatches,
} from "../repositories/learning-session-repository.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MODES = new Set(["NORMAL", "SRS", "QUIZ"]);
const CREATE_FIELDS = new Set(["operation_id", "set_id", "mode", "vocabulary_ids"]);
const OPERATION_FIELDS = new Set(["operation_id"]);

export class LearningSessionServiceError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "LearningSessionServiceError";
    this.code = code;
  }
}

export function createLearningSessionService({
  withTransaction,
  createSessionRepository,
  createStreakRepository,
  createLearningRepository,
  now = () => new Date(),
  uuid = randomUUID,
}) {
  return Object.freeze({
    async createSession(userId, input) {
      validateUuid(userId);
      const request = validateCreateInput(input);
      try {
        return await withTransaction(async (transaction) => {
          const operationTime = captureOperationTime(now);
          const sessions = createSessionRepository(transaction);
          const replay = assertCreationRequestReplayMatches(
            await sessions.findCreationReplay(userId, request.operation_id),
            userId,
            request,
          );
          if (replay) {
            return { session: toSessionProjection(replay, operationTime.instant), replayed: true };
          }

          const learning = createLearningRepository(transaction);
          const set = await learning.findAccessibleSetForUser(request.set_id, userId);
          if (!set) throw notFound();
          const items = selectSnapshot(set.items, request, operationTime.instant);
          if (items.length === 0) {
            const reason = set.items.length === 0 ? "EMPTY_SET" : "SRS_UP_TO_DATE";
            return { session: null, reason, replayed: false };
          }

          await protectProposedSnapshot(learning, userId, request, set.items);
          const recheckedSet = await learning.findAccessibleSetForUser(request.set_id, userId);
          if (!recheckedSet) throw notFound();
          const recheckedItems = reselectSnapshotOrInaccessible(
            recheckedSet.items,
            request,
            operationTime.instant,
          );
          if (!snapshotsMatch(items, recheckedItems)) throw inaccessible();

          const createdAt = operationTime.instant;
          const session = await sessions.createSessionWithItems({
            id: uuid(),
            user_id: userId,
            vocabulary_set_id: request.set_id,
            set_id_snapshot: request.set_id,
            mode: request.mode,
            create_operation_id: request.operation_id,
            snapshot_size: items.length,
            created_at: createdAt,
            expires_at: deriveSessionExpiry(createdAt),
            items,
          });
          return { session: toSessionProjection(session, operationTime.instant), replayed: false };
        });
      } catch (error) {
        if (!isUniqueCollision(error)) throw error;
        return withTransaction(async (transaction) => {
          const operationTime = captureOperationTime(now);
          const replay = assertCreationRequestReplayMatches(
            await createSessionRepository(transaction).findCreationReplay(
              userId,
              request.operation_id,
            ),
            userId,
            request,
          );
          if (!replay) throw error;
          return { session: toSessionProjection(replay, operationTime.instant), replayed: true };
        });
      }
    },

    async readSession(userId, sessionId) {
      validateUuid(userId);
      validateUuid(sessionId);
      return withTransaction(async (transaction) => {
        const operationTime = captureOperationTime(now);
        const sessions = createSessionRepository(transaction);
        const session = await sessions.findOwnedSession(sessionId, userId);
        if (!session) throw notFound();
        const accessible = await snapshotIsAccessible(
          createLearningRepository(transaction), session, false,
        );
        return {
          ...toSessionProjection(session, operationTime.instant),
          can_continue: accessible && projectSessionLifecycle(session, operationTime.instant) === "ACTIVE",
          ...(accessible ? {} : { restart_reason: "SESSION_INACCESSIBLE" }),
        };
      });
    },

    async acknowledgeNormalReveal(userId, sessionId, vocabularyId, input) {
      validateUuid(userId);
      validateUuid(sessionId);
      validateUuid(vocabularyId);
      const { operation_id: operationId } = validateOperationInput(input);
      return withTransaction(async (transaction) => {
        const sessions = createSessionRepository(transaction);
        const session = await sessions.lockOwnedSession(sessionId, userId);
        if (!session) throw notFound();
        if (session.mode !== "NORMAL") throw conflict("LEARNING_SESSION_EVENT_CONFLICT", "This operation is not valid for the session mode.");
        const item = await sessions.lockSessionItem(session.id, vocabularyId);
        if (!item) throw conflict("LEARNING_SESSION_EVENT_CONFLICT", "The vocabulary is not in this session.");

        const evidence = "NORMAL_REVEALED";
        const replay = assertEvidenceReplayMatches(
          await sessions.findEvidenceReplay(operationId),
          { session_id: session.id, vocabulary_id: vocabularyId, evidence },
        );
        if (replay) {
          const operationTime = captureOperationTime(now);
          return revealResult(session, replay, operationTime.instant, true, false);
        }

        await requireSnapshotAccessible(createLearningRepository(transaction), session, true);
        const operationTime = captureOperationTime(now);
        assertActive(session, operationTime.instant);
        if (item.evidence !== null) return revealResult(session, item, operationTime.instant, false, true);
        const updated = await sessions.recordEvidence({
          session,
          item,
          evidence,
          eventId: operationId,
          acceptedAt: operationTime.instant,
        });
        if (updated.count !== 1) throw conflict("LEARNING_SESSION_EVENT_CONFLICT", "The reveal was accepted concurrently.");
        const recorded = { ...item, evidence, evidence_event_id: operationId, evidence_at: operationTime.instant };
        const projected = { ...session, items: session.items.map((candidate) => candidate.id === item.id ? recorded : candidate) };
        return revealResult(projected, recorded, operationTime.instant, false, false);
      });
    },

    async completeNormalSession(userId, sessionId, input) {
      validateUuid(userId);
      validateUuid(sessionId);
      const { operation_id: operationId } = validateOperationInput(input);
      return withTransaction(async (transaction) => {
        const sessions = createSessionRepository(transaction);
        const streaks = createStreakRepository(transaction);
        const learning = createLearningRepository(transaction);
        const existing = await sessions.findOwnedSession(sessionId, userId);
        if (!existing) throw notFound();
        if (existing.mode !== "NORMAL") throw conflict("LEARNING_SESSION_EVENT_CONFLICT", "This operation is not valid for the session mode.");

        const completion = await completeLearningSessionAtomically({
          sessionRepository: sessions,
          streakRepository: streaks,
          sessionId,
          userId,
          completionEventId: operationId,
          captureTime: () => captureOperationTime(now),
          validateLockedSession: (session, items) => requireSnapshotAccessible(learning, session, true, items),
        });
        if (!completion) throw notFound();
        const operationTime = completion.operation_time;
        const streak = await readStreakProjection(streaks, userId, operationTime.instant);
        return {
          session: toSessionProjection(completion.session, operationTime.instant),
          streak,
          replayed: completion.replayed,
        };
      });
    },
  });
}

export function createStreakService({ withTransaction, createStreakRepository, now = () => new Date() }) {
  return Object.freeze({
    async getCurrentStreak(userId) {
      validateUuid(userId);
      return withTransaction((transaction) => {
        const operationTime = captureOperationTime(now);
        return readStreakProjection(
          createStreakRepository(transaction), userId, operationTime.instant,
        );
      });
    },
  });
}

export async function readStreakProjection(repository, userId, instant) {
  const today = toApplicationDate(instant);
  const dates = await repository.listActivityDatesThrough(userId, today);
  return projectCurrentStreak(dates, instant);
}

function selectSnapshot(setItems, request, instant) {
  const ordered = setItems.map((item) => ({
    vocabulary_id: item.vocabulary.id,
    position: item.position,
    progress: item.vocabulary.learning_progress?.[0] ?? null,
  }));
  if (request.mode === "SRS") {
    return ordered
      .map((item) => ({ ...item, evaluation: evaluateProgress(item.progress, instant) }))
      .filter((item) => item.evaluation.is_eligible)
      .sort(compareSrsItems)
      .slice(0, 10)
      .map((item, position) => ({ vocabulary_id: item.vocabulary_id, position }));
  }
  if (request.vocabulary_ids.length === 0 && ordered.length > 0) throw validationError();
  if (request.vocabulary_ids.length === 0 && ordered.length === 0) return [];
  const positions = new Map(ordered.map((item) => [item.vocabulary_id, item.position]));
  let priorPosition = -1;
  return request.vocabulary_ids.map((vocabularyId, position) => {
    const setPosition = positions.get(vocabularyId);
    if (setPosition === undefined || setPosition <= priorPosition) throw validationError();
    priorPosition = setPosition;
    return { vocabulary_id: vocabularyId, position };
  });
}

function compareSrsItems(left, right) {
  const leftNew = left.evaluation.stored_status === null ? 1 : 0;
  const rightNew = right.evaluation.stored_status === null ? 1 : 0;
  return leftNew - rightNew || left.position - right.position || left.vocabulary_id.localeCompare(right.vocabulary_id);
}

async function snapshotIsAccessible(learning, session, lock) {
  const set = lock
    ? await learning.lockAccessibleSetForUser(session.set_id_snapshot, session.user_id)
    : await learning.findAccessibleSetForUser(session.set_id_snapshot, session.user_id);
  if (!set) return false;
  if (!lock) {
    const ids = new Set(set.items.map((item) => item.vocabulary.id));
    return session.items.every((item) => ids.has(item.vocabulary_id));
  }
  for (const item of session.items) {
    if (!await learning.lockSetItem(session.set_id_snapshot, item.vocabulary_id)) return false;
  }
  return true;
}

async function requireSnapshotAccessible(learning, session, lock, items = session.items) {
  const candidate = { ...session, items };
  if (!await snapshotIsAccessible(learning, candidate, lock)) {
    throw conflict("LEARNING_SESSION_INACCESSIBLE", "The learning session is no longer accessible.");
  }
}

async function protectProposedSnapshot(learning, userId, request, setItems) {
  if (!await learning.lockAccessibleSetForSessionSnapshot(request.set_id, userId)) throw notFound();
  const vocabularyIds = setItems
    .map((item) => item.vocabulary.id)
    .sort((left, right) => left.localeCompare(right));
  for (const vocabularyId of vocabularyIds) {
    if (!await learning.lockSetItem(request.set_id, vocabularyId)) throw inaccessible();
  }
  if (request.mode === "SRS") {
    for (const vocabularyId of vocabularyIds) {
      await learning.lockProgressIdentity(userId, vocabularyId);
    }
  }
}

function assertCreationRequestReplayMatches(existing, userId, request) {
  if (!existing) return null;
  const baseMatches = existing.user_id === userId
    && existing.set_id_snapshot === request.set_id
    && existing.mode === request.mode;
  const itemMatches = request.mode === "SRS"
    || (
      existing.snapshot_size === request.vocabulary_ids.length
      && existing.items.every((item, index) => (
        item.position === index
        && item.vocabulary_id === request.vocabulary_ids[index]
      ))
    );
  if (!baseMatches || !itemMatches) {
    throw conflict(
      "LEARNING_SESSION_OPERATION_CONFLICT",
      "Creation operation identity was reused with a different session request.",
    );
  }
  return existing;
}

function snapshotsMatch(left, right) {
  return left.length === right.length && left.every((item, index) => (
    item.position === right[index].position
    && item.vocabulary_id === right[index].vocabulary_id
  ));
}

function reselectSnapshotOrInaccessible(setItems, request, instant) {
  try {
    return selectSnapshot(setItems, request, instant);
  } catch (error) {
    if (error?.code === "LEARNING_SESSION_VALIDATION_ERROR") throw inaccessible();
    throw error;
  }
}

function isUniqueCollision(error) {
  if (error?.code !== "P2002") return false;
  const target = error.meta?.target;
  if (Array.isArray(target)) {
    return target.length === 2
      && target[0] === "user_id"
      && target[1] === "create_operation_id";
  }
  return target === "LEARNING_SESSION_user_id_create_operation_id_key";
}

function assertActive(session, instant) {
  const state = projectSessionLifecycle(session, instant);
  if (state === "EXPIRED") throw conflict("LEARNING_SESSION_EXPIRED", "The learning session has expired.");
  if (state !== "ACTIVE") throw conflict("LEARNING_SESSION_EVENT_CONFLICT", "The learning session is already complete.");
}

function revealResult(session, item, instant, replayed, alreadyAcknowledged) {
  return {
    item: { vocabulary_id: item.vocabulary_id, evidence: item.evidence, evidence_at: item.evidence_at },
    session: toSessionProjection(session, instant),
    replayed,
    already_acknowledged: alreadyAcknowledged,
  };
}

export function toSessionProjection(session, evaluatedAt) {
  const items = session.items.map((item) => ({
    vocabulary_id: item.vocabulary_id,
    position: item.position,
    evidence: item.evidence,
  }));
  return {
    id: session.id,
    set_id: session.set_id_snapshot,
    mode: session.mode,
    state: projectSessionLifecycle(session, evaluatedAt),
    created_at: session.created_at,
    expires_at: session.expires_at,
    completed_at: session.completed_at,
    snapshot_size: session.snapshot_size,
    completed_items: items.filter((item) => item.evidence !== null).length,
    items,
  };
}

function validateCreateInput(input) {
  requireObject(input);
  const fields = Object.keys(input);
  if (fields.some((field) => !CREATE_FIELDS.has(field))) throw validationError();
  for (const field of ["operation_id", "set_id", "mode"]) if (!Object.hasOwn(input, field)) throw validationError();
  validateUuid(input.operation_id);
  validateUuid(input.set_id);
  if (!MODES.has(input.mode)) throw validationError();
  const hasIds = Object.hasOwn(input, "vocabulary_ids");
  if ((input.mode === "SRS" && hasIds) || (input.mode !== "SRS" && !hasIds)) throw validationError();
  if (hasIds) {
    if (!Array.isArray(input.vocabulary_ids) || input.vocabulary_ids.length > 10) throw validationError();
    input.vocabulary_ids.forEach(validateUuid);
    if (new Set(input.vocabulary_ids).size !== input.vocabulary_ids.length) throw validationError();
  }
  return { ...input, vocabulary_ids: hasIds ? [...input.vocabulary_ids] : undefined };
}

function validateOperationInput(input) {
  requireObject(input);
  if (Object.keys(input).length !== 1 || !Object.hasOwn(input, "operation_id")) throw validationError();
  validateUuid(input.operation_id);
  return { operation_id: input.operation_id };
}

function requireObject(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw validationError();
}

function validateUuid(value) {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) throw validationError();
}

function validationError() {
  return new LearningSessionServiceError("LEARNING_SESSION_VALIDATION_ERROR", "Learning Session request data is invalid.");
}

function notFound() {
  return new LearningSessionServiceError("LEARNING_SESSION_NOT_FOUND", "Learning Session was not found.");
}

function conflict(code, message) {
  return new LearningSessionServiceError(code, message);
}

function inaccessible() {
  return conflict(
    "LEARNING_SESSION_INACCESSIBLE",
    "The learning session snapshot is no longer accessible.",
  );
}
