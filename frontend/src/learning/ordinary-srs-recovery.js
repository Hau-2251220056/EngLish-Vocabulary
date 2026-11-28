import {
  loadLearningSessionState,
  reconcileLearningSessionState,
  saveLearningSessionState,
} from "../session-storage/learning-session-state.js";
import { clearSessionNamespace } from "../session-storage/resilient-session-store.js";

const PREFIX = "elvocab.learning.srs-recovery.v1:";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RATINGS = new Set(["AGAIN", "HARD", "GOOD", "EASY"]);

export function ordinarySrsPresentation(session, payload) {
  if (session.view_state !== "ACTIVE") return session.view_state;
  if (payload.eligible_count === 0 && payload.cards.length === 0) return "ACTIVE_EMPTY_DUE";
  const dueIds = new Set(payload.cards.map(({ id }) => id));
  const acknowledgedIds = new Set(session.acknowledged_ids);
  return session.item_ids.some((id) => !acknowledgedIds.has(id) && !dueIds.has(id))
    ? "ACTIVE_SNAPSHOT_UNAVAILABLE" : "ACTIVE";
}

export async function recoverOrdinarySrsSession({
  storage, identity, originalId, sessionService, readCards, randomUuid, isCurrent,
}) {
  const key = recoveryKey(identity, originalId);
  const stored = loadLearningSessionState(storage, identity);
  if (stored?.session_id !== originalId) return null;
  const stillCurrent = () => isCurrent() && loadLearningSessionState(storage, identity)?.session_id === originalId;

  async function readSnapshot(sessionId) {
    const projection = await sessionService.readSession(sessionId);
    if (projection.id !== sessionId) throw new TypeError("SRS session identity changed.");
    const session = reconcileLearningSessionState(stored, identity, projection);
    const payload = await readCards();
    if (payload.id !== identity.setId || payload.mode !== "SRS") {
      throw new TypeError("SRS card identity changed.");
    }
    return { session, payload, presentation: ordinarySrsPresentation(session, payload) };
  }

  const original = await readSnapshot(originalId);
  if (!stillCurrent()) return null;
  if (original.presentation !== "ACTIVE_SNAPSHOT_UNAVAILABLE") return original;

  // Read storage directly so an unavailable or corrupt journal cannot mint a second UUID.
  let operationId = storage.getItem(key);
  if (operationId === null) {
    operationId = randomUuid();
    if (!UUID.test(operationId)) throw new TypeError("SRS recovery operation is invalid.");
    storage.setItem(key, operationId);
    if (storage.getItem(key) !== operationId) throw new TypeError("SRS recovery could not be stored.");
  }
  if (!UUID.test(operationId)) throw new TypeError("SRS recovery operation is invalid.");
  const { session: created } = await sessionService.createSession({
    operation_id: operationId, set_id: identity.setId, mode: "SRS",
  });
  if (!stillCurrent()) return null;
  if (!created) {
    const latest = await readSnapshot(originalId);
    return stillCurrent() ? latest : null;
  }
  if (created.id === originalId) throw new TypeError("SRS recovery did not return an independent session.");

  const replacement = await readSnapshot(created.id);
  if (!stillCurrent()) return null;
  const session = {
    ...replacement.session, creation_operation_id: operationId, recovered_from_session_id: originalId,
  };
  if (!saveLearningSessionState(storage, session, { durableOnly: true })) {
    throw new TypeError("Replacement SRS session could not be stored.");
  }
  return { ...replacement, session };
}

export function readOrdinarySrsRatingAttempts(storage, identity) {
  const raw = storage?.getItem(ratingsKey(identity));
  if (raw == null) return [];
  const attempts = JSON.parse(raw);
  if (!Array.isArray(attempts) || attempts.some((entry) => (
    !isRatingAttempt(entry?.request, identity) || typeof entry.superseded !== "boolean"
  ))) throw new TypeError("Stored SRS ratings are invalid.");
  return attempts;
}

export function preserveOrdinarySrsRating(storage, identity, request) {
  if (!isRatingAttempt(request, identity)) throw new TypeError("SRS rating identity is invalid.");
  const attempts = readOrdinarySrsRatingAttempts(storage, identity);
  const existing = attempts.find((entry) => entry.request.event_id === request.event_id);
  if (existing) {
    if (Object.keys(request).some((field) => request[field] !== existing.request[field])) {
      throw new TypeError("SRS rating operation identity changed.");
    }
    return attempts;
  }
  return saveRatingAttempts(storage, identity, [...attempts, { request, superseded: false }]);
}

export function settleOrdinarySrsRating(storage, identity, eventId, { superseded = false } = {}) {
  const attempts = readOrdinarySrsRatingAttempts(storage, identity);
  if (!attempts.some(({ request }) => request.event_id === eventId)) return attempts;
  return saveRatingAttempts(storage, identity, superseded
    ? attempts.map((entry) => entry.request.event_id === eventId ? { ...entry, superseded } : entry)
    : attempts.filter(({ request }) => request.event_id !== eventId));
}

export function clearOrdinarySrsRecoveryNamespace(storage) {
  return clearSessionNamespace(storage, PREFIX);
}

function saveRatingAttempts(storage, identity, attempts) {
  const key = ratingsKey(identity);
  const raw = JSON.stringify(attempts);
  storage.setItem(key, raw);
  if (storage.getItem(key) !== raw) throw new TypeError("SRS ratings could not be stored.");
  return attempts;
}

function isRatingAttempt(request, identity) {
  return request && Object.keys(request).length === 6
    && request.set_id === identity.setId && UUID.test(request.session_id)
    && UUID.test(request.event_id) && UUID.test(request.vocabulary_id) && RATINGS.has(request.rating)
    && Number.isSafeInteger(request.expected_revision) && request.expected_revision >= 0;
}

function ratingsKey(identity) {
  if (!identity.userId || !identity.setId || identity.mode !== "SRS"
    || (identity.sessionIntent ?? "STANDARD") !== "STANDARD" || identity.passId != null) {
    throw new TypeError("Recovery requires an ordinary STANDARD SRS identity.");
  }
  return `${PREFIX}${encodeURIComponent(identity.userId)}:${encodeURIComponent(identity.setId)}:SRS:STANDARD`;
}

function recoveryKey(identity, sessionId) {
  if (!UUID.test(sessionId)) throw new TypeError("Original SRS session is invalid.");
  return `${ratingsKey(identity)}:create:${sessionId}`;
}
