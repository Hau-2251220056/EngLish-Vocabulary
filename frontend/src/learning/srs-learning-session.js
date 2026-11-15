import {
  createLearningSessionWithPendingReplay,
  loadLearningSessionState,
  reconcileLearningSessionState,
  saveLearningSessionState,
} from "../session-storage/learning-session-state.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function openSrsLearningSession({ storage, identity, service, randomUuid }) {
  requireDependencies(identity, service, randomUuid);
  const stored = loadLearningSessionState(storage, identity);
  if (stored) {
    return persistProjection(storage, identity, stored, await service.readSession(stored.session_id));
  }
  const result = await createLearningSessionWithPendingReplay({
    storage,
    identity,
    operationId: randomUuid(),
    createSession: (request) => service.createSession(request),
  });
  return result.session_state;
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
