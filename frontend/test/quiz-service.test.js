import assert from "node:assert/strict";
import test from "node:test";
import { createQuizService } from "../src/services/quiz-service.js";

test("Quiz service sends sole type and exact selected-choice contract", async () => {
  const calls = [];
  const service = createQuizService({
    async get(url, config) { calls.push(["GET", url, config]); return { data: { data: payload() } }; },
    async post(url, body) { calls.push(["POST", url, body]); return { data: { data: result(body) } }; },
  });
  await service.getQuestions("set/id", RUN);
  await service.submitAnswer(answer());
  assert.deepEqual(calls[0], ["GET", "/api/quiz/sets/set%2Fid/questions", { params: { type: "MULTIPLE_CHOICE", run_id: RUN } }]);
  assert.deepEqual(Object.keys(calls[1][2]), ["event_id", "set_id", "vocabulary_id", "run_id", "question_revision", "quiz_type", "expected_revision", "selected_choice_id"]);
  assert.equal(JSON.stringify(calls).includes("/api/learning/events"), false);
});

test("question validation requires four unique safe choices and rejects correctness leakage", async () => {
  for (const data of [
    { ...payload(), questions: [{ ...payload().questions[0], choices: payload().questions[0].choices.slice(0, 3) }] },
    { ...payload(), questions: [{ ...payload().questions[0], choices: payload().questions[0].choices.map((choice, index) => index ? choice : { ...choice, label: " ngủ " }) }] },
    { ...payload(), questions: [{ ...payload().questions[0], correct_choice_id: ID_A }] },
  ]) {
    const service = createQuizService({ async get() { return { data: { data } }; } });
    await assert.rejects(service.getQuestions("set", RUN), { code: "INVALID_QUIZ_RESPONSE" });
  }
});

test("answer validation rejects legacy and extra fields", async () => {
  const service = createQuizService({ async post(_url, body) { return { data: { data: result(body) } }; } });
  await assert.rejects(service.submitAnswer({ ...answer(), answer: "wake" }), { code: "INVALID_QUIZ_REQUEST" });
  await assert.rejects(service.submitAnswer({ ...answer(), quiz_type: "VI_TO_ENGLISH" }), { code: "INVALID_QUIZ_REQUEST" });
});

const RUN = "11111111-1111-4111-8111-111111111111", ID_A = "A".repeat(43), ID_B = "B".repeat(43), ID_C = "C".repeat(43), ID_D = "D".repeat(43);
function payload() { return { id: "set", name: "Core", quiz_type: "MULTIPLE_CHOICE", run_id: RUN, questions: [{ vocabulary_id: "word", position: 1, question_revision: "R".repeat(43), prompt: { word: "wake", part_of_speech: "verb" }, choices: [{ choice_id: ID_A, label: "thức dậy" }, { choice_id: ID_B, label: "ngủ" }, { choice_id: ID_C, label: "ăn" }, { choice_id: ID_D, label: "đi bộ" }], progress: { status: "NEW", review_count: 0, revision: 0, last_reviewed_at: null } }] }; }
function answer() { return { event_id: "22222222-2222-4222-8222-222222222222", set_id: "set", vocabulary_id: "word", run_id: RUN, question_revision: "R".repeat(43), quiz_type: "MULTIPLE_CHOICE", expected_revision: 0, selected_choice_id: ID_A }; }
function result(body) { return { set_id: body.set_id, vocabulary_id: body.vocabulary_id, run_id: body.run_id, quiz_type: "MULTIPLE_CHOICE", is_correct: true, selected_choice_id: body.selected_choice_id, correct_choice_id: ID_A, progress: { status: "LEARNED", review_count: 1, revision: 1, last_reviewed_at: null } }; }
