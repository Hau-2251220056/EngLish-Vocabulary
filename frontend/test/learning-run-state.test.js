import assert from "node:assert/strict";
import test from "node:test";
import {
  applySrsRating, clearLearningRunStateNamespace, createLearningRunState,
  currentSrsVocabularyId, loadLearningRunState, reconcileLearningRunState,
  restartNormalRun, restartSrsRun, saveLearningRunState, selectLearningMode,
  selectNormalCard, summarizeLearningRun,
} from "../src/learning/learning-run-state.js";

const srsPayload = payload("SRS", ["one", "two", "three", "four", "five"]);
const normalPayload = payload("NORMAL", ["one", "two", "three", "four", "five"]);

test("v1 two-outcome and corrupt state fail closed into fresh v2 SRS state", () => {
  const legacy = { version: 1, user_id: "u", set_id: "s", assessments: { one: "REMEMBERED" } };
  const fresh = reconcileLearningRunState(legacy, "u", "s", srsPayload);
  assert.equal(fresh.version, 2);
  assert.equal(fresh.active_mode, "SRS");
  assert.deepEqual(fresh.srs.queue, ["one", "two", "three", "four", "five"]);
  assert.deepEqual(reconcileLearningRunState({ version: 2 }, "u", "s", srsPayload), fresh);
});

test("AGAIN requeues after three presentations and never leaves duplicates", () => {
  let state = createLearningRunState("u", "s", srsPayload);
  state = applySrsRating(state, "one", "AGAIN", { revision: 1 });
  assert.deepEqual(state.srs.queue, ["two", "three", "four", "one", "five"]);
  state = applySrsRating(state, "two", "GOOD", { revision: 1 });
  state = applySrsRating(state, "three", "GOOD", { revision: 1 });
  state = applySrsRating(state, "four", "GOOD", { revision: 1 });
  assert.equal(currentSrsVocabularyId(state), "one");
  assert.deepEqual(state.srs.queue, ["one", "five"]);
  state = applySrsRating(state, "one", "AGAIN", { revision: 2 });
  assert.equal(state.srs.queue.filter((id) => id === "one").length, 1);
});

test("AGAIN uses tail for zero to two remaining cards", () => {
  for (const ids of [["one"], ["one", "two"], ["one", "two", "three"]]) {
    let state = createLearningRunState("u", "s", payload("SRS", ids));
    state = applySrsRating(state, "one", "AGAIN", {});
    assert.equal(state.srs.queue.at(-1), "one");
  }
});

test("fixed denominator, passing completion and exact-ID reconciliation are stable", () => {
  let state = createLearningRunState("u", "s", payload("SRS", ["same-a", "same-b"]));
  state = applySrsRating(state, "same-a", "GOOD", {});
  assert.deepEqual(summarizeLearningRun(state), { total: 2, completed_count: 1, presentation_count: 1, completed: false });
  state = reconcileLearningRunState(state, "u", "s", payload("SRS", ["same-b", "newly-due"]));
  assert.deepEqual(state.srs.initial_ids, ["same-a", "same-b"]);
  assert.deepEqual(state.srs.queue, ["same-b"]);
  state = applySrsRating(state, "same-b", "EASY", {});
  assert.equal(summarizeLearningRun(state).completed, true);
});

test("a settled snapshot yields to a fresh backend snapshot instead of staying falsely complete", () => {
  let completed = createLearningRunState("u", "s", payload("SRS", ["one"]));
  completed = applySrsRating(completed, "one", "GOOD", { revision: 1 });
  assert.equal(summarizeLearningRun(completed).completed, true);

  const dueAgain = reconcileLearningRunState(
    completed,
    "u",
    "s",
    payload("SRS", ["one", "newly-eligible"]),
  );
  assert.deepEqual(dueAgain.srs.initial_ids, ["one", "newly-eligible"]);
  assert.deepEqual(dueAgain.srs.queue, ["one", "newly-eligible"]);
  assert.deepEqual(dueAgain.srs.passed_ids, []);
  assert.equal(summarizeLearningRun(dueAgain).completed, false);

  const formerlyUpToDate = createLearningRunState("u", "s", payload("SRS", []));
  const firstDueSnapshot = reconcileLearningRunState(
    formerlyUpToDate,
    "u",
    "s",
    payload("SRS", ["one"]),
  );
  assert.deepEqual(firstDueSnapshot.srs.queue, ["one"]);
});

test("an unresolved AGAIN survives v2 storage reconciliation and never counts complete", () => {
  const storage = createStorage();
  let state = createLearningRunState("u", "s", payload("SRS", ["one", "two"]));
  state = applySrsRating(state, "one", "AGAIN", { revision: 1 });
  assert.deepEqual(state.srs.queue, ["two", "one"]);
  assert.deepEqual(summarizeLearningRun(state), {
    total: 2,
    completed_count: 0,
    presentation_count: 1,
    completed: false,
  });
  saveLearningRunState(storage, state);

  const resumed = reconcileLearningRunState(
    loadLearningRunState(storage, "u", "s"),
    "u",
    "s",
    payload("SRS", ["one", "two"]),
  );
  assert.deepEqual(resumed.srs.queue, ["two", "one"]);
  assert.equal(resumed.srs.queue.filter((id) => id === "one").length, 1);
  assert.equal(summarizeLearningRun(resumed).completed, false);
});

test("mode switch, NORMAL cursor, restarts and storage resume remain isolated", () => {
  const storage = createStorage();
  let state = createLearningRunState("u", "s", srsPayload, normalPayload.cards);
  state = applySrsRating(state, "one", "AGAIN", {});
  state = selectLearningMode(state, "NORMAL");
  state = selectNormalCard(state, "three", normalPayload.cards);
  saveLearningRunState(storage, state);
  assert.deepEqual(loadLearningRunState(storage, "u", "s"), state);
  state = restartNormalRun(state, normalPayload.cards);
  assert.equal(state.normal.current_vocabulary_id, "one");
  state = selectLearningMode(state, "SRS");
  assert.equal(currentSrsVocabularyId(state), "two");
  state = restartSrsRun(state, payload("SRS", ["five"]));
  assert.deepEqual(state.srs.queue, ["five"]);
});

test("namespace cleanup preserves unrelated session keys", () => {
  const storage = createStorage();
  storage.setItem("unrelated", "keep");
  saveLearningRunState(storage, createLearningRunState("u", "s", srsPayload));
  clearLearningRunStateNamespace(storage);
  assert.equal(storage.getItem("unrelated"), "keep");
  assert.equal(storage.length, 1);
});

function payload(mode, ids) {
  return { mode, evaluated_at: "2026-10-04T00:00:00.000Z", cards: ids.map((id) => ({ id })) };
}
function createStorage() {
  const values = new Map();
  return { get length() { return values.size; }, getItem(key) { return values.get(key) ?? null; }, key(index) { return [...values.keys()][index] ?? null; }, removeItem(key) { values.delete(key); }, setItem(key, value) { values.set(key, String(value)); } };
}
