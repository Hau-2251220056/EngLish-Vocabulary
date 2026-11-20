const MAX_ALTERNATIVES = 5;

export const SPEECH_RECOGNITION_ISSUES = Object.freeze({
  UNSUPPORTED: "UNSUPPORTED",
  INSECURE_CONTEXT: "INSECURE_CONTEXT",
  PERMISSION_DENIED: "PERMISSION_DENIED",
  SERVICE_NOT_ALLOWED: "SERVICE_NOT_ALLOWED",
  NO_SPEECH: "NO_SPEECH",
  AUDIO_CAPTURE_FAILED: "AUDIO_CAPTURE_FAILED",
  NETWORK_ERROR: "NETWORK_ERROR",
  ABORTED: "ABORTED",
  START_FAILED: "START_FAILED",
  RECOGNITION_ERROR: "RECOGNITION_ERROR",
});

export const SPEECH_RECOGNITION_EVENT_TYPES = Object.freeze({
  START: "start",
  RESULT: "result",
  ERROR: "error",
  END: "end",
});

const NATIVE_ERROR_ISSUES = Object.freeze({
  "not-allowed": SPEECH_RECOGNITION_ISSUES.PERMISSION_DENIED,
  "service-not-allowed": SPEECH_RECOGNITION_ISSUES.SERVICE_NOT_ALLOWED,
  "no-speech": SPEECH_RECOGNITION_ISSUES.NO_SPEECH,
  "audio-capture": SPEECH_RECOGNITION_ISSUES.AUDIO_CAPTURE_FAILED,
  network: SPEECH_RECOGNITION_ISSUES.NETWORK_ERROR,
  aborted: SPEECH_RECOGNITION_ISSUES.ABORTED,
});

export function getSpeechRecognitionCapability(browserWindow = globalThis.window) {
  if (!browserWindow) {
    return unsupportedCapability(SPEECH_RECOGNITION_ISSUES.UNSUPPORTED);
  }

  if (browserWindow.isSecureContext === false) {
    return unsupportedCapability(SPEECH_RECOGNITION_ISSUES.INSECURE_CONTEXT);
  }

  const RecognitionConstructor = browserWindow.SpeechRecognition
    || browserWindow.webkitSpeechRecognition
    || null;

  if (typeof RecognitionConstructor !== "function") {
    return unsupportedCapability(SPEECH_RECOGNITION_ISSUES.UNSUPPORTED);
  }

  return Object.freeze({
    supported: true,
    issue: null,
    RecognitionConstructor,
  });
}

export function mapSpeechRecognitionError(nativeError) {
  return NATIVE_ERROR_ISSUES[nativeError]
    || SPEECH_RECOGNITION_ISSUES.RECOGNITION_ERROR;
}

export function extractFinalRecognitionResult(event) {
  const results = event?.results;
  const resultCount = safeLength(results);
  const startIndex = Number.isInteger(event?.resultIndex) && event.resultIndex >= 0
    ? Math.min(event.resultIndex, resultCount)
    : 0;

  for (let resultIndex = startIndex; resultIndex < resultCount; resultIndex += 1) {
    const result = safeItem(results, resultIndex);
    if (!result || result.isFinal !== true) continue;

    const alternativeCount = Math.min(safeLength(result), MAX_ALTERNATIVES);
    const alternatives = [];

    for (let alternativeIndex = 0; alternativeIndex < alternativeCount; alternativeIndex += 1) {
      const alternative = safeItem(result, alternativeIndex);
      alternatives.push({
        transcript: typeof alternative?.transcript === "string"
          ? alternative.transcript
          : null,
        confidence: typeof alternative?.confidence === "number"
          ? alternative.confidence
          : null,
      });
    }

    return {
      alternatives,
      usable: typeof alternatives[0]?.transcript === "string"
        && alternatives[0].transcript.trim().length > 0,
    };
  }

  return { alternatives: [], usable: false };
}

export function createSpeechRecognitionAdapter({
  browserWindow = globalThis.window,
  onEvent = () => {},
} = {}) {
  const capability = getSpeechRecognitionCapability(browserWindow);
  let recognition = null;
  let availabilityIssue = capability.issue;
  let started = false;
  let active = false;
  let stopped = false;
  let aborted = false;
  let disposed = false;

  if (capability.supported) {
    try {
      recognition = new capability.RecognitionConstructor();
      recognition.lang = "en-US";
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = MAX_ALTERNATIVES;
      attachHandlers();
    } catch {
      recognition = null;
      availabilityIssue = SPEECH_RECOGNITION_ISSUES.RECOGNITION_ERROR;
    }
  }

  function emit(event) {
    if (!disposed) onEvent(event);
  }

  function attachHandlers() {
    recognition.onstart = () => {
      if (disposed || aborted) return;
      active = true;
      emit({ type: SPEECH_RECOGNITION_EVENT_TYPES.START });
    };

    recognition.onresult = (event) => {
      if (disposed || aborted) return;
      emit({
        type: SPEECH_RECOGNITION_EVENT_TYPES.RESULT,
        ...extractFinalRecognitionResult(event),
      });
    };

    recognition.onerror = (event) => {
      if (disposed) return;
      active = false;
      emit({
        type: SPEECH_RECOGNITION_EVENT_TYPES.ERROR,
        issue: mapSpeechRecognitionError(event?.error),
      });
    };

    recognition.onend = () => {
      if (disposed) return;
      active = false;
      emit({ type: SPEECH_RECOGNITION_EVENT_TYPES.END });
    };
  }

  function start() {
    if (disposed || !recognition || started) {
      return operationFailure(availabilityIssue);
    }

    started = true;
    active = true;
    try {
      recognition.start();
      return operationSuccess();
    } catch {
      active = false;
      const issue = SPEECH_RECOGNITION_ISSUES.START_FAILED;
      emit({ type: SPEECH_RECOGNITION_EVENT_TYPES.ERROR, issue });
      return operationFailure(issue);
    }
  }

  function stop() {
    if (disposed || !recognition || !started || !active || stopped || aborted) {
      return operationFailure();
    }

    stopped = true;
    try {
      recognition.stop();
      return operationSuccess();
    } catch {
      const issue = SPEECH_RECOGNITION_ISSUES.RECOGNITION_ERROR;
      emit({ type: SPEECH_RECOGNITION_EVENT_TYPES.ERROR, issue });
      return operationFailure(issue);
    }
  }

  function abort() {
    if (disposed || !recognition || !started || !active || aborted) {
      return operationFailure();
    }

    aborted = true;
    active = false;
    try {
      recognition.abort();
      return operationSuccess();
    } catch {
      const issue = SPEECH_RECOGNITION_ISSUES.RECOGNITION_ERROR;
      emit({ type: SPEECH_RECOGNITION_EVENT_TYPES.ERROR, issue });
      return operationFailure(issue);
    }
  }

  function dispose() {
    if (disposed) return operationSuccess();

    disposed = true;
    detachHandlers(recognition);
    if (recognition && started && active && !aborted) {
      aborted = true;
      active = false;
      try {
        recognition.abort();
      } catch {
        // Disposal is terminal; native cleanup failures must not escape or emit.
      }
    }
    recognition = null;
    return operationSuccess();
  }

  return Object.freeze({
    supported: recognition !== null,
    issue: recognition ? null : availabilityIssue,
    start,
    stop,
    abort,
    dispose,
  });
}

function unsupportedCapability(issue) {
  return Object.freeze({
    supported: false,
    issue,
    RecognitionConstructor: null,
  });
}

function safeLength(value) {
  try {
    return Number.isInteger(value?.length) && value.length > 0 ? value.length : 0;
  } catch {
    return 0;
  }
}

function safeItem(collection, index) {
  try {
    return collection?.[index] ?? collection?.item?.(index) ?? null;
  } catch {
    return null;
  }
}

function detachHandlers(recognition) {
  if (!recognition) return;
  recognition.onstart = null;
  recognition.onresult = null;
  recognition.onerror = null;
  recognition.onend = null;
}

function operationSuccess() {
  return Object.freeze({ ok: true, issue: null });
}

function operationFailure(issue = null) {
  return Object.freeze({ ok: false, issue });
}
