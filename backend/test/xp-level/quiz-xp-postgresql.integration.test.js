import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, afterEach, before, test } from "node:test";
import { createLearningRepository } from "../../src/repositories/learning-repository.js";
import { createQuizRepository } from "../../src/repositories/quiz-repository.js";
import { createLearningService } from "../../src/services/learning-service.js";
import { createQuizService } from "../../src/services/quiz-service.js";
import { createTestDatabase } from "../helpers/test-database.js";
import {
  assertMatchingOwnership,
  assertRunIdentity,
  assertSafeSchemaName,
  buildOwnership,
} from "./xp-level-migration-safety.js";

const TEST_PREFIX = "xp-quiz-task-224";
const INTEGER_MAX = 2_147_483_647;
const FIXED_NOW = new Date("2026-10-16T08:00:00.000Z");

let database;
let prisma;

before(async () => {
  const schemaName = requireIsolatedSchemaEnvironment();
  database = await createTestDatabase();
  prisma = database.prisma;
  await assertIsolatedSchemaOwnership(schemaName);
});

afterEach(async () => database.reset());
after(async () => {
  try {
    if (database) await database.reset();
  } finally {
    if (database) await database.disconnect();
  }
});

test("incorrect then first correct awards one persisted reward and later correct awards zero", async () => {
  const fixture = await createQuizFixture();
  const firstQuestion = await questionFor(fixture);
  const wrongChoice = firstQuestion.choices.find(({ choice_id }) => choice_id !== correctChoice(firstQuestion).choice_id);
  const incorrect = await answer(fixture, firstQuestion, wrongChoice.choice_id);
  const correctQuestion = await questionFor(fixture);
  const correct = await answer(fixture, correctQuestion, correctChoice(correctQuestion).choice_id);
  const laterQuestion = await questionFor(fixture, randomUUID());
  const later = await answer(fixture, laterQuestion, correctChoice(laterQuestion).choice_id);

  assertReward(incorrect, 0, 0, false);
  assertReward(correct, 3, 3, false);
  assertReward(later, 0, 3, false);
  assert.deepEqual(await rewardRows(fixture.user.id), [{
    vocabulary_id: fixture.vocabulary.id,
    reward_type: "QUIZ_FIRST_CORRECT",
    reward_cycle: 0,
    xp_amount: 3,
  }]);
  assert.equal((await progressFor(fixture)).revision, 3);
});

test("Quiz-before-SRS and SRS-before-Quiz independently accumulate 6 XP", async () => {
  for (const order of ["QUIZ_FIRST", "SRS_FIRST"]) {
    const fixture = await createQuizFixture();
    const quiz = async () => {
      const question = await questionFor(fixture);
      return answer(fixture, question, correctChoice(question).choice_id);
    };
    const srs = () => learningService().recordMeaningfulEvent(fixture.user.id, {
      event_id: randomUUID(),
      set_id: fixture.set.id,
      vocabulary_id: fixture.vocabulary.id,
      expected_revision: order === "QUIZ_FIRST" ? 1 : 0,
      rating: "GOOD",
    });

    const first = order === "QUIZ_FIRST" ? await quiz() : await srs();
    const second = order === "QUIZ_FIRST" ? await srs() : await quiz();
    assert.equal(first.reward.xp_earned, 3);
    assert.equal(second.reward.xp_earned, 3);
    assert.equal(second.reward.total_xp, 6);
    assert.deepEqual(
      new Set((await rewardRows(fixture.user.id)).map(({ reward_type }) => reward_type)),
      new Set(["QUIZ_FIRST_CORRECT", "SRS_INITIAL"]),
    );
    await database.reset();
  }
});

test("private same-headword UUIDs are independent while alternate Sets share one reward identity", async () => {
  const user = await createUser();
  await createCanonicalDistractors();
  const word = `${TEST_PREFIX}-shared-headword`;
  const first = await createVocabulary({ ownerId: user.id, word, meaning: "nghĩa riêng một" });
  const second = await createVocabulary({ ownerId: user.id, word, meaning: "nghĩa riêng hai" });
  const firstSet = await createSet(user.id, [first.id]);
  const alternateSet = await createSet(user.id, [first.id]);
  const secondSet = await createSet(user.id, [second.id]);

  const firstResult = await correctAnswer({ user, vocabulary: first, set: firstSet });
  const alternateResult = await correctAnswer({ user, vocabulary: first, set: alternateSet });
  const secondResult = await correctAnswer({ user, vocabulary: second, set: secondSet });

  assertReward(firstResult, 3, 3, false);
  assertReward(alternateResult, 0, 3, false);
  assertReward(secondResult, 3, 6, false);
  assert.deepEqual(
    new Set((await rewardRows(user.id)).map(({ vocabulary_id }) => vocabulary_id)),
    new Set([first.id, second.id]),
  );
});

test("immediate replay returns original XP and current total without a second increment", async () => {
  const fixture = await createQuizFixture();
  const question = await questionFor(fixture);
  const eventId = randomUUID();
  const original = await answer(fixture, question, correctChoice(question).choice_id, { eventId });
  const unrelated = await createVocabulary({ meaning: "unrelated reward" });
  await createQuizRepository(prisma).withTransaction((repository) =>
    repository.insertRewardAndIncrementXp({
      user_id: fixture.user.id,
      vocabulary_id: unrelated.id,
      reward_type: "SRS_INITIAL",
      reward_cycle: 0,
      source_event_id: randomUUID(),
      xp_amount: 3,
    }));
  const replay = await answer(fixture, question, correctChoice(question).choice_id, { eventId });

  assertReward(original, 3, 3, false);
  assertReward(replay, 3, 6, true);
  assert.equal((await progressFor(fixture)).revision, 1);
  assert.equal(await prisma.xP_REWARD.count({ where: { user_id: fixture.user.id } }), 2);
});

test("stale and concurrent duplicate submissions cannot double mutate or award", async () => {
  const stale = await createQuizFixture();
  const staleQuestion = await questionFor(stale);
  await answer(stale, staleQuestion, correctChoice(staleQuestion).choice_id);
  await assert.rejects(
    answer(stale, staleQuestion, correctChoice(staleQuestion).choice_id, { eventId: randomUUID() }),
    { code: "QUIZ_PROGRESS_CONFLICT" },
  );
  assert.equal(await totalXp(stale.user.id), 3);

  const duplicate = await createQuizFixture();
  const question = await questionFor(duplicate);
  const eventId = randomUUID();
  const results = await Promise.all([
    answer(duplicate, question, correctChoice(question).choice_id, { eventId }),
    answer(duplicate, question, correctChoice(question).choice_id, { eventId }),
  ]);
  assert.deepEqual(results.map(({ reward }) => reward.replayed).sort(), [false, true]);
  assert.equal(await prisma.xP_REWARD.count({ where: { user_id: duplicate.user.id } }), 1);
  assert.equal(await totalXp(duplicate.user.id), 3);

  const crossSource = await createQuizFixture();
  const crossQuestion = await questionFor(crossSource);
  const crossResults = await Promise.allSettled([
    answer(crossSource, crossQuestion, correctChoice(crossQuestion).choice_id),
    learningService().recordMeaningfulEvent(crossSource.user.id, {
      event_id: randomUUID(),
      set_id: crossSource.set.id,
      vocabulary_id: crossSource.vocabulary.id,
      expected_revision: 0,
      rating: "GOOD",
    }),
  ]);
  assert.equal(crossResults.filter(({ status }) => status === "fulfilled").length, 1);
  assert.equal(crossResults.filter(({ status }) => status === "rejected").length, 1);
  assert.equal(await prisma.xP_REWARD.count({ where: { user_id: crossSource.user.id } }), 1);
  assert.equal(await totalXp(crossSource.user.id), 3);
});

test("reward source collision rolls back the accepted Progress mutation", async () => {
  const fixture = await createQuizFixture();
  const question = await questionFor(fixture);
  const eventId = randomUUID();
  const other = await createVocabulary({ meaning: "collision owner" });
  await prisma.xP_REWARD.create({ data: {
    user_id: fixture.user.id,
    vocabulary_id: other.id,
    reward_type: "SRS_INITIAL",
    reward_cycle: 0,
    source_event_id: eventId,
    xp_amount: 3,
  } });

  await assert.rejects(
    answer(fixture, question, correctChoice(question).choice_id, { eventId }),
    { code: "QUIZ_PROGRESS_CONFLICT" },
  );
  assert.equal(await progressFor(fixture), null);
  assert.equal(await totalXp(fixture.user.id), 0);
  assert.equal(await prisma.xP_REWARD.count({ where: { user_id: fixture.user.id } }), 1);
});

test("XP increment failure rolls back both Progress and reward insertion", async () => {
  const fixture = await createQuizFixture({ totalXp: INTEGER_MAX });
  const question = await questionFor(fixture);
  await assert.rejects(answer(fixture, question, correctChoice(question).choice_id));
  assert.equal(await progressFor(fixture), null);
  assert.equal(await prisma.xP_REWARD.count({ where: { user_id: fixture.user.id } }), 0);
  assert.equal(await totalXp(fixture.user.id), INTEGER_MAX);
});

test("Quiz preserves complete and incomplete SRS schedules and cannot create due-review rewards", async () => {
  const fixture = await createQuizFixture({ totalXp: 3 });
  await prisma.xP_REWARD.create({ data: {
    user_id: fixture.user.id,
    vocabulary_id: fixture.vocabulary.id,
    reward_type: "SRS_INITIAL",
    reward_cycle: 0,
    source_event_id: randomUUID(),
    xp_amount: 3,
  } });
  await prisma.lEARNING_PROGRESS.create({ data: {
    user_id: fixture.user.id,
    vocabulary_id: fixture.vocabulary.id,
    status: "LEARNED",
    review_count: 4,
    revision: 4,
    last_reviewed_at: new Date(FIXED_NOW.getTime() - 86_400_000),
    next_review_at: FIXED_NOW,
    interval_days: 3,
    ease_factor: 2.5,
  } });
  const question = await questionFor(fixture);
  const result = await answer(fixture, question, correctChoice(question).choice_id);
  const progress = await progressFor(fixture);

  assertReward(result, 3, 6, false);
  assert.equal(progress.revision, 5);
  assert.equal(progress.next_review_at.toISOString(), FIXED_NOW.toISOString());
  assert.equal(progress.interval_days, 3);
  assert.equal(Number(progress.ease_factor), 2.5);
  assert.equal(await prisma.xP_REWARD.count({
    where: { user_id: fixture.user.id, reward_type: "SRS_DUE_REVIEW" },
  }), 0);

  const incomplete = await createQuizFixture({ totalXp: 3 });
  await prisma.xP_REWARD.create({ data: {
    user_id: incomplete.user.id,
    vocabulary_id: incomplete.vocabulary.id,
    reward_type: "SRS_INITIAL",
    reward_cycle: 0,
    source_event_id: randomUUID(),
    xp_amount: 3,
  } });
  await prisma.lEARNING_PROGRESS.create({ data: {
    user_id: incomplete.user.id,
    vocabulary_id: incomplete.vocabulary.id,
    status: "LEARNED",
    review_count: 1,
    revision: 1,
    last_reviewed_at: FIXED_NOW,
  } });
  const incompleteQuestion = await questionFor(incomplete);
  const incompleteResult = await answer(
    incomplete,
    incompleteQuestion,
    correctChoice(incompleteQuestion).choice_id,
  );
  assertReward(incompleteResult, 3, 6, false);
  assert.equal(await prisma.xP_REWARD.count({
    where: { user_id: incomplete.user.id, reward_type: "SRS_DUE_REVIEW" },
  }), 0);
});

test("unauthorized, malformed, and changed answers award no XP", async () => {
  const fixture = await createQuizFixture();
  const outsider = await createUser();
  const question = await questionFor(fixture);
  const body = answerBody(fixture, question, correctChoice(question).choice_id);

  await assert.rejects(quizService().recordAnswer(outsider.id, body), { code: "QUIZ_SET_NOT_FOUND" });
  await assert.rejects(quizService().recordAnswer(fixture.user.id, { ...body, xp: 999 }), { code: "QUIZ_VALIDATION_ERROR" });
  await assert.rejects(quizService().recordAnswer(fixture.user.id, {
    ...body,
    question_revision: "A".repeat(43),
  }), { code: "QUIZ_QUESTION_CHANGED" });
  assert.equal(await prisma.lEARNING_PROGRESS.count(), 0);
  assert.equal(await prisma.xP_REWARD.count(), 0);
  assert.equal(await totalXp(fixture.user.id), 0);
  assert.equal(await totalXp(outsider.id), 0);
});

function quizService() {
  return createQuizService({ quizRepository: createQuizRepository(prisma) });
}

function learningService() {
  return createLearningService({
    learningRepository: createLearningRepository(prisma),
    now: () => new Date(FIXED_NOW),
  });
}

async function createQuizFixture({ totalXp = 0 } = {}) {
  const user = await createUser(totalXp);
  await createCanonicalDistractors();
  const vocabulary = await createVocabulary({ ownerId: user.id, meaning: "target meaning" });
  const set = await createSet(user.id, [vocabulary.id]);
  return { user, vocabulary, set };
}

async function createUser(totalXp = 0) {
  return prisma.uSER.create({ data: {
    email: `${TEST_PREFIX}-${randomUUID()}@example.test`,
    password_hash: "task-224-not-an-auth-fixture",
    display_name: "TASK-224 Quiz XP User",
    role: "USER",
    total_xp: totalXp,
  } });
}

async function createCanonicalDistractors() {
  return Promise.all(["một", "hai", "ba", "bốn"].map((meaning, index) =>
    createVocabulary({ word: `${TEST_PREFIX}-canonical-${index}-${randomUUID()}`, meaning })));
}

async function createVocabulary({ ownerId = null, word, meaning = "test meaning" } = {}) {
  const vocabulary = await prisma.vOCABULARY.create({ data: {
    owner_id: ownerId,
    word: word ?? `${TEST_PREFIX}-${randomUUID()}`,
    meanings: { create: [{ part_of_speech: "noun", meaning_vi: meaning, cefr_level: "A1" }] },
  } });
  return { ...vocabulary, meaning };
}

function createSet(ownerId, vocabularyIds) {
  return prisma.vOCABULARY_SET.create({ data: {
    owner_id: ownerId,
    name: `${TEST_PREFIX}-${randomUUID()}`,
    is_public: false,
    items: { create: vocabularyIds.map((vocabularyId, index) => ({
      vocabulary_id: vocabularyId,
      position: index + 1,
    })) },
  } });
}

async function questionFor(fixture, runId = randomUUID()) {
  const result = await quizService().getQuestions(fixture.user.id, fixture.set.id, {
    type: "MULTIPLE_CHOICE",
    run_id: runId,
  });
  assert.equal(result.questions.length, 1);
  return {
    ...result.questions[0],
    run_id: result.run_id,
    correct_label: fixture.vocabulary.meaning,
  };
}

function correctChoice(question) {
  const choice = question.choices.find(({ label }) => label === question.correct_label);
  assert.ok(choice, "authoritative correct choice is present in the reconstructed question");
  return choice;
}

function answer(fixture, question, selectedChoiceId, { eventId = randomUUID() } = {}) {
  return quizService().recordAnswer(
    fixture.user.id,
    answerBody(fixture, question, selectedChoiceId, eventId),
  );
}

function answerBody(fixture, question, selectedChoiceId, eventId = randomUUID()) {
  return {
    event_id: eventId,
    set_id: fixture.set.id,
    vocabulary_id: fixture.vocabulary.id,
    run_id: question.run_id,
    question_revision: question.question_revision,
    quiz_type: "MULTIPLE_CHOICE",
    expected_revision: question.progress.revision,
    selected_choice_id: selectedChoiceId,
  };
}

async function correctAnswer(fixture) {
  const question = await questionFor(fixture);
  return answer(fixture, question, correctChoice(question).choice_id);
}

function progressFor(fixture) {
  return prisma.lEARNING_PROGRESS.findUnique({ where: {
    user_id_vocabulary_id: {
      user_id: fixture.user.id,
      vocabulary_id: fixture.vocabulary.id,
    },
  } });
}

function rewardRows(userId) {
  return prisma.xP_REWARD.findMany({
    where: { user_id: userId },
    orderBy: [{ reward_type: "asc" }, { vocabulary_id: "asc" }],
    select: { vocabulary_id: true, reward_type: true, reward_cycle: true, xp_amount: true },
  });
}

async function totalXp(userId) {
  return prisma.uSER.findUniqueOrThrow({ where: { id: userId }, select: { total_xp: true } })
    .then(({ total_xp }) => total_xp);
}

function assertReward(result, earned, total, replayed) {
  assert.equal(result.reward.xp_earned, earned);
  assert.equal(result.reward.total_xp, total);
  assert.equal(result.reward.replayed, replayed);
  assert.equal(typeof result.reward.level, "number");
  assert.equal(Object.hasOwn(result, "set_id"), true);
  assert.equal(Object.hasOwn(result, "correct_choice_id"), true);
}

function requireIsolatedSchemaEnvironment() {
  const schemaName = assertSafeSchemaName(process.env.XP_QUIZ_TEST_SCHEMA ?? "");
  const testUrl = new URL(process.env.TEST_DATABASE_URL ?? "");
  const databaseUrl = new URL(process.env.DATABASE_URL ?? "");
  assert.equal(testUrl.searchParams.get("schema"), schemaName);
  assert.equal(databaseUrl.searchParams.get("schema"), schemaName);
  assert.equal(testUrl.toString(), databaseUrl.toString());
  return schemaName;
}

async function assertIsolatedSchemaOwnership(schemaName) {
  const identity = assertRunIdentity({
    repository: process.env.GITHUB_REPOSITORY ?? "",
    runId: process.env.GITHUB_RUN_ID ?? "",
    attempt: process.env.GITHUB_RUN_ATTEMPT ?? "",
  });
  const expectedOwnership = buildOwnership({
    repository: identity.repository,
    runId: identity.runId,
    attempt: identity.attempt,
    schemaName,
  });
  const [row] = await prisma.$queryRawUnsafe(
    "SELECT current_schema() AS schema_name, obj_description(current_schema()::regnamespace, 'pg_namespace') AS ownership_marker",
  );
  assert.equal(row?.schema_name, schemaName);
  assertMatchingOwnership(row?.ownership_marker, expectedOwnership);
}
