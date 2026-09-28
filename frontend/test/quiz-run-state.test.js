import assert from "node:assert/strict";
import test from "node:test";
import {
  acceptQuizAnswer,
  beginQuizAnswer,
  clearQuizRunStateNamespace,
  createQuizRunState,
  failQuizAnswer,
  loadQuizRunState,
  reconcileQuizRunState,
  restartQuizRun,
  saveQuizRunState,
  summarizeQuizRun,
} from "../src/quiz/quiz-run-state.js";

const type = "VI_TO_ENGLISH";
const runId = "11111111-1111-4111-8111-111111111111";

test("run identity is scoped by USER, Set, type and active run", () => {
  const storage = createStorage();
  const state = createQuizRunState("user/1", "set/1", type, () => runId);
  assert.equal(saveQuizRunState(storage, state), true);

  assert.deepEqual(loadQuizRunState(storage, "user/1", "set/1", type), state);
  assert.equal(loadQuizRunState(storage, "user/2", "set/1", type), null);
  assert.equal(loadQuizRunState(storage, "user/1", "set/1", "UNSCRAMBLE_WORD"), null);
  assert.equal([...storage.keys()].some((key) => key.includes(runId)), true);
});

test("fresh question reconciliation preserves order and drops stale accepted data", () => {
  const stored = {
    ...createQuizRunState("user-1", "set-1", type, () => runId),
    current_vocabulary_id: "word-1",
    accepted: {
      "word-1": acceptedResult("revision-1", true, 1),
      "word-2": acceptedResult("stale", false, 4),
      removed: acceptedResult("removed", true, 1),
    },
  };
  const reconciled = reconcileQuizRunState(stored, "user-1", questionPayload());

  assert.deepEqual(reconciled.questions.map(({ vocabulary_id }) => vocabulary_id), [
    "word-1",
    "word-2",
  ]);
  assert.deepEqual(Object.keys(reconciled.accepted), ["word-1"]);
  assert.equal(reconciled.current_vocabulary_id, "word-2");
  assert.equal(JSON.stringify(reconciled).includes("meaning_vi"), false);
  assert.equal(JSON.stringify(reconciled).includes("tiles"), false);
  assert.equal(JSON.stringify(reconciled).includes("correct_answer"), false);
});

test("one accepted answer per question advances in order and derives completion", () => {
  let state = reconcileQuizRunState(
    createQuizRunState("user-1", "set-1", type, () => runId),
    "user-1",
    questionPayload(),
  );
  state = beginQuizAnswer(state, "word-1", "first answer", () => "event-1");
  const retryPayload = state.pending_attempt;
  assert.equal(beginQuizAnswer(state, "word-2", "parallel"), state);
  assert.equal(retryPayload.expected_revision, 0);

  state = acceptQuizAnswer(state, answerResult("word-1", true, 1));
  assert.equal(state.current_vocabulary_id, "word-2");
  assert.equal(beginQuizAnswer(state, "word-1", "again"), state);
  assert.deepEqual(summarizeQuizRun(state), {
    total: 2,
    answered: 1,
    correct: 1,
    incorrect: 0,
    completed: false,
  });

  state = beginQuizAnswer(state, "word-2", "second answer", () => "event-2");
  state = acceptQuizAnswer(state, answerResult("word-2", false, 4));
  assert.equal(state.current_vocabulary_id, null);
  assert.deepEqual(summarizeQuizRun(state), {
    total: 2,
    answered: 2,
    correct: 1,
    incorrect: 1,
    completed: true,
  });
  assert.equal(JSON.stringify(state).includes("canonical answer"), false);
});

test("same-spelling canonical and private questions remain distinct by vocabulary ID", () => {
  const payload = {
    id: "set-1",
    name: "Same spelling",
    quiz_type: type,
    run_id: runId,
    questions: [
      question("canonical-book", 1, "revision-c", 0),
      question("private-book-one", 2, "revision-p1", 0),
      question("private-book-two", 3, "revision-p2", 0),
    ],
  };
  let state = reconcileQuizRunState(
    createQuizRunState("user-1", "set-1", type, () => runId),
    "user-1",
    payload,
  );
  assert.equal(state.current_vocabulary_id, "canonical-book");
  state = beginQuizAnswer(state, "canonical-book", "book", () => "event-c");
  state = acceptQuizAnswer(state, answerResult("canonical-book", true, 1));
  assert.equal(state.current_vocabulary_id, "private-book-one");
  state = beginQuizAnswer(state, "private-book-one", "book", () => "event-p1");
  state = acceptQuizAnswer(state, answerResult("private-book-one", false, 1));
  assert.equal(state.current_vocabulary_id, "private-book-two");
  assert.deepEqual(summarizeQuizRun(state), {
    total: 3,
    answered: 2,
    correct: 1,
    incorrect: 1,
    completed: false,
  });
});

test("retry payload survives operational errors while conflicts are modeled", () => {
  let state = reconcileQuizRunState(
    createQuizRunState("user-1", "set-1", type, () => runId),
    "user-1",
    questionPayload(),
  );
  state = beginQuizAnswer(state, "word-1", "answer", () => "event-1");
  const attempt = state.pending_attempt;

  state = failQuizAnswer(state, "QUIZ_REQUEST_FAILED");
  assert.equal(state.request_state, "error");
  assert.deepEqual(state.pending_attempt, attempt);

  state = failQuizAnswer(state, "QUIZ_QUESTION_CHANGED", { conclusive: true });
  assert.equal(state.request_state, "conflict");
  assert.equal(state.pending_attempt, null);
});

test("restart creates a distinct empty run and Quiz cleanup is namespace-only", () => {
  const storage = createStorage();
  const state = createQuizRunState("user-1", "set-1", type, () => runId);
  saveQuizRunState(storage, state);
  storage.setItem("elvocab.learning.run.v1:user:set", "keep");
  storage.setItem("unrelated.session", "keep");

  const restarted = restartQuizRun(state, () => "new-run-id");
  assert.equal(restarted.run_id, "new-run-id");
  assert.deepEqual(restarted.accepted, {});
  assert.equal(restarted.current_vocabulary_id, null);

  clearQuizRunStateNamespace(storage);
  assert.equal(loadQuizRunState(storage, "user-1", "set-1", type), null);
  assert.equal(storage.getItem("elvocab.learning.run.v1:user:set"), "keep");
  assert.equal(storage.getItem("unrelated.session"), "keep");
});

test("persisted transient Quiz state contains neither canonical answers nor durable history", () => {
  const storage = createStorage();
  let state = reconcileQuizRunState(
    createQuizRunState("user-1", "set-1", type, () => runId),
    "user-1",
    questionPayload(),
  );
  state = beginQuizAnswer(state, "word-1", "submitted answer", () => "event-1");
  state = acceptQuizAnswer(state, answerResult("word-1", true, 1));
  saveQuizRunState(storage, state);

  const serialized = JSON.stringify([...storage.keys()].map((key) => [key, storage.getItem(key)]));
  assert.equal(serialized.includes("canonical answer"), false);
  assert.equal(serialized.includes("correct_answer"), false);
  assert.equal(serialized.includes("character_feedback"), false);
  assert.equal(serialized.includes("QUIZ_ATTEMPT"), false);
  assert.equal(serialized.includes("history"), false);
});

function questionPayload() {
  return {
    id: "set-1",
    name: "Core words",
    quiz_type: type,
    run_id: runId,
    questions: [
      question("word-1", 1, "revision-1", 0),
      question("word-2", 2, "revision-2", 3),
    ],
  };
}

function question(vocabularyId, position, revision, progressRevision) {
  return {
    vocabulary_id: vocabularyId,
    position,
    question_revision: revision,
    prompt: { meaning_vi: "nghĩa" },
    progress: {
      status: progressRevision === 0 ? "NEW" : "LEARNING",
      review_count: progressRevision,
      revision: progressRevision,
      last_reviewed_at: null,
    },
  };
}

function acceptedResult(questionRevision, isCorrect, progressRevision) {
  return {
    question_revision: questionRevision,
    is_correct: isCorrect,
    progress_revision: progressRevision,
  };
}

function answerResult(vocabularyId, isCorrect, revision) {
  return {
    vocabulary_id: vocabularyId,
    is_correct: isCorrect,
    correct_answer: "canonical answer",
    character_feedback: [],
    progress: { revision },
  };
}

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
