import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate } from "node:timers";
import {
  createReferencePlaybackCoordinator,
  REFERENCE_PLAYBACK_PHASES,
} from "../src/pronunciation/reference-playback-coordinator.js";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

function flushPromises() {
  return new Promise((resolve) => setImmediate(resolve));
}

function createHarness({
  audioSupported = true,
  ttsSupported = true,
  audioBehavior = {},
  recognitionPhase = "IDLE",
} = {}) {
  const audioInstances = [];
  const utterances = [];
  const states = [];
  const order = [];
  let currentRecognitionPhase = recognitionPhase;

  function createAudio(url) {
    if (!audioSupported) return null;
    const playDeferred = audioBehavior.playDeferred ?? deferred();
    const audio = {
      url,
      calls: { play: 0, pause: 0 },
      playDeferred,
      play() {
        this.calls.play += 1;
        order.push("audio.play");
        if (audioBehavior.playThrows) throw new Error("private play detail");
        return playDeferred.promise;
      },
      pause() {
        this.calls.pause += 1;
        order.push("audio.pause");
        if (audioBehavior.pauseThrows) throw new Error("private pause detail");
      },
      emit(type) {
        this[`on${type}`]?.();
      },
    };
    audioInstances.push(audio);
    return audio;
  }

  const speechSynthesis = ttsSupported ? {
    calls: { cancel: 0, speak: 0 },
    getVoices() {
      return [{ lang: "vi-VN" }, { lang: "en-US", default: true }];
    },
    cancel() {
      this.calls.cancel += 1;
      order.push("tts.cancel");
      if (audioBehavior.cancelThrows) throw new Error("private cancel detail");
    },
    speak(utterance) {
      this.calls.speak += 1;
      order.push("tts.speak");
      if (audioBehavior.speakThrows) throw new Error("private speak detail");
      utterances.push(utterance);
    },
  } : null;

  function createUtterance(text) {
    return { text, lang: "", voice: null, onend: null, onerror: null };
  }

  const coordinator = createReferencePlaybackCoordinator({
    createAudio: audioSupported ? createAudio : null,
    speechSynthesis,
    createUtterance,
    getRecognitionPhase: () => currentRecognitionPhase,
    cancelRecognition: () => {
      order.push("recognition.cancel");
      currentRecognitionPhase = "CANCELLED";
    },
    onStateChange: (state) => states.push(state),
  });

  return {
    coordinator,
    audioInstances,
    utterances,
    speechSynthesis,
    states,
    order,
    setRecognitionPhase: (phase) => { currentRecognitionPhase = phase; },
    getRecognitionPhase: () => currentRecognitionPhase,
  };
}

function listen(coordinator, overrides = {}) {
  return coordinator.listen({
    targetId: "vocabulary-1",
    text: "teacher",
    audioUrl: "https://cdn.example/teacher.mp3",
    ...overrides,
  });
}

test("stored pronunciation audio is preferred when a URL is present", async () => {
  const harness = createHarness();
  const result = listen(harness.coordinator);
  assert.equal(result.ok, true);
  assert.equal(harness.audioInstances.length, 1);
  assert.equal(harness.speechSynthesis.calls.speak, 0);
  assert.equal(harness.coordinator.getSnapshot().phase, REFERENCE_PLAYBACK_PHASES.LOADING_AUDIO);

  harness.audioInstances[0].playDeferred.resolve();
  await flushPromises();
  assert.equal(harness.coordinator.getSnapshot().phase, REFERENCE_PLAYBACK_PHASES.PLAYING_AUDIO);
});

test("browser TTS is used when the stored URL is absent", () => {
  const harness = createHarness();
  const result = listen(harness.coordinator, { audioUrl: null });
  assert.equal(result.ok, true);
  assert.equal(harness.audioInstances.length, 0);
  assert.equal(harness.speechSynthesis.calls.speak, 1);
  assert.equal(harness.utterances[0].text, "teacher");
  assert.equal(harness.utterances[0].lang, "en-US");
  assert.equal(harness.coordinator.getSnapshot().phase, REFERENCE_PLAYBACK_PHASES.SPEAKING_TTS);
});

test("audio rejection falls back to browser TTS", async () => {
  const harness = createHarness();
  listen(harness.coordinator);
  harness.audioInstances[0].playDeferred.reject(new Error("private play detail"));
  await flushPromises();
  assert.equal(harness.speechSynthesis.calls.speak, 1);
  assert.equal(harness.coordinator.getSnapshot().phase, REFERENCE_PLAYBACK_PHASES.SPEAKING_TTS);
});

test("missing audio and TTS support fails safely", () => {
  const harness = createHarness({ audioSupported: false, ttsSupported: false });
  const result = listen(harness.coordinator);
  assert.equal(result.ok, false);
  assert.equal(result.issue, "NO_PLAYBACK_AVAILABLE");
  assert.equal(harness.coordinator.getSnapshot().phase, REFERENCE_PLAYBACK_PHASES.ERROR);
});

test("ordinary Listen is rejected without cancellation during recognition-active phases", () => {
  for (const phase of ["STARTING", "LISTENING", "FINALIZING"]) {
    const harness = createHarness({ recognitionPhase: phase });
    const snapshot = harness.coordinator.getSnapshot();
    const result = listen(harness.coordinator);
    assert.deepEqual(result, {
      ok: false,
      issue: "RECOGNITION_ACTIVE",
      generation: null,
    });
    assert.equal(harness.order.includes("recognition.cancel"), false);
    assert.equal(harness.audioInstances.length, 0);
    assert.equal(harness.speechSynthesis.calls.speak, 0);
    assert.equal(harness.getRecognitionPhase(), phase);
    assert.deepEqual(harness.coordinator.getSnapshot(), snapshot);
  }
});

test("a defensive phase race cancels recognition before playback or rejects safely", () => {
  const order = [];
  let phase = "IDLE";
  const coordinator = createReferencePlaybackCoordinator({
    createAudio: () => {
      phase = "STARTING";
      return {
        play() {
          order.push("audio.play");
          return new Promise(() => {});
        },
        pause() {},
      };
    },
    getRecognitionPhase: () => phase,
    cancelRecognition: () => {
      order.push("recognition.cancel");
      phase = "CANCELLED";
    },
  });
  assert.equal(listen(coordinator).ok, true);
  assert.deepEqual(order, ["recognition.cancel", "audio.play"]);

  let blockedPhase = "IDLE";
  const blocked = createReferencePlaybackCoordinator({
    createAudio: () => {
      blockedPhase = "LISTENING";
      return {
        play: () => assert.fail("audio must not start"),
        pause() {},
      };
    },
    getRecognitionPhase: () => blockedPhase,
    cancelRecognition: () => { blockedPhase = "LISTENING"; },
  });
  assert.deepEqual(listen(blocked), {
    ok: false,
    issue: "RECOGNITION_ACTIVE",
    generation: null,
  });
});

test("a defensive TTS race cancels recognition before speak or rejects safely", () => {
  const order = [];
  let phase = "IDLE";
  const coordinator = createReferencePlaybackCoordinator({
    createAudio: null,
    speechSynthesis: {
      cancel() {},
      getVoices: () => [],
      speak: () => order.push("tts.speak"),
    },
    createUtterance(text) {
      phase = "STARTING";
      return { text };
    },
    getRecognitionPhase: () => phase,
    cancelRecognition: () => {
      order.push("recognition.cancel");
      phase = "CANCELLED";
    },
  });
  assert.equal(listen(coordinator, { audioUrl: null }).ok, true);
  assert.deepEqual(order, ["recognition.cancel", "tts.speak"]);
  assert.equal(phase, "CANCELLED");

  let blockedPhase = "IDLE";
  let speakCalls = 0;
  const blocked = createReferencePlaybackCoordinator({
    createAudio: null,
    speechSynthesis: {
      cancel() {},
      getVoices: () => [],
      speak: () => { speakCalls += 1; },
    },
    createUtterance(text) {
      blockedPhase = "LISTENING";
      return { text };
    },
    getRecognitionPhase: () => blockedPhase,
    cancelRecognition: () => { blockedPhase = "LISTENING"; },
  });
  assert.deepEqual(listen(blocked, { audioUrl: null }), {
    ok: false,
    issue: "RECOGNITION_ACTIVE",
    generation: null,
  });
  assert.equal(speakCalls, 0);
  assert.equal(blockedPhase, "LISTENING");
});

test("initial recognition phase reentrancy invalidates the initiating Listen", async (t) => {
  for (const channel of ["audio", "tts"]) {
    for (const action of ["cancel", "replaceTarget", "dispose"]) {
      await t.test(`${channel} ${action}`, async () => {
        let coordinator;
        let invalidated = false;
        let audioPlayCalls = 0;
        let ttsSpeakCalls = 0;
        coordinator = createReferencePlaybackCoordinator({
          createAudio: channel === "audio" ? () => ({
            pause() {},
            play() {
              audioPlayCalls += 1;
              return Promise.resolve();
            },
          }) : null,
          speechSynthesis: {
            cancel() {},
            getVoices: () => [],
            speak: () => { ttsSpeakCalls += 1; },
          },
          createUtterance: (text) => ({ text }),
          getRecognitionPhase() {
            if (!invalidated) {
              invalidated = true;
              if (action === "replaceTarget") coordinator.replaceTarget("vocabulary-2");
              else coordinator[action]();
            }
            return "IDLE";
          },
        });

        const result = listen(coordinator, {
          audioUrl: channel === "audio" ? "audio.mp3" : null,
        });
        const snapshot = coordinator.getSnapshot();
        await flushPromises();

        assert.equal(result.ok, false);
        assert.equal(audioPlayCalls, 0);
        assert.equal(ttsSpeakCalls, 0);
        assert.deepEqual(coordinator.getSnapshot(), snapshot);
        assert.equal(snapshot.generation, 1);
        assert.equal(
          snapshot.phase,
          action === "dispose" ? REFERENCE_PLAYBACK_PHASES.DISPOSED : REFERENCE_PLAYBACK_PHASES.IDLE,
        );
        assert.equal(
          snapshot.targetId,
          action === "replaceTarget" ? "vocabulary-2" : null,
        );
      });
    }
  }
});

test("stale Audio pause cleanup cannot cancel a newer reentrant TTS Listen", () => {
  let coordinator;
  let reenterOnPause = false;
  let nestedResult;
  let audioPlayCalls = 0;
  let ttsCancelCalls = 0;
  let ttsSpeakCalls = 0;
  let ttsSpeaking = false;
  const oldAudio = {
    play() {
      audioPlayCalls += 1;
      return new Promise(() => {});
    },
    pause() {
      if (!reenterOnPause) return;
      reenterOnPause = false;
      nestedResult = coordinator.listen({
        targetId: "vocabulary-new",
        text: "student",
        audioUrl: null,
      });
      throw new Error("private pause detail after reentry");
    },
  };

  coordinator = createReferencePlaybackCoordinator({
    createAudio: () => oldAudio,
    speechSynthesis: {
      cancel() {
        ttsCancelCalls += 1;
        ttsSpeaking = false;
      },
      getVoices: () => [],
      speak() {
        ttsSpeakCalls += 1;
        ttsSpeaking = true;
      },
    },
    createUtterance: (text) => ({ text }),
  });

  assert.equal(listen(coordinator).ok, true);
  reenterOnPause = true;
  const outerResult = listen(coordinator, {
    targetId: "vocabulary-obsolete",
    text: "obsolete",
    audioUrl: "obsolete.mp3",
  });

  assert.equal(outerResult.ok, false);
  assert.equal(nestedResult.ok, true);
  assert.equal(audioPlayCalls, 1);
  assert.equal(ttsSpeakCalls, 1);
  assert.equal(ttsCancelCalls, 2);
  assert.equal(ttsSpeaking, true);
  assert.deepEqual(coordinator.getSnapshot(), {
    generation: 3,
    targetId: "vocabulary-new",
    phase: REFERENCE_PLAYBACK_PHASES.SPEAKING_TTS,
    issue: null,
  });
});

test("dispose is authoritative before reentrant TTS cancellation", () => {
  let coordinator;
  let reenterOnCancel = false;
  let audioPlayCalls = 0;
  let ttsCancelCalls = 0;
  let oldTtsSpeaking = false;
  const nestedResults = [];

  coordinator = createReferencePlaybackCoordinator({
    createAudio: () => ({
      pause() {},
      play() {
        audioPlayCalls += 1;
        return new Promise(() => {});
      },
    }),
    speechSynthesis: {
      cancel() {
        ttsCancelCalls += 1;
        oldTtsSpeaking = false;
        if (!reenterOnCancel) return;
        reenterOnCancel = false;
        for (let index = 0; index < 2; index += 1) {
          nestedResults.push(coordinator.listen({
            targetId: `vocabulary-new-${index}`,
            text: "student",
            audioUrl: "new.mp3",
          }));
        }
        throw new Error("private cancel detail after reentry");
      },
      getVoices: () => [],
      speak() {
        oldTtsSpeaking = true;
      },
    },
    createUtterance: (text) => ({ text }),
  });

  assert.equal(listen(coordinator, { audioUrl: null }).ok, true);
  assert.equal(oldTtsSpeaking, true);
  reenterOnCancel = true;
  const disposeResult = coordinator.dispose();

  assert.equal(disposeResult.ok, true);
  assert.equal(audioPlayCalls, 0);
  assert.equal(oldTtsSpeaking, false);
  assert.equal(ttsCancelCalls, 2);
  assert.deepEqual(nestedResults.map(({ ok, issue }) => ({ ok, issue })), [
    { ok: false, issue: "DISPOSED" },
    { ok: false, issue: "DISPOSED" },
  ]);
  assert.deepEqual(coordinator.getSnapshot(), {
    generation: 2,
    targetId: "vocabulary-1",
    phase: REFERENCE_PLAYBACK_PHASES.DISPOSED,
    issue: null,
  });
  assert.deepEqual(coordinator.dispose(), disposeResult);
  assert.equal(ttsCancelCalls, 2);
});

test("global TTS cancellation rejects nested Listen until cleanup returns", () => {
  let coordinator;
  let reenterOnCancel = false;
  const nestedResults = [];
  let recognitionCallsBeforeNested;
  let recognitionCallsAfterNested;
  let recognitionPhaseCalls = 0;
  let speakCalls = 0;
  let nativeSpeaking = false;
  const order = [];

  coordinator = createReferencePlaybackCoordinator({
    createAudio: null,
    speechSynthesis: {
      cancel() {
        order.push("tts.cancel");
        nativeSpeaking = false;
        if (!reenterOnCancel) return;
        reenterOnCancel = false;
        order.push("nested.listen");
        recognitionCallsBeforeNested = recognitionPhaseCalls;
        for (let index = 0; index < 2; index += 1) {
          nestedResults.push(coordinator.listen({
            targetId: `vocabulary-nested-${index}`,
            text: "nested",
            audioUrl: null,
          }));
        }
        recognitionCallsAfterNested = recognitionPhaseCalls;
      },
      getVoices: () => [],
      speak() {
        speakCalls += 1;
        nativeSpeaking = true;
        order.push("tts.speak");
      },
    },
    createUtterance: (text) => ({ text }),
    getRecognitionPhase() {
      recognitionPhaseCalls += 1;
      return "IDLE";
    },
  });

  assert.equal(listen(coordinator, { audioUrl: null }).ok, true);
  reenterOnCancel = true;
  const outerResult = coordinator.listen({
    targetId: "vocabulary-outer",
    text: "outer",
    audioUrl: null,
  });

  assert.deepEqual(nestedResults, [
    { ok: false, issue: null, generation: null },
    { ok: false, issue: null, generation: null },
  ]);
  assert.equal(outerResult.ok, true);
  assert.equal(recognitionCallsAfterNested, recognitionCallsBeforeNested);
  assert.equal(speakCalls, 2);
  assert.equal(nativeSpeaking, true);
  assert.deepEqual(order.slice(-3), ["tts.cancel", "nested.listen", "tts.speak"]);
  assert.deepEqual(coordinator.getSnapshot(), {
    generation: 2,
    targetId: "vocabulary-outer",
    phase: REFERENCE_PLAYBACK_PHASES.SPEAKING_TTS,
    issue: null,
  });
});

test("global TTS cancellation guard covers every cleanup initiator", async (t) => {
  const cases = [
    {
      name: "prepareForRecognition",
      invoke(coordinator, order) {
        return coordinator.prepareForRecognition({
          targetId: "vocabulary-1",
          startRecognition() {
            order.push("recognition.start");
            return { ok: true };
          },
        });
      },
      expectedPhase: REFERENCE_PLAYBACK_PHASES.IDLE,
      expectedTarget: "vocabulary-1",
      expectedOrderSuffix: ["nested.listen", "recognition.start"],
    },
    {
      name: "cancel",
      invoke: (coordinator) => coordinator.cancel(),
      expectedPhase: REFERENCE_PLAYBACK_PHASES.IDLE,
      expectedTarget: "vocabulary-1",
    },
    {
      name: "stop",
      invoke: (coordinator) => coordinator.stop(),
      expectedPhase: REFERENCE_PLAYBACK_PHASES.IDLE,
      expectedTarget: "vocabulary-1",
    },
    {
      name: "replaceTarget",
      invoke: (coordinator) => coordinator.replaceTarget("vocabulary-replacement"),
      expectedPhase: REFERENCE_PLAYBACK_PHASES.IDLE,
      expectedTarget: "vocabulary-replacement",
    },
  ];

  for (const scenario of cases) {
    await t.test(scenario.name, () => {
      let coordinator;
      let armed = false;
      let nestedResult;
      let speakCalls = 0;
      const order = [];
      coordinator = createReferencePlaybackCoordinator({
        createAudio: null,
        speechSynthesis: {
          cancel() {
            order.push("tts.cancel");
            if (!armed) return;
            armed = false;
            order.push("nested.listen");
            nestedResult = coordinator.listen({
              targetId: "vocabulary-nested",
              text: "nested",
              audioUrl: null,
            });
          },
          getVoices: () => [],
          speak() {
            speakCalls += 1;
            order.push("tts.speak");
          },
        },
        createUtterance: (text) => ({ text }),
      });

      assert.equal(listen(coordinator, { audioUrl: null }).ok, true);
      armed = true;
      const result = scenario.invoke(coordinator, order);

      assert.equal(result.ok, true);
      assert.deepEqual(nestedResult, { ok: false, issue: null, generation: null });
      assert.equal(speakCalls, 1);
      assert.equal(coordinator.getSnapshot().generation, 2);
      assert.equal(coordinator.getSnapshot().targetId, scenario.expectedTarget);
      assert.equal(coordinator.getSnapshot().phase, scenario.expectedPhase);
      if (scenario.expectedOrderSuffix) {
        assert.deepEqual(
          order.slice(-scenario.expectedOrderSuffix.length),
          scenario.expectedOrderSuffix,
        );
      }
    });
  }
});

test("terminal cleanup rejects nested playback for completion and error", async (t) => {
  for (const terminal of ["onend", "onerror"]) {
    await t.test(terminal, () => {
      let coordinator;
      let armed = false;
      let nestedResult;
      let speakCalls = 0;
      let utterance;
      coordinator = createReferencePlaybackCoordinator({
        createAudio: null,
        speechSynthesis: {
          cancel() {
            if (!armed) return;
            armed = false;
            nestedResult = coordinator.listen({
              targetId: "vocabulary-nested",
              text: "nested",
              audioUrl: null,
            });
          },
          getVoices: () => [],
          speak(value) {
            speakCalls += 1;
            utterance = value;
          },
        },
        createUtterance: (text) => ({ text }),
      });

      assert.equal(listen(coordinator, { audioUrl: null }).ok, true);
      armed = true;
      utterance[terminal]();

      assert.deepEqual(nestedResult, { ok: false, issue: null, generation: null });
      assert.equal(speakCalls, 1);
      assert.deepEqual(coordinator.getSnapshot(), {
        generation: 1,
        targetId: "vocabulary-1",
        phase: terminal === "onend"
          ? REFERENCE_PLAYBACK_PHASES.IDLE
          : REFERENCE_PLAYBACK_PHASES.ERROR,
        issue: terminal === "onend" ? null : "PLAYBACK_FAILED",
      });
    });
  }
});

test("disposal and repeated nested Listen attempts remain authoritative during cancellation", () => {
  let coordinator;
  let armed = false;
  let speakCalls = 0;
  const nestedResults = [];
  coordinator = createReferencePlaybackCoordinator({
    createAudio: null,
    speechSynthesis: {
      cancel() {
        if (!armed) return;
        armed = false;
        for (let index = 0; index < 3; index += 1) {
          nestedResults.push(coordinator.listen({
            targetId: `vocabulary-nested-${index}`,
            text: "nested",
            audioUrl: null,
          }));
        }
      },
      getVoices: () => [],
      speak() { speakCalls += 1; },
    },
    createUtterance: (text) => ({ text }),
  });

  assert.equal(listen(coordinator, { audioUrl: null }).ok, true);
  armed = true;
  assert.equal(coordinator.dispose().ok, true);

  assert.deepEqual(nestedResults.map(({ ok, issue }) => ({ ok, issue })), [
    { ok: false, issue: "DISPOSED" },
    { ok: false, issue: "DISPOSED" },
    { ok: false, issue: "DISPOSED" },
  ]);
  assert.equal(speakCalls, 1);
  assert.deepEqual(coordinator.getSnapshot(), {
    generation: 2,
    targetId: "vocabulary-1",
    phase: REFERENCE_PLAYBACK_PHASES.DISPOSED,
    issue: null,
  });
});

test("throwing global TTS cancellation always releases the critical-section guard", () => {
  let cancelThrows = false;
  let speakCalls = 0;
  const coordinator = createReferencePlaybackCoordinator({
    createAudio: null,
    speechSynthesis: {
      cancel() {
        if (cancelThrows) throw new Error("private cancel detail");
      },
      getVoices: () => [],
      speak() { speakCalls += 1; },
    },
    createUtterance: (text) => ({ text }),
  });

  assert.equal(listen(coordinator, { audioUrl: null }).ok, true);
  cancelThrows = true;
  assert.equal(coordinator.cancel().ok, true);
  cancelThrows = false;
  const laterResult = coordinator.listen({
    targetId: "vocabulary-later",
    text: "later",
    audioUrl: null,
  });

  assert.equal(laterResult.ok, true);
  assert.equal(speakCalls, 2);
  assert.deepEqual(coordinator.getSnapshot(), {
    generation: 3,
    targetId: "vocabulary-later",
    phase: REFERENCE_PLAYBACK_PHASES.SPEAKING_TTS,
    issue: null,
  });
});

test("initial IDLE reentrancy cannot replace the initiating Listen owner", async (t) => {
  for (const channel of ["audio", "tts"]) {
    for (const action of ["cancel", "replaceTarget", "dispose"]) {
      await t.test(`${channel} ${action}`, async () => {
        let coordinator;
        let invalidated = false;
        let audioPlayCalls = 0;
        let ttsSpeakCalls = 0;
        coordinator = createReferencePlaybackCoordinator({
          createAudio: channel === "audio" ? () => ({
            pause() {},
            play() {
              audioPlayCalls += 1;
              return Promise.resolve();
            },
          }) : null,
          speechSynthesis: {
            cancel() {},
            getVoices: () => [],
            speak: () => { ttsSpeakCalls += 1; },
          },
          createUtterance: (text) => ({ text }),
          onStateChange(state) {
            if (invalidated || state.phase !== REFERENCE_PLAYBACK_PHASES.IDLE
              || state.generation !== 1) return;
            invalidated = true;
            if (action === "replaceTarget") coordinator.replaceTarget("vocabulary-2");
            else coordinator[action]();
          },
        });

        const result = listen(coordinator, {
          audioUrl: channel === "audio" ? "audio.mp3" : null,
        });
        const snapshot = coordinator.getSnapshot();
        await flushPromises();

        assert.equal(result.ok, false);
        assert.equal(audioPlayCalls, 0);
        assert.equal(ttsSpeakCalls, 0);
        assert.deepEqual(coordinator.getSnapshot(), snapshot);
        assert.equal(snapshot.generation, 2);
        assert.equal(
          snapshot.phase,
          action === "dispose" ? REFERENCE_PLAYBACK_PHASES.DISPOSED : REFERENCE_PLAYBACK_PHASES.IDLE,
        );
        assert.equal(
          snapshot.targetId,
          action === "replaceTarget" ? "vocabulary-2" : "vocabulary-1",
        );
      });
    }
  }
});

test("LOADING_AUDIO reentrancy cannot start obsolete native playback", async (t) => {
  for (const action of ["cancel", "replaceTarget", "dispose"]) {
    await t.test(action, () => {
      let coordinator;
      let playCalls = 0;
      let invalidated = false;
      coordinator = createReferencePlaybackCoordinator({
        createAudio: () => ({
          pause() {},
          play() {
            playCalls += 1;
            return Promise.resolve();
          },
        }),
        onStateChange(state) {
          if (invalidated || state.phase !== REFERENCE_PLAYBACK_PHASES.LOADING_AUDIO) return;
          invalidated = true;
          if (action === "replaceTarget") coordinator.replaceTarget("vocabulary-2");
          else coordinator[action]();
        },
      });

      const result = listen(coordinator);
      assert.equal(result.ok, false);
      assert.equal(playCalls, 0);
      if (action === "replaceTarget") {
        assert.deepEqual(coordinator.getSnapshot(), {
          generation: 2,
          targetId: "vocabulary-2",
          phase: REFERENCE_PLAYBACK_PHASES.IDLE,
          issue: null,
        });
      } else {
        assert.equal(
          coordinator.getSnapshot().phase,
          action === "dispose" ? REFERENCE_PLAYBACK_PHASES.DISPOSED : REFERENCE_PLAYBACK_PHASES.IDLE,
        );
        assert.equal(coordinator.getSnapshot().generation, 2);
      }
    });
  }
});

test("Audio construction reentrancy preserves invalidated ownership", () => {
  let coordinator;
  let playCalls = 0;
  coordinator = createReferencePlaybackCoordinator({
    createAudio: () => {
      coordinator.cancel();
      return {
        pause() {},
        play() {
          playCalls += 1;
          return Promise.resolve();
        },
      };
    },
  });

  const result = listen(coordinator);
  assert.equal(result.ok, false);
  assert.equal(playCalls, 0);
  assert.deepEqual(coordinator.getSnapshot(), {
    generation: 2,
    targetId: "vocabulary-1",
    phase: REFERENCE_PLAYBACK_PHASES.IDLE,
    issue: null,
  });
});

test("TTS pre-use reentrancy cannot start obsolete speech", () => {
  let coordinator;
  let speakCalls = 0;
  coordinator = createReferencePlaybackCoordinator({
    createAudio: null,
    speechSynthesis: {
      cancel() {},
      getVoices: () => [],
      speak: () => { speakCalls += 1; },
    },
    createUtterance(text) {
      coordinator.cancel();
      return { text };
    },
  });

  const result = listen(coordinator, { audioUrl: null });
  assert.equal(result.ok, false);
  assert.equal(speakCalls, 0);
  assert.deepEqual(coordinator.getSnapshot(), {
    generation: 2,
    targetId: "vocabulary-1",
    phase: REFERENCE_PLAYBACK_PHASES.IDLE,
    issue: null,
  });
});

test("synchronous TTS terminal callbacks preserve their terminal state", async (t) => {
  await t.test("end", () => {
    const states = [];
    const coordinator = createReferencePlaybackCoordinator({
      createAudio: null,
      speechSynthesis: {
        cancel() {},
        getVoices: () => [],
        speak: (utterance) => utterance.onend(),
      },
      createUtterance: (text) => ({ text }),
      onStateChange: (state) => states.push(state),
    });

    assert.equal(listen(coordinator, { audioUrl: null }).ok, true);
    assert.equal(coordinator.getSnapshot().phase, REFERENCE_PLAYBACK_PHASES.IDLE);
    assert.equal(states.some(({ phase }) => phase === REFERENCE_PLAYBACK_PHASES.SPEAKING_TTS), false);
  });

  await t.test("error", () => {
    const states = [];
    const coordinator = createReferencePlaybackCoordinator({
      createAudio: null,
      speechSynthesis: {
        cancel() {},
        getVoices: () => [],
        speak(utterance) {
          utterance.onerror(new Error("private native detail"));
        },
      },
      createUtterance: (text) => ({ text }),
      onStateChange: (state) => states.push(state),
    });

    assert.equal(listen(coordinator, { audioUrl: null }).ok, true);
    assert.deepEqual(coordinator.getSnapshot(), {
      generation: 1,
      targetId: "vocabulary-1",
      phase: REFERENCE_PLAYBACK_PHASES.ERROR,
      issue: "PLAYBACK_FAILED",
    });
    assert.equal(states.filter(({ phase }) => phase === REFERENCE_PLAYBACK_PHASES.ERROR).length, 1);
    assert.equal(states.some(({ phase }) => phase === REFERENCE_PLAYBACK_PHASES.SPEAKING_TTS), false);
    assert.equal(JSON.stringify(coordinator.getSnapshot()).includes("private"), false);
  });
});

test("synchronous Audio terminal callbacks cannot be overwritten by its play promise", async (t) => {
  await t.test("ended", async () => {
    const states = [];
    const coordinator = createReferencePlaybackCoordinator({
      createAudio: () => ({
        pause() {},
        play() {
          this.onended();
          return Promise.resolve();
        },
      }),
      onStateChange: (state) => states.push(state),
    });

    assert.equal(listen(coordinator).ok, true);
    await flushPromises();
    assert.equal(coordinator.getSnapshot().phase, REFERENCE_PLAYBACK_PHASES.IDLE);
    assert.equal(states.filter(({ phase }) => phase === REFERENCE_PLAYBACK_PHASES.IDLE).length, 2);
    assert.equal(states.some(({ phase }) => phase === REFERENCE_PLAYBACK_PHASES.PLAYING_AUDIO), false);
  });

  await t.test("error fallback", async () => {
    const states = [];
    let speakCalls = 0;
    const coordinator = createReferencePlaybackCoordinator({
      createAudio: () => ({
        pause() {},
        play() {
          this.onerror(new Error("private native detail"));
          return Promise.resolve();
        },
      }),
      speechSynthesis: {
        cancel() {},
        getVoices: () => [],
        speak: () => { speakCalls += 1; },
      },
      createUtterance: (text) => ({ text }),
      onStateChange: (state) => states.push(state),
    });

    assert.equal(listen(coordinator).ok, true);
    await flushPromises();
    assert.equal(speakCalls, 1);
    assert.equal(coordinator.getSnapshot().phase, REFERENCE_PLAYBACK_PHASES.SPEAKING_TTS);
    assert.equal(states.filter(({ phase }) => phase === REFERENCE_PLAYBACK_PHASES.SPEAKING_TTS).length, 1);
    assert.equal(states.some(({ phase }) => phase === REFERENCE_PLAYBACK_PHASES.PLAYING_AUDIO), false);
    assert.equal(JSON.stringify(coordinator.getSnapshot()).includes("private"), false);
  });
});

test("recognition preparation stops audio and TTS before starting recognition", () => {
  const harness = createHarness();
  listen(harness.coordinator);
  const result = harness.coordinator.prepareForRecognition({
    targetId: "vocabulary-1",
    startRecognition() {
      harness.order.push("recognition.start");
      return { ok: true };
    },
  });
  assert.equal(result.ok, true);
  assert.ok(harness.order.indexOf("audio.pause") < harness.order.indexOf("recognition.start"));
  assert.ok(harness.order.indexOf("tts.cancel") < harness.order.indexOf("recognition.start"));
});

test("rapid Listen then Speak suppresses stale playback completion", async () => {
  const harness = createHarness();
  listen(harness.coordinator);
  const audio = harness.audioInstances[0];
  harness.coordinator.prepareForRecognition({
    targetId: "vocabulary-1",
    startRecognition: () => ({ ok: true }),
  });
  const snapshot = harness.coordinator.getSnapshot();
  audio.playDeferred.resolve();
  await flushPromises();
  assert.deepEqual(harness.coordinator.getSnapshot(), snapshot);
  assert.equal(audio.calls.pause >= 1, true);
});

test("late audio rejection cannot start fallback for an obsolete target", async () => {
  const harness = createHarness();
  listen(harness.coordinator);
  const audio = harness.audioInstances[0];
  harness.coordinator.replaceTarget("vocabulary-2");
  audio.playDeferred.reject(new Error("late private detail"));
  await flushPromises();
  assert.equal(harness.speechSynthesis.calls.speak, 0);
  assert.equal(harness.coordinator.getSnapshot().targetId, "vocabulary-2");
});

test("late audio resolution cannot restore stale playback state", async () => {
  const harness = createHarness();
  listen(harness.coordinator);
  const audio = harness.audioInstances[0];
  harness.coordinator.cancel();
  const snapshot = harness.coordinator.getSnapshot();
  audio.playDeferred.resolve();
  await flushPromises();
  assert.deepEqual(harness.coordinator.getSnapshot(), snapshot);
});

test("TTS callbacks after cancellation are ignored", () => {
  const harness = createHarness();
  listen(harness.coordinator, { audioUrl: null });
  const utterance = harness.utterances[0];
  harness.coordinator.cancel();
  const snapshot = harness.coordinator.getSnapshot();
  utterance.onend?.();
  utterance.onerror?.();
  assert.deepEqual(harness.coordinator.getSnapshot(), snapshot);
});

test("target replacement invalidates prior audio ownership", async () => {
  const harness = createHarness();
  listen(harness.coordinator);
  const oldAudio = harness.audioInstances[0];
  harness.coordinator.replaceTarget("vocabulary-2");
  listen(harness.coordinator, {
    targetId: "vocabulary-2",
    text: "student",
    audioUrl: null,
  });
  oldAudio.emit("error");
  oldAudio.playDeferred.resolve();
  await flushPromises();
  assert.equal(harness.coordinator.getSnapshot().targetId, "vocabulary-2");
  assert.equal(harness.coordinator.getSnapshot().phase, REFERENCE_PLAYBACK_PHASES.SPEAKING_TTS);
});

test("dispose detaches callbacks and blocks future playback", async () => {
  const harness = createHarness();
  listen(harness.coordinator);
  const audio = harness.audioInstances[0];
  harness.coordinator.dispose();
  const snapshot = harness.coordinator.getSnapshot();
  assert.equal(snapshot.phase, REFERENCE_PLAYBACK_PHASES.DISPOSED);
  assert.equal(audio.onended, null);
  assert.equal(audio.onerror, null);
  audio.playDeferred.reject(new Error("late private detail"));
  await flushPromises();
  assert.deepEqual(harness.coordinator.getSnapshot(), snapshot);
  assert.equal(listen(harness.coordinator).issue, "DISPOSED");
});

test("repeated stop, cancel, and dispose operations remain safe", () => {
  const harness = createHarness();
  listen(harness.coordinator, { audioUrl: null });
  assert.equal(harness.coordinator.stop().ok, true);
  assert.equal(harness.coordinator.stop().ok, true);
  assert.equal(harness.coordinator.cancel().ok, true);
  assert.equal(harness.coordinator.dispose().ok, true);
  assert.equal(harness.coordinator.dispose().ok, true);
});

test("synchronous native exceptions are sanitized and do not escape", async (t) => {
  for (const [name, audioBehavior] of [
    ["play", { playThrows: true }],
    ["pause", { pauseThrows: true }],
    ["cancel", { cancelThrows: true }],
    ["speak", { speakThrows: true }],
  ]) {
    await t.test(name, () => {
      const harness = createHarness({ audioBehavior });
      assert.doesNotThrow(() => listen(harness.coordinator, {
        audioUrl: name === "cancel" || name === "speak" ? null : "audio.mp3",
      }));
      assert.doesNotThrow(() => harness.coordinator.cancel());
      assert.equal(JSON.stringify(harness.coordinator.getSnapshot()).includes("private"), false);
    });
  }
});

test("coordinator exposes no microphone, upload, persistence, scoring, or provider surface", () => {
  const harness = createHarness();
  assert.deepEqual(Object.keys(harness.coordinator).sort(), [
    "cancel",
    "dispose",
    "getSnapshot",
    "listen",
    "prepareForRecognition",
    "replaceTarget",
    "stop",
  ]);
  for (const forbidden of ["microphone", "upload", "persist", "score", "provider", "recognize"]) {
    assert.equal(forbidden in harness.coordinator, false);
  }
});
