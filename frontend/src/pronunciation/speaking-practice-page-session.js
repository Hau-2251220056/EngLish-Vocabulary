import { learningService } from "../services/learning-service.js";
import {
  createSpeakingPracticeController,
  SPEAKING_PRACTICE_ISSUES,
  SPEAKING_PRACTICE_PHASES,
} from "./speaking-practice-state.js";
import { REFERENCE_PLAYBACK_PHASES } from "./reference-playback-coordinator.js";
import {
  completeSpeakingPracticeBatch,
  continueSpeakingPracticeRun,
  createSpeakingPracticeRunState,
  currentSpeakingPracticeBatchIds,
  loadSpeakingPracticeRunState,
  reconcileSpeakingPracticeRun,
  saveSpeakingPracticeRunState,
  selectSpeakingPracticeVocabulary,
  summarizeSpeakingPracticeRun,
} from "./speaking-practice-run-state.js";

const ACTIVE_RECOGNITION_PHASES = new Set([
  SPEAKING_PRACTICE_PHASES.STARTING,
  SPEAKING_PRACTICE_PHASES.LISTENING,
  SPEAKING_PRACTICE_PHASES.FINALIZING,
]);
const ACTIVE_PLAYBACK_PHASES = new Set([
  REFERENCE_PLAYBACK_PHASES.LOADING_AUDIO,
  REFERENCE_PLAYBACK_PHASES.PLAYING_AUDIO,
  REFERENCE_PLAYBACK_PHASES.SPEAKING_TTS,
]);

export const SPEAKING_PRACTICE_LOAD_ISSUES = Object.freeze({
  EMPTY: "LEARNING_SET_EMPTY",
  NOT_FOUND: "LEARNING_SET_NOT_FOUND",
  FORBIDDEN: "FORBIDDEN",
  UNAUTHENTICATED: "UNAUTHENTICATED",
  INVALID_RESPONSE: "INVALID_LEARNING_RESPONSE",
  REQUEST_FAILED: "LEARNING_REQUEST_FAILED",
});

export function prepareSpeakingPracticeSession(runState, learningSet) {
  if (!learningSet || learningSet.mode !== "NORMAL" || learningSet.id !== runState?.set_id
    || !Array.isArray(learningSet.cards)) throw new TypeError("Speaking Practice manifest is invalid.");
  const ids = learningSet.cards.map(({ id }) => id);
  const state = reconcileSpeakingPracticeRun(runState, ids);
  const batchIds = currentSpeakingPracticeBatchIds(state);
  const cardById = new Map(learningSet.cards.map((card) => [card.id, card]));
  if (cardById.size !== learningSet.cards.length || batchIds.some((id) => !cardById.has(id))) {
    throw new TypeError("Speaking Practice manifest identities are invalid.");
  }
  const cards = batchIds.map((id) => cardById.get(id));
  const summary = summarizeSpeakingPracticeRun(state);
  return Object.freeze({
    state,
    target_index: summary.current_index,
    learning_set: Object.freeze({ ...learningSet, total_items: cards.length, cards: Object.freeze(cards) }),
  });
}

export function createSpeakingPracticePageSession({
  setId,
  userId = null,
  storage = null,
  loadLearningSet = (requestedSetId, options) => learningService.getLearningSet(requestedSetId, options),
  createController = createSpeakingPracticeController,
  controllerOptions = {},
  onSnapshot = () => {},
} = {}) {
  const sessionUserId = userId ?? `EPHEMERAL_${createEphemeralSessionId()}`;
  let active = true;
  let loadRequest = 0;
  let completed = false;
  let runState = loadSpeakingPracticeRunState(storage, sessionUserId, setId)
    ?? createSpeakingPracticeRunState(sessionUserId, setId);
  let runSummary = summarizeSpeakingPracticeRun(runState);
  let suppressControllerPublication = false;
  let controllerSnapshot = null;
  let latestSnapshot = null;

  const controller = createController({
    ...controllerOptions,
    onStateChange(snapshot) {
      controllerSnapshot = snapshot;
      if (active && !suppressControllerPublication) publishSnapshot();
    },
  });
  controllerSnapshot = controller.getSnapshot();
  latestSnapshot = createPageSnapshot(controllerSnapshot, completed, runSummary);

  function publishSnapshot() {
    latestSnapshot = createPageSnapshot(controllerSnapshot, completed, runSummary);
    onSnapshot(latestSnapshot);
  }

  function start() {
    if (!active) return Promise.resolve(operationFailure(SPEAKING_PRACTICE_ISSUES.DISPOSED));
    completed = false;
    if (!isValidRouteSetId(setId)) {
      const operation = controller.rejectLoad(
        SPEAKING_PRACTICE_ISSUES.INVALID_LEARNING_SET,
        { loadGeneration: controller.getSnapshot().generation },
      );
      return Promise.resolve(operation);
    }

    const begin = controller.beginLoad({ setId });
    if (!begin.ok) {
      return Promise.resolve(begin);
    }

    const request = ++loadRequest;
    const loadGeneration = begin.generation;
    return Promise.resolve()
      .then(() => loadLearningSet(setId, { mode: "NORMAL" }))
      .then(
        (payload) => settle(request, () => acceptLearningSet(payload, loadGeneration)),
        (error) => settle(request, () => controller.rejectLoad(mapLearningIssue(error), { loadGeneration })),
      );
  }

  function acceptLearningSet(payload, loadGeneration) {
    const wasInitialized = runState.session_initialized;
    let prepared;
    try {
      prepared = prepareSpeakingPracticeSession(runState, payload);
    } catch {
      return controller.rejectLoad(SPEAKING_PRACTICE_LOAD_ISSUES.INVALID_RESPONSE, { loadGeneration });
    }
    runState = prepared.state;
    runSummary = summarizeSpeakingPracticeRun(runState);
    saveSpeakingPracticeRunState(storage, runState);
    const initialEmptySet = !wasInitialized && payload.cards.length === 0;
    const operation = runWithoutIntermediatePublication(() => {
      const accepted = controller.acceptLearningSet(prepared.learning_set, { loadGeneration });
      if (!accepted.ok) return accepted;
      if (!initialEmptySet && runSummary.batch_completed) {
        completed = true;
        controller.cancel("SESSION_RESTORED_COMPLETED");
      } else if (prepared.target_index > 0) {
        controller.replaceTarget(prepared.target_index);
      }
      return accepted;
    });
    publishSnapshot();
    return operation;
  }

  function settle(request, apply) {
    if (!active || request !== loadRequest) {
      return operationFailure(SPEAKING_PRACTICE_ISSUES.DISPOSED);
    }
    const operation = apply();
    controllerSnapshot = controller.getSnapshot();
    latestSnapshot = createPageSnapshot(controllerSnapshot, completed, runSummary);
    return operation;
  }

  function previousTarget() {
    return moveToTarget(-1, { completeAtEnd: false });
  }

  function nextTarget() {
    return moveToTarget(1, { completeAtEnd: true });
  }

  function skipTarget() {
    return moveToTarget(1, { completeAtEnd: true });
  }

  function moveToTarget(offset, { completeAtEnd }) {
    if (!active) return operationFailure(SPEAKING_PRACTICE_ISSUES.DISPOSED);
    if (completed) return operationFailure(SPEAKING_PRACTICE_ISSUES.ILLEGAL_TRANSITION);
    const current = controller.getSnapshot();
    if (!Number.isSafeInteger(current.targetIndex)) {
      return operationFailure(SPEAKING_PRACTICE_ISSUES.INVALID_TARGET);
    }
    const nextIndex = current.targetIndex + offset;
    if (nextIndex < 0) return operationFailure(SPEAKING_PRACTICE_ISSUES.INVALID_TARGET);
    if (nextIndex >= current.targets.length) {
      return completeAtEnd
        ? enterCompletion()
        : operationFailure(SPEAKING_PRACTICE_ISSUES.INVALID_TARGET);
    }
    const operation = controller.replaceTarget(nextIndex);
    if (operation.ok) persistCurrentTarget();
    return operation;
  }

  function enterCompletion() {
    const completedRunState = completeSpeakingPracticeBatch(runState);
    const operation = runWithoutIntermediatePublication(
      () => controller.cancel("SESSION_COMPLETED"),
    );
    if (operation?.ok) {
      runState = completedRunState;
      runSummary = summarizeSpeakingPracticeRun(runState);
      saveSpeakingPracticeRunState(storage, runState);
      completed = true;
    }
    publishSnapshot();
    return operation?.ok ? operationSuccess() : operationFailure(operation?.issue);
  }

  function continueAfterCompletion() {
    if (!active) return operationFailure(SPEAKING_PRACTICE_ISSUES.DISPOSED);
    if (!completed || runSummary.full_run_completed) return operationFailure(SPEAKING_PRACTICE_ISSUES.ILLEGAL_TRANSITION);
    runState = continueSpeakingPracticeRun(runState);
    runSummary = summarizeSpeakingPracticeRun(runState);
    saveSpeakingPracticeRunState(storage, runState);
    return start();
  }

  function restartAfterCompletion() {
    if (!active) return Promise.resolve(operationFailure(SPEAKING_PRACTICE_ISSUES.DISPOSED));
    if (!completed || !runSummary.full_run_completed) {
      return Promise.resolve(operationFailure(SPEAKING_PRACTICE_ISSUES.ILLEGAL_TRANSITION));
    }
    runState = createSpeakingPracticeRunState(runState.user_id, runState.set_id);
    runSummary = summarizeSpeakingPracticeRun(runState);
    saveSpeakingPracticeRunState(storage, runState);
    return start();
  }

  function persistCurrentTarget() {
    const targetId = controller.getSnapshot().target?.id;
    if (!targetId) return;
    runState = selectSpeakingPracticeVocabulary(runState, targetId);
    runSummary = summarizeSpeakingPracticeRun(runState);
    saveSpeakingPracticeRunState(storage, runState);
  }

  function retryAttempt() {
    if (!active || completed) {
      return operationFailure(active
        ? SPEAKING_PRACTICE_ISSUES.ILLEGAL_TRANSITION
        : SPEAKING_PRACTICE_ISSUES.DISPOSED);
    }
    return controller.retry();
  }

  function listen() {
    if (!active || completed) return inactiveOperation();
    return controller.listen();
  }

  function requestSpeak() {
    if (!active || completed) return inactiveOperation();
    return controller.requestSpeak();
  }

  function confirmDisclosureAndStart() {
    if (!active || completed) return inactiveOperation();
    return controller.confirmDisclosureAndStart();
  }

  function deferDisclosure() {
    if (!active || completed) return inactiveOperation();
    return controller.cancel("DISCLOSURE_DEFERRED");
  }

  function stopSpeaking() {
    if (!active || completed) return inactiveOperation();
    return controller.stopSpeaking();
  }

  function inactiveOperation() {
    return operationFailure(active
      ? SPEAKING_PRACTICE_ISSUES.ILLEGAL_TRANSITION
      : SPEAKING_PRACTICE_ISSUES.DISPOSED);
  }

  function cancel(reason = "PAGE_CONTEXT_CHANGED") {
    if (!active) return operationFailure(SPEAKING_PRACTICE_ISSUES.DISPOSED);
    const current = controller.getSnapshot();
    if (reason === "PAGE_HIDDEN"
      && !ACTIVE_RECOGNITION_PHASES.has(current.phase)
      && !ACTIVE_PLAYBACK_PHASES.has(current.playback?.phase)) return operationSuccess();
    const operation = runWithoutIntermediatePublication(() => controller.cancel(reason));
    publishSnapshot();
    return operation;
  }

  function runWithoutIntermediatePublication(operation) {
    suppressControllerPublication = true;
    try {
      return operation();
    } finally {
      controllerSnapshot = controller.getSnapshot();
      suppressControllerPublication = false;
    }
  }

  function dispose() {
    if (!active) return operationSuccess();
    active = false;
    loadRequest += 1;
    const operation = controller.dispose();
    controllerSnapshot = controller.getSnapshot();
    latestSnapshot = createPageSnapshot(controllerSnapshot, completed, runSummary);
    return operation;
  }

  return Object.freeze({
    start,
    retry: start,
    previousTarget,
    nextTarget,
    skipTarget,
    retryAttempt,
    listen,
    requestSpeak,
    confirmDisclosureAndStart,
    deferDisclosure,
    stopSpeaking,
    continueAfterCompletion,
    restartAfterCompletion,
    cancel,
    exit: dispose,
    dispose,
    getSnapshot: () => latestSnapshot,
  });
}

export function bindSpeakingPracticeVisibility(documentTarget, onHidden) {
  if (!documentTarget?.addEventListener || !documentTarget?.removeEventListener) return () => {};
  let active = true;
  function handleVisibilityChange() {
    if (active && documentTarget.visibilityState === "hidden") onHidden();
  }
  documentTarget.addEventListener("visibilitychange", handleVisibilityChange);
  return () => {
    if (!active) return;
    active = false;
    documentTarget.removeEventListener("visibilitychange", handleVisibilityChange);
  };
}

export function resolveSpeakingPracticeReturnTo(setId, state) {
  if (!isValidRouteSetId(setId)) return "/topics";
  const publicDetail = `/vocabulary-sets/${setId}`;
  const privateDetail = `/my/vocabulary-sets/${setId}`;
  return [publicDetail, privateDetail].includes(state?.returnTo)
    ? state.returnTo
    : publicDetail;
}

export function mapLearningIssue(error) {
  const code = error?.code;
  if (code === SPEAKING_PRACTICE_LOAD_ISSUES.EMPTY
    || code === SPEAKING_PRACTICE_LOAD_ISSUES.NOT_FOUND
    || code === SPEAKING_PRACTICE_LOAD_ISSUES.FORBIDDEN
    || code === SPEAKING_PRACTICE_LOAD_ISSUES.INVALID_RESPONSE) return code;
  if (code === "AUTHENTICATION_FAILED" || error?.status === 401) {
    return SPEAKING_PRACTICE_LOAD_ISSUES.UNAUTHENTICATED;
  }
  return SPEAKING_PRACTICE_LOAD_ISSUES.REQUEST_FAILED;
}

function isValidRouteSetId(setId) {
  return typeof setId === "string" && setId.length > 0 && setId.trim() === setId;
}

function createPageSnapshot(controllerSnapshot, completed, session) {
  if (!completed) return Object.freeze({ ...controllerSnapshot, completed: false, session });
  return Object.freeze({
    ...controllerSnapshot,
    completed: true,
    session,
    result: null,
    controls: Object.freeze({
      ...controllerSnapshot.controls,
      canListen: false,
      canSpeak: false,
      canConfirmDisclosure: false,
      canStop: false,
      canRetry: false,
      canChangeTarget: false,
      canExit: true,
      canRestart: true,
    }),
  });
}

function operationSuccess() {
  return Object.freeze({ ok: true, issue: null, generation: null });
}

function operationFailure(issue) {
  return Object.freeze({ ok: false, issue, generation: null });
}

function createEphemeralSessionId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random()}`;
}
