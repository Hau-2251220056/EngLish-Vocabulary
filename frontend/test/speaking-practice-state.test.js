import assert from "node:assert/strict";
import test from "node:test";
import {
  createSpeakingPracticeController,
  SPEAKING_PRACTICE_ISSUES,
  SPEAKING_PRACTICE_PHASES,
} from "../src/pronunciation/speaking-practice-state.js";

function createTimers() {
  let now = 0;
  let nextId = 0;
  const timers = new Map();
  return {
    schedule(callback, delay) {
      const id = ++nextId;
      timers.set(id, { callback, at: now + delay });
      return id;
    },
    cancel(id) {
      timers.delete(id);
    },
    advance(milliseconds) {
      now += milliseconds;
      for (const [id, timer] of [...timers]) {
        if (timer.at <= now) {
          timers.delete(id);
          timer.callback();
        }
      }
    },
    count: () => timers.size,
  };
}

function createHarness({
  secure = true,
  supported = true,
  autoStart = false,
  startThrows = false,
  stateObserver,
} = {}) {
  const timers = createTimers();
  const recognizers = [];
  const events = [];
  const audioInstances = [];
  const utterances = [];
  const nativeLog = [];

  class FakeRecognition {
    constructor() {
      recognizers.push(this);
    }

    start() {
      nativeLog.push("recognition.start");
      if (startThrows) throw new Error("private native start detail");
      if (autoStart) this.onstart?.();
    }

    stop() {
      nativeLog.push("recognition.stop");
    }

    abort() {
      nativeLog.push("recognition.abort");
    }

    emitStart() {
      this.onstart?.();
    }

    emitResult(alternatives) {
      const result = alternatives.map(([transcript, confidence]) => ({ transcript, confidence }));
      result.isFinal = true;
      this.onresult?.({ resultIndex: 0, results: [result] });
    }

    emitError(error) {
      this.onerror?.({ error });
    }

    emitEnd() {
      this.onend?.();
    }
  }

  class FakeUtterance {
    constructor(text) {
      this.text = text;
      utterances.push(this);
    }
  }

  const speechSynthesis = {
    getVoices: () => [{ lang: "en-US", name: "English" }],
    speak(utterance) {
      nativeLog.push(`tts.speak:${utterance.text}`);
    },
    cancel() {
      nativeLog.push("tts.cancel");
    },
  };

  const browserWindow = {
    isSecureContext: secure,
    speechSynthesis,
    SpeechSynthesisUtterance: FakeUtterance,
    ...(supported ? { SpeechRecognition: FakeRecognition } : {}),
  };

  let controller;
  controller = createSpeakingPracticeController({
    browserWindow,
    scheduleTimeout: timers.schedule,
    cancelTimeout: timers.cancel,
    createAudio(url) {
      const audio = {
        url,
        playCalls: 0,
        pauseCalls: 0,
        play() {
          this.playCalls += 1;
          nativeLog.push(`audio.play:${url}`);
          return Promise.resolve();
        },
        pause() {
          this.pauseCalls += 1;
          nativeLog.push(`audio.pause:${url}`);
        },
      };
      audioInstances.push(audio);
      return audio;
    },
    speechSynthesis,
    createUtterance: (text) => new FakeUtterance(text),
    onStateChange(snapshot) {
      events.push(snapshot);
      stateObserver?.(snapshot, () => controller);
    },
  });

  return {
    controller,
    timers,
    recognizers,
    events,
    audioInstances,
    utterances,
    nativeLog,
  };
}

const learningSet = Object.freeze({
  id: "set-1",
  name: "Authorized Set",
  mode: "NORMAL",
  total_items: 2,
  cards: Object.freeze([
    Object.freeze({
      id: "vocabulary-1",
      word: "book",
      position: 4,
      phonetic: "/bʊk/",
      pronunciation_url: "book.mp3",
    }),
    Object.freeze({
      id: "vocabulary-2",
      word: "book",
      position: 9,
      phonetic: null,
      pronunciation_url: null,
    }),
  ]),
});

function load(harness, value = learningSet) {
  assert.equal(harness.controller.acceptLearningSet(value).ok, true);
  return harness.controller.getSnapshot();
}

function beginRecognition(harness) {
  load(harness);
  assert.equal(harness.controller.requestSpeak().issue, SPEAKING_PRACTICE_ISSUES.DISCLOSURE_REQUIRED);
  assert.equal(harness.controller.confirmDisclosureAndStart().ok, true);
  return harness.recognizers.at(-1);
}

test("initial and load outcomes are deterministic", () => {
  const harness = createHarness();
  assert.equal(harness.controller.getSnapshot().phase, SPEAKING_PRACTICE_PHASES.LOADING);
  const loadOperation = harness.controller.beginLoad({ setId: "missing-set" });
  harness.controller.rejectLoad("LEARNING_SET_NOT_FOUND", {
    loadGeneration: loadOperation.generation,
  });
  assert.equal(harness.controller.getSnapshot().phase, SPEAKING_PRACTICE_PHASES.INACCESSIBLE);
  harness.controller.beginLoad();
  harness.controller.rejectLoad("LEARNING_SET_EMPTY");
  assert.equal(harness.controller.getSnapshot().phase, SPEAKING_PRACTICE_PHASES.EMPTY);
  harness.controller.beginLoad();
  harness.controller.rejectLoad("LEARNING_REQUEST_FAILED");
  assert.equal(harness.controller.getSnapshot().phase, SPEAKING_PRACTICE_PHASES.RECOVERABLE_ERROR);
});

test("validated NORMAL identity and order are preserved without spelling deduplication", () => {
  const harness = createHarness();
  const snapshot = load(harness);
  assert.deepEqual(snapshot.targets.map(({ id, word, position }) => ({ id, word, position })), [
    { id: "vocabulary-1", word: "book", position: 4 },
    { id: "vocabulary-2", word: "book", position: 9 },
  ]);
  assert.equal(snapshot.target.id, "vocabulary-1");
  assert.equal(harness.controller.replaceTarget(1).ok, true);
  assert.equal(harness.controller.getSnapshot().target.id, "vocabulary-2");
  assert.equal(harness.controller.replaceTarget(8).issue, SPEAKING_PRACTICE_ISSUES.INVALID_TARGET);
});

test("malformed or stale learning identities are rejected without inventing a target", () => {
  const harness = createHarness();
  for (const malformed of [
    { ...learningSet, mode: "SRS" },
    { ...learningSet, total_items: 3 },
    { ...learningSet, cards: [{ ...learningSet.cards[0], id: "" }, learningSet.cards[1]] },
    { ...learningSet, cards: [learningSet.cards[0], { ...learningSet.cards[1], id: "vocabulary-1" }] },
    { ...learningSet, cards: [{ ...learningSet.cards[0], word: "" }, learningSet.cards[1]] },
  ]) {
    assert.equal(harness.controller.acceptLearningSet(malformed).issue, SPEAKING_PRACTICE_ISSUES.INVALID_LEARNING_SET);
  }
  assert.equal(harness.controller.getSnapshot().target, null);
});

test("unsupported and insecure capability states retain Listen but disable Speak", () => {
  const unsupported = createHarness({ supported: false });
  load(unsupported);
  assert.equal(unsupported.controller.getSnapshot().phase, SPEAKING_PRACTICE_PHASES.UNSUPPORTED);
  assert.equal(unsupported.controller.getSnapshot().controls.canListen, true);
  assert.equal(unsupported.controller.getSnapshot().controls.canSpeak, false);

  const insecure = createHarness({ secure: false });
  load(insecure);
  assert.equal(insecure.controller.getSnapshot().phase, SPEAKING_PRACTICE_PHASES.INSECURE_CONTEXT);
  assert.equal(insecure.controller.getSnapshot().controls.canSpeak, false);
});

test("disclosure gates first microphone use and explicit confirmation starts recognition", () => {
  const harness = createHarness();
  load(harness);
  assert.equal(harness.controller.requestSpeak().issue, SPEAKING_PRACTICE_ISSUES.DISCLOSURE_REQUIRED);
  assert.equal(harness.recognizers.length, 0);
  assert.equal(harness.controller.getSnapshot().phase, SPEAKING_PRACTICE_PHASES.DISCLOSURE);
  assert.equal(harness.controller.getSnapshot().controls.canConfirmDisclosure, true);
  assert.equal(harness.controller.confirmDisclosureAndStart().ok, true);
  assert.equal(harness.recognizers.length, 1);
  assert.equal(harness.controller.getSnapshot().phase, SPEAKING_PRACTICE_PHASES.STARTING);
});

test("real adapter, lifecycle and classifier compose into all three result outcomes", async (t) => {
  for (const [name, alternatives, expected] of [
    ["primary", [["book", 0.8]], "PRIMARY_MATCH"],
    ["alternative", [["back", 0.9], ["book", 0.4]], "ALTERNATIVE_MATCH"],
    ["no match", [["back", 0.9]], "NO_MATCH"],
  ]) {
    await t.test(name, () => {
      const harness = createHarness();
      const recognizer = beginRecognition(harness);
      recognizer.emitStart();
      recognizer.emitResult(alternatives);
      const snapshot = harness.controller.getSnapshot();
      assert.equal(snapshot.phase, SPEAKING_PRACTICE_PHASES.RESULT);
      assert.equal(snapshot.result.classification, expected);
      assert.equal(snapshot.target.id, "vocabulary-1");
    });
  }
});

test("intentional stop preserves a delayed final result", () => {
  const harness = createHarness();
  const recognizer = beginRecognition(harness);
  recognizer.emitStart();
  assert.equal(harness.controller.stopSpeaking().ok, true);
  assert.equal(harness.controller.getSnapshot().phase, SPEAKING_PRACTICE_PHASES.FINALIZING);
  recognizer.emitResult([["book", 0.7]]);
  assert.equal(harness.controller.getSnapshot().result.classification, "PRIMARY_MATCH");
  assert.equal(harness.timers.count(), 0);
});

test("intentional stop without a result returns to READY while spontaneous no-speech remains inconclusive", () => {
  const stopped = createHarness();
  const stoppedRecognizer = beginRecognition(stopped);
  stoppedRecognizer.emitStart();
  stopped.controller.stopSpeaking();
  stoppedRecognizer.emitEnd();
  assert.equal(stopped.controller.getSnapshot().phase, SPEAKING_PRACTICE_PHASES.READY);
  assert.equal(stopped.controller.getSnapshot().issue, null);
  assert.equal(stopped.controller.getSnapshot().result, null);
  assert.equal(stopped.controller.getSnapshot().recognition.phase, "IDLE");
  assert.equal(stopped.controller.getSnapshot().recognition.terminal, true);
  assert.equal(stopped.controller.getSnapshot().controls.canSpeak, true);

  const noSpeech = createHarness();
  const noSpeechRecognizer = beginRecognition(noSpeech);
  noSpeechRecognizer.emitStart();
  noSpeechRecognizer.emitError("no-speech");
  assert.equal(noSpeech.controller.getSnapshot().phase, SPEAKING_PRACTICE_PHASES.INCONCLUSIVE);
  assert.equal(noSpeech.controller.getSnapshot().issue, "NO_SPEECH");
});

test("duplicate starts and illegal stop/retry transitions are rejected", () => {
  const harness = createHarness();
  load(harness);
  assert.equal(harness.controller.stopSpeaking().issue, SPEAKING_PRACTICE_ISSUES.ILLEGAL_TRANSITION);
  assert.equal(harness.controller.retry().issue, SPEAKING_PRACTICE_ISSUES.ILLEGAL_TRANSITION);
  harness.controller.requestSpeak();
  harness.controller.confirmDisclosureAndStart();
  assert.equal(harness.controller.requestSpeak().issue, SPEAKING_PRACTICE_ISSUES.ILLEGAL_TRANSITION);
  assert.equal(harness.recognizers.length, 1);
});

test("stable recognition errors map to inconclusive or recoverable phases", async (t) => {
  for (const [nativeIssue, expectedPhase, stableIssue] of [
    ["no-speech", SPEAKING_PRACTICE_PHASES.INCONCLUSIVE, "NO_SPEECH"],
    ["aborted", SPEAKING_PRACTICE_PHASES.INCONCLUSIVE, "ABORTED"],
    ["not-allowed", SPEAKING_PRACTICE_PHASES.RECOVERABLE_ERROR, "PERMISSION_DENIED"],
    ["service-not-allowed", SPEAKING_PRACTICE_PHASES.RECOVERABLE_ERROR, "SERVICE_NOT_ALLOWED"],
    ["audio-capture", SPEAKING_PRACTICE_PHASES.RECOVERABLE_ERROR, "AUDIO_CAPTURE_FAILED"],
    ["network", SPEAKING_PRACTICE_PHASES.RECOVERABLE_ERROR, "NETWORK_ERROR"],
    ["private-native-code", SPEAKING_PRACTICE_PHASES.RECOVERABLE_ERROR, "RECOGNITION_ERROR"],
  ]) {
    await t.test(nativeIssue, () => {
      const harness = createHarness();
      const recognizer = beginRecognition(harness);
      recognizer.emitError(nativeIssue);
      assert.equal(harness.controller.getSnapshot().phase, expectedPhase);
      assert.equal(harness.controller.getSnapshot().issue, stableIssue);
    });
  }
});

test("start failure, end-without-result and unusable primary remain stable non-results", async (t) => {
  await t.test("start failure", () => {
    const harness = createHarness({ startThrows: true });
    load(harness);
    harness.controller.requestSpeak();
    const result = harness.controller.confirmDisclosureAndStart();
    assert.equal(result.ok, false);
    assert.equal(harness.controller.getSnapshot().phase, SPEAKING_PRACTICE_PHASES.RECOVERABLE_ERROR);
    assert.equal(harness.controller.getSnapshot().issue, "START_FAILED");
    assert.equal(JSON.stringify(harness.controller.getSnapshot()).includes("private"), false);
  });
  await t.test("end without result", () => {
    const harness = createHarness();
    const recognizer = beginRecognition(harness);
    recognizer.emitStart();
    recognizer.emitEnd();
    assert.equal(harness.controller.getSnapshot().phase, SPEAKING_PRACTICE_PHASES.INCONCLUSIVE);
    assert.equal(harness.controller.getSnapshot().issue, "NO_RESULT");
  });
  await t.test("unusable primary", () => {
    const harness = createHarness();
    const recognizer = beginRecognition(harness);
    recognizer.emitResult([["   ", 0.9], ["book", 0.5]]);
    assert.equal(harness.controller.getSnapshot().phase, SPEAKING_PRACTICE_PHASES.INCONCLUSIVE);
    assert.equal(harness.controller.getSnapshot().issue, "UNUSABLE_PRIMARY");
  });
});

test("startup and finalization watchdog outcomes are bounded and recoverable", async (t) => {
  await t.test("startup", () => {
    const harness = createHarness();
    beginRecognition(harness);
    harness.timers.advance(4_999);
    assert.equal(harness.controller.getSnapshot().phase, SPEAKING_PRACTICE_PHASES.STARTING);
    harness.timers.advance(1);
    assert.equal(harness.controller.getSnapshot().phase, SPEAKING_PRACTICE_PHASES.INCONCLUSIVE);
    assert.equal(harness.controller.getSnapshot().issue, "START_TIMEOUT");
  });
  await t.test("finalization", () => {
    const harness = createHarness();
    const recognizer = beginRecognition(harness);
    recognizer.emitStart();
    harness.controller.stopSpeaking();
    harness.timers.advance(3_999);
    assert.equal(harness.controller.getSnapshot().phase, SPEAKING_PRACTICE_PHASES.FINALIZING);
    harness.timers.advance(1);
    assert.equal(harness.controller.getSnapshot().phase, SPEAKING_PRACTICE_PHASES.READY);
    assert.equal(harness.controller.getSnapshot().issue, null);
    assert.equal(harness.controller.getSnapshot().result, null);
  });
});

test("Listen delegates exact URL/word and is rejected throughout active recognition", async () => {
  const harness = createHarness();
  load(harness);
  assert.equal(harness.controller.listen().ok, true);
  assert.equal(harness.audioInstances[0].url, "book.mp3");
  assert.equal(harness.audioInstances[0].playCalls, 1);
  harness.controller.requestSpeak();
  harness.controller.confirmDisclosureAndStart();
  assert.equal(harness.controller.listen().issue, "RECOGNITION_ACTIVE");
  const recognizer = harness.recognizers[0];
  recognizer.emitStart();
  assert.equal(harness.controller.listen().issue, "RECOGNITION_ACTIVE");
  harness.controller.stopSpeaking();
  assert.equal(harness.controller.listen().issue, "RECOGNITION_ACTIVE");
  await Promise.resolve();
});

test("Listen delegates URL-absent targets to TTS with the exact server word", () => {
  const harness = createHarness();
  load(harness);
  harness.controller.replaceTarget(1);
  assert.equal(harness.controller.listen().ok, true);
  assert.equal(harness.audioInstances.length, 0);
  assert.equal(harness.utterances.length, 1);
  assert.equal(harness.utterances[0].text, "book");
  assert.ok(harness.nativeLog.includes("tts.speak:book"));
});

test("Speak preparation stops playback before native recognition starts", () => {
  const harness = createHarness({ autoStart: true });
  load(harness);
  harness.controller.listen();
  harness.controller.requestSpeak();
  harness.nativeLog.length = 0;
  harness.controller.confirmDisclosureAndStart();
  assert.ok(harness.nativeLog.indexOf("audio.pause:book.mp3") < harness.nativeLog.indexOf("recognition.start"));
  assert.ok(harness.nativeLog.indexOf("tts.cancel") < harness.nativeLog.indexOf("recognition.start"));
  assert.equal(harness.controller.getSnapshot().phase, SPEAKING_PRACTICE_PHASES.LISTENING);
});

test("target replacement cancels ownership, clears result and rejects stale recognition", () => {
  const harness = createHarness();
  const recognizer = beginRecognition(harness);
  recognizer.emitStart();
  recognizer.emitResult([["book", 0.9]]);
  assert.equal(harness.controller.getSnapshot().phase, SPEAKING_PRACTICE_PHASES.RESULT);
  assert.equal(harness.controller.replaceTarget(1).ok, true);
  const replacement = harness.controller.getSnapshot();
  assert.equal(replacement.target.id, "vocabulary-2");
  assert.equal(replacement.result, null);
  recognizer.emitResult([["book", 1]]);
  assert.deepEqual(harness.controller.getSnapshot(), replacement);
});

test("active target replacement invalidates recognition before publishing the new target", () => {
  const harness = createHarness();
  const recognizer = beginRecognition(harness);
  recognizer.emitStart();
  assert.equal(harness.controller.replaceTarget(1).ok, true);
  assert.equal(harness.controller.getSnapshot().target.id, "vocabulary-2");
  assert.equal(harness.controller.getSnapshot().phase, SPEAKING_PRACTICE_PHASES.READY);
  assert.ok(harness.nativeLog.includes("recognition.abort"));
});

test("explicit retry creates a new attempt and never automatically restarts", () => {
  const harness = createHarness();
  const first = beginRecognition(harness);
  first.emitError("no-speech");
  assert.equal(harness.recognizers.length, 1);
  assert.equal(harness.controller.retry().ok, true);
  assert.equal(harness.recognizers.length, 2);
  assert.notEqual(harness.controller.getSnapshot().recognition.attemptToken, 1);
});

test("dispose publishes the real child terminal snapshots and remains idempotent", () => {
  const harness = createHarness();
  const recognizer = beginRecognition(harness);
  recognizer.emitStart();
  assert.equal(harness.controller.getSnapshot().phase, SPEAKING_PRACTICE_PHASES.LISTENING);

  assert.equal(harness.controller.dispose().ok, true);
  const disposed = harness.controller.getSnapshot();
  assert.equal(disposed.disposed, true);
  assert.equal(disposed.phase, SPEAKING_PRACTICE_PHASES.CANCELLING);
  assert.equal(disposed.issue, SPEAKING_PRACTICE_ISSUES.DISPOSED);
  assert.equal(disposed.recognition.phase, "DISPOSED");
  assert.equal(disposed.recognition.terminal, true);
  assert.equal(disposed.recognition.issue, "DISPOSED");
  assert.equal(disposed.playback.phase, "DISPOSED");
  assert.deepEqual(disposed.controls, {
    canListen: false,
    canSpeak: false,
    canConfirmDisclosure: false,
    canStop: false,
    canRetry: false,
    canChangeTarget: false,
    canExit: false,
  });

  const cleanupLog = [...harness.nativeLog];
  assert.equal(harness.controller.dispose().ok, true);
  assert.deepEqual(harness.nativeLog, cleanupLog);
  assert.deepEqual(harness.controller.getSnapshot(), disposed);

  recognizer.emitResult([["book", 1]]);
  recognizer.emitError("network");
  recognizer.emitEnd();
  assert.deepEqual(harness.controller.getSnapshot(), disposed);
  assert.equal(harness.controller.listen().issue, SPEAKING_PRACTICE_ISSUES.DISPOSED);
  assert.equal(harness.controller.requestSpeak().issue, SPEAKING_PRACTICE_ISSUES.DISPOSED);
  assert.equal(harness.controller.replaceTarget(1).issue, SPEAKING_PRACTICE_ISSUES.DISPOSED);
});

test("disposed playback callbacks and play promises cannot resurrect aggregate state", async () => {
  const harness = createHarness();
  load(harness);
  assert.equal(harness.controller.listen().ok, true);
  const audio = harness.audioInstances[0];
  assert.equal(audio.playCalls, 1);

  assert.equal(harness.controller.dispose().ok, true);
  const disposed = harness.controller.getSnapshot();
  assert.equal(disposed.playback.phase, "DISPOSED");
  assert.equal(audio.pauseCalls, 1);

  audio.onended?.();
  audio.onerror?.(new Error("private late audio detail"));
  await Promise.resolve();
  assert.deepEqual(harness.controller.getSnapshot(), disposed);
});

test("a synchronous aggregate observer can cancel STARTING without allowing native start", () => {
  let cancelled = false;
  const harness = createHarness({
    stateObserver(snapshot, getController) {
      if (!cancelled && snapshot.phase === SPEAKING_PRACTICE_PHASES.STARTING) {
        cancelled = true;
        getController()?.cancel("OBSERVER_CANCELLED");
      }
    },
  });
  load(harness);
  harness.controller.requestSpeak();
  const result = harness.controller.confirmDisclosureAndStart();
  assert.equal(result.ok, false);
  assert.equal(harness.recognizers.length, 0);
  assert.equal(harness.nativeLog.includes("recognition.start"), false);
  assert.equal(harness.controller.getSnapshot().phase, SPEAKING_PRACTICE_PHASES.READY);
});

test("a reentrant load outcome cannot be overwritten by an obsolete accepted payload", () => {
  let replaced = false;
  const harness = createHarness({
    stateObserver(snapshot, getController) {
      if (!replaced && snapshot.phase === SPEAKING_PRACTICE_PHASES.CANCELLING
        && snapshot.issue === "LOAD_REPLACED") {
        replaced = true;
        getController()?.beginLoad({ setId: "set-2" });
      }
    },
  });
  const result = harness.controller.acceptLearningSet(learningSet);
  assert.equal(result.ok, false);
  assert.equal(harness.controller.getSnapshot().phase, SPEAKING_PRACTICE_PHASES.LOADING);
  assert.equal(harness.controller.getSnapshot().target, null);
  assert.equal(harness.audioInstances.length, 0);
  assert.equal(harness.utterances.length, 0);
});

test("load generation and requested Set identity reject out-of-order async completion", () => {
  const harness = createHarness();
  const first = harness.controller.beginLoad({ setId: "set-1" });
  const second = harness.controller.beginLoad({ setId: "set-2" });
  assert.notEqual(first.generation, second.generation);
  assert.equal(
    harness.controller.acceptLearningSet(learningSet, { loadGeneration: first.generation }).issue,
    SPEAKING_PRACTICE_ISSUES.INVALID_LEARNING_SET,
  );
  assert.equal(
    harness.controller.acceptLearningSet(learningSet, { loadGeneration: second.generation }).issue,
    SPEAKING_PRACTICE_ISSUES.INVALID_LEARNING_SET,
  );
  assert.equal(harness.controller.getSnapshot().phase, SPEAKING_PRACTICE_PHASES.LOADING);
  assert.equal(harness.controller.getSnapshot().target, null);
});

test("controls are derived from each conceptual state", async (t) => {
  const cases = [
    ["loading", () => createHarness().controller.getSnapshot(), { canExit: true, canSpeak: false }],
    ["ready", () => load(createHarness()), { canListen: true, canSpeak: true, canChangeTarget: true }],
    ["disclosure", () => {
      const harness = createHarness(); load(harness); harness.controller.requestSpeak(); return harness.controller.getSnapshot();
    }, {
      canListen: true,
      canSpeak: false,
      canConfirmDisclosure: true,
      canChangeTarget: true,
    }],
    ["unsupported", () => load(createHarness({ supported: false })), { canListen: true, canSpeak: false }],
    ["insecure", () => load(createHarness({ secure: false })), { canListen: true, canSpeak: false }],
    ["empty", () => {
      const harness = createHarness(); harness.controller.rejectLoad("LEARNING_SET_EMPTY"); return harness.controller.getSnapshot();
    }, { canListen: false, canSpeak: false }],
  ];
  for (const [name, getSnapshot, expected] of cases) {
    await t.test(name, () => {
      const controls = getSnapshot().controls;
      for (const [key, value] of Object.entries(expected)) assert.equal(controls[key], value);
    });
  }
});

test("DISCLOSURE preserves exact reference Listen without starting recognition", async () => {
  const harness = createHarness();
  load(harness);
  harness.controller.requestSpeak();

  const disclosure = harness.controller.getSnapshot();
  assert.equal(disclosure.phase, SPEAKING_PRACTICE_PHASES.DISCLOSURE);
  assert.equal(disclosure.controls.canListen, true);
  assert.equal(disclosure.controls.canChangeTarget, true);
  assert.equal(disclosure.controls.canConfirmDisclosure, true);
  assert.equal(harness.controller.listen().ok, true);
  assert.equal(harness.audioInstances.length, 1);
  assert.equal(harness.audioInstances[0].url, "book.mp3");
  assert.equal(harness.audioInstances[0].playCalls, 1);
  assert.equal(harness.recognizers.length, 0);
  assert.equal(harness.nativeLog.includes("recognition.start"), false);
  assert.equal(harness.controller.getSnapshot().phase, SPEAKING_PRACTICE_PHASES.DISCLOSURE);
  await Promise.resolve();
});

test("target change invalidates pending disclosure and stale playback for the old target", async () => {
  const harness = createHarness();
  load(harness);
  harness.controller.requestSpeak();
  harness.controller.listen();
  const oldAudio = harness.audioInstances[0];

  assert.equal(harness.controller.replaceTarget(1).ok, true);
  const replacement = harness.controller.getSnapshot();
  assert.equal(replacement.phase, SPEAKING_PRACTICE_PHASES.READY);
  assert.equal(replacement.target.id, "vocabulary-2");
  assert.equal(replacement.result, null);
  assert.equal(replacement.controls.canConfirmDisclosure, false);
  assert.equal(harness.controller.confirmDisclosureAndStart().issue, SPEAKING_PRACTICE_ISSUES.ILLEGAL_TRANSITION);
  assert.equal(harness.recognizers.length, 0);

  oldAudio.onended?.();
  oldAudio.onerror?.();
  await Promise.resolve();
  assert.equal(harness.controller.getSnapshot().target.id, "vocabulary-2");
  assert.equal(harness.controller.getSnapshot().phase, SPEAKING_PRACTICE_PHASES.READY);

  assert.equal(harness.controller.requestSpeak().issue, SPEAKING_PRACTICE_ISSUES.DISCLOSURE_REQUIRED);
  assert.equal(harness.recognizers.length, 0);
  assert.equal(harness.controller.confirmDisclosureAndStart().ok, true);
  assert.equal(harness.recognizers.length, 1);
  assert.equal(harness.controller.getSnapshot().recognition.vocabularyId, "vocabulary-2");
});

test("active, terminal, cancelling and inaccessible phases expose derived controls only", () => {
  const harness = createHarness();
  const recognizer = beginRecognition(harness);
  assert.deepEqual(
    pickControls(harness.controller.getSnapshot().controls),
    { listen: false, speak: false, stop: false, retry: false, change: false },
  );
  recognizer.emitStart();
  assert.equal(harness.controller.getSnapshot().controls.canStop, true);
  harness.controller.stopSpeaking();
  assert.equal(harness.controller.getSnapshot().controls.canStop, false);
  recognizer.emitResult([["book", 1]]);
  assert.deepEqual(
    pickControls(harness.controller.getSnapshot().controls),
    { listen: true, speak: true, stop: false, retry: true, change: true },
  );

  const inaccessibleLoad = harness.controller.beginLoad({ setId: "missing-set" });
  harness.controller.rejectLoad("LEARNING_SET_NOT_FOUND", {
    loadGeneration: inaccessibleLoad.generation,
  });
  assert.equal(harness.events.some(({ phase }) => phase === SPEAKING_PRACTICE_PHASES.CANCELLING), true);
  assert.deepEqual(
    pickControls(harness.controller.getSnapshot().controls),
    { listen: false, speak: false, stop: false, retry: false, change: false },
  );
});

test("controller surface contains no write, upload, scoring, provider, or automatic-restart command", () => {
  const harness = createHarness();
  const keys = Object.keys(harness.controller);
  for (const forbidden of [
    "recordMeaningfulEvent", "post", "persist", "upload", "score", "provider", "restart",
  ]) {
    assert.equal(keys.includes(forbidden), false);
  }
  assert.deepEqual(keys.sort(), [
    "acceptLearningSet",
    "beginLoad",
    "cancel",
    "confirmDisclosureAndStart",
    "dispose",
    "getSnapshot",
    "listen",
    "rejectLoad",
    "replaceTarget",
    "requestSpeak",
    "retry",
    "stopSpeaking",
  ]);
});

function pickControls(controls) {
  return {
    listen: controls.canListen,
    speak: controls.canSpeak,
    stop: controls.canStop,
    retry: controls.canRetry,
    change: controls.canChangeTarget,
  };
}
