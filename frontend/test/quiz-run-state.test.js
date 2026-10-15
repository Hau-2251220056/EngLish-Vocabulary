import assert from "node:assert/strict";
import test from "node:test";
import { acceptQuizAnswer, beginQuizAnswer, createQuizRunState, failQuizAnswer, loadQuizRunState, reconcileQuizRunState, restartQuizRun, saveQuizRunState, summarizeQuizRun } from "../src/quiz/quiz-run-state.js";

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
  state = acceptQuizAnswer(state, { vocabulary_id: "word-1", is_correct: true, progress: { revision: 1 } });
  assert.equal(state.current_vocabulary_id, "word-2");
  assert.deepEqual(summarizeQuizRun(state), { total: 2, answered: 1, correct: 1, incorrect: 0, completed: false });
  assert.equal(restartQuizRun(state, () => "run-2").run_id, "run-2");
});

test("legacy Quiz types are invalid", () => assert.throws(() => createQuizRunState("user", "set", "UNSCRAMBLE_WORD"), TypeError));

test("same-tab storage restores accepted progress and an identical pending request", () => {
  const storage = memoryStorage();
  let state = reconcileQuizRunState(createQuizRunState("user", "set", TYPE, () => RUN), "user", payload());
  state = beginQuizAnswer(state, "word-1", "choice-a", () => "event-restore");
  assert.equal(saveQuizRunState(storage, state), true);

  const restored = reconcileQuizRunState(loadQuizRunState(storage, "user", "set", TYPE), "user", payload());
  assert.equal(restored.run_id, RUN);
  assert.equal(restored.pending_attempt.event_id, "event-restore");
  assert.equal(restored.pending_attempt.selected_choice_id, "choice-a");
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

function payload() { return { id: "set", quiz_type: TYPE, run_id: RUN, questions: [question("word-1", 1), question("word-2", 2)] }; }
function question(id, position) { return { vocabulary_id: id, position, question_revision: `revision-${position}`, progress: { revision: 0 } }; }
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
