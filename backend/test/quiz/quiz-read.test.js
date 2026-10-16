import assert from "node:assert/strict";
import test from "node:test";
import { buildMultipleChoiceQuestion, normalizeChoiceLabel, selectPrimaryMeaning } from "../../src/services/quiz-domain.js";
import { createQuizController } from "../../src/controllers/quiz-controller.js";
import { createQuizRepository } from "../../src/repositories/quiz-repository.js";
import { createQuizService, QuizServiceError } from "../../src/services/quiz-service.js";

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

test("bounded reads accept 1 or 10 IDs and preserve submitted order", async () => {
  const items = Array.from({ length: 10 }, (_, index) => setItem(`q${index}`, index + 1, `word-${index}`, `nghĩa-${index}`));
  const set = setFixture(items);
  const service = createQuizService({ quizRepository: readRepository(set, []) });
  const one = await service.getQuestions(USER, SET, boundedQuery([items[4].vocabulary.id]));
  assert.deepEqual(one.questions.map(({ vocabulary_id }) => vocabulary_id), [items[4].vocabulary.id]);

  const requested = items.map(({ vocabulary }) => vocabulary.id).reverse();
  const ten = await service.getQuestions(USER, SET, boundedQuery(requested));
  assert.deepEqual(ten.questions.map(({ vocabulary_id }) => vocabulary_id), requested);
  assert.equal(Object.hasOwn(ten, "removed_vocabulary_ids"), false);
});

test("bounded query rejects empty, malformed, duplicate, repeated, over-limit and unknown input", async () => {
  const set = setFixture(Array.from({ length: 11 }, (_, index) => setItem(`v${index}`, index + 1, `word-${index}`, `label-${index}`)));
  const service = createQuizService({ quizRepository: readRepository(set, []) });
  const ids = set.items.map(({ vocabulary }) => vocabulary.id);
  for (const input of [
    { type: "MULTIPLE_CHOICE", run_id: RUN, vocabulary_ids: "" },
    { type: "MULTIPLE_CHOICE", run_id: RUN, vocabulary_ids: undefined },
    { type: "MULTIPLE_CHOICE", run_id: RUN, vocabulary_ids: `${ids[0]},` },
    { type: "MULTIPLE_CHOICE", run_id: RUN, vocabulary_ids: "not-a-uuid" },
    boundedQuery([ids[0], ids[0]]),
    boundedQuery(ids),
    { ...boundedQuery([ids[0]]), extra: "unsupported" },
    { type: "MULTIPLE_CHOICE", run_id: RUN, vocabulary_ids: [ids[0], ids[1]] },
  ]) await assert.rejects(service.getQuestions(USER, SET, input), { code: "QUIZ_VALIDATION_ERROR" });
});

test("Set authorization precedes bounded membership disclosure and preserves concealed not-found", async () => {
  let distractorReads = 0;
  const repository = {
    findAccessibleSetForUser: async () => null,
    findCanonicalDistractorCandidates: async () => { distractorReads += 1; return []; },
  };
  const service = createQuizService({ quizRepository: repository });
  await assert.rejects(
    service.getQuestions(USER, SET, { type: "MULTIPLE_CHOICE", run_id: RUN, vocabulary_ids: "foreign-private-id" }),
    { code: "QUIZ_SET_NOT_FOUND" },
  );
  assert.equal(distractorReads, 0);
});

test("foreign, other-Set, removed and mixed requested IDs fail atomically without disclosure", async () => {
  const items = [
    setItem("valid", 1, "wake", "thức dậy"),
    setItem("local-1", 2, "sleep", "ngủ"),
    setItem("local-2", 3, "eat", "ăn"),
    setItem("local-3", 4, "walk", "đi bộ"),
  ];
  let distractorReads = 0;
  const repository = readRepository(setFixture(items), []);
  const originalRead = repository.findCanonicalDistractorCandidates;
  repository.findCanonicalDistractorCandidates = async (...args) => { distractorReads += 1; return originalRead(...args); };
  const service = createQuizService({ quizRepository: repository });
  const nonMembers = [uuid("foreign-private", 900), uuid("other-set", 900), uuid("removed", 900)];
  for (const id of nonMembers) {
    await assert.rejects(service.getQuestions(USER, SET, boundedQuery([id])), {
      code: "QUIZ_ITEM_CHANGED",
      message: "Quiz vocabulary is no longer available. Refresh before trying again.",
    });
  }
  await assert.rejects(
    service.getQuestions(USER, SET, boundedQuery([items[0].vocabulary.id, nonMembers[0]])),
    { code: "QUIZ_ITEM_CHANGED" },
  );
  assert.equal(distractorReads, 0);
});

test("ineligible question content and insufficient choices reject the whole bounded batch", async () => {
  const eligible = setItem("eligible", 1, "wake", "thức dậy");
  const ineligible = setItem("ineligible", 2, "broken", "hỏng");
  ineligible.vocabulary.meanings = [];
  const localDistractors = [
    setItem("d1", 3, "sleep", "ngủ"),
    setItem("d2", 4, "eat", "ăn"),
    setItem("d3", 5, "walk", "đi bộ"),
  ];
  const set = setFixture([eligible, ineligible, ...localDistractors]);
  const service = createQuizService({ quizRepository: readRepository(set, []) });
  await assert.rejects(
    service.getQuestions(USER, SET, boundedQuery([eligible.vocabulary.id, ineligible.vocabulary.id])),
    { code: "QUIZ_ITEM_CHANGED" },
  );

  const tooSmall = setFixture([setItem("only", 1, "wake", "thức dậy")]);
  await assert.rejects(
    createQuizService({ quizRepository: readRepository(tooSmall, []) })
      .getQuestions(USER, SET, boundedQuery([tooSmall.items[0].vocabulary.id])),
    { code: "QUIZ_CHOICES_UNAVAILABLE" },
  );
});

test("omitted vocabulary_ids keeps full-Set compatibility and question reads cannot mutate Progress", async () => {
  const items = [
    setItem("q1", 1, "wake", "thức dậy"),
    setItem("q2", 2, "sleep", "ngủ"),
    setItem("q3", 3, "eat", "ăn"),
    setItem("q4", 4, "walk", "đi bộ"),
  ];
  let writes = 0;
  const repository = {
    ...readRepository(setFixture(items), []),
    createProgress: async () => { writes += 1; },
    updateProgressAtRevision: async () => { writes += 1; },
  };
  const result = await createQuizService({ quizRepository: repository })
    .getQuestions(USER, SET, { type: "MULTIPLE_CHOICE", run_id: RUN });
  assert.deepEqual(result.questions.map(({ vocabulary_id }) => vocabulary_id), items.map(({ vocabulary }) => vocabulary.id));
  assert.equal(writes, 0);
});

test("Quiz read errors retain the approved 400, concealed 404 and atomic 409 envelopes", async () => {
  for (const [code, expectedStatus] of [
    ["QUIZ_VALIDATION_ERROR", 400],
    ["QUIZ_SET_NOT_FOUND", 404],
    ["QUIZ_ITEM_CHANGED", 409],
    ["QUIZ_CHOICES_UNAVAILABLE", 409],
  ]) {
    const controller = createQuizController({
      quizService: { getQuestions: async () => { throw new QuizServiceError(code, "Safe Quiz error."); } },
    });
    const response = fakeResponse();
    let forwarded = null;
    await controller.getQuestions(
      { user: { id: USER }, params: { setId: SET }, query: boundedQuery([uuid("valid", 200)]) },
      response,
      (error) => { forwarded = error; },
    );
    assert.equal(forwarded, null);
    assert.equal(response.statusCode, expectedStatus);
    assert.deepEqual(response.body, {
      success: false,
      error: { code, message: "Safe Quiz error." },
    });
  }
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
function boundedQuery(ids) {
  return { type: "MULTIPLE_CHOICE", run_id: RUN, vocabulary_ids: ids.join(",") };
}
function fakeResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}
function setFixture(items) { return { id: SET, name: "Core", items }; }
function setItem(seed, position, word, label) { return { id: uuid(seed, 100), position, vocabulary: vocabulary(seed, word, label) }; }
function vocabulary(seed, word, label) { return { id: uuid(seed, 200), word, updated_at: NOW, meanings: [meaning(uuid(seed, 300), label, "A1")], learning_progress: [] }; }
function meaning(id, label, cefr) { return { id, part_of_speech: "verb", meaning_vi: label, cefr_level: cefr, updated_at: NOW }; }
function uuid(seed, offset) { const value = [...seed].reduce((sum, char) => sum + char.codePointAt(0), offset); return `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`; }
