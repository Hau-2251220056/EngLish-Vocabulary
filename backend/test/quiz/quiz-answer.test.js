import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createQuizService } from "../../src/services/quiz-service.js";

const USER = "00000000-0000-4000-8000-000000000001";
const OTHER = "00000000-0000-4000-8000-000000000009";
const SET = "00000000-0000-4000-8000-000000000002";
const RUN = "00000000-0000-4000-8000-000000000003";
const NOW = "2026-10-15T00:00:00.000Z";

test("correct choice awards 3 XP once and identical retry is no-write", async () => {
  const harness = createHarness();
  const service = createQuizService({ quizRepository: harness.repository });
  const question = await loadQuestion(service);
  const request = answer(question, correctChoice(question).choice_id);
  const first = await service.recordAnswer(USER, request);
  const retry = await service.recordAnswer(USER, request);
  assert.equal(first.is_correct, true);
  assertReward(first, 3, 3, false);
  assertReward(retry, 3, 3, true);
  assert.equal(retry.progress.revision, 1);
  assert.equal(harness.writeCount(), 1);
  assert.equal(harness.rewardCount(), 1);
  assert.equal(harness.progress(USER).status, "LEARNED");
});

test("positive replay returns original earned XP with the current authoritative total", async () => {
  const harness = createHarness();
  const service = createQuizService({ quizRepository: harness.repository });
  const question = await loadQuestion(service);
  const request = answer(question, correctChoice(question).choice_id);
  const original = await service.recordAnswer(USER, request);
  harness.grantUnrelatedReward(3);
  const replay = await service.recordAnswer(USER, request);

  assertReward(original, 3, 3, false);
  assertReward(replay, 3, 6, true);
  assert.equal(original.reward.source_event_id, request.event_id);
  assert.equal(replay.reward.source_event_id, request.event_id);
  assert.equal(harness.rewardCount(), 2);
  assert.equal(harness.totalXp(), 6);
  assert.equal(replay.progress.revision, original.progress.revision);
});

test("incorrect choice awards 0 XP and preserves SRS fields", async () => {
  const initial = progress(USER, { revision: 4, review_count: 8, next_review_at: NOW, interval_days: 7, ease_factor: 2.5 });
  const harness = createHarness({ progressRows: [initial] });
  const service = createQuizService({ quizRepository: harness.repository });
  const question = await loadQuestion(service);
  const wrong = question.choices.find(({ choice_id }) => choice_id !== correctChoice(question).choice_id);
  const result = await service.recordAnswer(USER, answer(question, wrong.choice_id, { expectedRevision: 4 }));
  assert.equal(result.is_correct, false);
  assertReward(result, 0, 0, false);
  assert.equal(harness.rewardCount(), 0);
  assert.equal(harness.progress(USER).status, "LEARNING");
  assert.equal(harness.progress(USER).next_review_at, NOW);
  assert.equal(harness.progress(USER).interval_days, 7);
  assert.equal(harness.progress(OTHER), null);
});

test("zero-XP replay preserves zero earned with the current authoritative total", async () => {
  const harness = createHarness();
  const service = createQuizService({ quizRepository: harness.repository });
  const question = await loadQuestion(service);
  const wrong = question.choices.find(({ choice_id }) => choice_id !== correctChoice(question).choice_id);
  const request = answer(question, wrong.choice_id);
  const original = await service.recordAnswer(USER, request);
  harness.grantUnrelatedReward(3);
  const replay = await service.recordAnswer(USER, request);

  assertReward(original, 0, 0, false);
  assertReward(replay, 0, 3, true);
  assert.equal(original.reward.source_event_id, request.event_id);
  assert.equal(replay.reward.source_event_id, request.event_id);
  assert.equal(harness.rewardCount(), 1);
  assert.equal(harness.totalXp(), 3);
  assert.equal(replay.progress.revision, original.progress.revision);
});

test("later correct answers cannot repeat the first-correct reward", async () => {
  const harness = createHarness();
  const service = createQuizService({ quizRepository: harness.repository });
  const question = await loadQuestion(service);
  const choiceId = correctChoice(question).choice_id;
  const first = await service.recordAnswer(USER, answer(question, choiceId));
  const later = await service.recordAnswer(USER, answer(question, choiceId, { expectedRevision: 1 }));
  assertReward(first, 3, 3, false);
  assertReward(later, 0, 3, false);
  assert.equal(harness.rewardCount(), 1);
  assert.equal(harness.progress(USER).revision, 2);
});

test("Quiz reward remains independent from SRS rewards and exact to Vocabulary UUID", async () => {
  const otherVocabularyId = uuid("other-vocabulary");
  const harness = createHarness({
    totalXp: 6,
    rewards: [
      reward("SRS_INITIAL", uuid("q"), 3),
      reward("QUIZ_FIRST_CORRECT", otherVocabularyId, 3),
    ],
  });
  const service = createQuizService({ quizRepository: harness.repository });
  const question = await loadQuestion(service);
  const result = await service.recordAnswer(USER, answer(question, correctChoice(question).choice_id));
  assertReward(result, 3, 9, false);
  assert.equal(harness.rewardCount(), 3);
  assert.deepEqual(
    new Set(harness.rewards().map(({ vocabulary_id }) => vocabulary_id)),
    new Set([uuid("q"), otherVocabularyId]),
  );
});

test("tampered choice and changed question revision mutate nothing", async () => {
  const harness = createHarness();
  const service = createQuizService({ quizRepository: harness.repository });
  const question = await loadQuestion(service);
  await assert.rejects(service.recordAnswer(USER, answer(question, "A".repeat(43))), { code: "QUIZ_CHOICE_CHANGED" });
  await assert.rejects(service.recordAnswer(USER, { ...answer(question, question.choices[0].choice_id), question_revision: "B".repeat(43) }), { code: "QUIZ_QUESTION_CHANGED" });
  assert.equal(harness.writeCount(), 0);
  assert.equal(harness.rewardCount(), 0);
  assert.equal(harness.totalXp(), 0);
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
  assert.equal(harness.rewardCount() <= 1, true);
});

test("forced CAS loss leaves Progress, reward, and XP unchanged", async () => {
  const harness = createHarness({ forceCasConflict: true, progressRows: [progress(USER, { revision: 2, review_count: 2 })] });
  const service = createQuizService({ quizRepository: harness.repository });
  const question = await loadQuestion(service);
  await assert.rejects(
    service.recordAnswer(USER, answer(question, correctChoice(question).choice_id, { expectedRevision: 2 })),
    { code: "QUIZ_PROGRESS_CONFLICT" },
  );
  assert.equal(harness.progress(USER).revision, 2);
  assert.equal(harness.rewardCount(), 0);
  assert.equal(harness.totalXp(), 0);
});

test("reward insertion and XP increment failures roll back accepted Progress", async () => {
  for (const failure of [
    { rewardError: new Error("reward insert failed") },
    { incrementError: new Error("XP increment failed") },
  ]) {
    const harness = createHarness(failure);
    const service = createQuizService({ quizRepository: harness.repository });
    const question = await loadQuestion(service);
    const expected = failure.rewardError ?? failure.incrementError;
    await assert.rejects(
      service.recordAnswer(USER, answer(question, correctChoice(question).choice_id)),
      (error) => error === expected,
    );
    assert.equal(harness.progress(USER), null);
    assert.equal(harness.rewardCount(), 0);
    assert.equal(harness.totalXp(), 0);
  }
});

test("unauthorized answers cannot award XP", async () => {
  const source = createHarness();
  const question = await loadQuestion(createQuizService({ quizRepository: source.repository }));
  const harness = createHarness({ accessible: false });
  await assert.rejects(
    createQuizService({ quizRepository: harness.repository }).recordAnswer(USER, answer(question, correctChoice(question).choice_id)),
    { code: "QUIZ_SET_NOT_FOUND" },
  );
  assert.equal(harness.progress(USER), null);
  assert.equal(harness.rewardCount(), 0);
  assert.equal(harness.totalXp(), 0);
});

test("accepted response preserves Quiz fields and adds approved reward metadata", async () => {
  const harness = createHarness();
  const service = createQuizService({ quizRepository: harness.repository });
  const question = await loadQuestion(service);
  const result = await service.recordAnswer(USER, answer(question, correctChoice(question).choice_id));
  assert.deepEqual(Object.keys(result).sort(), [
    "correct_choice_id", "is_correct", "progress", "quiz_type", "reward", "run_id",
    "selected_choice_id", "set_id", "vocabulary_id",
  ]);
  assert.deepEqual(Object.keys(result.reward).sort(), [
    "is_max_level", "level", "level_min_xp", "next_level_xp", "replayed",
    "source_event_id", "total_xp", "xp_earned",
  ]);
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
function correctChoice(question) { return question.choices.find(({ label }) => label === "thức dậy"); }
function answer(question, choiceId, { expectedRevision = 0 } = {}) {
  return { event_id: randomUUID(), set_id: SET, vocabulary_id: question.vocabulary_id, run_id: RUN,
    question_revision: question.question_revision, quiz_type: "MULTIPLE_CHOICE", expected_revision: expectedRevision,
    selected_choice_id: choiceId };
}

function createHarness({ accessible = true, forceCasConflict = false, incrementError = null,
  progressRows = [], rewardError = null, rewards = [], totalXp = 0 } = {}) {
  const set = fixtureSet();
  const external = [vocabulary("e1", "sleep", "ngủ"), vocabulary("e2", "eat", "ăn"), vocabulary("e3", "walk", "đi bộ")];
  let committed = new Map(progressRows.map((row) => [row.user_id, structuredClone(row)]));
  let committedRewards = structuredClone(rewards);
  let committedTotalXp = totalXp;
  let writes = 0, transactions = 0, tail = Promise.resolve();
  const base = {
    findAccessibleSetForUser: async () => accessible ? structuredClone(set) : null,
    findCanonicalDistractorCandidates: async () => structuredClone(external),
  };
  const repository = {
    ...base,
    withTransaction(callback) {
      transactions += 1;
      const operation = tail.then(async () => {
        const draft = new Map([...committed].map(([key, row]) => [key, structuredClone(row)]));
        const draftRewards = structuredClone(committedRewards);
        let draftTotalXp = committedTotalXp;
        let draftWrites = writes;
        const tx = {
          ...base,
          lockAccessibleSetForUser: async () => accessible ? { id: SET } : null,
          lockQuestionItem: async () => ({ vocabulary_id: set.items[0].vocabulary.id }),
          lockProgressIdentity: async () => ({ lock_result: "" }),
          findProgress: async (userId) => structuredClone(draft.get(userId) ?? null),
          findRewardByIdentity: async (userId, vocabularyId, rewardType, rewardCycle) => structuredClone(
            draftRewards.find((entry) => entry.user_id === userId && entry.vocabulary_id === vocabularyId
              && entry.reward_type === rewardType && entry.reward_cycle === rewardCycle) ?? null),
          findRewardBySourceEvent: async (userId, sourceEventId) => structuredClone(
            draftRewards.find((entry) => entry.user_id === userId && entry.source_event_id === sourceEventId) ?? null),
          readUserTotalXp: async () => draftTotalXp,
          createProgress: async (data) => {
            const row = progress(data.user_id, data); draft.set(data.user_id, row); draftWrites += 1; return structuredClone(row);
          },
          updateProgressAtRevision: async (id, revision, data) => {
            if (forceCasConflict) return { count: 0 };
            const row = [...draft.values()].find((candidate) => candidate.id === id);
            if (!row || row.revision !== revision) return { count: 0 };
            Object.assign(row, { status: data.status, review_count: row.review_count + 1, revision: row.revision + 1,
              last_reviewed_at: data.last_reviewed_at, last_event_id: data.last_event_id });
            draftWrites += 1; return { count: 1 };
          },
          insertRewardAndIncrementXp: async (data) => {
            if (rewardError) throw rewardError;
            draftRewards.push(structuredClone(data));
            if (incrementError) throw incrementError;
            draftTotalXp += data.xp_amount;
            return { reward: structuredClone(data), total_xp: draftTotalXp };
          },
        };
        const result = await callback(tx);
        committed = draft; committedRewards = draftRewards; committedTotalXp = draftTotalXp; writes = draftWrites;
        return result;
      });
      tail = operation.catch(() => {}); return operation;
    },
  };
  return { repository, progress: (userId) => structuredClone(committed.get(userId) ?? null),
    grantUnrelatedReward: (amount) => {
      committedRewards.push(reward("SRS_INITIAL", uuid(`unrelated-${committedRewards.length}`), amount));
      committedTotalXp += amount;
    },
    rewardCount: () => committedRewards.length, rewards: () => structuredClone(committedRewards),
    totalXp: () => committedTotalXp, writeCount: () => writes, transactionCount: () => transactions };
}

function fixtureSet() { return { id: SET, name: "Core", items: [{ id: uuid("item"), position: 1, vocabulary: vocabulary("q", "wake", "thức dậy") }] }; }
function vocabulary(seed, word, label) { return { id: uuid(seed), word, updated_at: NOW, meanings: [{ id: uuid(`${seed}m`), part_of_speech: "verb", meaning_vi: label, cefr_level: "A1", updated_at: NOW }], learning_progress: [] }; }
function progress(userId, overrides = {}) { return { id: `progress-${userId}`, user_id: userId, vocabulary_id: uuid("q"), status: "LEARNING", review_count: 0, revision: 0,
  last_reviewed_at: null, last_event_id: null, next_review_at: null, interval_days: null, ease_factor: null, ...overrides }; }
function reward(rewardType, vocabularyId, amount) { return { user_id: USER, vocabulary_id: vocabularyId,
  reward_type: rewardType, reward_cycle: 0, source_event_id: randomUUID(), xp_amount: amount }; }
function assertReward(result, earned, total, replayed) {
  assert.equal(result.reward.xp_earned, earned); assert.equal(result.reward.total_xp, total);
  assert.equal(result.reward.replayed, replayed); assert.equal(result.reward.level, 1);
  assert.equal(result.reward.level_min_xp, 0); assert.equal(result.reward.next_level_xp, 50);
  assert.equal(result.reward.is_max_level, false);
}
function uuid(seed) { const value = [...seed].reduce((sum, char) => sum + char.codePointAt(0), 500); return `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`; }
