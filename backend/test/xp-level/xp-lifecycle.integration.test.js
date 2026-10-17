import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, afterEach, before, test } from "node:test";
import { createLearningRepository } from "../../src/repositories/learning-repository.js";
import { createQuizRepository } from "../../src/repositories/quiz-repository.js";
import { createLearningService } from "../../src/services/learning-service.js";
import { createQuizService } from "../../src/services/quiz-service.js";
import { createTestDatabase } from "../helpers/test-database.js";

const PREFIX = "xp-lifecycle-task-231";
const NOW = new Date("2026-10-17T08:00:00.000Z");
let database;
let prisma;

before(async () => {
  database = await createTestDatabase();
  prisma = database.prisma;
});

afterEach(async () => database.reset());
after(async () => {
  try { if (database) await database.reset(); }
  finally { if (database) await database.disconnect(); }
});

test("Quiz-first and SRS-first lifecycles cross Level 2 with exact cumulative rewards", async () => {
  for (const order of ["QUIZ_FIRST", "SRS_FIRST"]) {
    const fixture = await createFixture({ totalXp: 47 });
    const quiz = () => correctQuizAnswer(fixture);
    const srs = (expectedRevision) => learning().recordMeaningfulEvent(fixture.user.id, {
      event_id: randomUUID(), set_id: fixture.set.id,
      vocabulary_id: fixture.vocabulary.id, expected_revision: expectedRevision, rating: "GOOD",
    });

    const first = order === "QUIZ_FIRST" ? await quiz() : await srs(0);
    const second = order === "QUIZ_FIRST" ? await srs(1) : await quiz();
    assert.deepEqual(
      [first.reward.xp_earned, first.reward.total_xp, first.reward.level],
      [3, 50, 2],
    );
    assert.deepEqual(
      [second.reward.xp_earned, second.reward.total_xp, second.reward.level],
      [3, 53, 2],
    );
    assert.deepEqual(
      new Set((await rewards(fixture.user.id)).map(({ reward_type }) => reward_type)),
      new Set(["SRS_INITIAL", "QUIZ_FIRST_CORRECT"]),
    );
    await database.reset();
  }
});

test("due replay, requeue, alternate Set, USER isolation and NORMAL remain anti-farming safe", async () => {
  const fixture = await createFixture({ totalXp: 3 });
  const alternateSet = await createSet(fixture.user.id, [fixture.vocabulary.id]);
  const outsider = await createUser();
  await prisma.xP_REWARD.create({ data: {
    user_id: fixture.user.id, vocabulary_id: fixture.vocabulary.id,
    reward_type: "SRS_INITIAL", reward_cycle: 0,
    source_event_id: randomUUID(), xp_amount: 3,
  } });
  await prisma.lEARNING_PROGRESS.create({ data: {
    user_id: fixture.user.id, vocabulary_id: fixture.vocabulary.id,
    status: "LEARNED", stage: 1, interval_days: 3,
    next_review_at: new Date(NOW.getTime() - 86_400_000),
    last_reviewed_at: new Date(NOW.getTime() - 172_800_000),
    review_count: 1, revision: 4, last_event_id: randomUUID(),
  } });

  const dueEvent = randomUUID();
  const dueAttempt = { event_id: dueEvent, set_id: fixture.set.id,
    vocabulary_id: fixture.vocabulary.id, expected_revision: 4, rating: "AGAIN" };
  const due = await learning().recordMeaningfulEvent(fixture.user.id, dueAttempt);
  const replay = await learning().recordMeaningfulEvent(fixture.user.id, dueAttempt);
  const requeue = await learning().recordMeaningfulEvent(fixture.user.id, {
    ...dueAttempt, event_id: randomUUID(), expected_revision: 5,
  });
  assert.deepEqual([due.reward.xp_earned, due.reward.total_xp, due.reward.replayed], [1, 4, false]);
  assert.deepEqual([replay.reward.xp_earned, replay.reward.total_xp, replay.reward.replayed], [1, 4, true]);
  assert.deepEqual([requeue.reward.xp_earned, requeue.reward.total_xp], [0, 4]);

  const quizFirst = await correctQuizAnswer(fixture);
  const quizAlternate = await correctQuizAnswer({ ...fixture, set: alternateSet });
  assert.deepEqual([quizFirst.reward.xp_earned, quizFirst.reward.total_xp], [3, 7]);
  assert.deepEqual([quizAlternate.reward.xp_earned, quizAlternate.reward.total_xp], [0, 7]);

  const beforeNormal = await snapshot(fixture.user.id);
  const normal = await learning().getLearningSet(fixture.user.id, fixture.set.id, { mode: "NORMAL" });
  assert.equal(normal.mode, "NORMAL");
  assert.deepEqual(await snapshot(fixture.user.id), beforeNormal);
  await assert.rejects(
    learning().recordMeaningfulEvent(outsider.id, {
      event_id: randomUUID(), set_id: fixture.set.id,
      vocabulary_id: fixture.vocabulary.id, expected_revision: 6, rating: "GOOD",
    }),
    { code: "LEARNING_SET_NOT_FOUND" },
  );
  assert.equal(await prisma.xP_REWARD.count({ where: { user_id: outsider.id } }), 0);
  assert.equal((await prisma.uSER.findUniqueOrThrow({ where: { id: outsider.id } })).total_xp, 0);
});

function learning() {
  return createLearningService({
    learningRepository: createLearningRepository(prisma),
    now: () => new Date(NOW),
  });
}

function quiz() {
  return createQuizService({ quizRepository: createQuizRepository(prisma) });
}

async function createFixture({ totalXp = 0 } = {}) {
  const user = await createUser(totalXp);
  await Promise.all(["one", "two", "three", "four"].map((meaning, index) =>
    createVocabulary(null, `${PREFIX}-canonical-${index}-${randomUUID()}`, meaning)));
  const vocabulary = await createVocabulary(user.id, `${PREFIX}-${randomUUID()}`, "target meaning");
  const set = await createSet(user.id, [vocabulary.id]);
  return { user, vocabulary: { ...vocabulary, meaning: "target meaning" }, set };
}

function createUser(totalXp = 0) {
  return prisma.uSER.create({ data: {
    email: `${PREFIX}-${randomUUID()}@example.test`,
    password_hash: "task-231-not-an-auth-fixture",
    display_name: "TASK-231 Lifecycle User",
    role: "USER",
    total_xp: totalXp,
  } });
}

function createVocabulary(ownerId, word, meaning) {
  return prisma.vOCABULARY.create({ data: {
    owner_id: ownerId,
    word,
    meanings: { create: [{ part_of_speech: "noun", meaning_vi: meaning, cefr_level: "A1" }] },
  } });
}

function createSet(ownerId, vocabularyIds) {
  return prisma.vOCABULARY_SET.create({ data: {
    owner_id: ownerId,
    name: `${PREFIX}-${randomUUID()}`,
    is_public: false,
    items: { create: vocabularyIds.map((vocabularyId, index) => ({
      vocabulary_id: vocabularyId,
      position: index + 1,
    })) },
  } });
}

async function correctQuizAnswer(fixture) {
  const runId = randomUUID();
  const result = await quiz().getQuestions(fixture.user.id, fixture.set.id, {
    type: "MULTIPLE_CHOICE", run_id: runId,
  });
  const question = result.questions[0];
  const correct = question.choices.find(({ label }) => label === fixture.vocabulary.meaning);
  assert.ok(correct);
  return quiz().recordAnswer(fixture.user.id, {
    event_id: randomUUID(), set_id: fixture.set.id,
    vocabulary_id: fixture.vocabulary.id, run_id: runId,
    question_revision: question.question_revision, quiz_type: "MULTIPLE_CHOICE",
    expected_revision: question.progress.revision, selected_choice_id: correct.choice_id,
  });
}

function rewards(userId) {
  return prisma.xP_REWARD.findMany({
    where: { user_id: userId },
    orderBy: [{ reward_type: "asc" }, { reward_cycle: "asc" }],
  });
}

async function snapshot(userId) {
  const [user, progress, rewardRows] = await Promise.all([
    prisma.uSER.findUniqueOrThrow({ where: { id: userId }, select: { total_xp: true } }),
    prisma.lEARNING_PROGRESS.findMany({ where: { user_id: userId }, orderBy: { id: "asc" } }),
    rewards(userId),
  ]);
  return { totalXp: user.total_xp, progress, rewards: rewardRows };
}
