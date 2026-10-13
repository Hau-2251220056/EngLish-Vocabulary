import { selectEnglishSpeechVoice } from "../learning/learning-presentation.js";

const RECOGNITION_ACTIVE_PHASES = new Set(["STARTING", "LISTENING", "FINALIZING"]);

export const REFERENCE_PLAYBACK_PHASES = Object.freeze({
  IDLE: "IDLE",
  LOADING_AUDIO: "LOADING_AUDIO",
  PLAYING_AUDIO: "PLAYING_AUDIO",
  SPEAKING_TTS: "SPEAKING_TTS",
  ERROR: "ERROR",
  DISPOSED: "DISPOSED",
});

export const REFERENCE_PLAYBACK_ISSUES = Object.freeze({
  RECOGNITION_ACTIVE: "RECOGNITION_ACTIVE",
  INVALID_TARGET: "INVALID_TARGET",
  NO_PLAYBACK_AVAILABLE: "NO_PLAYBACK_AVAILABLE",
  PLAYBACK_FAILED: "PLAYBACK_FAILED",
  DISPOSED: "DISPOSED",
});

export function createReferencePlaybackCoordinator({
  createAudio = defaultCreateAudio,
  speechSynthesis = globalThis.window?.speechSynthesis ?? null,
  createUtterance = defaultCreateUtterance,
  getRecognitionPhase = () => "IDLE",
  cancelRecognition = () => {},
  onStateChange = () => {},
} = {}) {
  let generation = 0;
  let currentTargetId = null;
  let currentAudio = null;
  let currentUtterance = null;
  let speechCancellationInProgress = false;
  let disposed = false;
  let snapshot = createSnapshot({ generation });

  function publish(changes) {
    snapshot = createSnapshot({
      generation,
      targetId: currentTargetId,
      ...changes,
    });
    onStateChange(snapshot);
  }

  function owns(owner) {
    return !disposed
      && owner.generation === generation
      && owner.targetId === currentTargetId;
  }

  function detachAudio(audio) {
    if (!audio) return;
    audio.onended = null;
    audio.onerror = null;
  }

  function detachUtterance(utterance) {
    if (!utterance) return;
    utterance.onend = null;
    utterance.onerror = null;
  }

  function stopNativePlayback(expectedGeneration = generation) {
    const audio = currentAudio;
    const utterance = currentUtterance;
    currentAudio = null;
    currentUtterance = null;
    detachAudio(audio);
    detachUtterance(utterance);

    try {
      audio?.pause?.();
    } catch {
      // Cancellation is best effort and native details must not escape.
    }
    if (generation !== expectedGeneration) return false;
    if (!speechCancellationInProgress) {
      speechCancellationInProgress = true;
      try {
        speechSynthesis?.cancel?.();
      } catch {
        // Cancellation is best effort and native details must not escape.
      } finally {
        speechCancellationInProgress = false;
      }
    }
    return generation === expectedGeneration;
  }

  function invalidate({ phase = REFERENCE_PLAYBACK_PHASES.IDLE, issue = null } = {}) {
    generation += 1;
    const invalidationGeneration = generation;
    stopNativePlayback(invalidationGeneration);
    if (disposed || generation !== invalidationGeneration) return null;
    publish({ phase, issue });
    return !disposed && generation === invalidationGeneration
      ? invalidationGeneration
      : null;
  }

  function finish(owner) {
    if (!owns(owner)) return;
    stopNativePlayback(owner.generation);
    if (owns(owner)) publish({ phase: REFERENCE_PLAYBACK_PHASES.IDLE, issue: null });
  }

  function fail(owner, issue) {
    if (!owns(owner)) return;
    stopNativePlayback(owner.generation);
    if (owns(owner)) publish({ phase: REFERENCE_PLAYBACK_PHASES.ERROR, issue });
  }

  function resolveDefensiveRecognitionRace(owner) {
    if (!owns(owner)) return false;
    if (!RECOGNITION_ACTIVE_PHASES.has(getRecognitionPhase())) return owns(owner);
    try {
      cancelRecognition("REFERENCE_PLAYBACK_RACE");
    } catch {
      fail(owner, REFERENCE_PLAYBACK_ISSUES.RECOGNITION_ACTIVE);
      return false;
    }
    if (RECOGNITION_ACTIVE_PHASES.has(getRecognitionPhase())) {
      fail(owner, REFERENCE_PLAYBACK_ISSUES.RECOGNITION_ACTIVE);
      return false;
    }
    return owns(owner);
  }

  function startTts(owner, text) {
    if (!owns(owner)) return operationFailure();
    if (!resolveDefensiveRecognitionRace(owner)) {
      return operationFailure(REFERENCE_PLAYBACK_ISSUES.RECOGNITION_ACTIVE);
    }
    if (!speechSynthesis || typeof speechSynthesis.speak !== "function"
      || typeof createUtterance !== "function") {
      fail(owner, REFERENCE_PLAYBACK_ISSUES.NO_PLAYBACK_AVAILABLE);
      return operationFailure(REFERENCE_PLAYBACK_ISSUES.NO_PLAYBACK_AVAILABLE);
    }

    let utterance;
    let settled = false;
    try {
      utterance = createUtterance(text);
      const voices = typeof speechSynthesis.getVoices === "function"
        ? speechSynthesis.getVoices()
        : [];
      const voice = selectEnglishSpeechVoice(voices);
      utterance.lang = voice?.lang ?? "en-US";
      if (voice) utterance.voice = voice;
      utterance.onend = () => {
        settled = true;
        finish(owner);
      };
      utterance.onerror = () => {
        settled = true;
        fail(owner, REFERENCE_PLAYBACK_ISSUES.PLAYBACK_FAILED);
      };
      if (!owns(owner)) {
        detachUtterance(utterance);
        return operationFailure();
      }
      currentUtterance = utterance;
      if (!resolveDefensiveRecognitionRace(owner)) {
        detachUtterance(utterance);
        if (currentUtterance === utterance) currentUtterance = null;
        return operationFailure(REFERENCE_PLAYBACK_ISSUES.RECOGNITION_ACTIVE);
      }
      if (!owns(owner) || currentUtterance !== utterance) return operationFailure();
      speechSynthesis.speak(utterance);
      if (!settled && owns(owner) && currentUtterance === utterance) {
        publish({ phase: REFERENCE_PLAYBACK_PHASES.SPEAKING_TTS, issue: null });
      }
      return operationSuccess(owner.generation);
    } catch {
      detachUtterance(utterance);
      if (currentUtterance === utterance) currentUtterance = null;
      if (!settled) {
        fail(owner, REFERENCE_PLAYBACK_ISSUES.PLAYBACK_FAILED);
        return operationFailure(REFERENCE_PLAYBACK_ISSUES.PLAYBACK_FAILED);
      }
      return operationSuccess(owner.generation);
    }
  }

  function startAudio(owner, audioUrl, text) {
    let audio;
    let fallbackStarted = false;

    function fallback() {
      if (!owns(owner) || fallbackStarted || (audio && currentAudio !== audio)) return;
      fallbackStarted = true;
      detachAudio(audio);
      if (currentAudio === audio) currentAudio = null;
      try {
        audio?.pause?.();
      } catch {
        // Fallback remains available even if native pause fails.
      }
      startTts(owner, text);
    }

    try {
      if (!resolveDefensiveRecognitionRace(owner)) {
        return operationFailure(REFERENCE_PLAYBACK_ISSUES.RECOGNITION_ACTIVE);
      }
      if (typeof createAudio !== "function") return startTts(owner, text);
      audio = createAudio(audioUrl);
      if (!owns(owner)) {
        detachAudio(audio);
        return operationFailure();
      }
      if (!audio || typeof audio.play !== "function") return startTts(owner, text);
      currentAudio = audio;
      audio.onended = () => finish(owner);
      audio.onerror = fallback;
      publish({ phase: REFERENCE_PLAYBACK_PHASES.LOADING_AUDIO, issue: null });

      if (!owns(owner) || currentAudio !== audio) return operationFailure();
      if (!resolveDefensiveRecognitionRace(owner)) {
        return operationFailure(REFERENCE_PLAYBACK_ISSUES.RECOGNITION_ACTIVE);
      }
      if (!owns(owner) || currentAudio !== audio) return operationFailure();
      const playResult = audio.play();
      Promise.resolve(playResult).then(
        () => {
          if (!owns(owner) || currentAudio !== audio) {
            try {
              audio.pause?.();
            } catch {
              // Obsolete playback remains invalid even if native pause fails.
            }
            return;
          }
          publish({ phase: REFERENCE_PLAYBACK_PHASES.PLAYING_AUDIO, issue: null });
        },
        fallback,
      );
      return operationSuccess(owner.generation);
    } catch {
      fallback();
      return owns(owner)
        ? operationSuccess(owner.generation)
        : operationFailure(REFERENCE_PLAYBACK_ISSUES.PLAYBACK_FAILED);
    }
  }

  function listen({ targetId, text, audioUrl = null } = {}) {
    if (disposed) return operationFailure(REFERENCE_PLAYBACK_ISSUES.DISPOSED);
    if (speechCancellationInProgress) return operationFailure();
    if (targetId === undefined || typeof text !== "string" || text.trim().length === 0) {
      return operationFailure(REFERENCE_PLAYBACK_ISSUES.INVALID_TARGET);
    }

    const preflightGeneration = generation;
    const recognitionPhase = getRecognitionPhase();
    if (disposed || generation !== preflightGeneration) return operationFailure();
    if (RECOGNITION_ACTIVE_PHASES.has(recognitionPhase)) {
      return operationFailure(REFERENCE_PLAYBACK_ISSUES.RECOGNITION_ACTIVE);
    }

    generation += 1;
    currentTargetId = targetId;
    const owner = { generation, targetId };
    stopNativePlayback(owner.generation);
    if (!owns(owner)) return operationFailure();
    publish({ phase: REFERENCE_PLAYBACK_PHASES.IDLE, issue: null });
    if (!owns(owner)) return operationFailure();
    return audioUrl ? startAudio(owner, audioUrl, text) : startTts(owner, text);
  }

  function prepareForRecognition({ targetId, startRecognition } = {}) {
    if (disposed) return operationFailure(REFERENCE_PLAYBACK_ISSUES.DISPOSED);
    if (targetId === undefined || targetId !== currentTargetId
      || typeof startRecognition !== "function") {
      return operationFailure(REFERENCE_PLAYBACK_ISSUES.INVALID_TARGET);
    }

    const expectedGeneration = invalidate();
    if (expectedGeneration === null || disposed || targetId !== currentTargetId
      || expectedGeneration !== generation) {
      return operationFailure(REFERENCE_PLAYBACK_ISSUES.INVALID_TARGET);
    }
    try {
      return startRecognition();
    } catch {
      return operationFailure("START_RECOGNITION_FAILED");
    }
  }

  function replaceTarget(targetId) {
    if (disposed) return operationFailure(REFERENCE_PLAYBACK_ISSUES.DISPOSED);
    const expectedGeneration = invalidate();
    if (expectedGeneration === null) return operationFailure();
    currentTargetId = targetId;
    publish({ phase: REFERENCE_PLAYBACK_PHASES.IDLE, issue: null });
    if (disposed || generation !== expectedGeneration) return operationFailure();
    return operationSuccess(generation);
  }

  function cancel() {
    if (disposed) return operationSuccess(generation);
    const expectedGeneration = invalidate();
    return expectedGeneration === null
      ? operationFailure()
      : operationSuccess(expectedGeneration);
  }

  function dispose() {
    if (disposed) return operationSuccess(generation);
    generation += 1;
    disposed = true;
    snapshot = createSnapshot({
      generation,
      targetId: currentTargetId,
      phase: REFERENCE_PLAYBACK_PHASES.DISPOSED,
      issue: null,
    });
    stopNativePlayback(generation);
    onStateChange(snapshot);
    return operationSuccess(generation);
  }

  return Object.freeze({
    listen,
    prepareForRecognition,
    replaceTarget,
    cancel,
    stop: cancel,
    dispose,
    getSnapshot: () => snapshot,
  });
}

function defaultCreateAudio(url) {
  return new globalThis.Audio(url);
}

function defaultCreateUtterance(text) {
  return new globalThis.window.SpeechSynthesisUtterance(text);
}

function createSnapshot({
  generation,
  targetId = null,
  phase = REFERENCE_PLAYBACK_PHASES.IDLE,
  issue = null,
}) {
  return Object.freeze({ generation, targetId, phase, issue });
}

function operationSuccess(generation = null) {
  return Object.freeze({ ok: true, issue: null, generation });
}

function operationFailure(issue = null) {
  return Object.freeze({ ok: false, issue, generation: null });
}
