import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createQuizService } from "../../src/services/quiz-service.js";

const USER = "00000000-0000-4000-8000-000000000001";
const OTHER = "00000000-0000-4000-8000-000000000009";
const SET = "00000000-0000-4000-8000-000000000002";
const RUN = "00000000-0000-4000-8000-000000000003";
const NOW = "2026-10-15T00:00:00.000Z";

test("correct choice creates LEARNED once and identical retry is no-write", async () => {
  const harness = createHarness();
  const service = createQuizService({ quizRepository: harness.repository });
  const question = await loadQuestion(service);
  const correct = question.choices.find(({ label }) => label === "thức dậy");
  const request = answer(question, correct.choice_id);
  const first = await service.recordAnswer(USER, request);
  const retry = await service.recordAnswer(USER, request);
  assert.equal(first.is_correct, true);
  assert.equal(retry.progress.revision, 1);
  assert.equal(harness.writeCount(), 1);
  assert.equal(harness.progress(USER).status, "LEARNED");
});

test("incorrect choice updates only question Progress and preserves SRS fields", async () => {
  const initial = progress(USER, { revision: 4, review_count: 8, next_review_at: NOW, interval_days: 7, ease_factor: 2.5 });
  const harness = createHarness({ progressRows: [initial] });
  const service = createQuizService({ quizRepository: harness.repository });
  const question = await loadQuestion(service);
  const wrong = question.choices.find(({ label }) => label !== "thức dậy");
  const result = await service.recordAnswer(USER, answer(question, wrong.choice_id, { expectedRevision: 4 }));
  assert.equal(result.is_correct, false);
  assert.equal(harness.progress(USER).status, "LEARNING");
  assert.equal(harness.progress(USER).next_review_at, NOW);
  assert.equal(harness.progress(USER).interval_days, 7);
  assert.equal(harness.progress(OTHER), null);
});

test("tampered choice and changed question revision mutate nothing", async () => {
  const harness = createHarness();
  const service = createQuizService({ quizRepository: harness.repository });
  const question = await loadQuestion(service);
  await assert.rejects(service.recordAnswer(USER, answer(question, "A".repeat(43))), { code: "QUIZ_CHOICE_CHANGED" });
  await assert.rejects(service.recordAnswer(USER, { ...answer(question, question.choices[0].choice_id), question_revision: "B".repeat(43) }), { code: "QUIZ_QUESTION_CHANGED" });
  assert.equal(harness.writeCount(), 0);
});

test("stale and concurrent different events accept exactly one Progress mutation", async () => {
  const harness = createHarness({ progressRows: [progress(USER, { revision: 2, review_count: 2 })] });
  const service = createQuizService({ quizRepository: harness.repository });
  const question = await loadQuestion(service);
  const choice = question.choices[0].choice_id;
  const settled = await Promise.allSettled([
    service.recordAnswer(USER, answer(question, choice, { expectedRevision: 2 })),
    service.recordAnswer(USER, answer(question, choice, { expectedRevision: 2 })),
  ]);
  assert.equal(settled.filter(({ status }) => status === "fulfilled").length, 1);
  assert.equal(harness.writeCount(), 1);
  assert.equal(harness.progress(USER).revision, 3);
});

test("exact body and active type are validated before transaction", async () => {
  const harness = createHarness();
  const service = createQuizService({ quizRepository: harness.repository });
  const question = await loadQuestion(service);
  for (const input of [
    { ...answer(question, question.choices[0].choice_id), extra: true },
    { ...answer(question, question.choices[0].choice_id), quiz_type: "UNSCRAMBLE_WORD" },
    { ...answer(question, question.choices[0].choice_id), selected_choice_id: "" },
  ]) await assert.rejects(service.recordAnswer(USER, input), { code: "QUIZ_VALIDATION_ERROR" });
  assert.equal(harness.transactionCount(), 0);
});

async function loadQuestion(service) {
  return (await service.getQuestions(USER, SET, { type: "MULTIPLE_CHOICE", run_id: RUN })).questions[0];
}
function answer(question, choiceId, { expectedRevision = 0 } = {}) {
  return { event_id: randomUUID(), set_id: SET, vocabulary_id: question.vocabulary_id, run_id: RUN,
    question_revision: question.question_revision, quiz_type: "MULTIPLE_CHOICE", expected_revision: expectedRevision,
    selected_choice_id: choiceId };
}

function createHarness({ progressRows = [] } = {}) {
  const set = fixtureSet();
  const external = [vocabulary("e1", "sleep", "ngủ"), vocabulary("e2", "eat", "ăn"), vocabulary("e3", "walk", "đi bộ")];
  let committed = new Map(progressRows.map((row) => [row.user_id, structuredClone(row)]));
  let writes = 0, transactions = 0, tail = Promise.resolve();
  const base = {
    findAccessibleSetForUser: async () => structuredClone(set),
    findCanonicalDistractorCandidates: async () => structuredClone(external),
  };
  const repository = {
    ...base,
    withTransaction(callback) {
      transactions += 1;
      const operation = tail.then(async () => {
        const draft = new Map([...committed].map(([key, row]) => [key, structuredClone(row)]));
        const tx = {
          ...base,
          lockAccessibleSetForUser: async () => ({ id: SET }),
          lockQuestionItem: async () => ({ vocabulary_id: set.items[0].vocabulary.id }),
          findProgress: async (userId) => structuredClone(draft.get(userId) ?? null),
          createProgress: async (data) => { const row = progress(data.user_id, data); draft.set(data.user_id, row); writes += 1; return structuredClone(row); },
          updateProgressAtRevision: async (id, revision, data) => {
            const row = [...draft.values()].find((candidate) => candidate.id === id);
            if (!row || row.revision !== revision) return { count: 0 };
            Object.assign(row, { status: data.status, review_count: row.review_count + 1, revision: row.revision + 1,
              last_reviewed_at: data.last_reviewed_at, last_event_id: data.last_event_id }); writes += 1; return { count: 1 };
          },
        };
        const result = await callback(tx); committed = draft; return result;
      });
      tail = operation.catch(() => {}); return operation;
    },
  };
  return { repository, progress: (userId) => structuredClone(committed.get(userId) ?? null), writeCount: () => writes, transactionCount: () => transactions };
}
function fixtureSet() { return { id: SET, name: "Core", items: [{ id: uuid("item"), position: 1, vocabulary: vocabulary("q", "wake", "thức dậy") }] }; }
function vocabulary(seed, word, label) { return { id: uuid(seed), word, updated_at: NOW, meanings: [{ id: uuid(`${seed}m`), part_of_speech: "verb", meaning_vi: label, cefr_level: "A1", updated_at: NOW }], learning_progress: [] }; }
function progress(userId, overrides = {}) { return { id: `progress-${userId}`, user_id: userId, vocabulary_id: uuid("q"), status: "LEARNING", review_count: 0, revision: 0,
  last_reviewed_at: null, last_event_id: null, next_review_at: null, interval_days: null, ease_factor: null, ...overrides }; }
function uuid(seed) { const value = [...seed].reduce((sum, char) => sum + char.codePointAt(0), 500); return `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`; }
