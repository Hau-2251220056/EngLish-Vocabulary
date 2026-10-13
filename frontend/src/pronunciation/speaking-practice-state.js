import {
  createRecognitionAttemptController,
  RECOGNITION_ATTEMPT_PHASES,
} from "./recognition-attempt-controller.js";
import {
  createSpeechRecognitionAdapter,
  getSpeechRecognitionCapability,
  SPEECH_RECOGNITION_ISSUES,
} from "./speech-recognition-adapter.js";
import {
  createReferencePlaybackCoordinator,
} from "./reference-playback-coordinator.js";

export const SPEAKING_PRACTICE_PHASES = Object.freeze({
  LOADING: "LOADING",
  READY: "READY",
  DISCLOSURE: "DISCLOSURE",
  UNSUPPORTED: "UNSUPPORTED",
  INSECURE_CONTEXT: "INSECURE_CONTEXT",
  STARTING: "STARTING",
  LISTENING: "LISTENING",
  FINALIZING: "FINALIZING",
  RESULT: "RESULT",
  INCONCLUSIVE: "INCONCLUSIVE",
  RECOVERABLE_ERROR: "RECOVERABLE_ERROR",
  CANCELLING: "CANCELLING",
  INACCESSIBLE: "INACCESSIBLE",
  EMPTY: "EMPTY",
});

export const SPEAKING_PRACTICE_ISSUES = Object.freeze({
  DISCLOSURE_REQUIRED: "DISCLOSURE_REQUIRED",
  INVALID_LEARNING_SET: "INVALID_LEARNING_SET",
  INVALID_TARGET: "INVALID_TARGET",
  ILLEGAL_TRANSITION: "ILLEGAL_TRANSITION",
  INACCESSIBLE: "INACCESSIBLE",
  EMPTY: "EMPTY",
  DISPOSED: "DISPOSED",
});

const ACTIVE_PHASES = new Set([
  SPEAKING_PRACTICE_PHASES.STARTING,
  SPEAKING_PRACTICE_PHASES.LISTENING,
  SPEAKING_PRACTICE_PHASES.FINALIZING,
]);

const RETRY_PHASES = new Set([
  SPEAKING_PRACTICE_PHASES.RESULT,
  SPEAKING_PRACTICE_PHASES.INCONCLUSIVE,
  SPEAKING_PRACTICE_PHASES.RECOVERABLE_ERROR,
]);

const INCONCLUSIVE_ISSUES = new Set([
  SPEECH_RECOGNITION_ISSUES.NO_SPEECH,
  SPEECH_RECOGNITION_ISSUES.ABORTED,
  "NO_RESULT",
  "START_TIMEOUT",
  "FINALIZATION_TIMEOUT",
  "INVALID_TARGET",
  "UNUSABLE_PRIMARY",
]);

export function createSpeakingPracticeController({
  browserWindow = globalThis.window,
  createRecognitionController = createRecognitionAttemptController,
  createRecognitionAdapter = createSpeechRecognitionAdapter,
  createPlaybackCoordinator = createReferencePlaybackCoordinator,
  getCapability = getSpeechRecognitionCapability,
  scheduleTimeout = globalThis.setTimeout,
  cancelTimeout = globalThis.clearTimeout,
  createAudio,
  speechSynthesis = browserWindow?.speechSynthesis ?? null,
  createUtterance,
  onStateChange = () => {},
} = {}) {
  let generation = 0;
  let learningSet = null;
  let pendingSetId = null;
  let targetIndex = null;
  let disclosureAcknowledged = false;
  let disposed = false;
  let recognition = null;
  let playback = null;
  let capability = safeCapability(getCapability, browserWindow);
  let snapshot = createSnapshot({
    generation,
    phase: SPEAKING_PRACTICE_PHASES.LOADING,
    capability,
  });

  function currentTarget() {
    return targetIndex === null ? null : learningSet?.cards[targetIndex] ?? null;
  }

  function publish(changes = {}) {
    snapshot = createSnapshot({
      ...snapshot,
      generation,
      set: learningSet ? createSetSummary(learningSet) : null,
      targets: learningSet?.cards ?? [],
      targetIndex,
      target: currentTarget(),
      disclosureAcknowledged,
      recognition: recognition?.getSnapshot?.() ?? snapshot.recognition,
      playback: playback?.getSnapshot?.() ?? snapshot.playback,
      disposed,
      capability,
      ...changes,
    });
    onStateChange(snapshot);
  }

  function ownsIdentity(setId, vocabularyId) {
    const target = currentTarget();
    return !disposed && target && learningSet?.id === setId && target.id === vocabularyId;
  }

  function handleRecognitionState(childSnapshot) {
    if (disposed || snapshot.phase === SPEAKING_PRACTICE_PHASES.CANCELLING) return;
    if (!ownsIdentity(childSnapshot.setId, childSnapshot.vocabularyId)) return;

    if (childSnapshot.phase === RECOGNITION_ATTEMPT_PHASES.STARTING) {
      publish({ phase: SPEAKING_PRACTICE_PHASES.STARTING, issue: null, result: null });
    } else if (childSnapshot.phase === RECOGNITION_ATTEMPT_PHASES.LISTENING) {
      publish({ phase: SPEAKING_PRACTICE_PHASES.LISTENING, issue: null });
    } else if (childSnapshot.phase === RECOGNITION_ATTEMPT_PHASES.FINALIZING) {
      publish({ phase: SPEAKING_PRACTICE_PHASES.FINALIZING, issue: null });
    } else if (childSnapshot.phase === RECOGNITION_ATTEMPT_PHASES.RESULT) {
      publish({
        phase: SPEAKING_PRACTICE_PHASES.RESULT,
        issue: null,
        result: childSnapshot.result,
      });
    } else if (childSnapshot.phase === RECOGNITION_ATTEMPT_PHASES.INCONCLUSIVE) {
      publish({
        phase: phaseForRecognitionIssue(childSnapshot.issue),
        issue: childSnapshot.issue,
        result: childSnapshot.result,
      });
    } else if (childSnapshot.phase === RECOGNITION_ATTEMPT_PHASES.IDLE && childSnapshot.terminal) {
      publish({ phase: restingPhase(capability), issue: null, result: null });
    }
  }

  function handlePlaybackState(childSnapshot) {
    if (disposed || snapshot.phase === SPEAKING_PRACTICE_PHASES.CANCELLING) return;
    const target = currentTarget();
    if (!target || childSnapshot.targetId !== target.id) return;
    publish({ playback: childSnapshot });
  }

  recognition = createRecognitionController({
    createAdapter({ onEvent }) {
      return createRecognitionAdapter({ browserWindow, onEvent });
    },
    scheduleTimeout,
    cancelTimeout,
    onStateChange: handleRecognitionState,
  });

  playback = createPlaybackCoordinator({
    ...(createAudio === undefined ? {} : { createAudio }),
    speechSynthesis,
    ...(createUtterance === undefined ? {} : { createUtterance }),
    getRecognitionPhase: () => recognition.getSnapshot().phase,
    cancelRecognition: (reason) => recognition.cancel(reason),
    onStateChange: handlePlaybackState,
  });

  publish();

  function beginLoad({ setId = null } = {}) {
    if (disposed) return operationFailure(SPEAKING_PRACTICE_ISSUES.DISPOSED);
    if (!(setId === null || (typeof setId === "string" && setId.length > 0))) {
      return operationFailure(SPEAKING_PRACTICE_ISSUES.INVALID_LEARNING_SET);
    }
    const transitionGeneration = beginCancellation("LOAD_RESET");
    if (!transitionGeneration || !cancelChildren(transitionGeneration)) return operationFailure();
    learningSet = null;
    pendingSetId = setId;
    targetIndex = null;
    disclosureAcknowledged = false;
    capability = safeCapability(getCapability, browserWindow);
    publish({ phase: SPEAKING_PRACTICE_PHASES.LOADING, issue: null, result: null });
    return operationSuccess(generation);
  }

  function acceptLearningSet(value, { loadGeneration = generation } = {}) {
    if (disposed) return operationFailure(SPEAKING_PRACTICE_ISSUES.DISPOSED);
    const normalized = normalizeLearningSet(value);
    if (!normalized || loadGeneration !== generation
      || snapshot.phase !== SPEAKING_PRACTICE_PHASES.LOADING
      || (pendingSetId !== null && normalized.id !== pendingSetId)) {
      return operationFailure(SPEAKING_PRACTICE_ISSUES.INVALID_LEARNING_SET);
    }

    const transitionGeneration = beginCancellation("LOAD_REPLACED");
    if (!transitionGeneration || !cancelChildren(transitionGeneration)) return operationFailure();
    learningSet = normalized;
    pendingSetId = null;
    disclosureAcknowledged = false;
    capability = safeCapability(getCapability, browserWindow);

    if (normalized.cards.length === 0) {
      targetIndex = null;
      publish({ phase: SPEAKING_PRACTICE_PHASES.EMPTY, issue: SPEAKING_PRACTICE_ISSUES.EMPTY, result: null });
      return operationSuccess();
    }

    targetIndex = 0;
    const target = currentTarget();
    const owner = createOwner(generation, learningSet.id, target.id);
    playback.replaceTarget(target.id);
    if (!ownsAggregate(owner) || currentTarget() !== target) return operationFailure();
    publish({ phase: restingPhase(capability), issue: capability.issue, result: null });
    return operationSuccess();
  }

  function rejectLoad(issue, { loadGeneration = generation } = {}) {
    if (disposed) return operationFailure(SPEAKING_PRACTICE_ISSUES.DISPOSED);
    if (loadGeneration !== generation || snapshot.phase !== SPEAKING_PRACTICE_PHASES.LOADING) {
      return operationFailure(SPEAKING_PRACTICE_ISSUES.INVALID_LEARNING_SET);
    }
    const transitionGeneration = beginCancellation("LOAD_REJECTED");
    if (!transitionGeneration || !cancelChildren(transitionGeneration)) return operationFailure();
    learningSet = null;
    pendingSetId = null;
    targetIndex = null;
    const phase = issue === "LEARNING_SET_EMPTY" || issue === SPEAKING_PRACTICE_ISSUES.EMPTY
      ? SPEAKING_PRACTICE_PHASES.EMPTY
      : isInaccessibleIssue(issue)
        ? SPEAKING_PRACTICE_PHASES.INACCESSIBLE
        : SPEAKING_PRACTICE_PHASES.RECOVERABLE_ERROR;
    publish({ phase, issue: issue || "LEARNING_REQUEST_FAILED", result: null });
    return operationSuccess();
  }

  function requestSpeak() {
    if (disposed) return operationFailure(SPEAKING_PRACTICE_ISSUES.DISPOSED);
    if (!canStartFrom(snapshot.phase) || !currentTarget() || !capability.supported) {
      return operationFailure(SPEAKING_PRACTICE_ISSUES.ILLEGAL_TRANSITION);
    }
    if (!disclosureAcknowledged) {
      publish({
        phase: SPEAKING_PRACTICE_PHASES.DISCLOSURE,
        issue: SPEAKING_PRACTICE_ISSUES.DISCLOSURE_REQUIRED,
        result: null,
      });
      return operationFailure(SPEAKING_PRACTICE_ISSUES.DISCLOSURE_REQUIRED);
    }
    return startRecognition();
  }

  function confirmDisclosureAndStart() {
    if (disposed) return operationFailure(SPEAKING_PRACTICE_ISSUES.DISPOSED);
    if (snapshot.phase !== SPEAKING_PRACTICE_PHASES.DISCLOSURE || !currentTarget()) {
      return operationFailure(SPEAKING_PRACTICE_ISSUES.ILLEGAL_TRANSITION);
    }
    disclosureAcknowledged = true;
    return startRecognition();
  }

  function startRecognition() {
    const target = currentTarget();
    if (!target || !capability.supported || ACTIVE_PHASES.has(snapshot.phase)
      || snapshot.phase === SPEAKING_PRACTICE_PHASES.CANCELLING) {
      return operationFailure(SPEAKING_PRACTICE_ISSUES.ILLEGAL_TRANSITION);
    }

    generation += 1;
    const owner = createOwner(generation, learningSet.id, target.id);
    publish({ phase: SPEAKING_PRACTICE_PHASES.STARTING, issue: null, result: null });
    if (!ownsAggregate(owner)) return operationFailure();

    const operation = playback.prepareForRecognition({
      targetId: target.id,
      startRecognition: () => {
        if (!ownsAggregate(owner)) return operationFailure();
        return recognition.startAttempt({
          setId: learningSet.id,
          vocabularyId: target.id,
          target: target.word,
        });
      },
    });

    if (!operation?.ok && ownsAggregate(owner) && snapshot.phase === SPEAKING_PRACTICE_PHASES.STARTING) {
      const issue = operation?.issue || "START_FAILED";
      publish({ phase: phaseForRecognitionIssue(issue), issue, result: null });
    }
    return operation?.ok ? operationSuccess() : operationFailure(operation?.issue);
  }

  function stopSpeaking() {
    if (disposed) return operationFailure(SPEAKING_PRACTICE_ISSUES.DISPOSED);
    if (snapshot.phase !== SPEAKING_PRACTICE_PHASES.LISTENING) {
      return operationFailure(SPEAKING_PRACTICE_ISSUES.ILLEGAL_TRANSITION);
    }
    const operation = recognition.stop();
    return operation?.ok ? operationSuccess() : operationFailure(operation?.issue);
  }

  function retry() {
    if (disposed) return operationFailure(SPEAKING_PRACTICE_ISSUES.DISPOSED);
    if (!RETRY_PHASES.has(snapshot.phase) || !currentTarget() || !capability.supported) {
      return operationFailure(SPEAKING_PRACTICE_ISSUES.ILLEGAL_TRANSITION);
    }
    return startRecognition();
  }

  function listen() {
    if (disposed) return operationFailure(SPEAKING_PRACTICE_ISSUES.DISPOSED);
    const target = currentTarget();
    if (!target || !snapshot.controls.canListen) {
      return operationFailure(ACTIVE_PHASES.has(snapshot.phase)
        ? "RECOGNITION_ACTIVE"
        : SPEAKING_PRACTICE_ISSUES.ILLEGAL_TRANSITION);
    }
    const operation = playback.listen({
      targetId: target.id,
      text: target.word,
      audioUrl: target.pronunciation_url,
    });
    return operation?.ok ? operationSuccess() : operationFailure(operation?.issue);
  }

  function replaceTarget(nextIndex) {
    if (disposed) return operationFailure(SPEAKING_PRACTICE_ISSUES.DISPOSED);
    if (!Number.isSafeInteger(nextIndex) || nextIndex < 0
      || nextIndex >= (learningSet?.cards.length ?? 0)) {
      return operationFailure(SPEAKING_PRACTICE_ISSUES.INVALID_TARGET);
    }
    generation += 1;
    const transitionGeneration = generation;
    publish({ phase: SPEAKING_PRACTICE_PHASES.CANCELLING, issue: null, result: null });
    if (disposed || generation !== transitionGeneration) return operationFailure();
    recognition.cancel("TARGET_CHANGED");
    if (disposed || generation !== transitionGeneration) return operationFailure();
    targetIndex = nextIndex;
    const target = currentTarget();
    const owner = createOwner(generation, learningSet.id, target.id);
    playback.replaceTarget(target.id);
    if (!ownsAggregate(owner) || currentTarget() !== target) return operationFailure();
    publish({ phase: restingPhase(capability), issue: capability.issue, result: null });
    return operationSuccess();
  }

  function cancel(reason = "CANCELLED") {
    if (disposed) return operationSuccess();
    const cancellationGeneration = beginCancellation(reason);
    if (!cancellationGeneration || !cancelChildren(cancellationGeneration, reason)) {
      return operationSuccess();
    }
    const phase = currentTarget() ? restingPhase(capability) : SPEAKING_PRACTICE_PHASES.LOADING;
    publish({ phase, issue: capability.issue, result: null });
    return operationSuccess();
  }

  function dispose() {
    if (disposed) return operationSuccess();
    generation += 1;
    disposed = true;
    snapshot = createSnapshot({
      ...snapshot,
      generation,
      phase: SPEAKING_PRACTICE_PHASES.CANCELLING,
      issue: SPEAKING_PRACTICE_ISSUES.DISPOSED,
      result: null,
      disposed: true,
    });
    recognition.dispose();
    playback.dispose();
    snapshot = createSnapshot({
      ...snapshot,
      recognition: recognition.getSnapshot(),
      playback: playback.getSnapshot(),
    });
    onStateChange(snapshot);
    return operationSuccess();
  }

  function beginCancellation(reason) {
    generation += 1;
    const expectedGeneration = generation;
    publish({ phase: SPEAKING_PRACTICE_PHASES.CANCELLING, issue: reason, result: null });
    return !disposed && generation === expectedGeneration ? expectedGeneration : null;
  }

  function cancelChildren(expectedGeneration, reason = "CONTEXT_CHANGED") {
    recognition.cancel(reason);
    if (disposed || generation !== expectedGeneration) return false;
    playback.cancel();
    return !disposed && generation === expectedGeneration;
  }

  function ownsAggregate(owner) {
    const target = currentTarget();
    return !disposed
      && owner.generation === generation
      && owner.setId === learningSet?.id
      && owner.vocabularyId === target?.id;
  }

  return Object.freeze({
    beginLoad,
    acceptLearningSet,
    rejectLoad,
    requestSpeak,
    confirmDisclosureAndStart,
    stopSpeaking,
    retry,
    listen,
    replaceTarget,
    cancel,
    dispose,
    getSnapshot: () => snapshot,
  });
}

function normalizeLearningSet(value) {
  if (!isRecord(value) || value.mode !== "NORMAL" || typeof value.id !== "string"
    || typeof value.name !== "string" || !Number.isSafeInteger(value.total_items)
    || value.total_items < 0 || !Array.isArray(value.cards)
    || value.cards.length !== value.total_items) return null;

  const ids = new Set();
  const cards = [];
  for (const card of value.cards) {
    if (!isRecord(card) || typeof card.id !== "string" || card.id.length === 0
      || ids.has(card.id) || typeof card.word !== "string" || card.word.trim().length === 0
      || !Number.isSafeInteger(card.position) || card.position < 0
      || !(card.phonetic == null || typeof card.phonetic === "string")
      || !(card.pronunciation_url == null || typeof card.pronunciation_url === "string")) {
      return null;
    }
    ids.add(card.id);
    cards.push(Object.freeze({
      id: card.id,
      word: card.word,
      position: card.position,
      phonetic: card.phonetic ?? null,
      pronunciation_url: card.pronunciation_url ?? null,
    }));
  }

  return Object.freeze({
    id: value.id,
    name: value.name,
    total_items: value.total_items,
    cards: Object.freeze(cards),
  });
}

function safeCapability(getCapability, browserWindow) {
  try {
    const capability = getCapability(browserWindow);
    if (capability?.supported) return Object.freeze({ supported: true, issue: null });
    return Object.freeze({
      supported: false,
      issue: capability?.issue || SPEECH_RECOGNITION_ISSUES.UNSUPPORTED,
    });
  } catch {
    return Object.freeze({ supported: false, issue: SPEECH_RECOGNITION_ISSUES.UNSUPPORTED });
  }
}

function restingPhase(capability) {
  if (capability.issue === SPEECH_RECOGNITION_ISSUES.INSECURE_CONTEXT) {
    return SPEAKING_PRACTICE_PHASES.INSECURE_CONTEXT;
  }
  if (!capability.supported) return SPEAKING_PRACTICE_PHASES.UNSUPPORTED;
  return SPEAKING_PRACTICE_PHASES.READY;
}

function phaseForRecognitionIssue(issue) {
  return INCONCLUSIVE_ISSUES.has(issue)
    ? SPEAKING_PRACTICE_PHASES.INCONCLUSIVE
    : SPEAKING_PRACTICE_PHASES.RECOVERABLE_ERROR;
}

function canStartFrom(phase) {
  return phase === SPEAKING_PRACTICE_PHASES.READY
    || RETRY_PHASES.has(phase);
}

function isInaccessibleIssue(issue) {
  return issue === SPEAKING_PRACTICE_ISSUES.INACCESSIBLE
    || issue === "LEARNING_SET_NOT_FOUND"
    || issue === "UNAUTHENTICATED"
    || issue === "FORBIDDEN";
}

function createSetSummary(value) {
  return Object.freeze({ id: value.id, name: value.name, totalItems: value.total_items });
}

function createOwner(generation, setId, vocabularyId) {
  return Object.freeze({ generation, setId, vocabularyId });
}

function createSnapshot({
  generation,
  phase,
  issue = null,
  set = null,
  targets = [],
  targetIndex = null,
  target = null,
  disclosureAcknowledged = false,
  result = null,
  recognition = null,
  playback = null,
  capability = Object.freeze({ supported: false, issue: SPEECH_RECOGNITION_ISSUES.UNSUPPORTED }),
  disposed = false,
}) {
  return Object.freeze({
    generation,
    phase,
    issue,
    set,
    targets,
    targetIndex,
    target,
    disclosureAcknowledged,
    result,
    recognition,
    playback,
    capability,
    controls: deriveControls({ phase, target, capability, disposed }),
    disposed,
  });
}

function deriveControls({ phase, target, capability, disposed }) {
  const hasTarget = Boolean(target);
  const terminal = RETRY_PHASES.has(phase);
  const resting = phase === SPEAKING_PRACTICE_PHASES.READY
    || phase === SPEAKING_PRACTICE_PHASES.DISCLOSURE
    || phase === SPEAKING_PRACTICE_PHASES.UNSUPPORTED
    || phase === SPEAKING_PRACTICE_PHASES.INSECURE_CONTEXT
    || terminal;
  return Object.freeze({
    canListen: !disposed && hasTarget && resting,
    canSpeak: !disposed && hasTarget && capability.supported
      && (phase === SPEAKING_PRACTICE_PHASES.READY || terminal),
    canConfirmDisclosure: !disposed && phase === SPEAKING_PRACTICE_PHASES.DISCLOSURE,
    canStop: !disposed && phase === SPEAKING_PRACTICE_PHASES.LISTENING,
    canRetry: !disposed && hasTarget && capability.supported && terminal,
    canChangeTarget: !disposed && hasTarget && resting,
    canExit: !disposed,
  });
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function operationSuccess(generation = null) {
  return Object.freeze({ ok: true, issue: null, generation });
}

function operationFailure(issue = null) {
  return Object.freeze({ ok: false, issue, generation: null });
}
