import assert from "node:assert/strict";
import test from "node:test";
import { buildMultipleChoiceQuestion, normalizeChoiceLabel, selectPrimaryMeaning } from "../../src/services/quiz-domain.js";
import { createQuizRepository } from "../../src/repositories/quiz-repository.js";
import { createQuizService } from "../../src/services/quiz-service.js";

const USER = "00000000-0000-4000-8000-000000000001";
const SET = "00000000-0000-4000-8000-000000000002";
const RUN = "00000000-0000-4000-8000-000000000003";
const NOW = "2026-10-15T00:00:00.000Z";

test("primary Meaning and Vietnamese label normalization stay deterministic", () => {
  const meanings = [meaning("first", "khác", null), meaning("b1", "B1", "B1"), meaning("a2", "A2", "A2"), meaning("a2-2", "A2 second", "A2")];
  assert.equal(selectPrimaryMeaning(meanings).id, "a2");
  assert.equal(selectPrimaryMeaning([{ id: "first" }, { id: "second" }]).id, "first");
  assert.equal(normalizeChoiceLabel("  THỨC\tDẬY  "), "thức dậy");
  assert.notEqual(normalizeChoiceLabel("ma"), normalizeChoiceLabel("má"));
});

test("question builder prefers Set candidates, excludes ambiguous labels, and is stable", () => {
  const item = setItem("q", 1, "wake", "thức dậy");
  const local = [item.vocabulary, vocabulary("same", "rise", " THỨC  DẬY "), vocabulary("l1", "sleep", "ngủ"), vocabulary("l2", "eat", "ăn"), vocabulary("l3", "walk", "đi bộ")];
  const external = [vocabulary("e1", "run", "chạy")];
  const input = { runId: RUN, setId: SET, item, setCandidates: local, canonicalCandidates: external };
  const built = buildMultipleChoiceQuestion(input);
  assert.deepEqual(buildMultipleChoiceQuestion(input), built);
  assert.equal(built.question.choices.length, 4);
  assert.equal(new Set(built.question.choices.map(({ label }) => normalizeChoiceLabel(label))).size, 4);
  assert.equal(built.question.choices.some(({ label }) => label === "chạy"), false);
  assert.equal(built.question.prompt.word, "wake");
  assert.equal(built.question.prompt.part_of_speech, "verb");
  assert.match(built.question.question_revision, /^[A-Za-z0-9_-]{43}$/);
});

test("small Sets use canonical fallback without adding questions and fail safely when insufficient", async () => {
  const set = setFixture([setItem("q", 1, "wake", "thức dậy")]);
  const external = [vocabulary("e1", "sleep", "ngủ"), vocabulary("e2", "eat", "ăn"), vocabulary("e3", "walk", "đi bộ")];
  const service = createQuizService({ quizRepository: readRepository(set, external) });
  const payload = await service.getQuestions(USER, SET, { type: "MULTIPLE_CHOICE", run_id: RUN });
  assert.equal(payload.questions.length, 1);
  assert.equal(payload.questions[0].choices.length, 4);
  await assert.rejects(
    createQuizService({ quizRepository: readRepository(set, external.slice(0, 2)) }).getQuestions(USER, SET, { type: "MULTIPLE_CHOICE", run_id: RUN }),
    { code: "QUIZ_CHOICES_UNAVAILABLE" },
  );
});

test("legacy types and invalid question content are rejected", async () => {
  const service = createQuizService({ quizRepository: readRepository(setFixture([setItem("q", 1, "wake", "thức dậy")]), []) });
  await assert.rejects(service.getQuestions(USER, SET, { type: "VI_TO_ENGLISH", run_id: RUN }), { code: "QUIZ_VALIDATION_ERROR" });
  const invalid = setFixture([setItem("q", 1, "wake", "thức dậy")]);
  invalid.items[0].vocabulary.meanings = [];
  await assert.rejects(createQuizService({ quizRepository: readRepository(invalid, []) }).getQuestions(USER, SET, { type: "MULTIPLE_CHOICE", run_id: RUN }), { code: "QUIZ_ITEM_CHANGED" });
});

test("canonical fallback query enforces canonical ownership, exclusions, deterministic order and bounded projection", async () => {
  let query;
  const repository = createQuizRepository({ vOCABULARY: { findMany(input) { query = input; return []; } } });
  await repository.findCanonicalDistractorCandidates(["a", "b"]);
  assert.deepEqual(query.where.owner_id, null);
  assert.deepEqual(query.where.id.notIn, ["a", "b"]);
  assert.deepEqual(query.orderBy, { id: "asc" });
  assert.equal(query.take, 100);
  assert.equal(query.select.owner_id, undefined);
});

function readRepository(set, external) {
  return { findAccessibleSetForUser: async () => structuredClone(set), findCanonicalDistractorCandidates: async () => structuredClone(external) };
}
function setFixture(items) { return { id: SET, name: "Core", items }; }
function setItem(seed, position, word, label) { return { id: uuid(seed, 100), position, vocabulary: vocabulary(seed, word, label) }; }
function vocabulary(seed, word, label) { return { id: uuid(seed, 200), word, updated_at: NOW, meanings: [meaning(uuid(seed, 300), label, "A1")], learning_progress: [] }; }
function meaning(id, label, cefr) { return { id, part_of_speech: "verb", meaning_vi: label, cefr_level: cefr, updated_at: NOW }; }
function uuid(seed, offset) { const value = [...seed].reduce((sum, char) => sum + char.codePointAt(0), offset); return `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`; }
