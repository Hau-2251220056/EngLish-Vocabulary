import assert from "node:assert/strict";
import test from "node:test";
import {
  createRecognitionAttemptController,
  RECOGNITION_ATTEMPT_PHASES,
} from "../src/pronunciation/recognition-attempt-controller.js";
import { RECOGNITION_OUTCOMES } from "../src/pronunciation/recognition-classifier.js";

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
    fireByDelay(delay) {
      const entry = [...timers.entries()].find(([, timer]) => timer.delay === delay);
      assert.ok(entry, `expected a ${delay} ms timer`);
      const [id, timer] = entry;
      timers.delete(id);
      timer.callback();
    },
    count() {
      return timers.size;
    },
    delays() {
      return [...timers.values()].map(({ delay }) => delay);
    },
  };
}

function createHarness({ adapterBehavior = {} } = {}) {
  const timers = createFakeTimers();
  const adapters = [];
  const states = [];

  function createAdapter({ onEvent }) {
    const adapter = {
      calls: { start: 0, stop: 0, abort: 0, dispose: 0 },
      emit: onEvent,
      start() {
        this.calls.start += 1;
        if (adapterBehavior.onStartCall) adapterBehavior.onStartCall(this);
        return adapterBehavior.startResult || { ok: true, issue: null };
      },
      stop() {
        this.calls.stop += 1;
        if (adapterBehavior.onStopCall) adapterBehavior.onStopCall(this);
        return adapterBehavior.stopResult || { ok: true, issue: null };
      },
      abort() {
        this.calls.abort += 1;
        if (adapterBehavior.onAbortCall) adapterBehavior.onAbortCall(this);
        return { ok: true, issue: null };
      },
      dispose() {
        this.calls.dispose += 1;
        return { ok: true, issue: null };
      },
    };
    adapters.push(adapter);
    return adapter;
  }

  const controller = createRecognitionAttemptController({
    createAdapter,
    scheduleTimeout: timers.schedule,
    cancelTimeout: timers.cancel,
    onStateChange: (state) => states.push(state),
  });

  return { controller, timers, adapters, states };
}

function startDefault(controller, overrides = {}) {
  return controller.startAttempt({
    setId: "set-1",
    vocabularyId: "vocabulary-1",
    target: "teacher",
    ...overrides,
  });
}

function finalResult(alternatives) {
  return { type: "result", alternatives, usable: true };
}

test("STARTING advances to LISTENING on accepted start evidence", () => {
  const { controller, adapters, timers } = createHarness();
  startDefault(controller);
  assert.equal(controller.getSnapshot().phase, "STARTING");
  assert.deepEqual(timers.delays(), [5_000]);

  adapters[0].emit({ type: "start" });
  assert.equal(controller.getSnapshot().phase, "LISTENING");
  assert.equal(timers.count(), 0);
});

test("startup watchdog settles START_TIMEOUT at exactly 5000 ms", () => {
  const { controller, adapters, timers } = createHarness();
  startDefault(controller);
  timers.fireByDelay(5_000);

  assert.equal(controller.getSnapshot().phase, "INCONCLUSIVE");
  assert.equal(controller.getSnapshot().issue, "START_TIMEOUT");
  assert.equal(controller.getSnapshot().terminal, true);
  assert.equal(adapters[0].calls.dispose, 1);
  assert.equal(timers.count(), 0);
});

test("synchronous START_FAILED settles immediately without arming startup timer", () => {
  const { controller, timers } = createHarness({
    adapterBehavior: { startResult: { ok: false, issue: "START_FAILED" } },
  });
  const result = startDefault(controller);

  assert.deepEqual(result, { ok: false, issue: "START_FAILED", attemptToken: 1 });
  assert.equal(controller.getSnapshot().issue, "START_FAILED");
  assert.equal(timers.count(), 0);
});

test("synchronous adapter error callback plus failed start still reports command failure once", () => {
  const { controller, timers } = createHarness({
    adapterBehavior: {
      onStartCall: (adapter) => adapter.emit({ type: "error", issue: "START_FAILED" }),
      startResult: { ok: false, issue: "START_FAILED" },
    },
  });

  assert.deepEqual(startDefault(controller), {
    ok: false,
    issue: "START_FAILED",
    attemptToken: 1,
  });
  assert.equal(controller.getSnapshot().issue, "START_FAILED");
  assert.equal(timers.count(), 0);
});

test("synchronous start callback advances state and prevents a stale startup timer", () => {
  const { controller, timers } = createHarness({
    adapterBehavior: { onStartCall: (adapter) => adapter.emit({ type: "start" }) },
  });
  startDefault(controller);

  assert.equal(controller.getSnapshot().phase, "LISTENING");
  assert.equal(timers.count(), 0);
});

test("intentional stop enters FINALIZING and arms exactly one 4000 ms watchdog", () => {
  const { controller, adapters, timers } = createHarness();
  startDefault(controller);
  adapters[0].emit({ type: "start" });

  assert.equal(controller.stop().ok, true);
  assert.equal(controller.getSnapshot().phase, "FINALIZING");
  assert.deepEqual(timers.delays(), [4_000]);
  assert.equal(adapters[0].calls.stop, 1);
  assert.equal(controller.stop().ok, false);
  assert.equal(adapters[0].calls.stop, 1);
});

test("rapid Start/Stop is rejected until listening evidence arrives", () => {
  const { controller, adapters, timers } = createHarness();
  startDefault(controller);

  assert.equal(controller.stop().ok, false);
  assert.equal(adapters[0].calls.stop, 0);
  assert.deepEqual(timers.delays(), [5_000]);

  adapters[0].emit({ type: "start" });
  assert.equal(controller.stop().ok, true);
  assert.equal(adapters[0].calls.stop, 1);
  assert.deepEqual(timers.delays(), [4_000]);
});

test("stop allows a delayed valid result", () => {
  const { controller, adapters, timers } = createHarness();
  startDefault(controller);
  adapters[0].emit({ type: "start" });
  controller.stop();
  adapters[0].emit(finalResult([{ transcript: "teacher", confidence: 0.3 }]));

  assert.equal(controller.getSnapshot().phase, "RESULT");
  assert.equal(controller.getSnapshot().result.classification, "PRIMARY_MATCH");
  assert.equal(timers.count(), 0);
});

test("finalization watchdog ends an explicitly stopped empty attempt at exactly 4000 ms", () => {
  const { controller, adapters, timers } = createHarness();
  startDefault(controller);
  adapters[0].emit({ type: "start" });
  controller.stop();
  timers.fireByDelay(4_000);

  assert.equal(controller.getSnapshot().phase, "IDLE");
  assert.equal(controller.getSnapshot().terminal, true);
  assert.equal(controller.getSnapshot().issue, null);
  assert.equal(controller.getSnapshot().result, null);
  assert.equal(adapters[0].calls.dispose, 1);
  assert.equal(timers.count(), 0);
});

test("synchronous terminal callback during stop prevents a stale timer", () => {
  const harness = createHarness({
    adapterBehavior: {
      onStopCall: (adapter) => adapter.emit(finalResult([{ transcript: "teacher" }])),
    },
  });
  startDefault(harness.controller);
  harness.adapters[0].emit({ type: "start" });
  harness.controller.stop();

  assert.equal(harness.controller.getSnapshot().result.classification, "PRIMARY_MATCH");
  assert.equal(harness.timers.count(), 0);
});

test("end without result settles NO_RESULT", () => {
  const { controller, adapters } = createHarness();
  startDefault(controller);
  adapters[0].emit({ type: "start" });
  adapters[0].emit({ type: "end" });

  assert.equal(controller.getSnapshot().phase, "INCONCLUSIVE");
  assert.equal(controller.getSnapshot().issue, "NO_RESULT");
});

test("explicit stop followed by end settles as an empty stopped attempt", () => {
  const { controller, adapters, timers } = createHarness();
  startDefault(controller);
  adapters[0].emit({ type: "start" });
  controller.stop();
  adapters[0].emit({ type: "end" });

  assert.equal(controller.getSnapshot().phase, "IDLE");
  assert.equal(controller.getSnapshot().terminal, true);
  assert.equal(controller.getSnapshot().issue, null);
  assert.equal(controller.getSnapshot().result, null);
  assert.equal(timers.count(), 0);
});

test("no-speech after explicit stop remains a genuine inconclusive error", () => {
  const { controller, adapters } = createHarness();
  startDefault(controller);
  adapters[0].emit({ type: "start" });
  controller.stop();
  adapters[0].emit({ type: "error", issue: "NO_SPEECH" });

  assert.equal(controller.getSnapshot().phase, "INCONCLUSIVE");
  assert.equal(controller.getSnapshot().issue, "NO_SPEECH");
});

test("permission, network, and no-speech errors settle as stable inconclusive issues", () => {
  for (const issue of ["PERMISSION_DENIED", "NETWORK_ERROR", "NO_SPEECH"]) {
    const { controller, adapters } = createHarness();
    startDefault(controller);
    adapters[0].emit({ type: "error", issue });
    assert.equal(controller.getSnapshot().result.classification, "INCONCLUSIVE");
    assert.equal(controller.getSnapshot().issue, issue);
  }
});

test("classifier semantics remain PRIMARY_MATCH, ALTERNATIVE_MATCH, and NO_MATCH", () => {
  const cases = [
    [[{ transcript: "teacher" }], "PRIMARY_MATCH"],
    [[{ transcript: "picture" }, { transcript: "teacher" }], "ALTERNATIVE_MATCH"],
    [[{ transcript: "teachers" }, { transcript: "sheep" }], "NO_MATCH"],
  ];

  for (const [alternatives, expected] of cases) {
    const { controller, adapters } = createHarness();
    startDefault(controller);
    adapters[0].emit(finalResult(alternatives));
    assert.equal(controller.getSnapshot().result.classification, expected);
  }
});

test("unusable primary remains inconclusive and is never promoted", () => {
  const { controller, adapters } = createHarness();
  startDefault(controller);
  adapters[0].emit(finalResult([null, { transcript: "teacher", confidence: 1 }]));

  assert.equal(controller.getSnapshot().result.classification, "INCONCLUSIVE");
  assert.equal(controller.getSnapshot().issue, "UNUSABLE_PRIMARY");
});

test("first terminal callback wins across result, error, and end permutations", () => {
  const events = [
    finalResult([{ transcript: "teacher" }]),
    { type: "error", issue: "NETWORK_ERROR" },
    { type: "end" },
  ];

  for (const order of [events, [events[1], events[2], events[0]], [events[2], events[0], events[1]]]) {
    const { controller, adapters, states } = createHarness();
    startDefault(controller);
    for (const event of order) adapters[0].emit(event);
    const terminalStates = states.filter(({ terminal }) => terminal);
    assert.equal(terminalStates.length, 1);
    assert.equal(controller.getSnapshot(), terminalStates[0]);
  }
});

test("cancel invalidates ownership before synchronous abort callbacks", () => {
  const harness = createHarness({
    adapterBehavior: {
      onAbortCall: (adapter) => {
        adapter.emit(finalResult([{ transcript: "teacher" }]));
        adapter.emit({ type: "end" });
      },
    },
  });
  startDefault(harness.controller);
  harness.controller.cancel("ROUTE_LEAVE");

  assert.equal(harness.controller.getSnapshot().phase, "CANCELLED");
  assert.equal(harness.controller.getSnapshot().issue, "ROUTE_LEAVE");
  assert.equal(harness.controller.getSnapshot().result, null);
  assert.equal(harness.adapters[0].calls.abort, 1);
});

test("retry creates a new token and ignores every old adapter event", () => {
  const { controller, adapters } = createHarness();
  const first = startDefault(controller);
  const second = startDefault(controller);
  adapters[0].emit(finalResult([{ transcript: "teacher" }]));

  assert.notEqual(first.attemptToken, second.attemptToken);
  assert.equal(controller.getSnapshot().attemptToken, second.attemptToken);
  assert.equal(controller.getSnapshot().phase, "STARTING");
});

test("retry after result or error creates a fresh owned attempt", () => {
  for (const terminalEvent of [
    finalResult([{ transcript: "teacher" }]),
    { type: "error", issue: "NETWORK_ERROR" },
  ]) {
    const { controller, adapters } = createHarness();
    const first = startDefault(controller);
    adapters[0].emit(terminalEvent);
    const second = startDefault(controller);
    adapters[0].emit({ type: "end" });

    assert.notEqual(first.attemptToken, second.attemptToken);
    assert.equal(controller.getSnapshot().attemptToken, second.attemptToken);
    assert.equal(controller.getSnapshot().phase, "STARTING");
  }
});

test("Set and Vocabulary identity replacement invalidates old events", () => {
  const { controller, adapters } = createHarness();
  startDefault(controller);
  adapters[0].emit({ type: "start" });
  startDefault(controller, { setId: "set-2", vocabularyId: "vocabulary-2", target: "book" });
  adapters[0].emit(finalResult([{ transcript: "teacher" }]));

  assert.equal(controller.getSnapshot().setId, "set-2");
  assert.equal(controller.getSnapshot().vocabularyId, "vocabulary-2");
  assert.equal(controller.getSnapshot().phase, "STARTING");
  assert.equal(adapters[0].calls.abort, 1);
});

test("route-leave, logout-style cancellation, and dispose are idempotent and timer-safe", () => {
  for (const reason of ["ROUTE_LEAVE", "LOGOUT"]) {
    const { controller, timers } = createHarness();
    startDefault(controller);
    assert.equal(controller.cancel(reason).ok, true);
    assert.equal(controller.cancel(reason).ok, false);
    assert.equal(timers.count(), 0);
  }

  const { controller, adapters, timers } = createHarness();
  startDefault(controller);
  assert.equal(controller.dispose().ok, true);
  assert.equal(controller.dispose().ok, true);
  assert.equal(adapters[0].calls.abort, 1);
  assert.equal(adapters[0].calls.dispose, 1);
  assert.equal(timers.count(), 0);
});

test("unmount-style dispose while finalizing clears ownership and watchdogs", () => {
  const { controller, adapters, timers } = createHarness();
  startDefault(controller);
  adapters[0].emit({ type: "start" });
  controller.stop();
  assert.deepEqual(timers.delays(), [4_000]);

  controller.dispose();
  adapters[0].emit(finalResult([{ transcript: "teacher" }]));

  assert.equal(controller.getSnapshot().phase, "DISPOSED");
  assert.equal(controller.getSnapshot().result, null);
  assert.equal(timers.count(), 0);
  assert.equal(adapters[0].calls.abort, 1);
  assert.equal(adapters[0].calls.dispose, 1);
});

test("result immediately before timeout wins and result after timeout stays stale", () => {
  const before = createHarness();
  startDefault(before.controller);
  before.adapters[0].emit(finalResult([{ transcript: "teacher" }]));
  assert.equal(before.timers.count(), 0);
  assert.equal(before.controller.getSnapshot().result.classification, "PRIMARY_MATCH");

  const after = createHarness();
  startDefault(after.controller);
  after.timers.fireByDelay(5_000);
  after.adapters[0].emit(finalResult([{ transcript: "teacher" }]));
  assert.equal(after.controller.getSnapshot().issue, "START_TIMEOUT");
});

test("invalid confidence never changes classification", () => {
  for (const confidence of [undefined, Number.NaN, -1, 2, "0.9"]) {
    const { controller, adapters } = createHarness();
    startDefault(controller);
    adapters[0].emit(finalResult([{ transcript: "teacher", confidence }]));
    assert.equal(controller.getSnapshot().result.classification, "PRIMARY_MATCH");
  }
});

test("no automatic restart, multiple active attempt, persistence, scoring, or browser API exists", () => {
  const { controller, adapters } = createHarness();
  startDefault(controller);
  startDefault(controller);

  assert.equal(adapters.length, 2);
  assert.equal(adapters[0].calls.abort, 1);
  assert.equal(adapters[0].calls.dispose, 1);
  assert.equal(adapters[1].calls.start, 1);
  for (const forbidden of ["persist", "upload", "score", "pass", "getUserMedia", "restart"]) {
    assert.equal(Object.hasOwn(controller, forbidden), false);
  }
  assert.deepEqual(Object.values(RECOGNITION_ATTEMPT_PHASES), [
    "IDLE", "STARTING", "LISTENING", "FINALIZING", "RESULT", "INCONCLUSIVE",
    "CANCELLED", "DISPOSED",
  ]);
  assert.deepEqual(Object.values(RECOGNITION_OUTCOMES), [
    "PRIMARY_MATCH", "ALTERNATIVE_MATCH", "NO_MATCH", "INCONCLUSIVE",
  ]);
});
