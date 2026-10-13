import {
  classifyRecognition,
  RECOGNITION_OUTCOMES,
} from "./recognition-classifier.js";

const STARTUP_TIMEOUT_MS = 5_000;
const FINALIZATION_TIMEOUT_MS = 4_000;

export const RECOGNITION_ATTEMPT_PHASES = Object.freeze({
  IDLE: "IDLE",
  STARTING: "STARTING",
  LISTENING: "LISTENING",
  FINALIZING: "FINALIZING",
  RESULT: "RESULT",
  INCONCLUSIVE: "INCONCLUSIVE",
  CANCELLED: "CANCELLED",
  DISPOSED: "DISPOSED",
});

export function createRecognitionAttemptController({
  createAdapter,
  classify = classifyRecognition,
  scheduleTimeout = globalThis.setTimeout,
  cancelTimeout = globalThis.clearTimeout,
  onStateChange = () => {},
} = {}) {
  if (typeof createAdapter !== "function") {
    throw new TypeError("createAdapter must be a function");
  }

  let nextAttemptToken = 0;
  let generation = 0;
  let currentAttempt = null;
  let disposed = false;
  let snapshot = createSnapshot({ phase: RECOGNITION_ATTEMPT_PHASES.IDLE });

  function publish(attempt, changes = {}) {
    snapshot = createSnapshot({
      attemptToken: attempt?.token ?? null,
      generation: attempt?.generation ?? generation,
      setId: attempt?.setId ?? null,
      vocabularyId: attempt?.vocabularyId ?? null,
      phase: attempt?.phase ?? snapshot.phase,
      terminal: attempt?.terminal ?? false,
      result: attempt?.result ?? null,
      issue: attempt?.issue ?? null,
      ...changes,
    });
    onStateChange(snapshot);
  }

  function owns(attempt) {
    return !disposed
      && currentAttempt === attempt
      && !attempt.invalidated
      && attempt.token === snapshot.attemptToken
      && attempt.generation === generation
      && attempt.setId === snapshot.setId
      && attempt.vocabularyId === snapshot.vocabularyId;
  }

  function clearWatchdogs(attempt) {
    if (attempt.startupTimer !== null) {
      cancelTimeout(attempt.startupTimer);
      attempt.startupTimer = null;
    }
    if (attempt.finalizationTimer !== null) {
      cancelTimeout(attempt.finalizationTimer);
      attempt.finalizationTimer = null;
    }
  }

  function settle(attempt, result) {
    if (!owns(attempt) || attempt.terminal) return false;

    attempt.terminal = true;
    attempt.result = result;
    attempt.issue = result.issue ?? null;
    attempt.phase = result.classification === RECOGNITION_OUTCOMES.INCONCLUSIVE
      ? RECOGNITION_ATTEMPT_PHASES.INCONCLUSIVE
      : RECOGNITION_ATTEMPT_PHASES.RESULT;
    clearWatchdogs(attempt);
    publish(attempt);
    attempt.adapter.dispose();
    return true;
  }

  function settleInconclusive(attempt, issue) {
    return settle(attempt, Object.freeze({
      classification: RECOGNITION_OUTCOMES.INCONCLUSIVE,
      issue,
      target: attempt.target,
      normalizedTarget: "",
      primaryTranscript: null,
      matchedAlternativeIndex: null,
      alternatives: [],
    }));
  }

  function settleStoppedWithoutResult(attempt) {
    if (!owns(attempt) || attempt.terminal) return false;

    attempt.terminal = true;
    attempt.result = null;
    attempt.issue = null;
    attempt.phase = RECOGNITION_ATTEMPT_PHASES.IDLE;
    clearWatchdogs(attempt);
    publish(attempt);
    attempt.adapter.dispose();
    return true;
  }

  function handleEvent(attempt, event) {
    if (!owns(attempt) || attempt.terminal || !event) return;

    if (event.type === "start") {
      if (attempt.phase !== RECOGNITION_ATTEMPT_PHASES.STARTING) return;
      if (attempt.startupTimer !== null) {
        cancelTimeout(attempt.startupTimer);
        attempt.startupTimer = null;
      }
      attempt.phase = RECOGNITION_ATTEMPT_PHASES.LISTENING;
      publish(attempt);
      return;
    }

    if (event.type === "result") {
      if (!Array.isArray(event.alternatives) || event.alternatives.length === 0) return;
      let result;
      try {
        result = classify({ target: attempt.target, alternatives: event.alternatives });
      } catch {
        settleInconclusive(attempt, "RECOGNITION_ERROR");
        return;
      }
      settle(attempt, result);
      return;
    }

    if (event.type === "error") {
      settleInconclusive(attempt, event.issue || "RECOGNITION_ERROR");
      return;
    }

    if (event.type === "end") {
      if (attempt.phase === RECOGNITION_ATTEMPT_PHASES.FINALIZING) {
        settleStoppedWithoutResult(attempt);
      } else {
        settleInconclusive(attempt, "NO_RESULT");
      }
    }
  }

  function invalidateCurrent({ phase, issue, publishState = true } = {}) {
    const attempt = currentAttempt;
    if (!attempt) return false;

    attempt.invalidated = true;
    attempt.terminal = true;
    clearWatchdogs(attempt);
    currentAttempt = null;
    generation += 1;

    if (publishState) {
      attempt.phase = phase;
      attempt.issue = issue;
      attempt.result = null;
      publish(attempt, { generation });
    }

    attempt.adapter.abort();
    attempt.adapter.dispose();
    return true;
  }

  function startAttempt({ setId, vocabularyId, target } = {}) {
    if (disposed) return operationFailure("DISPOSED");
    if (setId === undefined || vocabularyId === undefined || typeof target !== "string") {
      return operationFailure("INVALID_ATTEMPT");
    }

    invalidateCurrent({ publishState: false });
    generation += 1;

    const attempt = {
      token: ++nextAttemptToken,
      generation,
      setId,
      vocabularyId,
      target,
      phase: RECOGNITION_ATTEMPT_PHASES.STARTING,
      terminal: false,
      invalidated: false,
      result: null,
      issue: null,
      startupTimer: null,
      finalizationTimer: null,
      adapter: null,
    };

    attempt.adapter = createAdapter({
      onEvent: (event) => handleEvent(attempt, event),
    });
    currentAttempt = attempt;
    publish(attempt);

    const startResult = attempt.adapter.start();
    if (!startResult?.ok) {
      const issue = startResult?.issue || "START_FAILED";
      if (owns(attempt) && !attempt.terminal) settleInconclusive(attempt, issue);
      return operationFailure(issue, attempt.token);
    }

    if (!owns(attempt) || attempt.terminal) return operationSuccess(attempt.token);

    if (attempt.phase === RECOGNITION_ATTEMPT_PHASES.STARTING) {
      attempt.startupTimer = scheduleTimeout(() => {
        if (!owns(attempt) || attempt.terminal) return;
        settleInconclusive(attempt, "START_TIMEOUT");
      }, STARTUP_TIMEOUT_MS);
    }

    return operationSuccess(attempt.token);
  }

  function stop() {
    const attempt = currentAttempt;
    if (!attempt || !owns(attempt) || attempt.terminal
      || attempt.phase !== RECOGNITION_ATTEMPT_PHASES.LISTENING) {
      return operationFailure();
    }

    attempt.phase = RECOGNITION_ATTEMPT_PHASES.FINALIZING;
    publish(attempt);
    const stopResult = attempt.adapter.stop();
    if (!stopResult?.ok) {
      const issue = stopResult?.issue || "RECOGNITION_ERROR";
      if (owns(attempt) && !attempt.terminal) settleInconclusive(attempt, issue);
      return operationFailure(issue, attempt.token);
    }

    if (!owns(attempt) || attempt.terminal) return operationSuccess(attempt.token);

    if (attempt.phase === RECOGNITION_ATTEMPT_PHASES.FINALIZING) {
      attempt.finalizationTimer = scheduleTimeout(() => {
        if (!owns(attempt) || attempt.terminal) return;
        settleStoppedWithoutResult(attempt);
      }, FINALIZATION_TIMEOUT_MS);
    }

    return operationSuccess(attempt.token);
  }

  function cancel(reason = "CANCELLED") {
    if (disposed) return operationFailure("DISPOSED");
    const cancelled = invalidateCurrent({
      phase: RECOGNITION_ATTEMPT_PHASES.CANCELLED,
      issue: reason,
    });
    return cancelled ? operationSuccess() : operationFailure();
  }

  function dispose() {
    if (disposed) return operationSuccess();
    invalidateCurrent({
      phase: RECOGNITION_ATTEMPT_PHASES.DISPOSED,
      issue: "DISPOSED",
    });
    disposed = true;
    if (!currentAttempt && snapshot.phase !== RECOGNITION_ATTEMPT_PHASES.DISPOSED) {
      snapshot = createSnapshot({
        phase: RECOGNITION_ATTEMPT_PHASES.DISPOSED,
        generation,
        terminal: true,
        issue: "DISPOSED",
      });
      onStateChange(snapshot);
    }
    return operationSuccess();
  }

  return Object.freeze({
    startAttempt,
    stop,
    cancel,
    dispose,
    getSnapshot: () => snapshot,
  });
}

function createSnapshot({
  attemptToken = null,
  generation = 0,
  setId = null,
  vocabularyId = null,
  phase,
  terminal = false,
  result = null,
  issue = null,
}) {
  return Object.freeze({
    attemptToken,
    generation,
    setId,
    vocabularyId,
    phase,
    terminal,
    result,
    issue,
  });
}

function operationSuccess(attemptToken = null) {
  return Object.freeze({ ok: true, issue: null, attemptToken });
}

function operationFailure(issue = null, attemptToken = null) {
  return Object.freeze({ ok: false, issue, attemptToken });
}
