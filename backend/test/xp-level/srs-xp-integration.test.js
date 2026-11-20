import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import {
  LearningServiceError,
  createLearningService,
} from "../../src/services/learning-service.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const SET_ID = "22222222-2222-4222-8222-222222222222";
const FIXED_NOW = new Date("2026-10-16T08:00:00.000Z");

test("initial HARD, GOOD, and EASY each award exactly 3 XP", async () => {
  for (const rating of ["HARD", "GOOD", "EASY"]) {
    const repository = new FakeLearningRepository();
    const vocabularyId = randomUUID();
    const result = await service(repository).recordMeaningfulEvent(
      USER_ID,
      event({ vocabularyId, rating }),
    );

    assertReward(result, { xpEarned: 3, totalXp: 3, replayed: false });
    assert.equal(repository.rewards.length, 1);
    assert.equal(repository.rewards[0].reward_type, "SRS_INITIAL");
    assert.equal(repository.rewards[0].reward_cycle, 0);
  }
});

test("initial AGAIN awards zero without consuming the later first-pass reward", async () => {
  const repository = new FakeLearningRepository();
  const vocabularyId = randomUUID();
  const again = await service(repository).recordMeaningfulEvent(
    USER_ID,
    event({ vocabularyId, rating: "AGAIN" }),
  );
  assertReward(again, { xpEarned: 0, totalXp: 0, replayed: false });
  assert.equal(repository.rewards.length, 0);

  const pass = await service(repository).recordMeaningfulEvent(
    USER_ID,
    event({ vocabularyId, rating: "GOOD", expectedRevision: 1 }),
  );
  assertReward(pass, { xpEarned: 3, totalXp: 3, replayed: false });
  assert.equal(repository.rewards.length, 1);
});

test("an existing initial reward prevents a duplicate initial award", async () => {
  const vocabularyId = randomUUID();
  const repository = new FakeLearningRepository({ totalXp: 3 });
  repository.seedProgress(learningProgress(vocabularyId));
  repository.seedReward(reward({ vocabularyId, rewardType: "SRS_INITIAL", amount: 3 }));

  const result = await service(repository).recordMeaningfulEvent(
    USER_ID,
    event({ vocabularyId, rating: "EASY", expectedRevision: 1 }),
  );

  assertReward(result, { xpEarned: 0, totalXp: 3, replayed: false });
  assert.equal(repository.rewards.length, 1);
});

test("a genuinely due scheduled review awards 1 XP from the pre-event revision", async () => {
  const vocabularyId = randomUUID();
  const repository = dueRepository(vocabularyId, { revision: 7 });

  const result = await service(repository).recordMeaningfulEvent(
    USER_ID,
    event({ vocabularyId, rating: "HARD", expectedRevision: 7 }),
  );

  assertReward(result, { xpEarned: 1, totalXp: 4, replayed: false });
  const dueReward = repository.rewards.find(({ reward_type }) => reward_type === "SRS_DUE_REVIEW");
  assert.equal(dueReward.reward_cycle, 7);
  assert.equal(dueReward.xp_amount, 1);
});

test("due AGAIN awards once and its immediate LEARNING requeue awards zero", async () => {
  const vocabularyId = randomUUID();
  const repository = dueRepository(vocabularyId, { revision: 4 });

  const dueAgain = await service(repository).recordMeaningfulEvent(
    USER_ID,
    event({ vocabularyId, rating: "AGAIN", expectedRevision: 4 }),
  );
  assertReward(dueAgain, { xpEarned: 1, totalXp: 4, replayed: false });
  assert.equal(dueAgain.status, "LEARNING");

  const requeue = await service(repository).recordMeaningfulEvent(
    USER_ID,
    event({ vocabularyId, rating: "AGAIN", expectedRevision: 5 }),
  );
  assertReward(requeue, { xpEarned: 0, totalXp: 4, replayed: false });
  assert.equal(repository.rewards.filter(({ reward_type }) => reward_type === "SRS_DUE_REVIEW").length, 1);
});

test("future, legacy-unscheduled, and malformed schedules cannot award due-review XP", async () => {
  const cases = [
    {
      name: "future",
      progress: { status: "LEARNED", interval_days: 3, next_review_at: dayOffset(1) },
      rejected: true,
    },
    {
      name: "legacy",
      progress: { status: "NEEDS_REVIEW", interval_days: null, next_review_at: null },
    },
    {
      name: "malformed",
      progress: { status: "LEARNED", interval_days: 2, next_review_at: dayOffset(-1) },
    },
  ];

  for (const entry of cases) {
    const vocabularyId = randomUUID();
    const repository = new FakeLearningRepository({ totalXp: 3 });
    repository.seedProgress(learningProgress(vocabularyId, entry.progress));
    repository.seedReward(reward({ vocabularyId, rewardType: "SRS_INITIAL", amount: 3 }));
    const operation = service(repository).recordMeaningfulEvent(
      USER_ID,
      event({ vocabularyId, rating: "GOOD", expectedRevision: 1 }),
    );

    if (entry.rejected) {
      await assert.rejects(operation, hasCode("LEARNING_PROGRESS_CHANGED"), entry.name);
    } else {
      assertReward(await operation, { xpEarned: 0, totalXp: 3, replayed: false });
    }
    assert.equal(repository.rewards.length, 1, entry.name);
    assert.equal(repository.totalXp, 3, entry.name);
  }
});

test("distinct Vocabulary UUIDs remain independent even when their headword would match", async () => {
  const repository = new FakeLearningRepository();
  const firstVocabularyId = randomUUID();
  const secondVocabularyId = randomUUID();

  const first = await service(repository).recordMeaningfulEvent(
    USER_ID,
    event({ vocabularyId: firstVocabularyId, rating: "GOOD" }),
  );
  const second = await service(repository).recordMeaningfulEvent(
    USER_ID,
    event({ vocabularyId: secondVocabularyId, rating: "GOOD" }),
  );

  assertReward(first, { xpEarned: 3, totalXp: 3, replayed: false });
  assertReward(second, { xpEarned: 3, totalXp: 6, replayed: false });
  assert.deepEqual(
    new Set(repository.rewards.map(({ vocabulary_id }) => vocabulary_id)),
    new Set([firstVocabularyId, secondVocabularyId]),
  );
});

test("immediate replay returns the original XP award and current total without another increment", async () => {
  const repository = new FakeLearningRepository();
  const vocabularyId = randomUUID();
  const acceptedEvent = event({ vocabularyId, rating: "GOOD" });
  const first = await service(repository).recordMeaningfulEvent(USER_ID, acceptedEvent);
  repository.grantUnrelatedReward(3);
  const replay = await service(repository).recordMeaningfulEvent(USER_ID, {
    ...acceptedEvent,
    rating: "EASY",
  });

  assertReward(first, { xpEarned: 3, totalXp: 3, replayed: false });
  assertReward(replay, { xpEarned: 3, totalXp: 6, replayed: true });
  assert.equal(first.reward.source_event_id, acceptedEvent.event_id);
  assert.equal(replay.reward.source_event_id, acceptedEvent.event_id);
  assert.equal(repository.rewards.length, 2);
  assert.equal(repository.totalXp, 6);
  assert.equal(replay.revision, first.revision);
});

test("zero-XP immediate replay preserves zero earned while returning the current total", async () => {
  const repository = new FakeLearningRepository();
  const vocabularyId = randomUUID();
  const acceptedEvent = event({ vocabularyId, rating: "AGAIN" });
  const first = await service(repository).recordMeaningfulEvent(USER_ID, acceptedEvent);
  repository.grantUnrelatedReward(3);
  const replay = await service(repository).recordMeaningfulEvent(USER_ID, acceptedEvent);

  assertReward(first, { xpEarned: 0, totalXp: 0, replayed: false });
  assertReward(replay, { xpEarned: 0, totalXp: 3, replayed: true });
  assert.equal(first.reward.source_event_id, acceptedEvent.event_id);
  assert.equal(replay.reward.source_event_id, acceptedEvent.event_id);
  assert.equal(repository.rewards.length, 1);
  assert.equal(repository.totalXp, 3);
  assert.equal(replay.revision, first.revision);
});

test("serialized concurrent duplicate acceptance cannot double award in the service model", async () => {
  const repository = new FakeLearningRepository();
  const vocabularyId = randomUUID();
  const duplicate = event({ vocabularyId, rating: "GOOD" });

  const [first, second] = await Promise.all([
    service(repository).recordMeaningfulEvent(USER_ID, duplicate),
    service(repository).recordMeaningfulEvent(USER_ID, duplicate),
  ]);

  assert.deepEqual([first.reward.replayed, second.reward.replayed].sort(), [false, true]);
  assert.equal(repository.rewards.length, 1);
  assert.equal(repository.totalXp, 3);
});

test("Progress CAS conflict and later persistence failure roll back every staged XP mutation", async () => {
  const vocabularyId = randomUUID();
  const conflictRepository = new FakeLearningRepository({ forceCasConflict: true });
  conflictRepository.seedProgress(learningProgress(vocabularyId));
  await assert.rejects(
    service(conflictRepository).recordMeaningfulEvent(
      USER_ID,
      event({ vocabularyId, rating: "GOOD", expectedRevision: 1 }),
    ),
    hasCode("LEARNING_PROGRESS_CHANGED"),
  );
  assert.equal(conflictRepository.progress(vocabularyId).revision, 1);
  assert.equal(conflictRepository.rewards.length, 0);
  assert.equal(conflictRepository.totalXp, 0);

  const failure = new Error("increment failed");
  const failureRepository = new FakeLearningRepository({ incrementError: failure });
  failureRepository.seedProgress(learningProgress(vocabularyId));
  await assert.rejects(
    service(failureRepository).recordMeaningfulEvent(
      USER_ID,
      event({ vocabularyId, rating: "GOOD", expectedRevision: 1 }),
    ),
    (error) => error === failure,
  );
  assert.equal(failureRepository.progress(vocabularyId).revision, 1);
  assert.equal(failureRepository.rewards.length, 0);
  assert.equal(failureRepository.totalXp, 0);
});

test("unauthorized or removed-set events create no Progress, reward, or XP", async () => {
  for (const options of [{ accessible: false }, { member: false }]) {
    const repository = new FakeLearningRepository(options);
    await assert.rejects(
      service(repository).recordMeaningfulEvent(
        USER_ID,
        event({ vocabularyId: randomUUID(), rating: "GOOD" }),
      ),
      (error) => error instanceof LearningServiceError,
    );
    assert.equal(repository.progressCount, 0);
    assert.equal(repository.rewards.length, 0);
    assert.equal(repository.totalXp, 0);
  }
});

test("accepted SRS response preserves existing Progress fields and adds only reward metadata", async () => {
  const repository = new FakeLearningRepository();
  const vocabularyId = randomUUID();
  const result = await service(repository).recordMeaningfulEvent(
    USER_ID,
    event({ vocabularyId, rating: "GOOD" }),
  );

  assert.deepEqual(Object.keys(result).sort(), [
    "effective_status",
    "interval_days",
    "last_reviewed_at",
    "next_review_at",
    "review_count",
    "revision",
    "reward",
    "stage",
    "status",
    "stored_status",
    "vocabulary_id",
  ]);
  assert.deepEqual(Object.keys(result.reward).sort(), [
    "is_max_level",
    "level",
    "level_min_xp",
    "next_level_xp",
    "replayed",
    "source_event_id",
    "total_xp",
    "xp_earned",
  ]);
});

function service(repository) {
  return createLearningService({
    learningRepository: repository,
    now: () => new Date(FIXED_NOW),
  });
}

function event({
  vocabularyId,
  rating,
  expectedRevision = 0,
  eventId = randomUUID(),
}) {
  return {
    event_id: eventId,
    set_id: SET_ID,
    vocabulary_id: vocabularyId,
    expected_revision: expectedRevision,
    rating,
  };
}

function learningProgress(vocabularyId, overrides = {}) {
  return {
    id: randomUUID(),
    user_id: USER_ID,
    vocabulary_id: vocabularyId,
    status: "LEARNING",
    review_count: 1,
    revision: 1,
    last_reviewed_at: new Date(FIXED_NOW),
    last_event_id: null,
    interval_days: null,
    next_review_at: new Date(FIXED_NOW),
    ...overrides,
  };
}

function reward({
  vocabularyId,
  rewardType,
  amount,
  cycle = 0,
  sourceEventId = randomUUID(),
}) {
  return {
    user_id: USER_ID,
    vocabulary_id: vocabularyId,
    reward_type: rewardType,
    reward_cycle: cycle,
    source_event_id: sourceEventId,
    xp_amount: amount,
  };
}

function dueRepository(vocabularyId, { revision }) {
  const repository = new FakeLearningRepository({ totalXp: 3 });
  repository.seedProgress(learningProgress(vocabularyId, {
    status: "LEARNED",
    revision,
    interval_days: 3,
    next_review_at: dayOffset(-1),
  }));
  repository.seedReward(reward({ vocabularyId, rewardType: "SRS_INITIAL", amount: 3 }));
  return repository;
}

function dayOffset(days) {
  return new Date(FIXED_NOW.getTime() + days * 86_400_000);
}

function assertReward(result, { xpEarned, totalXp, replayed }) {
  assert.equal(result.reward.xp_earned, xpEarned);
  assert.equal(result.reward.total_xp, totalXp);
  assert.equal(result.reward.replayed, replayed);
  assert.equal(result.reward.level, 1);
  assert.equal(result.reward.level_min_xp, 0);
  assert.equal(result.reward.next_level_xp, 50);
  assert.equal(result.reward.is_max_level, false);
}

function hasCode(code) {
  return (error) => error?.code === code;
}

class FakeLearningRepository {
  constructor({
    accessible = true,
    member = true,
    totalXp = 0,
    forceCasConflict = false,
    incrementError = null,
  } = {}) {
    this.accessible = accessible;
    this.member = member;
    this.forceCasConflict = forceCasConflict;
    this.incrementError = incrementError;
    this.state = { progress: new Map(), rewards: [], totalXp };
    this.transactionQueue = Promise.resolve();
  }

  get rewards() {
    return this.state.rewards;
  }

  get totalXp() {
    return this.state.totalXp;
  }

  get progressCount() {
    return this.state.progress.size;
  }

  progress(vocabularyId) {
    return this.state.progress.get(progressKey(USER_ID, vocabularyId));
  }

  seedProgress(progress) {
    this.state.progress.set(progressKey(progress.user_id, progress.vocabulary_id), progress);
  }

  seedReward(value) {
    this.state.rewards.push(value);
  }

  grantUnrelatedReward(amount) {
    this.state.rewards.push(reward({
      vocabularyId: randomUUID(),
      rewardType: "QUIZ_FIRST_CORRECT",
      amount,
    }));
    this.state.totalXp += amount;
  }

  withTransaction(callback) {
    const operation = this.transactionQueue.then(async () => {
      const draft = structuredClone(this.state);
      const result = await callback(this.methods(draft));
      this.state = draft;
      return result;
    });
    this.transactionQueue = operation.catch(() => {});
    return operation;
  }

  findProgress(userId, vocabularyId) {
    return this.methods(this.state).findProgress(userId, vocabularyId);
  }

  findRewardBySourceEvent(userId, sourceEventId) {
    return this.methods(this.state).findRewardBySourceEvent(userId, sourceEventId);
  }

  readUserTotalXp(userId) {
    return this.methods(this.state).readUserTotalXp(userId);
  }

  methods(state) {
    return {
      lockAccessibleSetForUser: async () => this.accessible ? { id: SET_ID } : null,
      lockSetItem: async () => this.member ? { id: randomUUID() } : null,
      lockProgressIdentity: async () => ({ lock_result: "" }),
      findProgress: async (userId, vocabularyId) =>
        state.progress.get(progressKey(userId, vocabularyId)) ?? null,
      findRewardByIdentity: async (userId, vocabularyId, rewardType, rewardCycle) =>
        state.rewards.find((entry) =>
          entry.user_id === userId
          && entry.vocabulary_id === vocabularyId
          && entry.reward_type === rewardType
          && entry.reward_cycle === rewardCycle) ?? null,
      findRewardBySourceEvent: async (userId, sourceEventId) =>
        state.rewards.find((entry) =>
          entry.user_id === userId && entry.source_event_id === sourceEventId) ?? null,
      readUserTotalXp: async (userId) => userId === USER_ID ? state.totalXp : null,
      createProgress: async (data) => {
        const key = progressKey(data.user_id, data.vocabulary_id);
        if (state.progress.has(key)) throw Object.assign(new Error("duplicate progress"), { code: "P2002" });
        const created = normalizeProgress({ id: randomUUID(), ...data });
        state.progress.set(key, created);
        return created;
      },
      updateProgressAtRevision: async (id, expectedRevision, data) => {
        if (this.forceCasConflict) return { count: 0 };
        const entry = [...state.progress.values()].find((progress) =>
          progress.id === id && progress.revision === expectedRevision);
        if (!entry) return { count: 0 };
        applyProgressUpdate(entry, data);
        return { count: 1 };
      },
      insertRewardAndIncrementXp: async (data) => {
        state.rewards.push({ ...data });
        if (this.incrementError) throw this.incrementError;
        state.totalXp += data.xp_amount;
        return {
          reward: { ...data },
          total_xp: state.totalXp,
        };
      },
    };
  }
}

function progressKey(userId, vocabularyId) {
  return `${userId}:${vocabularyId}`;
}

function normalizeProgress(progress) {
  return {
    status: null,
    review_count: 0,
    revision: 0,
    last_reviewed_at: null,
    last_event_id: null,
    interval_days: null,
    next_review_at: null,
    ...progress,
  };
}

function applyProgressUpdate(progress, data) {
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === "object" && Object.hasOwn(value, "increment")) {
      progress[key] += value.increment;
    } else {
      progress[key] = value;
    }
  }
}
