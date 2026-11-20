import {
  clearLearningSessionState,
  createLearningSessionWithPendingReplay,
  loadLearningSessionState,
  reconcileLearningSessionState,
  saveLearningSessionState,
} from "../session-storage/learning-session-state.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function openSrsLearningSession({
  storage, identity, service, randomUuid, refreshUnanswered = false,
}) {
  requireDependencies(identity, service, randomUuid);
  const stored = loadLearningSessionState(storage, identity);
  if (stored) {
    const projection = await service.readSession(stored.session_id);
    if (shouldRefreshUnansweredDueOnly(identity, projection, refreshUnanswered)) {
      clearLearningSessionState(storage, identity);
    } else {
      const state = persistProjection(storage, identity, stored, projection);
      return identity.sessionIntent === "DUE_ONLY"
        ? { session_state: state, cards: projection.cards, evaluated_at: projection.evaluated_at, set_name: projection.set_name }
        : state;
    }
  }
  const result = await createLearningSessionWithPendingReplay({
    storage,
    identity,
    operationId: randomUuid(),
    createSession: (request) => service.createSession(request),
  });
  if (identity.sessionIntent !== "DUE_ONLY") return result.session_state;
  if (!result.session_state) return { session_state: null, cards: [], evaluated_at: null };
  const projection = await service.readSession(result.session_state.session_id);
  const state = persistProjection(storage, identity, result.session_state, projection);
  return { session_state: state, cards: projection.cards, evaluated_at: projection.evaluated_at, set_name: projection.set_name };
}

function shouldRefreshUnansweredDueOnly(identity, projection, requested) {
  return requested && identity.sessionIntent === "DUE_ONLY"
    && projection.state === "ACTIVE"
    && projection.items.every(({ evidence }) => evidence === null);
}

export async function openPassLinkedSrsSession({
  storage,
  identity,
  passId,
  exactSessionId = null,
  pathService,
  sessionService,
  runOperation,
  randomUuid,
}) {
  requirePassDependencies(
    identity, passId, exactSessionId, pathService, sessionService, runOperation, randomUuid,
  );
  const stored = loadLearningSessionState(storage, identity);
  const sessionId = stored?.session_id ?? exactSessionId;
  if (sessionId) {
    const session = await sessionService.readSession(sessionId);
    const sessionState = persistProjection(storage, identity, stored, session);
    return { session_state: sessionState, cards: session.cards, evaluated_at: session.evaluated_at };
  }
  const result = await runOperation({
    storage,
    userId: identity.userId,
    setId: identity.setId,
    passId,
    kind: "NEXT_SESSION:SRS",
    randomUuid,
    execute: (operationId) => pathService.createNextSession(passId, operationId, "SRS"),
  });
  if (result.session === null) {
    return { session_state: null, cards: [], evaluated_at: null, reason: result.reason };
  }
  return {
    session_state: persistProjection(storage, identity, stored, result.session),
    cards: result.cards,
    evaluated_at: result.evaluated_at,
    replayed: result.replayed,
    resumed: result.resumed ?? false,
  };
}

export function acceptSrsRatingProjection({
  storage, identity, state, backendSession, cefrPass = null,
}) {
  requirePassEvidenceIdentity(identity, cefrPass);
  return persistProjection(storage, identity, state, backendSession);
}

export async function reconcileSrsLearningSession({ storage, identity, state, service }) {
  return persistProjection(
    storage,
    identity,
    state,
    await service.readSession(state.session_id),
  );
}

function persistProjection(storage, identity, stored, backendSession) {
  const accepted = reconcileLearningSessionState(stored, identity, backendSession);
  if (!saveLearningSessionState(storage, accepted)) {
    throw new TypeError("SRS Learning Session projection could not be persisted.");
  }
  return accepted;
}

function requireDependencies(identity, service, randomUuid) {
  if (identity?.mode !== "SRS" || typeof service?.createSession !== "function"
    || typeof service?.readSession !== "function" || typeof randomUuid !== "function") {
    throw new TypeError("SRS session dependencies are invalid.");
  }
}

function requirePassDependencies(
  identity, passId, exactSessionId, pathService, sessionService, runOperation, randomUuid,
) {
  if (identity?.mode !== "SRS" || !UUID_PATTERN.test(passId)
    || !(exactSessionId === null || UUID_PATTERN.test(exactSessionId))
    || typeof pathService?.createNextSession !== "function"
    || typeof sessionService?.readSession !== "function"
    || typeof runOperation !== "function" || typeof randomUuid !== "function") {
    throw new TypeError("CEFR SRS session dependencies are invalid.");
  }
}

function requirePassEvidenceIdentity(identity, cefrPass) {
  if (identity.passId) {
    if (cefrPass?.id !== identity.passId) {
      throw new TypeError("SRS CEFR evidence does not match the active pass.");
    }
  } else if (cefrPass) {
    throw new TypeError("Ordinary SRS evidence cannot include a CEFR pass.");
  }
}
