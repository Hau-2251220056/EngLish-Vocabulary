import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { createApp } from "../../src/create-app.js";
import { createSessionFixture, createUserFixture } from "../helpers/auth-fixtures.js";
import { createTestDatabase } from "../helpers/test-database.js";
import { startHttpTestServer } from "../helpers/http-test-server.js";

let database;
let prisma;
let http;
let admin;
let owner;
let otherUser;
let topic;
let adminCookie;
let ownerCookie;
let otherCookie;

before(async () => {
  database = await createTestDatabase();
  prisma = database.prisma;
  http = await startHttpTestServer(createApp({ prisma }));
});

beforeEach(async () => {
  await database.reset();
  admin = await createUserFixture(prisma, { role: "ADMIN" });
  owner = await createUserFixture(prisma, { role: "USER" });
  otherUser = await createUserFixture(prisma, { role: "USER" });
  adminCookie = await sessionCookie(admin.id);
  ownerCookie = await sessionCookie(owner.id);
  otherCookie = await sessionCookie(otherUser.id);
  topic = await prisma.tOPIC.create({
    data: { name: `Quiz test topic ${randomUUID()}` },
  });
});

afterEach(async () => {
  await database.reset();
});

after(async () => {
  try {
    if (database) await database.reset();
  } finally {
    try {
      if (http) await http.close();
    } finally {
      if (database) await database.disconnect();
    }
  }
});

test("Quiz API is USER-only and preserves public/owned/concealed Set access", async () => {
  const vocabulary = await createVocabulary("access");
  const publicSet = await createSet(admin.id, true, [vocabulary.id]);
  const ownedSet = await createSet(owner.id, false, [vocabulary.id]);
  const foreignSet = await createSet(otherUser.id, false, [vocabulary.id]);
  const runId = randomUUID();

  assertError(await getQuestions(publicSet.id, "VI_TO_ENGLISH", runId), 401, "AUTHENTICATION_FAILED");
  assertError(await getQuestions(publicSet.id, "VI_TO_ENGLISH", runId, adminCookie), 403, "FORBIDDEN");
  assert.equal((await getQuestions(publicSet.id, "VI_TO_ENGLISH", runId, ownerCookie)).status, 200);
  assert.equal((await getQuestions(ownedSet.id, "UNSCRAMBLE_WORD", runId, ownerCookie)).status, 200);
  for (const setId of [foreignSet.id, randomUUID()]) {
    assertError(
      await getQuestions(setId, "VI_TO_ENGLISH", runId, ownerCookie),
      404,
      "QUIZ_SET_NOT_FOUND",
    );
  }
});

test("ordered question reads cover both types, disclose no answer and never mutate Progress", async () => {
  const first = await createVocabulary("first", { word: "achievement", nested: true });
  const second = await createVocabulary("second", { word: "mother-in-law" });
  const set = await createSet(admin.id, true, [second.id, first.id]);
  await prisma.lEARNING_PROGRESS.create({
    data: {
      user_id: owner.id,
      vocabulary_id: first.id,
      status: "LEARNED",
      review_count: 2,
      revision: 2,
    },
  });
  const before = await progressSnapshot();
  const runId = randomUUID();

  const vietnamese = await getQuestions(set.id, "VI_TO_ENGLISH", runId, ownerCookie);
  assert.equal(vietnamese.status, 200, vietnamese.text);
  assert.deepEqual(vietnamese.json.data.questions.map(({ vocabulary_id, position }) => [vocabulary_id, position]), [
    [second.id, 1],
    [first.id, 2],
  ]);
  assert.equal(vietnamese.json.data.questions[1].prompt.meaning_vi, "nghĩa A1 được chọn");
  assert.equal(vietnamese.json.data.questions[1].progress.revision, 2);

  const unscrambleFirst = await getQuestions(set.id, "UNSCRAMBLE_WORD", runId, ownerCookie);
  const unscrambleRetry = await getQuestions(set.id, "UNSCRAMBLE_WORD", runId, ownerCookie);
  const unscrambleRestart = await getQuestions(set.id, "UNSCRAMBLE_WORD", randomUUID(), ownerCookie);
  assert.equal(unscrambleFirst.status, 200, unscrambleFirst.text);
  assert.deepEqual(unscrambleFirst.json, unscrambleRetry.json);
  assert.notEqual(
    unscrambleFirst.json.data.questions[0].question_revision,
    unscrambleRestart.json.data.questions[0].question_revision,
  );
  for (const response of [vietnamese, unscrambleFirst]) {
    for (const question of response.json.data.questions) assertNoAnswerLeak(question);
  }
  assert.deepEqual(await progressSnapshot(), before);
});

test("Personal Vocabulary stays exact across both Quiz types, answers and later refetch", async () => {
  const sharedWord = `book-${randomUUID()}`;
  const canonical = await createPersonalQuizVocabulary({ word: sharedWord, meaningVi: "canonical book", partOfSpeech: "noun" });
  const privateOne = await createPersonalQuizVocabulary({ ownerId: owner.id, word: sharedWord, meaningVi: "private booking", partOfSpeech: "verb", secondaryMeaning: true });
  const privateTwo = await createPersonalQuizVocabulary({ ownerId: owner.id, word: sharedWord, meaningVi: "second private book", partOfSpeech: "noun" });
  const set = await createSet(owner.id, false, [privateTwo.id, canonical.id, privateOne.id]);
  const runId = randomUUID();
  const responses = await Promise.all([
    getQuestions(set.id, "VI_TO_ENGLISH", runId, ownerCookie),
    getQuestions(set.id, "UNSCRAMBLE_WORD", runId, ownerCookie),
  ]);

  for (const response of responses) {
    assert.equal(response.status, 200, response.text);
    assert.deepEqual(response.json.data.questions.map(({ vocabulary_id, position }) => [vocabulary_id, position]), [
      [privateTwo.id, 1], [canonical.id, 2], [privateOne.id, 3],
    ]);
    const privateQuestion = response.json.data.questions[2];
    assert.equal(privateQuestion.prompt.meaning_vi, "private booking");
    assert.equal(privateQuestion.prompt.part_of_speech, "verb");
  }

  const vietnameseQuestion = { ...responses[0].json.data.questions[2], quiz_type: "VI_TO_ENGLISH" };
  const vietnameseResult = await postAnswer(answerBody(vietnameseQuestion, set.id, runId, randomUUID(), sharedWord), ownerCookie);
  assert.equal(vietnameseResult.status, 200, vietnameseResult.text);
  assert.equal(vietnameseResult.json.data.vocabulary_id, privateOne.id);
  assert.equal(vietnameseResult.json.data.is_correct, true);

  const unscrambleQuestion = { ...responses[1].json.data.questions[0], quiz_type: "UNSCRAMBLE_WORD" };
  assert.deepEqual(
    unscrambleQuestion.prompt.tiles.map(({ character }) => character).sort(),
    [...sharedWord].filter((character) => /[\p{L}\p{Nd}]/u.test(character)).sort(),
  );
  const unscrambleResult = await postAnswer(answerBody(unscrambleQuestion, set.id, runId, randomUUID(), sharedWord), ownerCookie);
  assert.equal(unscrambleResult.status, 200, unscrambleResult.text);
  assert.equal(unscrambleResult.json.data.vocabulary_id, privateTwo.id);
  assert.equal(unscrambleResult.json.data.is_correct, true);
  assert.equal(await prisma.lEARNING_PROGRESS.count({ where: { user_id: owner.id } }), 2);

  await prisma.vOCABULARY.update({ where: { id: privateOne.id }, data: { word: "reserve" } });
  const refreshed = await getQuestions(set.id, "UNSCRAMBLE_WORD", randomUUID(), ownerCookie);
  const refreshedPrivate = refreshed.json.data.questions.find(({ vocabulary_id }) => vocabulary_id === privateOne.id);
  assert.deepEqual(refreshedPrivate.prompt.tiles.map(({ character }) => character).sort(), [..."reserve"].sort());
  assert.equal(refreshedPrivate.prompt.meaning_vi, "private booking");
  assert.equal(refreshedPrivate.prompt.part_of_speech, "verb");
  assertError(await getQuestions(set.id, "VI_TO_ENGLISH", randomUUID(), otherCookie), 404, "QUIZ_SET_NOT_FOUND");
});

test("UNSCRAMBLE_WORD HTTP projection preserves opaque duplicate tiles, fixed separators and identity fallback", async () => {
  const duplicateVocabulary = await createVocabulary("unscramble-duplicate", { word: "book-case" });
  const identityVocabulary = await createVocabulary("unscramble-identity", { word: "z-z'z z.z" });
  const set = await createSet(admin.id, true, [duplicateVocabulary.id, identityVocabulary.id]);
  const response = await getQuestions(set.id, "UNSCRAMBLE_WORD", randomUUID(), ownerCookie);

  assert.equal(response.status, 200, response.text);
  const [duplicateQuestion, identityQuestion] = response.json.data.questions;
  const duplicateTiles = duplicateQuestion.prompt.tiles.filter(({ character }) => character === "o");
  assert.equal(duplicateTiles.length, 2);
  assert.equal(new Set(duplicateTiles.map(({ tile_id }) => tile_id)).size, 2);
  assert.equal(duplicateTiles.every(({ tile_id }) => typeof tile_id === "string" && tile_id.length > 0), true);
  assert.deepEqual(
    duplicateQuestion.prompt.slots.filter(({ kind }) => kind === "separator"),
    [{ kind: "separator", value: "-" }],
  );
  assert.equal(
    duplicateQuestion.prompt.slots.filter(({ kind }) => kind === "tile").length,
    duplicateQuestion.prompt.tiles.length,
  );

  assert.equal(identityQuestion.prompt.shuffle_mode, "IDENTITY_FALLBACK");
  assert.deepEqual(
    identityQuestion.prompt.slots.filter(({ kind }) => kind === "separator").map(({ value }) => value),
    ["-", "'", " ", "."],
  );
  assert.equal(new Set(identityQuestion.prompt.tiles.map(({ character }) => character)).size, 1);
  assertNoAnswerLeak(duplicateQuestion);
  assertNoAnswerLeak(identityQuestion);
});

test("correct creates LEARNED once and identical retry does not double-count", async () => {
  const vocabulary = await createVocabulary("correct", { word: "Café au lait" });
  const set = await createSet(admin.id, true, [vocabulary.id]);
  const runId = randomUUID();
  const question = await loadQuestion(set.id, "VI_TO_ENGLISH", runId, ownerCookie);
  const eventId = randomUUID();
  const body = answerBody(question, set.id, runId, eventId, "  CAFE\u0301\tAU\u00A0LAIT ");

  const first = await postAnswer(body, ownerCookie);
  assert.equal(first.status, 200, first.text);
  assert.equal(first.json.data.is_correct, true);
  assert.equal(first.json.data.normalized_answer, "café au lait");
  assert.equal(first.json.data.progress.status, "LEARNED");
  assert.equal(first.json.data.progress.review_count, 1);
  assert.equal(first.json.data.progress.revision, 1);

  const retry = await postAnswer(body, ownerCookie);
  assert.equal(retry.status, 200, retry.text);
  const persisted = await findProgress(owner.id, vocabulary.id);
  assert.equal(persisted.review_count, 1);
  assert.equal(persisted.revision, 1);
  assert.equal(persisted.last_event_id, eventId);
  assert.equal(persisted.next_review_at, null);
  assert.equal(persisted.interval_days, null);
  assert.equal(persisted.ease_factor, null);
});

test("VI_TO_ENGLISH accepts normalized spaces for canonical hyphens with aligned feedback", async () => {
  const vocabulary = await createVocabulary("hyphen-equivalence", { word: "mother-in-law" });
  const set = await createSet(admin.id, true, [vocabulary.id]);
  const runId = randomUUID();
  const question = await loadQuestion(set.id, "VI_TO_ENGLISH", runId, ownerCookie);
  const response = await postAnswer(
    answerBody(question, set.id, runId, randomUUID(), "mother  in   law"),
    ownerCookie,
  );

  assert.equal(response.status, 200, response.text);
  assert.equal(response.json.data.is_correct, true);
  assert.equal(response.json.data.progress.status, "LEARNED");
  assert.deepEqual(
    response.json.data.character_feedback.filter(({ expected }) => expected === "-"),
    [
      { position: 6, submitted: " ", expected: "-", state: "correct" },
      { position: 9, submitted: " ", expected: "-", state: "correct" },
    ],
  );
});

test("incorrect updates existing Progress once, keeps SRS fields and isolates other USER", async () => {
  const vocabulary = await createVocabulary("incorrect", { word: "mother-in-law" });
  const set = await createSet(owner.id, false, [vocabulary.id]);
  const srsDate = new Date("2027-01-01T00:00:00.000Z");
  await prisma.lEARNING_PROGRESS.createMany({
    data: [
      {
        user_id: owner.id,
        vocabulary_id: vocabulary.id,
        status: "LEARNED",
        review_count: 4,
        revision: 4,
        next_review_at: srsDate,
        interval_days: 8,
        ease_factor: 2.5,
      },
      {
        user_id: otherUser.id,
        vocabulary_id: vocabulary.id,
        status: "LEARNED",
        review_count: 9,
        revision: 9,
      },
    ],
  });
  const runId = randomUUID();
  const question = await loadQuestion(set.id, "UNSCRAMBLE_WORD", runId, ownerCookie);
  const response = await postAnswer(
    answerBody(question, set.id, runId, randomUUID(), "mother in law", 4),
    ownerCookie,
  );
  assert.equal(response.status, 200, response.text);
  assert.equal(response.json.data.is_correct, false);
  assert.equal(response.json.data.progress.status, "LEARNING");
  assert.equal(response.json.data.progress.review_count, 5);
  assert.equal(response.json.data.character_feedback.some(({ state }) => state === "incorrect"), true);

  const current = await findProgress(owner.id, vocabulary.id);
  assert.equal(current.next_review_at.toISOString(), srsDate.toISOString());
  assert.equal(current.interval_days, 8);
  assert.equal(current.ease_factor.toString(), "2.5");
  const isolated = await findProgress(otherUser.id, vocabulary.id);
  assert.equal(isolated.review_count, 9);
  assert.equal(isolated.revision, 9);
});

test("retry, stale revision and changed question conflicts roll back atomically", async () => {
  const vocabulary = await createVocabulary("conflict", { word: "apostrophe's" });
  const set = await createSet(admin.id, true, [vocabulary.id]);
  const runId = randomUUID();
  const question = await loadQuestion(set.id, "VI_TO_ENGLISH", runId, ownerCookie);
  const eventId = randomUUID();
  const accepted = answerBody(question, set.id, runId, eventId, "wrong");
  assert.equal((await postAnswer(accepted, ownerCookie)).status, 200);

  assertError(
    await postAnswer({ ...accepted, answer: "apostrophe's" }, ownerCookie),
    409,
    "QUIZ_RETRY_CONFLICT",
  );
  assertError(
    await postAnswer({ ...accepted, event_id: randomUUID() }, ownerCookie),
    409,
    "QUIZ_PROGRESS_CONFLICT",
  );
  const afterConflicts = await findProgress(owner.id, vocabulary.id);
  assert.equal(afterConflicts.review_count, 1);
  assert.equal(afterConflicts.revision, 1);

  const otherVocabulary = await createVocabulary("changed", { word: "before" });
  const changedSet = await createSet(admin.id, true, [otherVocabulary.id]);
  const changedRun = randomUUID();
  const staleQuestion = await loadQuestion(changedSet.id, "UNSCRAMBLE_WORD", changedRun, ownerCookie);
  await prisma.vOCABULARY.update({
    where: { id: otherVocabulary.id },
    data: { word: "after" },
  });
  assertError(
    await postAnswer(answerBody(staleQuestion, changedSet.id, changedRun, randomUUID(), "after"), ownerCookie),
    409,
    "QUIZ_QUESTION_CHANGED",
  );
  assert.equal(await prisma.lEARNING_PROGRESS.count({ where: { user_id: owner.id, vocabulary_id: otherVocabulary.id } }), 0);
});

test("concurrent submissions at the same revision accept one and reject one without double mutation", async () => {
  const vocabulary = await createVocabulary("race", { word: "concurrency" });
  const set = await createSet(admin.id, true, [vocabulary.id]);
  const runId = randomUUID();
  const question = await loadQuestion(set.id, "UNSCRAMBLE_WORD", runId, ownerCookie);
  const responses = await Promise.all([
    postAnswer(answerBody(question, set.id, runId, randomUUID(), "concurrency"), ownerCookie),
    postAnswer(answerBody(question, set.id, runId, randomUUID(), "wrong"), ownerCookie),
  ]);

  assert.deepEqual(responses.map(({ status }) => status).sort(), [200, 409]);
  assert.equal(responses.find(({ status }) => status === 409).json.error.code, "QUIZ_PROGRESS_CONFLICT");
  const progress = await findProgress(owner.id, vocabulary.id);
  assert.equal(progress.review_count, 1);
  assert.equal(progress.revision, 1);
});

async function sessionCookie(userId) {
  const session = await createSessionFixture(prisma, userId);
  return `session_id=${session.rawToken}`;
}

async function createVocabulary(prefix, { word = `quiz-${prefix}-${randomUUID()}`, nested = false } = {}) {
  const vocabulary = await prisma.vOCABULARY.create({ data: { word } });
  const late = await prisma.vOCABULARY_MEANING.create({
    data: {
      vocabulary_id: vocabulary.id,
      part_of_speech: "verb",
      meaning_vi: `nghĩa B1 ${prefix}`,
      cefr_level: "B1",
      created_at: new Date("2026-02-01T00:00:00.000Z"),
    },
  });
  if (nested) {
    await prisma.vOCABULARY_MEANING.create({
      data: {
        vocabulary_id: vocabulary.id,
        part_of_speech: "noun",
        meaning_vi: "nghĩa A1 được chọn",
        context: "ngữ cảnh an toàn",
        cefr_level: "A1",
        created_at: new Date("2026-03-01T00:00:00.000Z"),
      },
    });
  }
  assert.ok(late.id);
  return vocabulary;
}

function createPersonalQuizVocabulary({ ownerId = null, word, meaningVi, partOfSpeech, secondaryMeaning = false }) {
  return prisma.vOCABULARY.create({
    data: {
      owner_id: ownerId,
      word,
      meanings: {
        create: [
          { part_of_speech: partOfSpeech, meaning_vi: meaningVi, cefr_level: "A1", created_at: new Date("2026-01-01T00:00:00.000Z") },
          ...(secondaryMeaning ? [{ part_of_speech: "noun", meaning_vi: "secondary meaning", cefr_level: "B2", created_at: new Date("2026-02-01T00:00:00.000Z") }] : []),
        ],
      },
    },
  });
}

function createSet(ownerId, isPublic, vocabularyIds) {
  return prisma.vOCABULARY_SET.create({
    data: {
      owner_id: ownerId,
      topic_id: topic.id,
      name: `Quiz Set ${randomUUID()}`,
      is_public: isPublic,
      items: {
        create: vocabularyIds.map((vocabularyId, index) => ({
          vocabulary_id: vocabularyId,
          position: index + 1,
        })),
      },
    },
  });
}

async function getQuestions(setId, type, runId, cookie) {
  return http.request(`/api/quiz/sets/${setId}/questions?type=${type}&run_id=${runId}`, { cookie });
}

async function loadQuestion(setId, type, runId, cookie) {
  const response = await getQuestions(setId, type, runId, cookie);
  assert.equal(response.status, 200, response.text);
  return { ...response.json.data.questions[0], quiz_type: type };
}

function answerBody(question, setId, runId, eventId, answer, expectedRevision = question.progress.revision) {
  return {
    event_id: eventId,
    set_id: setId,
    vocabulary_id: question.vocabulary_id,
    run_id: runId,
    question_revision: question.question_revision,
    quiz_type: question.quiz_type,
    expected_revision: expectedRevision,
    answer,
  };
}

function postAnswer(json, cookie) {
  return http.request("/api/quiz/answers", { method: "POST", json, cookie });
}

function findProgress(userId, vocabularyId) {
  return prisma.lEARNING_PROGRESS.findUnique({
    where: { user_id_vocabulary_id: { user_id: userId, vocabulary_id: vocabularyId } },
  });
}

function progressSnapshot() {
  return prisma.lEARNING_PROGRESS.findMany({ orderBy: { id: "asc" } });
}

function assertNoAnswerLeak(question) {
  const serialized = JSON.stringify(question);
  for (const field of ["word", "phonetic", "pronunciation_url", "examples", "correct_answer", "normalized_answer"]) {
    assert.equal(serialized.includes(`\"${field}\"`), false, `${field} leaked`);
  }
}

function assertError(response, status, code) {
  assert.equal(response.status, status, response.text);
  assert.equal(response.json?.success, false);
  assert.equal(response.json?.error?.code, code);
}
