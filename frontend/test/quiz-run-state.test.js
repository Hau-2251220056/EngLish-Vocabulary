import assert from "node:assert/strict";
import test from "node:test";
import { acceptQuizAnswer, beginQuizAnswer, continueQuizRun, createQuizRunState, currentQuizBatchIds,
  failQuizAnswer, loadQuizRunState, reconcileQuizMembership, reconcileQuizRunState, restartQuizRun,
  retryQuizBatch, saveQuizRunState, summarizeQuizRun } from "../src/quiz/quiz-run-state.js";

const TYPE = "MULTIPLE_CHOICE", RUN = "run-1";
test("run reconciles order and pending selected choice without storing choice content", () => {
  let state = reconcileQuizRunState(createQuizRunState("user", "set", TYPE, () => RUN), "user", payload());
  state = beginQuizAnswer(state, "word-1", "choice-a", () => "event-1");
  assert.equal(state.pending_attempt.selected_choice_id, "choice-a");
  assert.equal(JSON.stringify(state).includes("thức dậy"), false);
  assert.equal(JSON.stringify(state).includes("correct_choice_id"), false);
});

test("accepted answers advance, summarize, retry safely and restart", () => {
  let state = reconcileQuizRunState(createQuizRunState("user", "set", TYPE, () => RUN), "user", payload());
  state = beginQuizAnswer(state, "word-1", "choice-a", () => "event-1");
  const attempt = state.pending_attempt;
  state = failQuizAnswer(state, "QUIZ_REQUEST_FAILED");
  assert.deepEqual(state.pending_attempt, attempt);
  state = { ...state, request_state: "submitting" };
  state = acceptQuizAnswer(state, acceptedResult("word-1", true));
  assert.equal(state.current_vocabulary_id, "word-2");
  assert.deepEqual(summarizeQuizRun(state), { total: 2, answered: 1, correct: 1, incorrect: 0, completed: false, full_run_completed: false, next_batch_size: 0 });
  assert.equal(restartQuizRun(state, () => "run-2").run_id, "run-2");
});

test("legacy Quiz types are invalid", () => assert.throws(() => createQuizRunState("user", "set", "UNSCRAMBLE_WORD"), TypeError));

test("same-tab storage restores accepted progress and an identical pending request", () => {
  const storage = memoryStorage();
  let state = reconcileQuizRunState(createQuizRunState("user", "set", TYPE, () => RUN), "user", payload());
  state = beginQuizAnswer(state, "word-1", "choice-word-1", () => "event-restore");
  assert.equal(saveQuizRunState(storage, state), true);

  const restored = reconcileQuizRunState(loadQuizRunState(storage, "user", "set", TYPE), "user", payload());
  assert.equal(restored.run_id, RUN);
  assert.equal(restored.pending_attempt.event_id, "event-restore");
  assert.equal(restored.pending_attempt.selected_choice_id, "choice-word-1");
});

test("restart creates a fresh run and the next selection creates a fresh event", () => {
  let state = reconcileQuizRunState(createQuizRunState("user", "set", TYPE, () => RUN), "user", payload());
  state = beginQuizAnswer(state, "word-1", "choice-a", () => "event-1");
  state = restartQuizRun(state, () => "run-2");
  state = reconcileQuizRunState(state, "user", { ...payload(), run_id: "run-2" });
  state = beginQuizAnswer(state, "word-1", "choice-b", () => "event-2");
  assert.equal(state.run_id, "run-2");
  assert.equal(state.pending_attempt.event_id, "event-2");
  assert.notEqual(state.pending_attempt.event_id, "event-1");
});

test("manifest snapshot creates fixed batches and reconciliation excludes additions without refill", () => {
  const ids = Array.from({ length: 12 }, (_, index) => `word-${index + 1}`);
  let state = createQuizRunState("user", "set", TYPE, ids, () => RUN);
  assert.deepEqual(currentQuizBatchIds(state), ids.slice(0, 10));
  state = reconcileQuizMembership(state, ["new-word", ...ids.filter((id) => id !== "word-2").reverse()]);
  assert.deepEqual(state.ordered_run.snapshot_ids, ids.filter((id) => id !== "word-2"));
  assert.deepEqual(currentQuizBatchIds(state), ids.slice(0, 10).filter((id) => id !== "word-2"));
  assert.deepEqual(state.ordered_run.batches.map((batch) => batch.length), [9, 2]);
});

test("continuation summary reports the next non-empty fixed batch size", () => {
  const ids = Array.from({ length: 21 }, (_, index) => `word-${index + 1}`);
  let state = createQuizRunState("user", "set", TYPE, ids, () => RUN);
  state.ordered_run = { ...state.ordered_run, batch_status: "COMPLETED", current_vocabulary_id: null };
  state = reconcileQuizMembership(state, [...ids.slice(0, 10), "word-21"]);
  assert.equal(summarizeQuizRun(state).next_batch_size, 1);
});

test("completed result persists; continuation and retry create isolated fresh runs", () => {
  const ids = Array.from({ length: 11 }, (_, index) => `word-${index + 1}`);
  let state = createQuizRunState("user", "set", TYPE, ids, () => RUN);
  state = reconcileQuizRunState(state, "user", batchPayload(ids.slice(0, 10), RUN));
  for (const id of ids.slice(0, 10)) {
    state = beginQuizAnswer(state, id, `choice-${id}`, () => `event-${id}`);
    state = acceptQuizAnswer(state, acceptedResult(id, id !== "word-10"));
  }
  assert.deepEqual(state.completed_result, { total: 10, answered: 10, correct: 9, incorrect: 1 });
  const preserved = reconcileQuizMembership(state, ids.filter((id) => id !== "word-3"));
  assert.deepEqual(preserved.completed_result, state.completed_result);

  const retried = retryQuizBatch(preserved, () => "retry-run");
  assert.equal(retried.run_id, "retry-run");
  assert.deepEqual(currentQuizBatchIds(retried), ids.slice(0, 10).filter((id) => id !== "word-3"));
  assert.deepEqual(retried.accepted, {});
  assert.equal(retried.pending_attempt, null);
  assert.equal(retried.questions.length, 0);

  const continued = continueQuizRun(preserved, () => "next-run");
  assert.equal(continued.run_id, "next-run");
  assert.deepEqual(currentQuizBatchIds(continued), ["word-11"]);
  assert.equal(continued.completed_result, null);
});

test("response reconciliation rejects partial, reordered or stale-run question data", () => {
  const state = createQuizRunState("user", "set", TYPE, ["word-1", "word-2"], () => RUN);
  assert.throws(() => reconcileQuizRunState(state, "user", batchPayload(["word-1"], RUN)), TypeError);
  assert.throws(() => reconcileQuizRunState(state, "user", batchPayload(["word-2", "word-1"], RUN)), TypeError);
  assert.throws(() => reconcileQuizRunState(state, "user", batchPayload(["word-1", "word-2"], "stale-run")), TypeError);
});

test("legacy unbounded page loads remain compatible while initializing only the first bounded batch", () => {
  const ids = Array.from({ length: 12 }, (_, index) => `legacy-${index + 1}`);
  const state = reconcileQuizRunState(
    createQuizRunState("user", "set", TYPE, () => RUN),
    "user",
    batchPayload(ids, RUN),
  );
  assert.deepEqual(currentQuizBatchIds(state), ids.slice(0, 10));
  assert.deepEqual(state.questions.map(({ vocabulary_id }) => vocabulary_id), ids.slice(0, 10));
});

test("restoration retains pending identity but never accepts or advances it automatically", () => {
  const storage = memoryStorage();
  let state = createQuizRunState("isolated-user", "set", TYPE, ["word-1"], () => RUN);
  state = reconcileQuizRunState(state, "isolated-user", batchPayload(["word-1"], RUN));
  state = beginQuizAnswer(state, "word-1", "choice-word-1", () => "pending-event");
  saveQuizRunState(storage, state);
  const restored = loadQuizRunState(storage, "isolated-user", "set", TYPE);
  assert.equal(restored.pending_attempt.event_id, "pending-event");
  assert.equal(restored.accepted["word-1"], undefined);
  assert.equal(summarizeQuizRun(restored).answered, 0);
  assert.equal(loadQuizRunState(storage, "other-user", "set", TYPE), null);
});

test("restoration drops pending submissions when fresh choices or revisions no longer match", () => {
  let state = createQuizRunState("user", "set", TYPE, ["word-1"], () => RUN);
  const original = batchPayload(["word-1"], RUN);
  original.questions[0].choices = choices("word-1");
  state = reconcileQuizRunState(state, "user", original);
  state = beginQuizAnswer(state, "word-1", "choice-word-1", () => "pending-event");

  const changedChoice = batchPayload(["word-1"], RUN);
  changedChoice.questions[0].choices = choices("replacement");
  assert.equal(reconcileQuizRunState(state, "user", changedChoice).pending_attempt, null);

  const changedProgress = batchPayload(["word-1"], RUN);
  changedProgress.questions[0].choices = choices("word-1");
  changedProgress.questions[0].progress.revision = 1;
  assert.equal(reconcileQuizRunState(state, "user", changedProgress).pending_attempt, null);
});

function payload() { return { id: "set", quiz_type: TYPE, run_id: RUN, questions: [question("word-1", 1), question("word-2", 2)] }; }
function question(id, position) { return { vocabulary_id: id, position, question_revision: `revision-${position}`, progress: { revision: 0 }, choices: choices(id) }; }
function choices(id) { return Array.from({ length: 4 }, (_, index) => ({ choice_id: index ? `${id}-${index}` : `choice-${id}` })); }
function batchPayload(ids, runId) { return { id: "set", quiz_type: TYPE, run_id: runId, questions: ids.map((id, index) => question(id, index + 1)) }; }
function acceptedResult(id, isCorrect) { return { run_id: RUN, vocabulary_id: id, is_correct: isCorrect, progress: { revision: 1 } }; }
function memoryStorage() {
  const values = new Map();
  return {
    get length() { return values.size; },
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, String(value)),
  };
}
