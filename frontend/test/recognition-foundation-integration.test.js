import assert from "node:assert/strict";
import test from "node:test";
import {
  createRecognitionAttemptController,
  RECOGNITION_ATTEMPT_PHASES,
} from "../src/pronunciation/recognition-attempt-controller.js";
import { RECOGNITION_OUTCOMES } from "../src/pronunciation/recognition-classifier.js";
import { createSpeechRecognitionAdapter } from "../src/pronunciation/speech-recognition-adapter.js";

function createFakeTimers() {
  let nextId = 0;
  const timers = new Map();

  return {
    schedule(callback, delay) {
      const id = ++nextId;
      timers.set(id, { callback, delay });
      return id;
    },
    cancel(id) {
      timers.delete(id);
    },
    fire(delay) {
      const entry = [...timers.entries()].find(([, timer]) => timer.delay === delay);
      assert.ok(entry, `expected a ${delay} ms timer`);
      const [id, timer] = entry;
      timers.delete(id);
      timer.callback();
    },
    delays() {
      return [...timers.values()].map(({ delay }) => delay);
    },
    count() {
      return timers.size;
    },
  };
}

function createHarness({ onNativeStart, onNativeStop } = {}) {
  const timers = createFakeTimers();
  const nativeInstances = [];
  const adapters = [];
  const states = [];

  class FakeSpeechRecognition {
    constructor() {
      this.calls = { start: 0, stop: 0, abort: 0 };
      nativeInstances.push(this);
    }

    start() {
      this.calls.start += 1;
      onNativeStart?.(this);
    }

    stop() {
      this.calls.stop += 1;
      onNativeStop?.(this);
    }

    abort() {
      this.calls.abort += 1;
    }

    emit(type, event = {}) {
      this[`on${type}`]?.(event);
    }
  }

  const browserWindow = {
    isSecureContext: true,
    SpeechRecognition: FakeSpeechRecognition,
  };
  const controller = createRecognitionAttemptController({
    createAdapter({ onEvent }) {
      const adapter = createSpeechRecognitionAdapter({ browserWindow, onEvent });
      adapters.push(adapter);
      return adapter;
    },
    scheduleTimeout: timers.schedule,
    cancelTimeout: timers.cancel,
    onStateChange: (state) => states.push(state),
  });

  return { controller, timers, nativeInstances, adapters, states };
}

function startAttempt(controller, overrides = {}) {
  return controller.startAttempt({
    setId: "set-1",
    vocabularyId: "vocabulary-1",
    target: "teacher",
    ...overrides,
  });
}

function finalResult(alternatives) {
  const result = alternatives.map((alternative) => alternative);
  result.isFinal = true;
  return { resultIndex: 0, results: [result] };
}

function startListening(harness, overrides) {
  const command = startAttempt(harness.controller, overrides);
  const native = harness.nativeInstances.at(-1);
  native.emit("start");
  return { command, native };
}

test("real adapter factory wiring reaches LISTENING with fixed native configuration", () => {
  const harness = createHarness();
  const { command, native } = startListening(harness);

  assert.equal(command.ok, true);
  assert.equal(harness.adapters.length, 1);
  assert.equal(harness.adapters[0].supported, true);
  assert.deepEqual(native.calls, { start: 1, stop: 0, abort: 0 });
  assert.equal(native.lang, "en-US");
  assert.equal(native.continuous, false);
  assert.equal(native.interimResults, false);
  assert.equal(native.maxAlternatives, 5);
  assert.equal(harness.controller.getSnapshot().phase, RECOGNITION_ATTEMPT_PHASES.LISTENING);
  assert.equal(harness.timers.count(), 0);
});

test("real adapter results flow through the real classifier for all match outcomes", async (t) => {
  const cases = [
    {
      name: "primary exact match",
      alternatives: [{ transcript: "Teacher", confidence: 0.8 }],
      outcome: RECOGNITION_OUTCOMES.PRIMARY_MATCH,
    },
    {
      name: "later alternative match",
      alternatives: [
        { transcript: "feature", confidence: 0.9 },
        { transcript: "teacher", confidence: 0.4 },
      ],
      outcome: RECOGNITION_OUTCOMES.ALTERNATIVE_MATCH,
    },
    {
      name: "no match",
      alternatives: [{ transcript: "student", confidence: 0.99 }],
      outcome: RECOGNITION_OUTCOMES.NO_MATCH,
    },
  ];

  for (const fixture of cases) {
    await t.test(fixture.name, () => {
      const harness = createHarness();
      const { native } = startListening(harness);
      native.emit("result", finalResult(fixture.alternatives));

      const snapshot = harness.controller.getSnapshot();
      assert.equal(snapshot.phase, RECOGNITION_ATTEMPT_PHASES.RESULT);
      assert.equal(snapshot.result.classification, fixture.outcome);
      assert.equal(snapshot.terminal, true);
      assert.equal(harness.timers.count(), 0);
    });
  }
});

test("an unusable raw primary stays INCONCLUSIVE through all three real modules", () => {
  const harness = createHarness();
  const { native } = startListening(harness);
  native.emit("result", finalResult([
    { transcript: null, confidence: 0.8 },
    { transcript: "teacher", confidence: 0.7 },
  ]));

  const snapshot = harness.controller.getSnapshot();
  assert.equal(snapshot.phase, RECOGNITION_ATTEMPT_PHASES.INCONCLUSIVE);
  assert.equal(snapshot.result.classification, RECOGNITION_OUTCOMES.INCONCLUSIVE);
  assert.equal(snapshot.issue, "UNUSABLE_PRIMARY");
});

test("intentional stop preserves a delayed final result and clears its watchdog", () => {
  const harness = createHarness();
  const { native } = startListening(harness);

  assert.equal(harness.controller.stop().ok, true);
  assert.equal(harness.controller.getSnapshot().phase, RECOGNITION_ATTEMPT_PHASES.FINALIZING);
  assert.deepEqual(harness.timers.delays(), [4_000]);

  native.emit("result", finalResult([{ transcript: "teacher", confidence: 0.5 }]));
  assert.equal(harness.controller.getSnapshot().result.classification, RECOGNITION_OUTCOMES.PRIMARY_MATCH);
  assert.equal(harness.timers.count(), 0);
});

test("stable native errors settle once as INCONCLUSIVE without native detail", async (t) => {
  for (const [nativeError, issue] of [
    ["not-allowed", "PERMISSION_DENIED"],
    ["network", "NETWORK_ERROR"],
    ["no-speech", "NO_SPEECH"],
    ["unknown-private-error", "RECOGNITION_ERROR"],
  ]) {
    await t.test(nativeError, () => {
      const harness = createHarness();
      const { native } = startListening(harness);
      native.emit("error", { error: nativeError, message: "private native detail" });
      native.emit("end");

      const snapshot = harness.controller.getSnapshot();
      assert.equal(snapshot.phase, RECOGNITION_ATTEMPT_PHASES.INCONCLUSIVE);
      assert.equal(snapshot.issue, issue);
      assert.equal(JSON.stringify(snapshot).includes("private native detail"), false);
    });
  }
});

test("cancellation and identity replacement suppress stale native callbacks", () => {
  const cancelled = createHarness();
  const { native: cancelledNative } = startListening(cancelled);
  cancelled.controller.cancel("ROUTE_LEAVE");
  const cancelledSnapshot = cancelled.controller.getSnapshot();
  cancelledNative.emit("result", finalResult([{ transcript: "teacher" }]));
  assert.deepEqual(cancelled.controller.getSnapshot(), cancelledSnapshot);
  assert.equal(cancelledNative.calls.abort, 1);
  assert.equal(cancelled.timers.count(), 0);

  const retried = createHarness();
  const { native: oldNative } = startListening(retried);
  const oldToken = retried.controller.getSnapshot().attemptToken;
  const { native: newNative } = startListening(retried, {
    setId: "set-2",
    vocabularyId: "vocabulary-2",
    target: "student",
  });
  oldNative.emit("result", finalResult([{ transcript: "teacher" }]));
  assert.equal(retried.controller.getSnapshot().attemptToken > oldToken, true);
  assert.equal(retried.controller.getSnapshot().phase, RECOGNITION_ATTEMPT_PHASES.LISTENING);
  newNative.emit("result", finalResult([{ transcript: "student" }]));
  assert.equal(retried.controller.getSnapshot().result.classification, RECOGNITION_OUTCOMES.PRIMARY_MATCH);
});

test("startup and finalization watchdogs use exact delays and clean timers", () => {
  const startup = createHarness();
  startAttempt(startup.controller);
  assert.deepEqual(startup.timers.delays(), [5_000]);
  startup.timers.fire(5_000);
  assert.equal(startup.controller.getSnapshot().issue, "START_TIMEOUT");
  assert.equal(startup.timers.count(), 0);

  const finalization = createHarness();
  startListening(finalization);
  finalization.controller.stop();
  assert.deepEqual(finalization.timers.delays(), [4_000]);
  finalization.timers.fire(4_000);
  assert.equal(finalization.controller.getSnapshot().phase, RECOGNITION_ATTEMPT_PHASES.IDLE);
  assert.equal(finalization.controller.getSnapshot().terminal, true);
  assert.equal(finalization.controller.getSnapshot().issue, null);
  assert.equal(finalization.controller.getSnapshot().result, null);
  assert.equal(finalization.timers.count(), 0);
});

test("synchronous native start and stop callbacks leave no stale timer or duplicate settlement", () => {
  const harness = createHarness({
    onNativeStart(native) {
      native.emit("start");
    },
    onNativeStop(native) {
      native.emit("result", finalResult([{ transcript: "teacher", confidence: 0.75 }]));
      native.emit("error", { error: "network" });
      native.emit("end");
    },
  });

  startAttempt(harness.controller);
  assert.equal(harness.controller.getSnapshot().phase, RECOGNITION_ATTEMPT_PHASES.LISTENING);
  assert.equal(harness.timers.count(), 0);
  harness.controller.stop();

  const snapshot = harness.controller.getSnapshot();
  assert.equal(snapshot.result.classification, RECOGNITION_OUTCOMES.PRIMARY_MATCH);
  assert.equal(snapshot.terminal, true);
  assert.equal(harness.timers.count(), 0);
});

test("duplicate and reordered native events cannot overwrite the first terminal result", () => {
  const harness = createHarness();
  const { native } = startListening(harness);
  native.emit("result", finalResult([{ transcript: "student" }]));
  const firstTerminal = harness.controller.getSnapshot();

  native.emit("error", { error: "network" });
  native.emit("result", finalResult([{ transcript: "teacher" }]));
  native.emit("end");
  assert.deepEqual(harness.controller.getSnapshot(), firstTerminal);
  assert.equal(firstTerminal.result.classification, RECOGNITION_OUTCOMES.NO_MATCH);
});

test("dispose detaches native handlers and prevents all further callbacks", () => {
  const harness = createHarness();
  const { native } = startListening(harness);
  harness.controller.dispose();
  const disposedSnapshot = harness.controller.getSnapshot();

  assert.equal(disposedSnapshot.phase, RECOGNITION_ATTEMPT_PHASES.DISPOSED);
  assert.equal(native.onstart, null);
  assert.equal(native.onresult, null);
  assert.equal(native.onerror, null);
  assert.equal(native.onend, null);
  native.emit("result", finalResult([{ transcript: "teacher" }]));
  assert.deepEqual(harness.controller.getSnapshot(), disposedSnapshot);
  assert.equal(harness.timers.count(), 0);
});

test("cross-module harness has no service, upload, persistence, logging, or scoring surface", () => {
  const harness = createHarness();
  startListening(harness);

  assert.deepEqual(Object.keys(harness.adapters[0]).sort(), [
    "abort",
    "dispose",
    "issue",
    "start",
    "stop",
    "supported",
  ]);
  assert.equal("score" in harness.controller.getSnapshot(), false);
  assert.equal("pass" in harness.controller.getSnapshot(), false);
  assert.equal(harness.nativeInstances.length, 1);
});
