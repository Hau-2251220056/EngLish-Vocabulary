import {
  createSessionIdentity,
  createSessionStorageKey,
  LEARNING_SESSION_MODES,
  readSessionValue,
  removeSessionValue,
  writeSessionValue,
} from "./resilient-session-store.js";
import { requireSessionProjection } from "../services/learning-session-service.js";

const VERSION = 2;
const NAMESPACE = "elvocab.backend-learning-session";
const PENDING_NAMESPACE = "elvocab.backend-learning-session-create";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MODE_TO_STORAGE = Object.freeze({
  NORMAL: LEARNING_SESSION_MODES.NORMAL_FLASHCARD,
  SRS: LEARNING_SESSION_MODES.SRS_FLASHCARD,
  QUIZ: LEARNING_SESSION_MODES.MULTIPLE_CHOICE_QUIZ,
});
const VIEW_STATES = new Set(["ACTIVE", "EXPIRED", "INACCESSIBLE", "COMPLETED"]);

export function reconcileLearningSessionState(stored, { userId, setId, mode }, backendValue) {
  const session = requireSessionProjection(backendValue, {
    allowAccessState: Object.hasOwn(backendValue, "can_continue"),
  });
  requireIdentity(userId, setId, mode);
  if (session.set_id !== setId || session.mode !== mode) {
    throw new TypeError("Backend Learning Session does not match the requested identity.");
  }
  const matchingStored = isStoredRecord(stored, userId, setId, mode)
    && stored.session_id === session.id ? stored : null;
  const itemIds = session.items.map(({ vocabulary_id: id }) => id);
  const cursor = itemIds.includes(matchingStored?.cursor_vocabulary_id)
    ? matchingStored.cursor_vocabulary_id
    : session.items.find(({ evidence }) => evidence === null)?.vocabulary_id ?? itemIds[0];
  const inaccessible = session.restart_reason === "SESSION_INACCESSIBLE";
  const viewState = inaccessible ? "INACCESSIBLE" : session.state;
  return Object.freeze({
    version: VERSION,
    user_id: userId,
    set_id: setId,
    mode,
    session_id: session.id,
    creation_operation_id: matchingStored?.creation_operation_id ?? null,
    expires_at: session.expires_at,
    cursor_vocabulary_id: cursor,
    view_state: viewState,
    can_continue: !inaccessible && session.state === "ACTIVE",
    restart_required: inaccessible || session.state === "EXPIRED",
    item_ids: Object.freeze(itemIds),
    acknowledged_ids: Object.freeze(session.items
      .filter(({ evidence }) => evidence !== null)
      .map(({ vocabulary_id: id }) => id)),
    needs_reconciliation: false,
  });
}

export function selectLearningSessionCursor(state, vocabularyId) {
  if (!isRuntimeState(state) || state.view_state !== "ACTIVE"
    || !state.item_ids.includes(vocabularyId)) return state;
  return { ...state, cursor_vocabulary_id: vocabularyId };
}

export function loadLearningSessionState(storage, identity) {
  const key = storageKey(identity);
  const stored = readSessionValue(storage, key, (value) => isStoredRecord(
    value, identity.userId, identity.setId, identity.mode,
  ));
  return stored ? {
    ...stored, item_ids: [], acknowledged_ids: [], needs_reconciliation: true,
  } : null;
}

export function saveLearningSessionState(storage, state) {
  if (!isRuntimeState(state)) return false;
  const stored = {
    version: VERSION,
    user_id: state.user_id,
    set_id: state.set_id,
    mode: state.mode,
    session_id: state.session_id,
    creation_operation_id: state.creation_operation_id,
    expires_at: state.expires_at,
    cursor_vocabulary_id: state.cursor_vocabulary_id,
    view_state: state.view_state,
  };
  return writeSessionValue(storage, storageKey({
    userId: state.user_id, setId: state.set_id, mode: state.mode,
  }), stored);
}

export function clearLearningSessionState(storage, identity) {
  return removeSessionValue(storage, storageKey(identity));
}

export async function createLearningSessionWithPendingReplay({
  storage,
  identity,
  operationId,
  vocabularyIds,
  createSession,
}) {
  if (typeof createSession !== "function") {
    throw new TypeError("Learning Session create callback is invalid.");
  }
  const pending = prepareLearningSessionCreation(storage, identity, operationId);
  const request = {
    operation_id: pending.creation_operation_id,
    set_id: identity.setId,
    mode: identity.mode,
    ...(identity.mode === "SRS" ? {} : { vocabulary_ids: vocabularyIds }),
  };
  const result = await createSession(request);
  if (result.session === null) {
    clearPendingLearningSessionCreation(storage, identity, pending.creation_operation_id);
    return { ...result, session_state: null };
  }
  return {
    ...result,
    session_state: acceptLearningSessionCreation(
      storage, identity, pending.creation_operation_id, result.session,
    ),
  };
}

export function prepareLearningSessionCreation(storage, identity, operationId) {
  const existing = loadPendingLearningSessionCreation(storage, identity);
  if (existing) return existing;
  requireUuid(operationId, "Learning Session creation operation is invalid.");
  const pending = Object.freeze({
    version: VERSION,
    user_id: identity.userId,
    set_id: identity.setId,
    mode: identity.mode,
    creation_operation_id: operationId,
  });
  requireIdentity(identity.userId, identity.setId, identity.mode);
  const key = pendingStorageKey(identity);
  if (!writeSessionValue(storage, key, pending)) {
    removeSessionValue(storage, key);
    throw new TypeError("Learning Session creation identity could not be persisted.");
  }
  return pending;
}

export function loadPendingLearningSessionCreation(storage, identity) {
  const key = pendingStorageKey(identity);
  return readSessionValue(storage, key, (value) => isPendingCreationRecord(
    value, identity.userId, identity.setId, identity.mode,
  ));
}

export function acceptLearningSessionCreation(
  storage, identity, operationId, backendSession,
) {
  const pending = loadPendingLearningSessionCreation(storage, identity);
  if (!pending || pending.creation_operation_id !== operationId) {
    throw new TypeError("Learning Session creation replay identity does not match.");
  }
  const current = loadLearningSessionState(storage, identity);
  const state = reconcileLearningSessionState(current, identity, backendSession);
  const accepted = Object.freeze({ ...state, creation_operation_id: operationId });
  if (!saveLearningSessionState(storage, accepted)) {
    throw new TypeError("Learning Session identity could not be persisted.");
  }
  removeSessionValue(storage, pendingStorageKey(identity));
  return accepted;
}

export function clearPendingLearningSessionCreation(storage, identity, operationId) {
  const pending = loadPendingLearningSessionCreation(storage, identity);
  if (!pending || pending.creation_operation_id !== operationId) return false;
  return removeSessionValue(storage, pendingStorageKey(identity));
}

function storageKey({ userId, setId, mode }) {
  requireIdentity(userId, setId, mode);
  return createSessionStorageKey(NAMESPACE, createSessionIdentity({
    version: VERSION,
    userId,
    setId,
    mode: MODE_TO_STORAGE[mode],
  }));
}

function pendingStorageKey({ userId, setId, mode }) {
  requireIdentity(userId, setId, mode);
  return createSessionStorageKey(PENDING_NAMESPACE, createSessionIdentity({
    version: VERSION,
    userId,
    setId,
    mode: MODE_TO_STORAGE[mode],
  }));
}

function requireIdentity(userId, setId, mode) {
  if (typeof userId !== "string" || userId.length === 0
    || typeof setId !== "string" || setId.length === 0
    || !Object.hasOwn(MODE_TO_STORAGE, mode)) throw new TypeError("Learning Session identity is invalid.");
}

function isStoredRecord(value, userId, setId, mode) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value)
    && value.version === VERSION && value.user_id === userId && value.set_id === setId
    && value.mode === mode && UUID_PATTERN.test(value.session_id)
    && (value.creation_operation_id === null || UUID_PATTERN.test(value.creation_operation_id))
    && typeof value.expires_at === "string" && /(?:Z|[+-]\d{2}:\d{2})$/i.test(value.expires_at)
    && !Number.isNaN(Date.parse(value.expires_at))
    && UUID_PATTERN.test(value.cursor_vocabulary_id)
    && VIEW_STATES.has(value.view_state));
}

function isRuntimeState(value) {
  return isStoredRecord(value, value?.user_id, value?.set_id, value?.mode)
    && Array.isArray(value.acknowledged_ids)
    && Array.isArray(value.item_ids)
    && typeof value.needs_reconciliation === "boolean";
}

function isPendingCreationRecord(value, userId, setId, mode) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).length === 5
    && value.version === VERSION && value.user_id === userId && value.set_id === setId
    && value.mode === mode && UUID_PATTERN.test(value.creation_operation_id));
}

function requireUuid(value, message) {
  if (!UUID_PATTERN.test(value)) throw new TypeError(message);
}
