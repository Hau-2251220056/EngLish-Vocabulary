import assert from "node:assert/strict";
import { test } from "node:test";
import express from "express";
import { createQuizController } from "../../src/controllers/quiz-controller.js";
import { createRoleAuthorizationMiddleware } from "../../src/middleware/role-authorization-middleware.js";
import { createQuizRepository } from "../../src/repositories/quiz-repository.js";
import { createQuizRouter } from "../../src/routes/quiz-routes.js";
import {
  buildCharacterFeedback,
  createUnscrambleProjection,
  createQuestionRevision,
  normalizeQuizAnswer,
  quizAnswersAreEquivalent,
  selectPrimaryMeaning,
} from "../../src/services/quiz-domain.js";
import { createQuizService } from "../../src/services/quiz-service.js";
import { startHttpTestServer } from "../helpers/http-test-server.js";

const USER_ID = "00000000-0000-4000-8000-000000000001";
const SET_ID = "00000000-0000-4000-8000-000000000002";
const RUN_ID = "00000000-0000-4000-8000-000000000003";
const OTHER_RUN_ID = "00000000-0000-4000-8000-000000000004";
const FIRST_VOCABULARY_ID = "00000000-0000-4000-8000-000000000005";
const SECOND_VOCABULARY_ID = "00000000-0000-4000-8000-000000000006";

test("pure Quiz helpers match Learning selection and normalize Unicode feedback", () => {
  const meanings = [
    { id: "first", cefr_level: null },
    { id: "b1-first", cefr_level: "B1" },
    { id: "a2-first", cefr_level: "A2" },
    { id: "a2-second", cefr_level: "A2" },
  ];
  assert.equal(selectPrimaryMeaning(meanings).id, "a2-first");
  assert.equal(selectPrimaryMeaning([{ id: "first" }, { id: "second" }]).id, "first");
  assert.equal(selectPrimaryMeaning([]), null);

  assert.equal(normalizeQuizAnswer("  CAFe\u0301\t AU  LAIT "), "café au lait");
  assert.equal(normalizeQuizAnswer("Mother-in-law"), "mother-in-law");
  assert.notEqual(normalizeQuizAnswer("can't"), normalizeQuizAnswer("cant"));
  assert.throws(() => normalizeQuizAnswer(" \n "), TypeError);

  assert.deepEqual(buildCharacterFeedback("café", "cafe"), [
    { position: 0, submitted: "c", expected: "c", state: "correct" },
    { position: 1, submitted: "a", expected: "a", state: "correct" },
    { position: 2, submitted: "f", expected: "f", state: "correct" },
    { position: 3, submitted: "é", expected: "e", state: "incorrect" },
  ]);
  assert.equal(buildCharacterFeedback("cat", "cats")[3].state, "missing");
  assert.equal(buildCharacterFeedback("cats", "cat")[3].state, "extra");
  assert.deepEqual(buildCharacterFeedback("boo", "book")[3], {
    position: 3, submitted: null, expected: "k", state: "missing",
  });
  assert.deepEqual(buildCharacterFeedback("books", "book")[4], {
    position: 4, submitted: "s", expected: null, state: "extra",
  });
  assert.deepEqual(buildCharacterFeedback("boak", "book")[2], {
    position: 2, submitted: "a", expected: "o", state: "incorrect",
  });
  assert.deepEqual(buildCharacterFeedback("bok", "book").slice(2), [
    { position: 2, submitted: null, expected: "o", state: "missing" },
    { position: 3, submitted: "k", expected: "k", state: "correct" },
  ]);
  assert.equal(buildCharacterFeedback("book", "book").every(({ state }) => state === "correct"), true);
});

test("minimum-edit feedback keeps insertions, deletions, substitutions and duplicates meaningful", () => {
  assert.deepEqual(
    buildCharacterFeedback("resilint", "resilient").slice(6),
    [
      { position: 6, submitted: null, expected: "e", state: "missing" },
      { position: 7, submitted: "n", expected: "n", state: "correct" },
      { position: 8, submitted: "t", expected: "t", state: "correct" },
    ],
  );
  assert.deepEqual(
    buildCharacterFeedback("traxvel", "travel").slice(3),
    [
      { position: 3, submitted: "x", expected: null, state: "extra" },
      { position: 4, submitted: "v", expected: "v", state: "correct" },
      { position: 5, submitted: "e", expected: "e", state: "correct" },
      { position: 6, submitted: "l", expected: "l", state: "correct" },
    ],
  );
  assert.deepEqual(buildCharacterFeedback("travwl", "travel")[4], {
    position: 4, submitted: "w", expected: "e", state: "incorrect",
  });

  for (const [submitted, canonical, expectedStates] of [
    ["bok", "book", ["correct", "correct", "missing", "correct"]],
    ["comittee", "committee", ["correct", "correct", "correct", "missing", "correct", "correct", "correct", "correct", "correct"]],
    ["oo", "ooo", ["correct", "correct", "missing"]],
    ["boook", "book", ["correct", "correct", "correct", "extra", "correct"]],
  ]) {
    assert.deepEqual(
      buildCharacterFeedback(submitted, canonical).map(({ state }) => state),
      expectedStates,
      `${submitted} / ${canonical}`,
    );
  }
});

test("VI_TO_ENGLISH may accept normalized spaces for canonical hyphens without weakening strict comparison", () => {
  const options = { allowSpaceForCanonicalHyphen: true };
  assert.equal(quizAnswersAreEquivalent("mother-in-law", "mother-in-law", options), true);
  assert.equal(quizAnswersAreEquivalent("mother in law", "mother-in-law", options), true);
  assert.equal(quizAnswersAreEquivalent("mother  in   law", "mother-in-law", options), true);
  assert.equal(quizAnswersAreEquivalent("motherinlaw", "mother-in-law", options), false);
  assert.equal(quizAnswersAreEquivalent("mother-in laww", "mother-in-law", options), false);
  assert.equal(quizAnswersAreEquivalent("mother-in-law", "mother in law", options), false);
  assert.equal(quizAnswersAreEquivalent("cant", "can't", options), false);
  assert.equal(quizAnswersAreEquivalent("mother in law", "mother-in-law"), false);

  const accepted = buildCharacterFeedback("mother  in   law", "mother-in-law", options);
  assert.deepEqual(accepted.filter(({ expected }) => expected === "-"), [
    { position: 6, submitted: " ", expected: "-", state: "correct" },
    { position: 9, submitted: " ", expected: "-", state: "correct" },
  ]);
  assert.deepEqual(
    buildCharacterFeedback("motherinlaw", "mother-in-law", options)
      .filter(({ state }) => state !== "correct"),
    [
      { position: 6, submitted: null, expected: "-", state: "missing" },
      { position: 9, submitted: null, expected: "-", state: "missing" },
    ],
  );
  assert.deepEqual(
    buildCharacterFeedback("mother-in laww", "mother-in-law", options).slice(-2),
    [
      { position: 12, submitted: "w", expected: "w", state: "correct" },
      { position: 13, submitted: "w", expected: null, state: "extra" },
    ],
  );
});

test("Unscramble projection is stable, duplicate-safe and preserves fixed separators", () => {
  const input = {
    runId: RUN_ID,
    setId: SET_ID,
    vocabularyId: FIRST_VOCABULARY_ID,
    word: "book-room 2",
  };
  const first = createUnscrambleProjection(input);
  assert.deepEqual(createUnscrambleProjection(input), first);
  assert.equal(first.shuffle_mode, "SHUFFLED");
  assert.notEqual(first.tiles.map(({ character }) => character).join(""), "bookroom2");
  assert.equal(new Set(first.tiles.map(({ tile_id }) => tile_id)).size, first.tiles.length);
  assert.equal(first.tiles.filter(({ character }) => character === "o").length, 4);
  assert.deepEqual(first.slots.filter(({ kind }) => kind === "separator"), [
    { kind: "separator", value: "-" },
    { kind: "separator", value: " " },
  ]);
  assert.equal(first.tiles.some(({ character }) => character === "2"), true);

  const sequences = new Set([RUN_ID, OTHER_RUN_ID, SET_ID].map((runId) =>
    createUnscrambleProjection({ ...input, runId }).tiles.map(({ character }) => character).join("")));
  assert.ok(sequences.size > 1);

  const one = createUnscrambleProjection({ ...input, word: "A" });
  assert.equal(one.shuffle_mode, "IDENTITY_FALLBACK");
  assert.equal(one.tiles[0].character, "a");
  const identical = createUnscrambleProjection({ ...input, word: "ooo" });
  assert.equal(identical.shuffle_mode, "IDENTITY_FALLBACK");
  assert.equal(identical.tiles.map(({ character }) => character).join(""), "ooo");
  assert.throws(() => createUnscrambleProjection({ ...input, word: "---" }), TypeError);
});

test("question revision is opaque, stable and changes with authoritative version inputs", () => {
  const input = {
    setId: SET_ID,
    itemId: "00000000-0000-4000-8000-000000000007",
    position: 1,
    quizType: "VI_TO_ENGLISH",
    vocabularyId: FIRST_VOCABULARY_ID,
    vocabularyUpdatedAt: "2026-09-01T00:00:00.000Z",
    meaningId: "00000000-0000-4000-8000-000000000008",
    meaningUpdatedAt: "2026-09-01T00:00:00.000Z",
  };
  const revision = createQuestionRevision(input);
  assert.equal(createQuestionRevision(input), revision);
  assert.match(revision, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(
    createQuestionRevision({ ...input, position: 2 }),
    revision,
  );
  assert.notEqual(
    createQuestionRevision({
      ...input,
      meaningUpdatedAt: "2026-09-02T00:00:00.000Z",
    }),
    revision,
  );

  const unscrambleInput = {
    ...input,
    quizType: "UNSCRAMBLE_WORD",
    runId: RUN_ID,
  };
  assert.notEqual(
    createQuestionRevision(unscrambleInput),
    createQuestionRevision({ ...unscrambleInput, runId: OTHER_RUN_ID }),
  );
});

test("Quiz repository applies the public-or-owned predicate and ordered minimal projection", async () => {
  let query;
  const repository = createQuizRepository({
    vOCABULARY_SET: {
      findFirst(input) {
        query = input;
        return Promise.resolve(null);
      },
    },
  });
  await repository.findAccessibleSetForUser(SET_ID, USER_ID, "VI_TO_ENGLISH");

  assert.deepEqual(query.where, {
    id: SET_ID,
    OR: [
      { is_public: true },
      { is_public: false, owner_id: USER_ID },
    ],
  });
  assert.deepEqual(query.select.items.orderBy, { position: "asc" });
  const vocabularySelect = query.select.items.select.vocabulary.select;
  assert.deepEqual(vocabularySelect.learning_progress.where, { user_id: USER_ID });
  assert.equal(Object.hasOwn(vocabularySelect, "phonetic"), false);
  assert.equal(Object.hasOwn(vocabularySelect, "pronunciation_url"), false);
  assert.equal(Object.hasOwn(vocabularySelect.meanings.select, "examples"), false);

  await repository.findAccessibleSetForUser(SET_ID, USER_ID, "UNSCRAMBLE_WORD");
  assert.equal(Object.hasOwn(query.select.items.select.vocabulary.select, "meanings"), true);
});

test("VI_TO_ENGLISH read projection is ordered, deterministic, safe and read-only", async () => {
  const calls = [];
  const repository = {
    async findAccessibleSetForUser(setId, userId, quizType) {
      calls.push({ setId, userId, quizType });
      return questionSetFixture();
    },
  };
  const service = createQuizService({ quizRepository: repository });
  const first = await service.getQuestions(USER_ID, SET_ID, {
    type: "VI_TO_ENGLISH",
    run_id: RUN_ID,
  });
  const second = await service.getQuestions(USER_ID, SET_ID, {
    type: "VI_TO_ENGLISH",
    run_id: OTHER_RUN_ID,
  });

  assert.deepEqual(calls, [
    { setId: SET_ID, userId: USER_ID, quizType: "VI_TO_ENGLISH" },
    { setId: SET_ID, userId: USER_ID, quizType: "VI_TO_ENGLISH" },
  ]);
  assert.deepEqual(first.questions.map(({ position }) => position), [1, 2]);
  assert.deepEqual(first.questions[0].prompt, {
    meaning_vi: "nghĩa A2 đầu tiên",
    context: "ngữ cảnh an toàn",
    part_of_speech: "verb",
    cefr_level: "A2",
  });
  assert.deepEqual(first.questions[0].progress, {
    status: "LEARNED",
    review_count: 2,
    revision: 2,
    last_reviewed_at: new Date("2026-09-02T00:00:00.000Z"),
  });
  assert.deepEqual(first.questions[1].progress, {
    status: "NEW",
    review_count: 0,
    revision: 0,
    last_reviewed_at: null,
  });
  assert.equal(
    first.questions[0].question_revision,
    second.questions[0].question_revision,
  );
  for (const question of first.questions) assertSafeQuestionShape(question);
});

test("UNSCRAMBLE_WORD projection is stable, ordered and structurally non-disclosing", async () => {
  const service = createQuizService({
    quizRepository: {
      async findAccessibleSetForUser() {
        return questionSetFixture();
      },
    },
  });
  const first = await service.getQuestions(USER_ID, SET_ID, {
    type: "UNSCRAMBLE_WORD",
    run_id: RUN_ID,
  });
  const retry = await service.getQuestions(USER_ID, SET_ID, {
    type: "UNSCRAMBLE_WORD",
    run_id: RUN_ID,
  });
  const restarted = await service.getQuestions(USER_ID, SET_ID, {
    type: "UNSCRAMBLE_WORD",
    run_id: OTHER_RUN_ID,
  });

  assert.deepEqual(first, retry);
  assert.notEqual(
    first.questions[0].question_revision,
    restarted.questions[0].question_revision,
  );
  for (const question of first.questions) {
    assert.equal(typeof question.prompt.meaning_vi, "string");
    assert.equal(Array.isArray(question.prompt.tiles), true);
    assert.equal(Array.isArray(question.prompt.slots), true);
    assert.match(question.prompt.shuffle_mode, /^(SHUFFLED|IDENTITY_FALLBACK)$/);
    assert.equal(question.prompt.tiles.every(({ tile_id }) => /^[A-Za-z0-9_-]{43}$/.test(tile_id)), true);
    assertSafeQuestionShape(question);
  }
  assert.equal(JSON.stringify(first).includes("achievement"), false);
  assert.notDeepEqual(first.questions[0].prompt.tiles, restarted.questions[0].prompt.tiles);
});

test("question read validation, concealment, empty Sets and invalid content use safe errors", async () => {
  const resultQueue = [null, { id: SET_ID, name: "Empty", items: [] }, invalidQuestionSetFixture()];
  const service = createQuizService({
    quizRepository: {
      async findAccessibleSetForUser() {
        return resultQueue.shift();
      },
    },
  });

  await assert.rejects(
    () => service.getQuestions(USER_ID, SET_ID, { type: "UNKNOWN", run_id: RUN_ID }),
    { code: "QUIZ_VALIDATION_ERROR" },
  );
  await assert.rejects(
    () => service.getQuestions(USER_ID, SET_ID, { type: "VI_TO_ENGLISH", run_id: RUN_ID, extra: "x" }),
    { code: "QUIZ_VALIDATION_ERROR" },
  );
  await assert.rejects(
    () => service.getQuestions(USER_ID, SET_ID, { type: "VI_TO_ENGLISH", run_id: RUN_ID }),
    { code: "QUIZ_SET_NOT_FOUND" },
  );
  await assert.rejects(
    () => service.getQuestions(USER_ID, SET_ID, { type: "VI_TO_ENGLISH", run_id: RUN_ID }),
    { code: "QUIZ_SET_EMPTY" },
  );
  await assert.rejects(
    () => service.getQuestions(USER_ID, SET_ID, { type: "VI_TO_ENGLISH", run_id: RUN_ID }),
    { code: "QUIZ_ITEM_CHANGED" },
  );
});

test("Quiz router is USER-only and maps only approved question and answer routes", async () => {
  const serviceCalls = [];
  const quizController = createQuizController({
    quizService: {
      async getQuestions(userId, setId, query) {
        serviceCalls.push({ userId, setId, query });
        return { id: setId, questions: [] };
      },
      async recordAnswer() {
        return { is_correct: true };
      },
    },
  });
  const app = express();
  const authenticationMiddleware = (req, res, next) => {
    const role = req.headers["x-test-role"];
    if (!role) {
      res.status(401).json({ success: false, error: { code: "AUTHENTICATION_FAILED" } });
      return;
    }
    req.user = { id: USER_ID, role };
    next();
  };
  app.use("/api/quiz", createQuizRouter({
    quizController,
    authenticationMiddleware,
    userAuthorizationMiddleware: createRoleAuthorizationMiddleware({ allowedRoles: ["USER"] }),
  }));
  const http = await startHttpTestServer(app);
  try {
    assert.equal((await http.request(`/api/quiz/sets/${SET_ID}/questions?type=VI_TO_ENGLISH&run_id=${RUN_ID}`)).status, 401);
    assert.equal((await http.request(`/api/quiz/sets/${SET_ID}/questions?type=VI_TO_ENGLISH&run_id=${RUN_ID}`, { headers: { "x-test-role": "ADMIN" } })).status, 403);
    assert.equal((await http.request(`/api/quiz/sets/${SET_ID}/questions?type=VI_TO_ENGLISH&run_id=${RUN_ID}`, { headers: { "x-test-role": "USER" } })).status, 200);
    assert.equal((await http.request("/api/quiz/answers", { method: "POST", headers: { "x-test-role": "USER" }, json: {} })).status, 200);
    assert.equal(serviceCalls.length, 1);
  } finally {
    await http.close();
  }
});

function questionSetFixture() {
  const vocabularyDate = new Date("2026-09-01T00:00:00.000Z");
  const meaningDate = new Date("2026-09-01T01:00:00.000Z");
  return {
    id: SET_ID,
    name: "Ordered Quiz Set",
    items: [
      {
        id: "00000000-0000-4000-8000-000000000007",
        position: 1,
        vocabulary: {
          id: FIRST_VOCABULARY_ID,
          word: "achievement",
          updated_at: vocabularyDate,
          meanings: [
            meaning("00000000-0000-4000-8000-000000000008", "B1", "nghĩa B1", meaningDate),
            meaning("00000000-0000-4000-8000-000000000009", "A2", "nghĩa A2 đầu tiên", meaningDate),
            meaning("00000000-0000-4000-8000-00000000000a", "A2", "nghĩa A2 thứ hai", meaningDate),
          ],
          learning_progress: [{
            status: "LEARNED",
            review_count: 2,
            revision: 2,
            last_reviewed_at: new Date("2026-09-02T00:00:00.000Z"),
          }],
        },
      },
      {
        id: "00000000-0000-4000-8000-00000000000b",
        position: 2,
        vocabulary: {
          id: SECOND_VOCABULARY_ID,
          word: "collaboration",
          updated_at: vocabularyDate,
          meanings: [meaning("00000000-0000-4000-8000-00000000000c", null, "cộng tác", meaningDate)],
          learning_progress: [],
        },
      },
    ],
  };
}

function invalidQuestionSetFixture() {
  const set = questionSetFixture();
  set.items[0].vocabulary.meanings = [];
  return set;
}

function meaning(id, cefrLevel, meaningVi, updatedAt) {
  return {
    id,
    part_of_speech: "verb",
    meaning_vi: meaningVi,
    context: "ngữ cảnh an toàn",
    cefr_level: cefrLevel,
    updated_at: updatedAt,
  };
}

function assertSafeQuestionShape(question) {
  const serialized = JSON.stringify(question);
  for (const field of ["word", "phonetic", "pronunciation_url", "meanings", "examples", "correct_answer", "normalized_answer"]) {
    assert.equal(serialized.includes(`\"${field}\"`), false, `${field} leaked`);
  }
}
