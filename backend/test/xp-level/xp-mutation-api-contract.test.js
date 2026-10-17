import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createLearningController } from "../../src/controllers/learning-controller.js";
import { createQuizController } from "../../src/controllers/quiz-controller.js";
import { LearningServiceError } from "../../src/services/learning-service.js";
import { QuizServiceError } from "../../src/services/quiz-service.js";

const USER_ID = "00000000-0000-4000-8000-000000000001";

test("Learning mutation preserves its envelope and exposes exactly the approved reward projection", async () => {
  const event = { event_id: randomUUID() };
  const result = acceptedLearningResult(event.event_id);
  const controller = createLearningController({
    learningService: { recordMeaningfulEvent: async () => result },
  });
  const response = responseRecorder();

  await controller.recordEvent(
    { user: { id: USER_ID }, body: event },
    response,
    assertNoUnexpectedError,
  );

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { success: true, data: result });
  assertApprovedReward(response.body.data.reward, event.event_id);
});

test("Quiz mutation preserves its envelope and exposes exactly the approved reward projection", async () => {
  const answer = { event_id: randomUUID() };
  const result = acceptedQuizResult(answer.event_id);
  const controller = createQuizController({
    quizService: { recordAnswer: async () => result },
  });
  const response = responseRecorder();

  await controller.recordAnswer(
    { user: { id: USER_ID }, body: answer },
    response,
    assertNoUnexpectedError,
  );

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { success: true, data: result });
  assertApprovedReward(response.body.data.reward, answer.event_id);
});

test("Learning and Quiz mutation error families expose no success reward projection", async () => {
  const learningCases = [
    ["VALIDATION_ERROR", 400],
    ["LEARNING_SET_NOT_FOUND", 404],
    ["LEARNING_SET_EMPTY", 409],
    ["LEARNING_SET_ITEM_CHANGED", 409],
    ["LEARNING_PROGRESS_CHANGED", 409],
  ];
  const quizCases = [
    ["QUIZ_VALIDATION_ERROR", 400],
    ["QUIZ_SET_NOT_FOUND", 404],
    ["QUIZ_SET_EMPTY", 409],
    ["QUIZ_ITEM_CHANGED", 409],
    ["QUIZ_CHOICES_UNAVAILABLE", 409],
    ["QUIZ_QUESTION_CHANGED", 409],
    ["QUIZ_CHOICE_CHANGED", 409],
    ["QUIZ_RETRY_CONFLICT", 409],
    ["QUIZ_PROGRESS_CONFLICT", 409],
  ];
  const cases = [
    ...learningCases.map(([code, status]) => ({
      invoke(controller, request, response, next) {
        return controller.recordEvent(request, response, next);
      },
      controller: createLearningController({
        learningService: {
          recordMeaningfulEvent: async () => {
            throw new LearningServiceError(code, "Safe Learning error.");
          },
        },
      }),
      code,
      status,
    })),
    ...quizCases.map(([code, status]) => ({
      invoke(controller, request, response, next) {
        return controller.recordAnswer(request, response, next);
      },
      controller: createQuizController({
        quizService: {
          recordAnswer: async () => {
            throw new QuizServiceError(code, "Safe Quiz error.");
          },
        },
      }),
      code,
      status,
    })),
  ];

  for (const entry of cases) {
    const response = responseRecorder();
    await entry.invoke(
      entry.controller,
      { user: { id: USER_ID }, body: { event_id: randomUUID() } },
      response,
      assertNoUnexpectedError,
    );
    assert.equal(response.statusCode, entry.status);
    assert.equal(response.body.success, false);
    assert.equal(response.body.error.code, entry.code);
    assert.equal(Object.hasOwn(response.body, "data"), false);
    assert.equal(JSON.stringify(response.body).includes("reward"), false);
  }
});

function acceptedLearningResult(sourceEventId) {
  return {
    vocabulary_id: randomUUID(),
    status: "LEARNED",
    stored_status: "LEARNED",
    effective_status: "LEARNED",
    stage: 3,
    review_count: 2,
    revision: 2,
    last_reviewed_at: "2026-10-17T00:00:00.000Z",
    next_review_at: "2026-10-20T00:00:00.000Z",
    interval_days: 3,
    reward: rewardProjection(sourceEventId),
  };
}

function acceptedQuizResult(sourceEventId) {
  return {
    set_id: randomUUID(),
    vocabulary_id: randomUUID(),
    run_id: randomUUID(),
    quiz_type: "MULTIPLE_CHOICE",
    is_correct: true,
    selected_choice_id: "A".repeat(43),
    correct_choice_id: "A".repeat(43),
    progress: {
      status: "LEARNED",
      review_count: 1,
      revision: 1,
      last_reviewed_at: "2026-10-17T00:00:00.000Z",
    },
    reward: rewardProjection(sourceEventId),
  };
}

function rewardProjection(sourceEventId) {
  return {
    source_event_id: sourceEventId,
    xp_earned: 3,
    replayed: false,
    total_xp: 153,
    level: 3,
    level_min_xp: 150,
    next_level_xp: 300,
    is_max_level: false,
  };
}

function assertApprovedReward(reward, sourceEventId) {
  assert.deepEqual(Object.keys(reward).sort(), [
    "is_max_level",
    "level",
    "level_min_xp",
    "next_level_xp",
    "replayed",
    "source_event_id",
    "total_xp",
    "xp_earned",
  ]);
  assert.equal(reward.source_event_id, sourceEventId);
  for (const internal of ["id", "reward_id", "reward_type", "reward_cycle", "constraint"]) {
    assert.equal(Object.hasOwn(reward, internal), false);
  }
}

function responseRecorder() {
  return {
    statusCode: null,
    body: null,
    status(value) {
      this.statusCode = value;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
  };
}

function assertNoUnexpectedError(error) {
  assert.fail(`Unexpected controller error: ${error?.message ?? error}`);
}
