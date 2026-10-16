import assert from "node:assert/strict";
import test from "node:test";
import { readQuizSessionWithRecovery } from "../src/quiz/quiz-presentation.js";
import { createQuizSessionReader } from "../src/quiz/quiz-session-reader.js";
import { createQuizRunState, currentQuizBatchIds } from "../src/quiz/quiz-run-state.js";
import { QuizApiError } from "../src/services/quiz-service.js";

const TYPE = "MULTIPLE_CHOICE";
const RUN = "run-1";

test("session reader always obtains the authorized NORMAL manifest before its bounded Quiz read", async () => {
  const calls = [];
  const ids = Array.from({ length: 12 }, (_, index) => `word-${index + 1}`);
  const reader = createQuizSessionReader({
    async loadMembership(setId) {
      calls.push(["manifest", setId]);
      return manifest(ids);
    },
    async loadQuestions(setId, runId, vocabularyIds) {
      calls.push(["questions", setId, runId, [...vocabularyIds]]);
      return payload(vocabularyIds, runId);
    },
  });
  const result = await reader(createQuizRunState("user", "set", TYPE, null, () => RUN));
  assert.deepEqual(calls, [
    ["manifest", "set"],
    ["questions", "set", RUN, ids.slice(0, 10)],
  ]);
  assert.deepEqual(currentQuizBatchIds(result.state), ids.slice(0, 10));
  assert.deepEqual(result.payload.questions.map(({ vocabulary_id }) => vocabulary_id), ids.slice(0, 10));
});

test("restored reads reconcile exact IDs without additions, reordering or refill", async () => {
  const original = Array.from({ length: 12 }, (_, index) => `word-${index + 1}`);
  const fresh = ["new-word", ...original.filter((id) => id !== "word-2").reverse()];
  const requested = [];
  const reader = createQuizSessionReader({
    async loadMembership() { return manifest(fresh); },
    async loadQuestions(_setId, _runId, vocabularyIds) {
      requested.push(...vocabularyIds);
      return payload(vocabularyIds, RUN);
    },
  });
  const state = createQuizRunState("user", "set", TYPE, original, () => RUN);
  const result = await reader(state);
  assert.deepEqual(requested, original.slice(0, 10).filter((id) => id !== "word-2"));
  assert.equal(result.state.ordered_run.snapshot_ids.includes("new-word"), false);
  assert.deepEqual(result.state.ordered_run.batches.map((batch) => batch.length), [9, 2]);
});

test("a completed batch performs manifest reconciliation but no automatic question read or answer replay", async () => {
  const ids = ["word-1"];
  let questionReads = 0;
  const reader = createQuizSessionReader({
    async loadMembership() { return manifest(ids); },
    async loadQuestions() { questionReads += 1; throw new Error("must not read completed batch"); },
  });
  const state = createQuizRunState("user", "set", TYPE, ids, () => RUN);
  state.ordered_run = { ...state.ordered_run, current_vocabulary_id: null, batch_status: "COMPLETED", run_status: "COMPLETED" };
  state.completed_result = { total: 1, answered: 1, correct: 1, incorrect: 0 };
  const result = await reader(state);
  assert.equal(questionReads, 0);
  assert.equal(result.payload, null);
  assert.deepEqual(result.state.completed_result, state.completed_result);
});

test("one-shot item conflict fetches a fresh manifest and can reconcile an emptied batch", async () => {
  let manifestReads = 0;
  let questionReads = 0;
  const reader = createQuizSessionReader({
    async loadMembership() {
      manifestReads += 1;
      return manifest(manifestReads === 1 ? ["word-1"] : []);
    },
    async loadQuestions() {
      questionReads += 1;
      throw new QuizApiError({ code: "QUIZ_ITEM_CHANGED", kind: "conflict", status: 409, message: "changed" });
    },
  });
  const result = await readQuizSessionWithRecovery(
    reader,
    createQuizRunState("user", "set", TYPE, ["word-1"], () => RUN),
  );
  assert.equal(manifestReads, 2);
  assert.equal(questionReads, 1);
  assert.equal(result.payload, null);
  assert.equal(result.state.ordered_run.run_status, "COMPLETED");
});

function manifest(ids) {
  return { id: "set", mode: "NORMAL", cards: ids.map((id, index) => ({ id, position: index + 1 })) };
}
function payload(ids, runId) {
  return { id: "set", quiz_type: TYPE, run_id: runId, questions: ids.map((id, index) => ({
    vocabulary_id: id,
    position: index + 1,
    question_revision: `revision-${id}`,
    progress: { revision: 0 },
  })) };
}
