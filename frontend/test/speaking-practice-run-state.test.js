import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { prepareSpeakingPracticeSession } from "../src/pronunciation/speaking-practice-page-session.js";
import {
  clearSpeakingPracticeRunStateNamespace,
  completeSpeakingPracticeBatch,
  continueSpeakingPracticeRun,
  createSpeakingPracticeRunState,
  currentSpeakingPracticeBatchIds,
  loadSpeakingPracticeRunState,
  reconcileSpeakingPracticeRun,
  restartSpeakingPracticeRun,
  saveSpeakingPracticeRunState,
  selectSpeakingPracticeVocabulary,
  summarizeSpeakingPracticeRun,
} from "../src/pronunciation/speaking-practice-run-state.js";

test("Speaking snapshots create stable batches for zero, short, exact-ten and long Sets", () => {
  for (const size of [0, 4, 10, 21]) {
    const ids = vocabularyIds(size);
    const state = createSpeakingPracticeRunState("user", "set", ids);
    assert.deepEqual(state.ordered_run.batches.map((batch) => batch.length),
      size === 0 ? [] : size <= 10 ? [size] : size === 10 ? [10] : [10, 10, 1]);
    assert.ok(state.ordered_run.batches.every((batch) => new Set(batch).size === batch.length && batch.length <= 10));
  }
});

test("fresh membership initializes order while restoration excludes additions, reorder and refill", () => {
  const original = vocabularyIds(12);
  let state = createSpeakingPracticeRunState("user", "set");
  state = reconcileSpeakingPracticeRun(state, original);
  assert.deepEqual(currentSpeakingPracticeBatchIds(state), original.slice(0, 10));

  state = reconcileSpeakingPracticeRun(state, ["new-word", ...original.filter((id) => id !== "word-2").reverse()]);
  assert.deepEqual(state.ordered_run.snapshot_ids, original.filter((id) => id !== "word-2"));
  assert.deepEqual(currentSpeakingPracticeBatchIds(state), original.slice(0, 10).filter((id) => id !== "word-2"));
  assert.deepEqual(state.ordered_run.batches.map((batch) => batch.length), [9, 2]);
});

test("same-tab cursor and explicit completion restore without recognition state", () => {
  const storage = memoryStorage();
  let state = createSpeakingPracticeRunState("user", "set", vocabularyIds(11));
  state = selectSpeakingPracticeVocabulary(state, "word-6");
  assert.equal(saveSpeakingPracticeRunState(storage, {
    ...state,
    transcript: "must not persist",
    confidence: 0.99,
    result: { outcome: "MATCH" },
    recognition: { phase: "LISTENING" },
    audio: new Uint8Array([1]),
    score: 100,
    attempts: ["private"],
  }), false);
  assert.equal(saveSpeakingPracticeRunState(storage, state), true);

  let restored = loadSpeakingPracticeRunState(storage, "user", "set");
  assert.equal(restored.ordered_run.current_vocabulary_id, "word-6");
  assert.deepEqual(Object.keys(restored).sort(), ["mode", "ordered_run", "session_initialized", "set_id", "user_id", "version"]);
  assert.equal(JSON.stringify(restored).includes("must not persist"), false);
  assert.equal(JSON.stringify(restored).includes("LISTENING"), false);

  restored = completeSpeakingPracticeBatch(restored);
  saveSpeakingPracticeRunState(storage, restored);
  restored = loadSpeakingPracticeRunState(storage, "user", "set");
  assert.equal(summarizeSpeakingPracticeRun(restored).batch_completed, true);
  assert.equal(summarizeSpeakingPracticeRun(restored).full_run_completed, false);
});

test("continuation and restart are explicit and restart captures latest order", () => {
  const original = vocabularyIds(11);
  let state = createSpeakingPracticeRunState("user", "set", original);
  assert.equal(continueSpeakingPracticeRun(state), state);
  state = completeSpeakingPracticeBatch(state);
  assert.equal(summarizeSpeakingPracticeRun(state).next_batch_size, 1);
  state = continueSpeakingPracticeRun(state);
  assert.deepEqual(currentSpeakingPracticeBatchIds(state), ["word-11"]);
  state = completeSpeakingPracticeBatch(state);
  assert.equal(summarizeSpeakingPracticeRun(state).full_run_completed, true);
  assert.equal(continueSpeakingPracticeRun(state), state);

  const latest = ["new-2", "new-1"];
  state = restartSpeakingPracticeRun(state, latest);
  assert.deepEqual(state.ordered_run.snapshot_ids, latest);
  assert.equal(summarizeSpeakingPracticeRun(state).batch_completed, false);
});

test("authorized NORMAL manifest preparation returns only the current batch and restored cursor", () => {
  const ids = vocabularyIds(12);
  let state = createSpeakingPracticeRunState("user", "set", ids);
  state = selectSpeakingPracticeVocabulary(state, "word-5");
  const prepared = prepareSpeakingPracticeSession(state, manifest(ids));
  assert.deepEqual(prepared.learning_set.cards.map(({ id }) => id), ids.slice(0, 10));
  assert.equal(prepared.learning_set.total_items, 10);
  assert.equal(prepared.target_index, 4);
  assert.equal(JSON.stringify(prepared.state).includes("word label"), false);
});

test("malformed, stale-identity and unavailable storage fail safely with page-lifetime fallback", () => {
  const storage = memoryStorage();
  const state = createSpeakingPracticeRunState("user", "set", ["word-1"]);
  saveSpeakingPracticeRunState(storage, state);
  assert.equal(loadSpeakingPracticeRunState(storage, "other-user", "set"), null);

  const [key] = storage.keys();
  storage.setItem(key, "{");
  assert.equal(loadSpeakingPracticeRunState(storage, "user", "set"), null);

  const denied = throwingStorage();
  assert.equal(saveSpeakingPracticeRunState(denied, state), false);
  assert.equal(loadSpeakingPracticeRunState(denied, "user", "set").ordered_run.current_vocabulary_id, "word-1");
});

test("Speaking namespace cleanup preserves unrelated and other-mode session keys", () => {
  const storage = memoryStorage();
  saveSpeakingPracticeRunState(storage, createSpeakingPracticeRunState("user", "set", ["word-1"]));
  storage.setItem("elvocab.quiz.run.v2:keep", "quiz");
  storage.setItem("unrelated", "keep");
  clearSpeakingPracticeRunStateNamespace(storage);
  assert.equal(loadSpeakingPracticeRunState(storage, "user", "set"), null);
  assert.equal(storage.getItem("elvocab.quiz.run.v2:keep"), "quiz");
  assert.equal(storage.getItem("unrelated"), "keep");
});

test("router mounts the Speaking-only auth cleanup observer without changing the Speaking page", async () => {
  const [router, observer] = await Promise.all([
    readFile(new URL("../src/app-router.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/pronunciation/speaking-session-storage-observer.jsx", import.meta.url), "utf8"),
  ]);
  assert.match(router, /<SpeakingSessionStorageObserver \/>/);
  assert.match(observer, /clearSpeakingPracticeRunStateNamespace/);
  assert.match(observer, /!isLoading && !isAuthenticated/);
});

function vocabularyIds(size) {
  return Array.from({ length: size }, (_, index) => `word-${index + 1}`);
}

function manifest(ids) {
  return {
    id: "set",
    name: "Speaking Set",
    mode: "NORMAL",
    total_items: ids.length,
    cards: ids.map((id, index) => ({
      id,
      word: `word label ${index}`,
      position: index + 1,
      phonetic: null,
      pronunciation_url: null,
    })),
  };
}

function memoryStorage() {
  const values = new Map();
  return {
    get length() { return values.size; },
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    keys: () => [...values.keys()],
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, String(value)),
  };
}

function throwingStorage() {
  return {
    get length() { throw new Error("denied"); },
    getItem() { throw new Error("denied"); },
    key() { throw new Error("denied"); },
    removeItem() { throw new Error("denied"); },
    setItem() { throw new Error("denied"); },
  };
}
