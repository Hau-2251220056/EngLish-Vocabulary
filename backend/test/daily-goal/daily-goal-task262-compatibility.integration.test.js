import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { createDailyGoalRepository } from "../../src/repositories/daily-goal-repository.js";
import { createLearningRepository } from "../../src/repositories/learning-repository.js";
import { createQuizRepository } from "../../src/repositories/quiz-repository.js";
import { createDailyGoalService } from "../../src/services/daily-goal-service.js";
import { createLearningService } from "../../src/services/learning-service.js";
import { createQuizService } from "../../src/services/quiz-service.js";

const NOW = new Date("2026-10-27T08:00:00.000Z");
const DAY = new Date("2026-10-27T00:00:00.000Z");
const STREAK_DAY = new Date("2026-10-26T00:00:00.000Z");

export async function runTask262CompatibilityIntegration({ prisma } = {}) {
  if (!prisma?.$transaction) throw new TypeError("A real Prisma client is required.");
  const fixtures = { users: [], vocabularyIds: [] };
  const evidence = createEvidenceTracker(["srsCompatibility", "quizCompatibility", "streakIsolation"]);
  let primary;
  try {
    const fixture = await createFixture(prisma, fixtures, { totalXp: 40 });
    const streakBefore = await streakSnapshot(prisma, fixture.user.id);
    assert.equal(streakBefore.length, 1); evidence.mark("streakIsolation");

    const srsEvent = { event_id: randomUUID(), set_id: fixture.set.id, vocabulary_id: fixture.vocabulary.id, expected_revision: 0, rating: "GOOD" };
    const srs = learning(prisma);
    const srsInitial = await srs.recordMeaningfulEvent(fixture.user.id, srsEvent);
    const srsReplay = await srs.recordMeaningfulEvent(fixture.user.id, srsEvent);
    assert.deepEqual([srsInitial.reward.xp_earned, srsInitial.reward.total_xp, srsInitial.reward.replayed], [3, 43, false]);
    assert.deepEqual([srsReplay.reward.xp_earned, srsReplay.reward.total_xp, srsReplay.reward.replayed], [3, 43, true]);
    assert.equal(await rewardCount(prisma, fixture.user.id, "SRS_INITIAL"), 1);
    evidence.mark("srsCompatibility", 3);

    const quizInitial = await correctQuizAnswer(prisma, fixture, fixture.set);
    const quizReplay = await quiz(prisma).recordAnswer(fixture.user.id, quizInitial.request);
    assert.deepEqual([quizInitial.result.reward.xp_earned, quizInitial.result.reward.total_xp, quizInitial.result.reward.replayed], [3, 46, false]);
    assert.deepEqual([quizReplay.reward.xp_earned, quizReplay.reward.total_xp, quizReplay.reward.replayed], [3, 46, true]);
    assert.equal(await rewardCount(prisma, fixture.user.id, "QUIZ_FIRST_CORRECT"), 1);
    evidence.mark("quizCompatibility", 3);

    await prisma.dAILY_GOAL_DAY.create({
      data: { user_id: fixture.user.id, activity_date: DAY, active_milliseconds: 600_000n, last_credited_at: NOW, last_engagement_at: NOW, last_activity_type: "NORMAL" },
    });
    const dailyGoal = createDailyGoalService({ dailyGoalRepository: createDailyGoalRepository(prisma), now: () => new Date(NOW), uuid: randomUUID });
    const dailyResult = await dailyGoal.updateGoal(fixture.user.id, { operation_id: randomUUID(), target_minutes: 10 });
    assert.equal(dailyResult.reward.xp_earned, 10);
    assert.equal(await prisma.xP_REWARD.count({ where: { user_id: fixture.user.id } }), 2);
    evidence.mark("srsCompatibility"); evidence.mark("quizCompatibility");

    await prisma.lEARNING_PROGRESS.update({
      where: { user_id_vocabulary_id: { user_id: fixture.user.id, vocabulary_id: fixture.vocabulary.id } },
      data: { status: "LEARNED", interval_days: 3, next_review_at: new Date(NOW.getTime() - 86_400_000), last_reviewed_at: new Date(NOW.getTime() - 172_800_000), revision: 4 },
    });
    const dueEvent = { ...srsEvent, event_id: randomUUID(), expected_revision: 4, rating: "AGAIN" };
    const due = await srs.recordMeaningfulEvent(fixture.user.id, dueEvent);
    const dueReplay = await srs.recordMeaningfulEvent(fixture.user.id, dueEvent);
    const requeue = await srs.recordMeaningfulEvent(fixture.user.id, { ...dueEvent, event_id: randomUUID(), expected_revision: 5 });
    assert.deepEqual([due.reward.xp_earned, due.reward.total_xp, due.reward.replayed], [1, 57, false]);
    assert.deepEqual([dueReplay.reward.xp_earned, dueReplay.reward.total_xp, dueReplay.reward.replayed], [1, 57, true]);
    assert.deepEqual([requeue.reward.xp_earned, requeue.reward.total_xp], [0, 57]);
    assert.equal(await rewardCount(prisma, fixture.user.id, "SRS_DUE_REVIEW"), 1);
    evidence.mark("srsCompatibility", 4);

    const quizAlternate = await correctQuizAnswer(prisma, fixture, fixture.alternateSet);
    assert.deepEqual([quizAlternate.result.reward.xp_earned, quizAlternate.result.reward.total_xp], [0, 57]);
    assert.equal(await rewardCount(prisma, fixture.user.id, "QUIZ_FIRST_CORRECT"), 1);
    evidence.mark("quizCompatibility", 2);

    assert.deepEqual(await streakSnapshot(prisma, fixture.user.id), streakBefore);
    assert.equal(await prisma.sTREAK_DAY.count({ where: { user_id: fixture.user.id, activity_date: DAY } }), 0);
    assert.equal((await prisma.uSER.findUniqueOrThrow({ where: { id: fixture.user.id }, select: { total_xp: true } })).total_xp, 57);
    evidence.mark("streakIsolation", 3);
    return evidence.finish();
  } catch (error) {
    primary = error;
    throw error;
  } finally {
    try { await cleanupFixtures(prisma, fixtures); }
    catch (cleanupError) { if (primary) markCleanupFailure(primary); else throw cleanupError; }
  }
}

function learning(prisma) { return createLearningService({ learningRepository: createLearningRepository(prisma), now: () => new Date(NOW) }); }
function quiz(prisma) { return createQuizService({ quizRepository: createQuizRepository(prisma) }); }

async function createFixture(prisma, fixtures, { totalXp }) {
  const user = await prisma.uSER.create({ data: { email: `task262-compat-${randomUUID()}@example.test`, password_hash: "not-used", display_name: "TASK-262 Compatibility", role: "USER", total_xp: totalXp } });
  fixtures.users.push(user.id);
  for (const meaning of ["one", "two", "three", "four"]) await createVocabulary(prisma, fixtures, null, `task262-${randomUUID()}`, meaning);
  const vocabulary = await createVocabulary(prisma, fixtures, user.id, `task262-${randomUUID()}`, "target meaning");
  const set = await createSet(prisma, user.id, vocabulary.id);
  const alternateSet = await createSet(prisma, user.id, vocabulary.id);
  const session = await prisma.lEARNING_SESSION.create({ data: { user_id: user.id, vocabulary_set_id: set.id, set_id_snapshot: set.id, mode: "NORMAL", status: "COMPLETED", create_operation_id: randomUUID(), snapshot_size: 1, created_at: NOW, expires_at: new Date(NOW.getTime() + 86_400_000), completed_at: NOW, completion_event_id: randomUUID() } });
  await prisma.sTREAK_DAY.create({ data: { user_id: user.id, activity_date: STREAK_DAY, first_session_id: session.id } });
  return { user, vocabulary: { ...vocabulary, meaning: "target meaning" }, set, alternateSet };
}

async function createVocabulary(prisma, fixtures, ownerId, word, meaning) {
  const vocabulary = await prisma.vOCABULARY.create({ data: { owner_id: ownerId, word, meanings: { create: [{ part_of_speech: "noun", meaning_vi: meaning, cefr_level: "A1" }] } } });
  fixtures.vocabularyIds.push(vocabulary.id);
  return vocabulary;
}

function createSet(prisma, ownerId, vocabularyId) {
  return prisma.vOCABULARY_SET.create({ data: { owner_id: ownerId, name: `task262-${randomUUID()}`, is_public: false, items: { create: [{ vocabulary_id: vocabularyId, position: 1 }] } } });
}

async function correctQuizAnswer(prisma, fixture, set) {
  const service = quiz(prisma);
  const runId = randomUUID();
  const questions = await service.getQuestions(fixture.user.id, set.id, { type: "MULTIPLE_CHOICE", run_id: runId });
  const question = questions.questions[0];
  const correct = question.choices.find(({ label }) => label === fixture.vocabulary.meaning);
  assert.ok(correct);
  const request = { event_id: randomUUID(), set_id: set.id, vocabulary_id: fixture.vocabulary.id, run_id: runId, question_revision: question.question_revision, quiz_type: "MULTIPLE_CHOICE", expected_revision: question.progress.revision, selected_choice_id: correct.choice_id };
  return { request, result: await service.recordAnswer(fixture.user.id, request) };
}

function rewardCount(prisma, userId, rewardType) { return prisma.xP_REWARD.count({ where: { user_id: userId, reward_type: rewardType } }); }
function streakSnapshot(prisma, userId) { return prisma.sTREAK_DAY.findMany({ where: { user_id: userId }, orderBy: { activity_date: "asc" } }); }

function createEvidenceTracker(categories) {
  const counts = Object.fromEntries(categories.map((category) => [category, 0]));
  return Object.freeze({
    mark(category, count = 1) { assert(Object.hasOwn(counts, category)); counts[category] += count; },
    finish() { assert(Object.values(counts).every((count) => Number.isInteger(count) && count > 0)); return Object.fromEntries(Object.entries(counts).map(([category, assertions]) => [category, Object.freeze({ status: "PASS", assertions })])); },
  });
}
function markCleanupFailure(error) { try { Object.defineProperty(error, "task262CleanupFailed", { value: true }); } catch {} }

async function cleanupFixtures(prisma, fixtures) {
  if (!fixtures.users.length) return;
  const where = { user_id: { in: fixtures.users } };
  await prisma.dAILY_GOAL_OPERATION_RECEIPT.deleteMany({ where });
  await prisma.dAILY_GOAL_OWNER.deleteMany({ where });
  await prisma.dAILY_GOAL_TRACKING_SESSION.deleteMany({ where });
  await prisma.dAILY_GOAL_MONITOR_SESSION.deleteMany({ where });
  await prisma.uSER_NOTIFICATION.deleteMany({ where });
  await prisma.dAILY_GOAL_REWARD.deleteMany({ where });
  await prisma.dAILY_GOAL_DAY.deleteMany({ where });
  await prisma.sTREAK_DAY.deleteMany({ where });
  await prisma.xP_REWARD.deleteMany({ where });
  await prisma.lEARNING_PROGRESS.deleteMany({ where });
  await prisma.lEARNING_SESSION.deleteMany({ where });
  await prisma.vOCABULARY_SET.deleteMany({ where: { owner_id: { in: fixtures.users } } });
  await prisma.vOCABULARY.deleteMany({ where: { id: { in: fixtures.vocabularyIds } } });
  await prisma.aUTH_SESSION.deleteMany({ where });
  await prisma.uSER.deleteMany({ where: { id: { in: fixtures.users } } });
}
