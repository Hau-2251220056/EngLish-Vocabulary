import assert from "node:assert/strict";
import test from "node:test";
import {
  assessLearningCard,
  clearLearningRunState,
  clearLearningRunStateNamespace,
  createLearningRunState,
  loadLearningRunState,
  reconcileLearningRunState,
  restartLearningRun,
  saveLearningRunState,
  selectLearningCard,
  summarizeLearningRun,
} from "../src/learning/learning-run-state.js";

const cards = Object.freeze([{ id: "word-1" }, { id: "word-2" }]);

test("run state round-trips in a USER/Set-scoped Learning namespace", () => {
  const storage = createStorage();
  const state = createLearningRunState("user/1", "set/1", cards);
  saveLearningRunState(storage, state);

  assert.deepEqual(loadLearningRunState(storage, "user/1", "set/1"), state);
  assert.equal(loadLearningRunState(storage, "user-2", "set/1"), null);
  assert.equal([...storage.keys()][0].startsWith("elvocab.learning.run.v1:"), true);

  clearLearningRunState(storage, "user/1", "set/1");
  assert.equal(loadLearningRunState(storage, "user/1", "set/1"), null);
});

test("fresh payload reconciliation retains only valid cursor and assessments", () => {
  const reconciled = reconcileLearningRunState(
    {
      version: 1,
      user_id: "user-1",
      set_id: "set-1",
      current_vocabulary_id: "removed-word",
      assessments: {
        "word-1": "REMEMBERED",
        "removed-word": "STUDY_AGAIN",
        "word-2": "INVALID",
      },
    },
    "user-1",
    "set-1",
    cards,
  );

  assert.equal(reconciled.current_vocabulary_id, "word-1");
  assert.deepEqual(reconciled.assessments, { "word-1": "REMEMBERED" });
  assert.deepEqual(
    reconcileLearningRunState({ version: 1 }, "user-1", "set-1", cards),
    createLearningRunState("user-1", "set-1", cards),
  );
});

test("current-card, assessment, completion and restart semantics remain client-only", () => {
  let state = createLearningRunState("user-1", "set-1", cards);
  state = selectLearningCard(state, "word-2", cards);
  state = assessLearningCard(state, "word-1", "REMEMBERED", cards);
  state = assessLearningCard(state, "word-2", "STUDY_AGAIN", cards);

  assert.equal(state.current_vocabulary_id, "word-2");
  assert.deepEqual(summarizeLearningRun(state, cards), {
    total: 2,
    assessed: 2,
    remembered: 1,
    study_again: 1,
    completed: true,
  });
  assert.deepEqual(
    restartLearningRun(state, cards),
    createLearningRunState("user-1", "set-1", cards),
  );
});

test("namespace cleanup removes only Learning-owned run state", () => {
  const storage = createStorage();
  storage.setItem("unrelated.session.key", "keep");
  saveLearningRunState(
    storage,
    createLearningRunState("user-1", "set-1", cards),
  );
  saveLearningRunState(
    storage,
    createLearningRunState("user-2", "set-2", cards),
  );

  clearLearningRunStateNamespace(storage);

  assert.equal(storage.getItem("unrelated.session.key"), "keep");
  assert.equal(storage.length, 1);
});

test("corrupt stored JSON fails closed", () => {
  const storage = createStorage();
  storage.setItem("elvocab.learning.run.v1:user:set", "{");
  assert.equal(loadLearningRunState(storage, "user", "set"), null);
});

function createStorage() {
  const values = new Map();
  return {
    get length() { return values.size; },
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    key(index) { return [...values.keys()][index] ?? null; },
    removeItem(key) { values.delete(key); },
    setItem(key, value) { values.set(key, String(value)); },
    keys() { return values.keys(); },
  };
}
