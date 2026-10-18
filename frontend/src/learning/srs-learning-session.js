import {
  createLearningSessionWithPendingReplay,
  loadLearningSessionState,
  reconcileLearningSessionState,
  saveLearningSessionState,
} from "../session-storage/learning-session-state.js";

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

export function acceptSrsRatingProjection({ storage, identity, state, backendSession }) {
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
