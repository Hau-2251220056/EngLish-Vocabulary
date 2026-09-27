import assert from "node:assert/strict";
import test from "node:test";
import {
  QuizApiError,
  createQuizService,
} from "../src/services/quiz-service.js";

const runId = "11111111-1111-4111-8111-111111111111";
const questionRevision = "A".repeat(43);

test("Quiz service uses only the approved question and answer endpoints", async () => {
  const calls = [];
  const service = createQuizService({
    async get(url, config) {
      calls.push(["GET", url, config]);
      return { data: { data: questionPayload } };
    },
    async post(url, body) {
      calls.push(["POST", url, body]);
      return { data: { data: answerResult } };
    },
  });
  const answer = answerRequest();

  assert.deepEqual(
    await service.getQuestions("set/id", "VI_TO_ENGLISH", runId),
    questionPayload,
  );
  assert.deepEqual(await service.submitAnswer(answer), answerResult);
  assert.deepEqual(calls, [
    [
      "GET",
      "/api/quiz/sets/set%2Fid/questions",
      { params: { type: "VI_TO_ENGLISH", run_id: runId } },
    ],
    ["POST", "/api/quiz/answers", answer],
  ]);
  assert.equal(JSON.stringify(calls).includes("/api/learning/events"), false);
});

test("Quiz service serializes exactly the approved answer contract", async () => {
  let received;
  const service = createQuizService({
    async post(_url, body) {
      received = body;
      return { data: { data: answerResult } };
    },
  });

  await service.submitAnswer(answerRequest());
  assert.deepEqual(Object.keys(received), [
    "event_id",
    "set_id",
    "vocabulary_id",
    "run_id",
    "question_revision",
    "quiz_type",
    "expected_revision",
    "answer",
  ]);
  await assert.rejects(
    service.submitAnswer({ ...answerRequest(), canonical_answer: "leak" }),
    { code: "INVALID_QUIZ_REQUEST" },
  );
});

test("Quiz service validates both approved types and rejects answer leakage", async () => {
  const unscramble = {
    ...questionPayload,
    quiz_type: "UNSCRAMBLE_WORD",
    questions: [{
      ...questionPayload.questions[0],
      prompt: {
        ...questionPayload.questions[0].prompt,
        tiles: [
          { tile_id: "B".repeat(43), character: "b" },
          { tile_id: "C".repeat(43), character: "a" },
        ],
        slots: [{ kind: "tile" }, { kind: "separator", value: "-" }, { kind: "tile" }],
        shuffle_mode: "SHUFFLED",
      },
    }],
  };
  const valid = createQuizService({
    async get() { return { data: { data: unscramble } }; },
  });
  assert.deepEqual(
    await valid.getQuestions("set", "UNSCRAMBLE_WORD", runId),
    unscramble,
  );

  const leaking = createQuizService({
    async get() {
      return {
        data: {
          data: {
            ...questionPayload,
            questions: [{ ...questionPayload.questions[0], word: "vocabulary" }],
          },
        },
      };
    },
  });
  await assert.rejects(
    leaking.getQuestions("set", "VI_TO_ENGLISH", runId),
    { code: "INVALID_QUIZ_RESPONSE" },
  );
  const nestedLeak = createQuizService({
    async get() {
      return {
        data: {
          data: {
            ...questionPayload,
            questions: [{
              ...questionPayload.questions[0],
              prompt: {
                ...questionPayload.questions[0].prompt,
                correct_answer: "vocabulary",
              },
            }],
          },
        },
      };
    },
  });
  await assert.rejects(
    nestedLeak.getQuestions("set", "VI_TO_ENGLISH", runId),
    { code: "INVALID_QUIZ_RESPONSE" },
  );
  await assert.rejects(
    valid.getQuestions("set", "UNAPPROVED", runId),
    { code: "INVALID_QUIZ_REQUEST" },
  );
});

test("Quiz service maps not-found, conflict and operational failures safely", async () => {
  for (const [status, expectedKind] of [[404, "not-found"], [409, "conflict"]]) {
    const service = createQuizService({
      async get() {
        throw {
          response: {
            status,
            data: { error: { code: `QUIZ_${status}`, message: "Safe message." } },
          },
        };
      },
    });
    await assert.rejects(
      service.getQuestions("set", "VI_TO_ENGLISH", runId),
      (error) => {
        assert.equal(error instanceof QuizApiError, true);
        assert.equal(error.kind, expectedKind);
        assert.equal(error.status, status);
        return true;
      },
    );
  }

  await assert.rejects(
    createQuizService({ async get() { throw new Error("network detail"); } })
      .getQuestions("set", "VI_TO_ENGLISH", runId),
    { kind: "operational", code: "QUIZ_REQUEST_FAILED" },
  );
});

const questionPayload = {
  id: "set-id",
  name: "Core words",
  quiz_type: "VI_TO_ENGLISH",
  run_id: runId,
  questions: [{
    vocabulary_id: "word-1",
    position: 1,
    question_revision: questionRevision,
    prompt: {
      meaning_vi: "từ vựng",
      context: null,
      part_of_speech: "noun",
      cefr_level: "A2",
    },
    progress: {
      status: "NEW",
      review_count: 0,
      revision: 0,
      last_reviewed_at: null,
    },
  }],
};

const answerResult = {
  set_id: "set-id",
  vocabulary_id: "word-1",
  run_id: runId,
  quiz_type: "VI_TO_ENGLISH",
  is_correct: true,
  correct_answer: "vocabulary",
  normalized_answer: "vocabulary",
  character_feedback: [{ position: 0, expected: "v", submitted: "v", state: "correct" }],
  progress: {
    status: "LEARNED",
    review_count: 1,
    revision: 1,
    last_reviewed_at: "2026-09-26T00:00:00.000Z",
  },
};

function answerRequest() {
  return {
    event_id: "22222222-2222-4222-8222-222222222222",
    set_id: "set-id",
    vocabulary_id: "word-1",
    run_id: runId,
    question_revision: questionRevision,
    quiz_type: "VI_TO_ENGLISH",
    expected_revision: 0,
    answer: "vocabulary",
  };
}
