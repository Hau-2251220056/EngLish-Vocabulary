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

test("bounded Quiz reads serialize exact ordered IDs and reject partial or reordered responses", async () => {
  const requested = ["word-2", "word-1"];
  const calls = [];
  const service = createQuizService({
    async get(url, config) {
      calls.push([url, config]);
      return { data: { data: payload(requested) } };
    },
  });
  const result = await service.getQuestions("set/id", RUN, requested);
  assert.deepEqual(result.questions.map(({ vocabulary_id }) => vocabulary_id), requested);
  assert.deepEqual(calls[0], ["/api/quiz/sets/set%2Fid/questions", {
    params: { type: "MULTIPLE_CHOICE", run_id: RUN, vocabulary_ids: "word-2,word-1" },
  }]);

  for (const responseIds of [["word-2"], ["word-1", "word-2"]]) {
    const invalid = createQuizService({ async get() { return { data: { data: payload(responseIds) } }; } });
    await assert.rejects(invalid.getQuestions("set", RUN, requested), { code: "INVALID_QUIZ_RESPONSE" });
  }
});

test("bounded Quiz read input rejects empty, duplicate and over-limit batches before transport", async () => {
  let reads = 0;
  const service = createQuizService({ async get() { reads += 1; return { data: { data: payload() } }; } });
  for (const ids of [[], ["same", "same"], Array.from({ length: 11 }, (_, index) => `word-${index}`)]) {
    await assert.rejects(service.getQuestions("set", RUN, ids), { code: "INVALID_QUIZ_REQUEST" });
  }
  assert.equal(reads, 0);
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

test("answer validation accepts authoritative original, replay, zero and MAX rewards", async () => {
  for (const reward of [
    rewardProjection(),
    rewardProjection({ xp_earned: 0 }),
    rewardProjection({ replayed: true, total_xp: 153, level: 3, level_min_xp: 150, next_level_xp: 300 }),
    rewardProjection({ total_xp: 6000, level: 15, level_min_xp: 5250, next_level_xp: null, is_max_level: true }),
  ]) {
    const service = createQuizService({
      async post(_url, body) {
        return { data: { data: { ...result(body), reward } } };
      },
    });
    assert.deepEqual((await service.submitAnswer(answer())).reward, reward);
  }
});

test("answer validation rejects malformed reward projections as operational responses", async () => {
  for (const reward of [
    undefined,
    rewardProjection({ source_event_id: "not-a-uuid" }),
    rewardProjection({ xp_earned: 2 }),
    rewardProjection({ replayed: "false" }),
    rewardProjection({ level: 16 }),
    rewardProjection({ is_max_level: true, next_level_xp: null }),
    { ...rewardProjection(), reward_type: "QUIZ_FIRST_CORRECT" },
  ]) {
    const service = createQuizService({
      async post(_url, body) {
        return { data: { data: { ...result(body), reward } } };
      },
    });
    await assert.rejects(service.submitAnswer(answer()), { code: "INVALID_QUIZ_RESPONSE" });
  }
});

const RUN = "11111111-1111-4111-8111-111111111111", ID_A = "A".repeat(43), ID_B = "B".repeat(43), ID_C = "C".repeat(43), ID_D = "D".repeat(43);
function payload(ids = ["word"]) { return { id: "set", name: "Core", quiz_type: "MULTIPLE_CHOICE", run_id: RUN, questions: ids.map((id, index) => ({ vocabulary_id: id, position: index + 1, question_revision: String.fromCharCode(82 + index).repeat(43), prompt: { word: `wake-${index}`, part_of_speech: "verb" }, choices: [{ choice_id: ID_A, label: "thức dậy" }, { choice_id: ID_B, label: "ngủ" }, { choice_id: ID_C, label: "ăn" }, { choice_id: ID_D, label: "đi bộ" }], progress: { status: "NEW", review_count: 0, revision: 0, last_reviewed_at: null } })) }; }
function answer() { return { event_id: "22222222-2222-4222-8222-222222222222", set_id: "set", vocabulary_id: "word", run_id: RUN, question_revision: "R".repeat(43), quiz_type: "MULTIPLE_CHOICE", expected_revision: 0, selected_choice_id: ID_A }; }
function result(body) { return { set_id: body.set_id, vocabulary_id: body.vocabulary_id, run_id: body.run_id, quiz_type: "MULTIPLE_CHOICE", is_correct: true, selected_choice_id: body.selected_choice_id, correct_choice_id: ID_A, progress: { status: "LEARNED", review_count: 1, revision: 1, last_reviewed_at: null }, reward: rewardProjection({ source_event_id: body.event_id }) }; }
function rewardProjection(overrides = {}) { return { source_event_id: answer().event_id, xp_earned: 3, replayed: false, total_xp: 53, level: 2, level_min_xp: 50, next_level_xp: 150, is_max_level: false, ...overrides }; }
