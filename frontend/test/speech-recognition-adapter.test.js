import assert from "node:assert/strict";
import test from "node:test";
import {
  createSpeechRecognitionAdapter,
  extractFinalRecognitionResult,
  getSpeechRecognitionCapability,
  mapSpeechRecognitionError,
  SPEECH_RECOGNITION_EVENT_TYPES,
  SPEECH_RECOGNITION_ISSUES,
} from "../src/pronunciation/speech-recognition-adapter.js";

function createFakeRecognition({ methodFailures = {} } = {}) {
  const instances = [];

  class FakeRecognition {
    constructor() {
      this.calls = { start: 0, stop: 0, abort: 0 };
      instances.push(this);
    }

    start() {
      this.calls.start += 1;
      if (methodFailures.start) throw new Error("private native start detail");
    }

    stop() {
      this.calls.stop += 1;
      if (methodFailures.stop) throw new Error("private native stop detail");
    }

    abort() {
      this.calls.abort += 1;
      if (methodFailures.abort) throw new Error("private native abort detail");
    }

    emit(type, event = {}) {
      this[`on${type}`]?.(event);
    }
  }

  return { FakeRecognition, instances };
}

function createAdapter(options = {}) {
  const events = [];
  const fake = createFakeRecognition(options);
  const adapter = createSpeechRecognitionAdapter({
    browserWindow: {
      isSecureContext: true,
      SpeechRecognition: fake.FakeRecognition,
    },
    onEvent: (event) => events.push(event),
  });

  return { adapter, events, instance: fake.instances[0], instances: fake.instances };
}

function finalResult(alternatives) {
  const result = alternatives.map((alternative) => alternative);
  result.isFinal = true;
  return { resultIndex: 0, results: [result] };
}

test("capability prefers the standard constructor and supports the prefixed fallback", () => {
  class StandardRecognition {}
  class PrefixedRecognition {}

  const standard = getSpeechRecognitionCapability({
    isSecureContext: true,
    SpeechRecognition: StandardRecognition,
    webkitSpeechRecognition: PrefixedRecognition,
  });
  const prefixed = getSpeechRecognitionCapability({
    isSecureContext: true,
    webkitSpeechRecognition: PrefixedRecognition,
  });

  assert.equal(standard.RecognitionConstructor, StandardRecognition);
  assert.equal(prefixed.RecognitionConstructor, PrefixedRecognition);
});

test("capability safely distinguishes unsupported and insecure contexts", () => {
  assert.deepEqual(getSpeechRecognitionCapability(null), {
    supported: false,
    issue: SPEECH_RECOGNITION_ISSUES.UNSUPPORTED,
    RecognitionConstructor: null,
  });
  assert.equal(getSpeechRecognitionCapability({ isSecureContext: true }).issue, "UNSUPPORTED");
  assert.equal(getSpeechRecognitionCapability({ isSecureContext: false }).issue, "INSECURE_CONTEXT");
});

test("construction creates one configured recognizer and never starts it automatically", () => {
  const { adapter, instance, instances } = createAdapter();

  assert.equal(adapter.supported, true);
  assert.equal(instances.length, 1);
  assert.equal(instance.lang, "en-US");
  assert.equal(instance.continuous, false);
  assert.equal(instance.interimResults, false);
  assert.equal(instance.maxAlternatives, 5);
  assert.equal(instance.calls.start, 0);
});

test("constructor failure is contained without leaking native details", () => {
  class ThrowingRecognition {
    constructor() {
      throw new Error("private constructor detail");
    }
  }

  const adapter = createSpeechRecognitionAdapter({
    browserWindow: { isSecureContext: true, SpeechRecognition: ThrowingRecognition },
  });

  assert.equal(adapter.supported, false);
  assert.equal(adapter.issue, SPEECH_RECOGNITION_ISSUES.RECOGNITION_ERROR);
  assert.deepEqual(adapter.start(), { ok: false, issue: "RECOGNITION_ERROR" });
});

test("start invokes native start once and emits stable start evidence", () => {
  const { adapter, events, instance } = createAdapter();

  assert.deepEqual(adapter.start(), { ok: true, issue: null });
  assert.deepEqual(adapter.start(), { ok: false, issue: null });
  assert.equal(instance.calls.start, 1);
  instance.emit("start");
  assert.deepEqual(events, [{ type: SPEECH_RECOGNITION_EVENT_TYPES.START }]);
});

test("synchronous start failure maps to START_FAILED without leaking its message", () => {
  const { adapter, events } = createAdapter({ methodFailures: { start: true } });

  assert.deepEqual(adapter.start(), { ok: false, issue: "START_FAILED" });
  assert.deepEqual(events, [{ type: "error", issue: "START_FAILED" }]);
  assert.equal(JSON.stringify(events).includes("private"), false);
});

test("intentional stop permits a delayed final result and only calls native stop once", () => {
  const { adapter, events, instance } = createAdapter();
  adapter.start();

  assert.deepEqual(adapter.stop(), { ok: true, issue: null });
  assert.deepEqual(adapter.stop(), { ok: false, issue: null });
  instance.emit("result", finalResult([{ transcript: "teacher", confidence: 0.3 }]));

  assert.equal(instance.calls.stop, 1);
  assert.deepEqual(events, [{
    type: "result",
    alternatives: [{ transcript: "teacher", confidence: 0.3 }],
    usable: true,
  }]);
});

test("abort is guarded, idempotent, and suppresses late match-bearing results", () => {
  const { adapter, events, instance } = createAdapter();
  adapter.start();

  assert.deepEqual(adapter.abort(), { ok: true, issue: null });
  assert.deepEqual(adapter.abort(), { ok: false, issue: null });
  instance.emit("result", finalResult([{ transcript: "teacher", confidence: 1 }]));
  instance.emit("error", { error: "aborted", message: "private" });
  instance.emit("end");

  assert.equal(instance.calls.abort, 1);
  assert.equal(events.some(({ type }) => type === "result"), false);
  assert.deepEqual(events, [
    { type: "error", issue: "ABORTED" },
    { type: "end" },
  ]);
});

test("dispose detaches handlers, aborts an active recognizer once, and stays terminal", () => {
  const { adapter, events, instance } = createAdapter();
  adapter.start();
  const handlers = {
    result: instance.onresult,
    error: instance.onerror,
    end: instance.onend,
  };

  assert.deepEqual(adapter.dispose(), { ok: true, issue: null });
  assert.deepEqual(adapter.dispose(), { ok: true, issue: null });
  assert.equal(instance.calls.abort, 1);
  assert.equal(instance.onstart, null);
  assert.equal(instance.onresult, null);
  assert.equal(instance.onerror, null);
  assert.equal(instance.onend, null);
  handlers.result(finalResult([{ transcript: "late" }]));
  handlers.error({ error: "network" });
  handlers.end();
  assert.deepEqual(events, []);
  assert.deepEqual(adapter.start(), { ok: false, issue: null });
});

test("native errors map to stable issue codes and never expose browser messages", () => {
  const mappings = {
    "not-allowed": "PERMISSION_DENIED",
    "service-not-allowed": "SERVICE_NOT_ALLOWED",
    "no-speech": "NO_SPEECH",
    "audio-capture": "AUDIO_CAPTURE_FAILED",
    network: "NETWORK_ERROR",
    aborted: "ABORTED",
    unknown: "RECOGNITION_ERROR",
  };

  for (const [nativeError, issue] of Object.entries(mappings)) {
    assert.equal(mapSpeechRecognitionError(nativeError), issue);
  }
  assert.equal(mapSpeechRecognitionError(), "RECOGNITION_ERROR");

  const { adapter, events, instance } = createAdapter();
  adapter.start();
  instance.emit("error", { error: "network", message: "browser vendor detail" });
  assert.deepEqual(events, [{ type: "error", issue: "NETWORK_ERROR" }]);
});

test("final result extraction preserves native order, raw primary identity, and numeric confidence", () => {
  const event = finalResult([
    null,
    { transcript: "teacher", confidence: 0.8 },
    { transcript: "picture", confidence: "0.7" },
  ]);

  assert.deepEqual(extractFinalRecognitionResult(event), {
    alternatives: [
      { transcript: null, confidence: null },
      { transcript: "teacher", confidence: 0.8 },
      { transcript: "picture", confidence: null },
    ],
    usable: false,
  });
});

test("result extraction bounds candidates to five without reordering or deduplicating", () => {
  const alternatives = ["one", "one", "three", "four", "five", "six"]
    .map((transcript) => ({ transcript, confidence: 0.5 }));
  const result = extractFinalRecognitionResult(finalResult(alternatives));

  assert.deepEqual(result.alternatives.map(({ transcript }) => transcript), [
    "one", "one", "three", "four", "five",
  ]);
});

test("only the first final result group is selected and result groups are never merged", () => {
  const interim = [{ transcript: "interim" }];
  interim.isFinal = false;
  const firstFinal = [{ transcript: "first" }];
  firstFinal.isFinal = true;
  const secondFinal = [{ transcript: "second" }];
  secondFinal.isFinal = true;

  const extracted = extractFinalRecognitionResult({
    resultIndex: 0,
    results: [interim, firstFinal, secondFinal],
  });
  assert.deepEqual(extracted.alternatives, [{ transcript: "first", confidence: null }]);
});

test("interim-only, missing, and malformed result events are safe unusable results", () => {
  const interim = [{ transcript: "teacher", confidence: 1 }];
  interim.isFinal = false;

  for (const event of [undefined, {}, { results: null }, { results: [interim] }]) {
    assert.deepEqual(extractFinalRecognitionResult(event), {
      alternatives: [],
      usable: false,
    });
  }
});

test("duplicate and reordered native callbacks remain bounded adapter events", () => {
  const { adapter, events, instance } = createAdapter();
  adapter.start();
  instance.emit("result", finalResult([{ transcript: "teacher" }]));
  instance.emit("end");
  instance.emit("end");
  instance.emit("error", { error: "no-speech" });

  assert.deepEqual(events.map(({ type }) => type), ["result", "end", "end", "error"]);
  assert.equal(events.filter(({ type }) => type === "result").length, 1);
});

test("synchronous stop and abort failures are contained as generic stable errors", () => {
  for (const method of ["stop", "abort"]) {
    const { adapter, events } = createAdapter({ methodFailures: { [method]: true } });
    adapter.start();
    const result = adapter[method]();
    assert.deepEqual(result, { ok: false, issue: "RECOGNITION_ERROR" });
    assert.deepEqual(events, [{ type: "error", issue: "RECOGNITION_ERROR" }]);
  }
});

test("adapter contract contains no scoring, persistence, upload, timeout, or provider API surface", () => {
  const { adapter } = createAdapter();
  const keys = Object.keys(adapter);

  for (const forbidden of [
    "score", "pass", "persist", "upload", "provider", "startTimeout", "finalizationTimeout",
  ]) {
    assert.equal(keys.includes(forbidden), false);
  }
  assert.equal(Object.hasOwn(SPEECH_RECOGNITION_ISSUES, "START_TIMEOUT"), false);
  assert.equal(Object.hasOwn(SPEECH_RECOGNITION_ISSUES, "FINALIZATION_TIMEOUT"), false);
});
