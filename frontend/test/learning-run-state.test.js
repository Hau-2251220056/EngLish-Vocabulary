import assert from "node:assert/strict";
import test from "node:test";
import {
  applySrsRating, clearLearningRunStateNamespace, completeNormalBatch,
  continueNormalRun, createLearningRunState, currentNormalBatchCards,
  currentSrsVocabularyId, loadLearningRunState, reconcileLearningRunState,
  reconcileSrsSessionRun,
  restartNormalRun, restartSrsRun, saveLearningRunState, selectLearningMode,
  selectNormalCard, setSrsRetryContext, summarizeLearningRun, summarizeNormalRun,
} from "../src/learning/learning-run-state.js";

const srsPayload = payload("SRS", ["one", "two", "three", "four", "five"]);
const normalPayload = payload("NORMAL", ["one", "two", "three", "four", "five"]);

test("legacy and corrupt state fail closed into fresh v3 SRS state", () => {
  const legacy = { version: 1, user_id: "u", set_id: "s", assessments: { one: "REMEMBERED" } };
  const fresh = reconcileLearningRunState(legacy, "u", "s", srsPayload);
  assert.equal(fresh.version, 3);
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

test("Backend SRS snapshot is authoritative while unresolved AGAIN queue order survives reconciliation", () => {
  let state = createLearningRunState("u", "s", payload("SRS", ["one", "two", "outside"]));
  state = applySrsRating(state, "one", "AGAIN", { revision: 1 });
  const reconciled = reconcileSrsSessionRun(state, {
    mode: "SRS",
    view_state: "ACTIVE",
    item_ids: ["one", "two"],
    acknowledged_ids: [],
  });
  assert.deepEqual(reconciled.srs.initial_ids, ["one", "two"]);
  assert.deepEqual(reconciled.srs.queue, ["two", "one"]);
  const completed = reconcileSrsSessionRun(reconciled, {
    mode: "SRS",
    view_state: "COMPLETED",
    item_ids: ["one", "two"],
    acknowledged_ids: ["one", "two"],
  });
  assert.equal(completed.srs.status, "COMPLETED");
  assert.deepEqual(completed.srs.queue, []);
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
  assert.deepEqual(summarizeLearningRun(state), { total: 2, completed_count: 1, presentation_count: 1, completed: false, up_to_date: false });
  state = reconcileLearningRunState(state, "u", "s", payload("SRS", ["same-b", "newly-due"]));
  assert.deepEqual(state.srs.initial_ids, ["same-a", "same-b"]);
  assert.deepEqual(state.srs.queue, ["same-b"]);
  state = applySrsRating(state, "same-b", "EASY", {});
  assert.equal(summarizeLearningRun(state).completed, true);
});

test("a completed review stays complete until explicit continuation; up-to-date can discover future due reviews", () => {
  let completed = createLearningRunState("u", "s", payload("SRS", ["one"]));
  completed = applySrsRating(completed, "one", "GOOD", { revision: 1 });
  assert.equal(summarizeLearningRun(completed).completed, true);

  const preserved = reconcileLearningRunState(
    completed,
    "u",
    "s",
    payload("SRS", ["one", "newly-eligible"]),
  );
  assert.deepEqual(preserved.srs.initial_ids, ["one"]);
  assert.equal(summarizeLearningRun(preserved).completed, true);

  const continued = restartSrsRun(preserved, payload("SRS", ["one", "newly-eligible"]));
  assert.deepEqual(continued.srs.queue, ["one", "newly-eligible"]);
  assert.equal(summarizeLearningRun(continued).completed, false);

  const formerlyUpToDate = createLearningRunState("u", "s", payload("SRS", []));
  const firstDueSnapshot = reconcileLearningRunState(
    formerlyUpToDate,
    "u",
    "s",
    payload("SRS", ["one"]),
  );
  assert.deepEqual(firstDueSnapshot.srs.queue, ["one"]);
});

test("an unresolved AGAIN survives v3 storage reconciliation and never counts complete", () => {
  const storage = createStorage();
  let state = createLearningRunState("u", "s", payload("SRS", ["one", "two"]));
  state = applySrsRating(state, "one", "AGAIN", { revision: 1 });
  assert.deepEqual(state.srs.queue, ["two", "one"]);
  assert.deepEqual(summarizeLearningRun(state), {
    total: 2,
    completed_count: 0,
    presentation_count: 1,
    completed: false,
    up_to_date: false,
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

test("SRS caps authoritative eligible order after selection for 0, fewer than 10, exactly 10 and more than 10", () => {
  for (const count of [0, 7, 10, 14]) {
    const orderedIds = Array.from({ length: count }, (_, index) => `priority-${index + 1}`);
    const state = createLearningRunState("srs-user", `set-${count}`, payload("SRS", orderedIds));
    assert.deepEqual(state.srs.initial_ids, orderedIds.slice(0, 10));
    assert.deepEqual(state.srs.queue, orderedIds.slice(0, 10));
    assert.equal(state.srs.initial_ids.length <= 10, true);
  }
});

test("more than 10 AGAIN presentations never end the queue or grow the distinct denominator", () => {
  let state = createLearningRunState("u", "s", payload("SRS", ["again-card"]));
  for (let revision = 1; revision <= 12; revision += 1) {
    state = applySrsRating(state, "again-card", "AGAIN", { revision });
  }
  assert.deepEqual(state.srs.initial_ids, ["again-card"]);
  assert.deepEqual(state.srs.queue, ["again-card"]);
  assert.equal(state.srs.presentation_count, 12);
  assert.equal(summarizeLearningRun(state).completed, false);
});

test("passing ratings retain authoritative progress and complete only accepted queue items", () => {
  for (const rating of ["HARD", "GOOD", "EASY"]) {
    const progress = { revision: 4, interval_days: rating === "HARD" ? 1 : rating === "GOOD" ? 3 : 7 };
    let state = createLearningRunState("u", `s-${rating}`, payload("SRS", [rating]));
    state = applySrsRating(state, rating, rating, progress);
    assert.deepEqual(state.srs.last_progress, progress);
    assert.deepEqual(state.srs.passed_ids, [rating]);
    assert.equal(state.srs.status, "COMPLETED");
  }
});

test("SRS restoration preserves retry identity without replay and reconciles stale active IDs without additions", () => {
  const storage = createStorage();
  let state = createLearningRunState("resume-user", "resume-set", payload("SRS", ["one", "two"]));
  state = setSrsRetryContext(state, {
    event_id: "event-1",
    session_id: "session-1",
    set_id: "resume-set",
    vocabulary_id: "one",
    expected_revision: 0,
    rating: "GOOD",
  });
  saveLearningRunState(storage, state);
  const restored = loadLearningRunState(storage, "resume-user", "resume-set");
  assert.deepEqual(restored.srs.retry_context, state.srs.retry_context);
  assert.equal(restored.srs.presentation_count, 0);

  const reconciled = reconcileLearningRunState(
    restored,
    "resume-user",
    "resume-set",
    payload("SRS", ["new-item", "two"]),
  );
  assert.deepEqual(reconciled.srs.initial_ids, ["two"]);
  assert.deepEqual(reconciled.srs.queue, ["two"]);
  assert.equal(reconciled.srs.retry_context, null);
});

test("NORMAL creates fixed batches for 0, fewer than 10, exactly 10 and more than 10 cards", () => {
  for (const count of [0, 7, 10, 21]) {
    const cards = makeCards(count);
    const state = createLearningRunState("u", "s", null, cards);
    assert.deepEqual(state.normal.snapshot_ids, cards.map(({ id }) => id));
    assert.equal(state.normal.batches.every((batch) => batch.length <= 10), true);
    assert.deepEqual(state.normal.batches.flat(), state.normal.snapshot_ids);
  }
});

test("NORMAL final card requires explicit completion and back navigation remains available", () => {
  const cards = makeCards(3);
  let state = selectLearningMode(createLearningRunState("u", "s", null, cards), "NORMAL");
  state = selectNormalCard(state, cards[2].id, cards);
  assert.equal(summarizeNormalRun(state).batch_completed, false);
  state = selectNormalCard(state, cards[1].id, cards);
  assert.equal(state.normal.current_vocabulary_id, cards[1].id);
  assert.equal(completeNormalBatch(state), state);
  state = selectNormalCard(state, cards[2].id, cards);
  state = completeNormalBatch(state);
  assert.deepEqual(summarizeNormalRun(state), {
    batch_completed: true,
    full_run_completed: true,
    next_batch_size: 0,
  });
});

test("NORMAL completed batch restores, continues explicitly and full restart adopts latest order", () => {
  const storage = createStorage();
  const cards = makeCards(11);
  let state = selectLearningMode(createLearningRunState("u", "s", null, cards), "NORMAL");
  state = selectNormalCard(state, cards[9].id, cards);
  state = completeNormalBatch(state);
  assert.equal(summarizeNormalRun(state).next_batch_size, 1);
  saveLearningRunState(storage, state);
  const restored = reconcileLearningRunState(
    loadLearningRunState(storage, "u", "s"), "u", "s", payload("NORMAL", cards.map(({ id }) => id)),
  );
  assert.equal(summarizeNormalRun(restored).batch_completed, true);
  assert.equal(restored.normal.active_batch_index, 0);
  state = continueNormalRun(restored);
  assert.equal(state.normal.current_vocabulary_id, cards[10].id);
  assert.equal(state.normal.active_batch_index, 1);
  state = restartNormalRun(state, [{ id: "latest-b" }, { id: "latest-a" }]);
  assert.deepEqual(state.normal.snapshot_ids, ["latest-b", "latest-a"]);
});

test("NORMAL reconciliation excludes additions and preserves original batches across removal and reorder", () => {
  const cards = makeCards(12);
  const stored = createLearningRunState("u", "s", null, cards);
  const freshIds = ["new-card", ...cards.map(({ id }) => id).filter((id) => id !== "card-02").reverse()];
  const reconciled = reconcileLearningRunState(stored, "u", "s", payload("NORMAL", freshIds));
  assert.equal(reconciled.normal.snapshot_ids.includes("new-card"), false);
  assert.deepEqual(reconciled.normal.batches.map((batch) => batch.length), [9, 2]);
  assert.deepEqual(reconciled.normal.snapshot_ids, cards.map(({ id }) => id).filter((id) => id !== "card-02"));
  assert.deepEqual(currentNormalBatchCards(reconciled, freshIds.map((id) => ({ id }))).map(({ id }) => id), reconciled.normal.batches[0]);
});

test("NORMAL initializes from its first authorized manifest after an SRS-first visit", () => {
  const initial = createLearningRunState("lazy-user", "lazy-set", srsPayload);
  assert.equal(initial.normal_initialized, false);
  const reconciled = reconcileLearningRunState(
    initial,
    "lazy-user",
    "lazy-set",
    payload("NORMAL", ["first", "second"]),
  );
  assert.equal(reconciled.normal_initialized, true);
  assert.deepEqual(reconciled.normal.snapshot_ids, ["first", "second"]);
});

test("fresh SRS reconciliation keeps NORMAL uninitialized for its later authorized manifest", () => {
  const afterSrsRead = reconcileLearningRunState(null, "fresh-user", "fresh-set", srsPayload);
  assert.equal(afterSrsRead.normal_initialized, false);
  const afterNormalRead = reconcileLearningRunState(
    afterSrsRead, "fresh-user", "fresh-set", payload("NORMAL", ["first", "second"]),
  );
  assert.equal(afterNormalRead.normal_initialized, true);
  assert.deepEqual(afterNormalRead.normal.snapshot_ids, ["first", "second"]);
});

test("NORMAL malformed storage starts fresh and unavailable storage keeps page-lifetime resume", () => {
  const malformedStorage = createStorage();
  malformedStorage.setItem("elvocab.learning.run.v1:malformed-user:malformed-set", "{not-json");
  assert.equal(loadLearningRunState(malformedStorage, "malformed-user", "malformed-set"), null);
  const fresh = reconcileLearningRunState(
    null,
    "malformed-user",
    "malformed-set",
    payload("NORMAL", ["one", "two"]),
  );
  assert.deepEqual(fresh.normal.snapshot_ids, ["one", "two"]);

  const unavailableStorage = {
    getItem() { throw new Error("blocked"); },
    setItem() { throw new Error("blocked"); },
    removeItem() { throw new Error("blocked"); },
  };
  const resumable = selectLearningMode(
    createLearningRunState("memory-user", "memory-set", null, makeCards(3)),
    "NORMAL",
  );
  const atSecondCard = selectNormalCard(resumable, "card-02", makeCards(3));
  assert.equal(saveLearningRunState(unavailableStorage, atSecondCard), false);
  assert.deepEqual(loadLearningRunState(unavailableStorage, "memory-user", "memory-set"), atSecondCard);
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
function makeCards(count) {
  return Array.from({ length: count }, (_, index) => ({ id: `card-${String(index + 1).padStart(2, "0")}` }));
}
function createStorage() {
  const values = new Map();
  return { get length() { return values.size; }, getItem(key) { return values.get(key) ?? null; }, key(index) { return [...values.keys()][index] ?? null; }, removeItem(key) { values.delete(key); }, setItem(key, value) { values.set(key, String(value)); } };
}
