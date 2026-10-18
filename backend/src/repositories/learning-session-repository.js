// @ts-nocheck
import {
  isSessionAcceptingAt,
} from "../services/learning-session-domain.js";

const EVIDENCE_BY_MODE = Object.freeze({
  NORMAL: new Set(["NORMAL_REVEALED"]),
  SRS: new Set(["SRS_HARD", "SRS_GOOD", "SRS_EASY"]),
  QUIZ: new Set(["QUIZ_CORRECT", "QUIZ_INCORRECT"]),
});

const SESSION_SELECT = Object.freeze({
  id: true,
  user_id: true,
  vocabulary_set_id: true,
  set_id_snapshot: true,
  mode: true,
  status: true,
  create_operation_id: true,
  snapshot_size: true,
  created_at: true,
  expires_at: true,
  completed_at: true,
  completion_event_id: true,
  items: {
    orderBy: { position: "asc" },
    select: {
      id: true,
      session_id: true,
      vocabulary_id: true,
      position: true,
      evidence: true,
      evidence_event_id: true,
      evidence_at: true,
    },
  },
});

export class LearningSessionPersistenceError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "LearningSessionPersistenceError";
    this.code = code;
  }
}

export function createLearningSessionRepository(transaction) {
  requireTransactionClient(transaction);

  const findOwnedSession = (sessionId, userId) => transaction.lEARNING_SESSION.findFirst({
    where: { id: sessionId, user_id: userId },
    select: SESSION_SELECT,
  });

  return Object.freeze({
    createSessionWithItems(input) {
      const items = assertSnapshotIntegrity(input.snapshot_size, input.items);
      return transaction.lEARNING_SESSION.create({
        data: {
          id: input.id,
          user_id: input.user_id,
          vocabulary_set_id: input.vocabulary_set_id,
          set_id_snapshot: input.set_id_snapshot,
          mode: input.mode,
          create_operation_id: input.create_operation_id,
          snapshot_size: input.snapshot_size,
          created_at: cloneInstant(input.created_at, "created_at"),
          expires_at: cloneInstant(input.expires_at, "expires_at"),
          items: {
            create: items.map(({ vocabulary_id, position }) => ({
              vocabulary_id,
              position,
            })),
          },
        },
        select: SESSION_SELECT,
      });
    },

    findOwnedSession,

    findCreationReplay(userId, createOperationId) {
      return transaction.lEARNING_SESSION.findUnique({
        where: {
          user_id_create_operation_id: {
            user_id: userId,
            create_operation_id: createOperationId,
          },
        },
        select: SESSION_SELECT,
      });
    },

    findCompletionReplay(userId, completionEventId) {
      return transaction.lEARNING_SESSION.findUnique({
        where: {
          user_id_completion_event_id: {
            user_id: userId,
            completion_event_id: completionEventId,
          },
        },
        select: SESSION_SELECT,
      });
    },

    findEvidenceReplay(evidenceEventId) {
      return transaction.lEARNING_SESSION_ITEM.findUnique({
        where: { evidence_event_id: evidenceEventId },
        select: SESSION_SELECT.items.select,
      });
    },

    async lockOwnedSession(sessionId, userId) {
      const rows = await transaction.$queryRaw`
        SELECT "id"
        FROM "LEARNING_SESSION"
        WHERE "id" = ${sessionId}::uuid
          AND "user_id" = ${userId}::uuid
        FOR UPDATE
      `;
      if (!rows[0]) return null;
      return findOwnedSession(sessionId, userId);
    },

    async lockSessionItem(sessionId, vocabularyId) {
      const rows = await transaction.$queryRaw`
        SELECT "id"
        FROM "LEARNING_SESSION_ITEM"
        WHERE "session_id" = ${sessionId}::uuid
          AND "vocabulary_id" = ${vocabularyId}::uuid
        FOR UPDATE
      `;
      if (!rows[0]) return null;
      return transaction.lEARNING_SESSION_ITEM.findUnique({
        where: {
          session_id_vocabulary_id: {
            session_id: sessionId,
            vocabulary_id: vocabularyId,
          },
        },
        select: SESSION_SELECT.items.select,
      });
    },

    lockSessionItems(sessionId) {
      return transaction.$queryRaw`
        SELECT
          "id",
          "session_id",
          "vocabulary_id",
          "position",
          "evidence",
          "evidence_event_id",
          "evidence_at"
        FROM "LEARNING_SESSION_ITEM"
        WHERE "session_id" = ${sessionId}::uuid
        ORDER BY "position" ASC
        FOR UPDATE
      `;
    },

    recordEvidence({ session, item, evidence, eventId, acceptedAt }) {
      assertLockedItem(session, item);
      assertSessionAcceptsMutation(session, acceptedAt);
      assertEvidenceCompatible(session.mode, evidence);
      if (item.evidence !== null || item.evidence_event_id !== null || item.evidence_at !== null) {
        throw persistenceError(
          "LEARNING_SESSION_ITEM_ALREADY_RESOLVED",
          "Session item already has durable evidence.",
        );
      }

      return transaction.lEARNING_SESSION_ITEM.updateMany({
        where: {
          id: item.id,
          session_id: session.id,
          evidence: null,
          evidence_event_id: null,
          evidence_at: null,
        },
        data: {
          evidence,
          evidence_event_id: eventId,
          evidence_at: cloneInstant(acceptedAt, "acceptedAt"),
        },
      });
    },

    completeSession({ session, items, completionEventId, acceptedAt }) {
      assertSessionAcceptsMutation(session, acceptedAt);
      assertCompleteGroup(session, items);

      return transaction.lEARNING_SESSION.updateMany({
        where: {
          id: session.id,
          user_id: session.user_id,
          status: "ACTIVE",
          completed_at: null,
          completion_event_id: null,
        },
        data: {
          status: "COMPLETED",
          completed_at: cloneInstant(acceptedAt, "acceptedAt"),
          completion_event_id: completionEventId,
        },
      });
    },
  });
}

export function assertSnapshotIntegrity(snapshotSize, items) {
  if (!Number.isInteger(snapshotSize) || snapshotSize < 1 || snapshotSize > 10) {
    throw persistenceError("LEARNING_SESSION_SNAPSHOT_INVALID", "snapshot_size must be from 1 to 10.");
  }
  if (!Array.isArray(items) || items.length !== snapshotSize) {
    throw persistenceError(
      "LEARNING_SESSION_SNAPSHOT_INVALID",
      "Session item count must equal snapshot_size.",
    );
  }

  const seenVocabularyIds = new Set();
  const normalized = items.map((item, position) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw persistenceError("LEARNING_SESSION_SNAPSHOT_INVALID", "Session item must be an object.");
    }
    if (item.position !== position) {
      throw persistenceError(
        "LEARNING_SESSION_SNAPSHOT_INVALID",
        "Session item positions must be contiguous from zero.",
      );
    }
    if (typeof item.vocabulary_id !== "string" || item.vocabulary_id.length === 0) {
      throw persistenceError(
        "LEARNING_SESSION_SNAPSHOT_INVALID",
        "Session item vocabulary identity is required.",
      );
    }
    if (seenVocabularyIds.has(item.vocabulary_id)) {
      throw persistenceError(
        "LEARNING_SESSION_SNAPSHOT_INVALID",
        "Session item vocabulary identities must be distinct.",
      );
    }
    seenVocabularyIds.add(item.vocabulary_id);
    return Object.freeze({
      vocabulary_id: item.vocabulary_id,
      position,
    });
  });

  return Object.freeze(normalized);
}

export function assertCreationReplayMatches(existing, expected) {
  if (!existing) return null;
  const expectedItems = assertSnapshotIntegrity(expected.snapshot_size, expected.items);
  const existingItems = assertSnapshotIntegrity(existing.snapshot_size, existing.items);
  const matches = existing.user_id === expected.user_id
    && existing.set_id_snapshot === expected.set_id_snapshot
    && existing.mode === expected.mode
    && existing.snapshot_size === expected.snapshot_size
    && existingItems.every((item, index) => (
      item.vocabulary_id === expectedItems[index].vocabulary_id
      && item.position === expectedItems[index].position
    ));
  if (!matches) {
    throw persistenceError(
      "LEARNING_SESSION_OPERATION_CONFLICT",
      "Creation operation identity was reused with a different session request.",
    );
  }
  return existing;
}

export function assertEvidenceReplayMatches(existing, expected) {
  if (!existing) return null;
  if (
    existing.session_id !== expected.session_id
    || existing.vocabulary_id !== expected.vocabulary_id
    || existing.evidence !== expected.evidence
  ) {
    throw persistenceError(
      "LEARNING_SESSION_EVENT_CONFLICT",
      "Evidence event identity was reused with different evidence.",
    );
  }
  return existing;
}

export function assertCompletionReplayMatches(existing, expected) {
  if (!existing) return null;
  if (
    existing.user_id !== expected.user_id
    || existing.id !== expected.session_id
    || existing.completion_event_id !== expected.completion_event_id
  ) {
    throw persistenceError(
      "LEARNING_SESSION_EVENT_CONFLICT",
      "Completion event identity was reused with a different session.",
    );
  }
  return existing;
}

export function assertCompleteGroup(session, items) {
  const normalized = assertSnapshotIntegrity(session.snapshot_size, items);
  for (let index = 0; index < normalized.length; index += 1) {
    const item = items[index];
    if (item.session_id !== session.id) {
      throw persistenceError(
        "LEARNING_SESSION_SNAPSHOT_INVALID",
        "Session item belongs to a different session.",
      );
    }
    if (!item.evidence || !item.evidence_event_id || !item.evidence_at) {
      throw persistenceError(
        "LEARNING_SESSION_INCOMPLETE",
        "Every session item must have complete durable evidence.",
      );
    }
    assertEvidenceCompatible(session.mode, item.evidence);
  }
  return true;
}

function assertLockedItem(session, item) {
  if (!item || item.session_id !== session.id) {
    throw persistenceError(
      "LEARNING_SESSION_ITEM_MISMATCH",
      "Session item does not belong to the locked session.",
    );
  }
}

function assertSessionAcceptsMutation(session, acceptedAt) {
  if (!session || session.status !== "ACTIVE") {
    throw persistenceError("LEARNING_SESSION_TERMINAL", "Learning Session is not active.");
  }
  if (!isSessionAcceptingAt(session.expires_at, acceptedAt)) {
    throw persistenceError("LEARNING_SESSION_EXPIRED", "Learning Session has expired.");
  }
}

function assertEvidenceCompatible(mode, evidence) {
  if (!EVIDENCE_BY_MODE[mode]?.has(evidence)) {
    throw persistenceError(
      "LEARNING_SESSION_EVIDENCE_MISMATCH",
      "Evidence is not compatible with the Learning Session mode.",
    );
  }
}

function cloneInstant(value, name) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new TypeError(`${name} must be a valid Date.`);
  }
  return new Date(value.getTime());
}

function requireTransactionClient(transaction) {
  if (
    !transaction
    || typeof transaction !== "object"
    || !transaction.lEARNING_SESSION
    || !transaction.lEARNING_SESSION_ITEM
    || typeof transaction.$queryRaw !== "function"
  ) {
    throw new TypeError("A caller-provided Prisma transaction client is required.");
  }
}

function persistenceError(code, message) {
  return new LearningSessionPersistenceError(code, message);
}
