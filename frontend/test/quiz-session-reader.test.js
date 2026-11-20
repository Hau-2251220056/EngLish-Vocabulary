import assert from "node:assert/strict";
import test from "node:test";
import { readQuizSessionWithRecovery } from "../src/quiz/quiz-presentation.js";
import { createQuizSessionReader } from "../src/quiz/quiz-session-reader.js";
import { acceptQuizAnswer, beginQuizAnswer, bindQuizLearningSession, createQuizRunState,
  currentQuizBatchIds, loadQuizRunState, reconcileQuizRunState, saveQuizRunState } from "../src/quiz/quiz-run-state.js";
import { QuizApiError } from "../src/services/quiz-service.js";

const TYPE = "MULTIPLE_CHOICE";
const RUN = "11111111-1111-4111-8111-111111111111";
const SESSION = "22222222-2222-4222-8222-222222222222";

test("session reader always obtains the authorized NORMAL manifest before its bounded Quiz read", async () => {
  const calls = [];
  const ids = Array.from({ length: 12 }, (_, index) => `word-${index + 1}`);
  const reader = createQuizSessionReader({
    createSession: createSessionFake(calls),
    async loadMembership(setId) {
      calls.push(["manifest", setId]);
      return manifest(ids);
    },
    async loadQuestions(setId, runId, vocabularyIds, sessionId) {
      calls.push(["questions", setId, runId, [...vocabularyIds], sessionId]);
      return payload(vocabularyIds, runId);
    },
  });
  const result = await reader(createQuizRunState("user", "set", TYPE, null, () => RUN));
  assert.deepEqual(calls, [
    ["manifest", "set"],
    ["create", RUN, ids.slice(0, 10)],
    ["questions", "set", SESSION, ids.slice(0, 10), SESSION],
  ]);
  assert.deepEqual(currentQuizBatchIds(result.state), ids.slice(0, 10));
  assert.deepEqual(result.payload.questions.map(({ vocabulary_id }) => vocabulary_id), ids.slice(0, 10));
});

test("restored reads reconcile exact IDs without additions, reordering or refill", async () => {
  const original = Array.from({ length: 12 }, (_, index) => `word-${index + 1}`);
  const fresh = ["new-word", ...original.filter((id) => id !== "word-2").reverse()];
  const requested = [];
  const reader = createQuizSessionReader({
    createSession: createSessionFake(),
    async loadMembership() { return manifest(fresh); },
    async loadQuestions(_setId, _runId, vocabularyIds) {
      requested.push(...vocabularyIds);
      return payload(vocabularyIds, SESSION);
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
    createSession: createSessionFake(),
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
    createSession: createSessionFake(),
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

test("lost accepted response survives persisted reload and exact-replays before completion restore", async () => {
  const storage = memoryStorage();
  let state = createQuizRunState("user", "set", TYPE, ["word-1"], () => RUN);
  state = bindQuizLearningSession(state, session(["word-1"], "ACTIVE"));
  state = reconcileQuizRunState(state, "user", payload(["word-1"], SESSION));
  state = beginQuizAnswer(state, "word-1", "choice-1", () => "event-1");
  assert.equal(saveQuizRunState(storage, state), true);
  const restored = loadQuizRunState(storage, "user", "set", TYPE);
  const replayed = [];
  const reader = createQuizSessionReader({
    async loadMembership() { return manifest(["word-1"]); },
    async readSession() { return session(["word-1"], "COMPLETED", ["QUIZ_CORRECT"]); },
    async replayAnswer(input) {
      replayed.push(structuredClone(input));
      return answerResult(input, true);
    },
    async loadQuestions() { throw new Error("completed recovery must not reload questions"); },
  });
  const result = await reader(restored);
  assert.deepEqual(replayed, [state.pending_attempt]);
  assert.equal(result.state.pending_attempt, null);
  assert.equal(result.state.completed_result.correct, 1);
  assert.equal(result.state.ordered_run.batch_status, "COMPLETED");
});

test("completed-result reload requires an authoritative matching completed session", async () => {
  let state = createQuizRunState("user", "set", TYPE, ["word-1"], () => RUN);
  state = bindQuizLearningSession(state, session(["word-1"], "ACTIVE"));
  state = reconcileQuizRunState(state, "user", payload(["word-1"], SESSION));
  state = beginQuizAnswer(state, "word-1", "choice-1", () => "event-1");
  state = acceptQuizAnswer(state, answerResult(state.pending_attempt, false));
  const reader = createQuizSessionReader({
    async loadMembership() { return manifest(["word-1"]); },
    async readSession() { return session(["word-1"], "COMPLETED", ["QUIZ_INCORRECT"]); },
    async loadQuestions() { throw new Error("must not read completed questions"); },
  });
  const restored = await reader(state);
  assert.equal(restored.state.completed_result.incorrect, 1);
});

test("Backend-ahead completion reconciles evidence without resubmitting completed answers", async () => {
  let state = createQuizRunState("user", "set", TYPE, ["word-1"], () => RUN);
  state = bindQuizLearningSession(state, session(["word-1"], "ACTIVE"));
  state = reconcileQuizRunState(state, "user", payload(["word-1"], SESSION));
  let replays = 0;
  const result = await createQuizSessionReader({
    async loadMembership() { return manifest(["word-1"]); },
    async readSession() { return session(["word-1"], "COMPLETED", ["QUIZ_CORRECT"]); },
    async replayAnswer() { replays += 1; throw new Error("must not replay without pending operation"); },
  })(state);
  assert.equal(replays, 0);
  assert.equal(result.state.completed_result.correct, 1);
});

test("completed restoration rejects inaccessible, mismatched and nonterminal Backend sessions", async () => {
  let state = createQuizRunState("user", "set", TYPE, ["word-1"], () => RUN);
  state = bindQuizLearningSession(state, session(["word-1"], "ACTIVE"));
  state = reconcileQuizRunState(state, "user", payload(["word-1"], SESSION));
  state = beginQuizAnswer(state, "word-1", "choice-1", () => "event-1");
  state = acceptQuizAnswer(state, answerResult(state.pending_attempt, true));
  const base = { async loadMembership() { return manifest(["word-1"]); } };
  await assert.rejects(createQuizSessionReader({ ...base,
    async readSession() { return { ...session(["word-1"], "COMPLETED", ["QUIZ_CORRECT"]), restart_reason: "SESSION_INACCESSIBLE" }; },
  })(state), { code: "LEARNING_SESSION_NOT_FOUND" });
  await assert.rejects(createQuizSessionReader({ ...base,
    async readSession() { return session(["word-2"], "COMPLETED", ["QUIZ_CORRECT"]); },
  })(state), /does not match/);
  await assert.rejects(createQuizSessionReader({ ...base,
    async readSession() { return session(["word-1"], "ACTIVE"); },
  })(state), /not confirmed/);
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

function createSessionFake(calls = []) {
  return async (request) => {
    calls.push(["create", request.operation_id, [...request.vocabulary_ids]]);
    return { session: { id: SESSION, set_id: "set", mode: "QUIZ",
      items: request.vocabulary_ids.map((vocabulary_id, position) => ({ vocabulary_id, position })) } };
  };
}

function session(ids, state, evidence = ids.map(() => null)) {
  return { id: SESSION, set_id: "set", mode: TYPE === "MULTIPLE_CHOICE" ? "QUIZ" : TYPE,
    state, can_continue: state === "ACTIVE", items: ids.map((vocabulary_id, position) => ({
      vocabulary_id, position, evidence: evidence[position],
    })) };
}

function answerResult(input, correct) {
  return { set_id: input.set_id, vocabulary_id: input.vocabulary_id, run_id: input.run_id,
    quiz_type: TYPE, is_correct: correct, selected_choice_id: input.selected_choice_id,
    correct_choice_id: correct ? input.selected_choice_id : "correct-choice",
    progress: { status: correct ? "LEARNED" : "LEARNING", review_count: 1, revision: 1,
      last_reviewed_at: "2026-10-18T00:00:00.000Z" },
    reward: { source_event_id: input.event_id, xp_earned: correct ? 3 : 0, replayed: true,
      total_xp: correct ? 3 : 0, level: 1, level_min_xp: 0, next_level_xp: 50,
      is_max_level: false } };
}

function memoryStorage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key),
    key: (index) => [...values.keys()][index] ?? null, get length() { return values.size; } };
}
