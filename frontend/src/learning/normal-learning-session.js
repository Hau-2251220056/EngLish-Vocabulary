import {
  loadLearningSessionState,
  reconcileLearningSessionState,
  saveLearningSessionState,
  selectLearningSessionCursor,
  createLearningSessionWithPendingReplay,
} from "../session-storage/learning-session-state.js";
import { readSessionValue, removeSessionValue, writeSessionValue } from "../session-storage/resilient-session-store.js";

const OPERATION_VERSION = 1;
const OPERATION_NAMESPACE = "elvocab.normal-learning-operation";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function openNormalLearningSession({ storage, identity, vocabularyIds, service, randomUuid }) {
  requireDependencies(identity, service, randomUuid);
  const stored = loadLearningSessionState(storage, identity);
  if (stored) {
    const session = await service.readSession(stored.session_id);
    return persistProjection(storage, identity, stored, session);
  }
  const result = await createLearningSessionWithPendingReplay({
    storage,
    identity,
    operationId: randomUuid(),
    vocabularyIds,
    createSession: (request) => service.createSession(request),
  });
  return result.session_state;
}

export async function acknowledgeNormalReveal({ storage, identity, state, vocabularyId, service, randomUuid }) {
  requireDependencies(identity, service, randomUuid);
  requireActiveItem(state, vocabularyId);
  if (state.acknowledged_ids.includes(vocabularyId)) return state;
  const operation = prepareOperation(storage, identity, state.session_id, "REVEAL", vocabularyId, randomUuid);
  const result = await service.acknowledgeNormalReveal(
    state.session_id, vocabularyId, operation.operation_id,
  );
  const accepted = persistProjection(storage, identity, state, result.session);
  clearOperation(storage, identity, state.session_id, "REVEAL", vocabularyId, operation.operation_id);
  return accepted;
}

export async function completeNormalLearningSession({ storage, identity, state, service, randomUuid }) {
  requireDependencies(identity, service, randomUuid);
  if (state.view_state !== "ACTIVE" || state.acknowledged_ids.length !== state.item_ids.length) {
    throw new TypeError("NORMAL session is not ready for completion.");
  }
  const operation = prepareOperation(storage, identity, state.session_id, "COMPLETE", null, randomUuid);
  const result = await service.completeNormalSession(state.session_id, operation.operation_id);
  const accepted = persistProjection(storage, identity, state, result.session);
  clearOperation(storage, identity, state.session_id, "COMPLETE", null, operation.operation_id);
  return { session_state: accepted, streak: result.streak, replayed: result.replayed };
}

export function canCompleteNormalLearningSession(state) {
  return Boolean(state?.view_state === "ACTIVE" && state.item_ids.length > 0
    && state.acknowledged_ids.length === state.item_ids.length);
}

export function persistNormalLearningCursor({ storage, state, vocabularyId }) {
  const selected = selectLearningSessionCursor(state, vocabularyId);
  if (selected === state) return state;
  if (!saveLearningSessionState(storage, selected)) {
    throw new TypeError("NORMAL presentation cursor could not be persisted.");
  }
  return selected;
}

export async function reconcileNormalLearningSession({ storage, identity, state, service }) {
  const session = await service.readSession(state.session_id);
  return persistProjection(storage, identity, state, session);
}

function persistProjection(storage, identity, stored, backendSession) {
  const accepted = reconcileLearningSessionState(stored, identity, backendSession);
  if (!saveLearningSessionState(storage, accepted)) {
    throw new TypeError("Learning Session projection could not be persisted.");
  }
  return accepted;
}

function prepareOperation(storage, identity, sessionId, kind, vocabularyId, randomUuid) {
  const key = operationKey(identity, sessionId, kind, vocabularyId);
  const existing = readSessionValue(storage, key, (value) => isOperation(value, identity, sessionId, kind, vocabularyId));
  if (existing) return existing;
  const operationId = randomUuid();
  if (!UUID_PATTERN.test(operationId)) throw new TypeError("NORMAL operation identity is invalid.");
  const operation = {
    version: OPERATION_VERSION,
    user_id: identity.userId,
    set_id: identity.setId,
    session_id: sessionId,
    kind,
    vocabulary_id: vocabularyId,
    operation_id: operationId,
  };
  if (!writeSessionValue(storage, key, operation)) {
    removeSessionValue(storage, key);
    throw new TypeError("NORMAL operation identity could not be persisted.");
  }
  return operation;
}

function clearOperation(storage, identity, sessionId, kind, vocabularyId, operationId) {
  const key = operationKey(identity, sessionId, kind, vocabularyId);
  const current = readSessionValue(storage, key, (value) => isOperation(value, identity, sessionId, kind, vocabularyId));
  if (current?.operation_id === operationId) removeSessionValue(storage, key);
}

function operationKey(identity, sessionId, kind, vocabularyId) {
  return [OPERATION_NAMESPACE, `v${OPERATION_VERSION}`, encodeURIComponent(identity.userId),
    encodeURIComponent(identity.setId), sessionId, kind, vocabularyId ?? "session"].join(":");
}

function isOperation(value, identity, sessionId, kind, vocabularyId) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value)
    && value.version === OPERATION_VERSION && value.user_id === identity.userId
    && value.set_id === identity.setId && value.session_id === sessionId && value.kind === kind
    && value.vocabulary_id === vocabularyId && UUID_PATTERN.test(value.operation_id));
}

function requireActiveItem(state, vocabularyId) {
  if (state?.view_state !== "ACTIVE" || !state.item_ids.includes(vocabularyId)) {
    throw new TypeError("NORMAL session item is not active.");
  }
}

function requireDependencies(identity, service, randomUuid) {
  if (identity?.mode !== "NORMAL" || typeof service?.createSession !== "function"
    || typeof randomUuid !== "function") throw new TypeError("NORMAL session dependencies are invalid.");
}
