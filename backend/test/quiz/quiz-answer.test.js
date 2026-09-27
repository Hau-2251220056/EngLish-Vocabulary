import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { createQuestionRevision } from "../../src/services/quiz-domain.js";
import { createQuizService } from "../../src/services/quiz-service.js";

const USER_ID = "10000000-0000-4000-8000-000000000001";
const OTHER_USER_ID = "10000000-0000-4000-8000-000000000002";
const SET_ID = "10000000-0000-4000-8000-000000000003";
const VOCABULARY_ID = "10000000-0000-4000-8000-000000000004";
const ITEM_ID = "10000000-0000-4000-8000-000000000005";
const MEANING_ID = "10000000-0000-4000-8000-000000000006";
const RUN_ID = "10000000-0000-4000-8000-000000000007";
const VOCABULARY_UPDATED_AT = new Date("2026-09-20T00:00:00.000Z");
const MEANING_UPDATED_AT = new Date("2026-09-20T01:00:00.000Z");

test("correct first assessment creates LEARNED Progress once and identical retry is no-write", async () => {
  const harness = createTransactionHarness();
  const service = createQuizService({ quizRepository: harness.repository });
  const eventId = randomUUID();
  const request = answerRequest({
    eventId,
    answer: "  CAFe\u0301\t AU  LAIT ",
    quizType: "VI_TO_ENGLISH",
  });

  const result = await service.recordAnswer(USER_ID, request);
  assert.equal(result.is_correct, true);
  assert.equal(result.normalized_answer, "café au lait");
  assert.equal(result.correct_answer, "Café au lait");
  assert.equal(result.progress.status, "LEARNED");
  assert.equal(result.progress.review_count, 1);
  assert.equal(result.progress.revision, 1);
  assert.equal(result.character_feedback.every(({ state }) => state === "correct"), true);

  const created = harness.getProgress(USER_ID);
  assert.equal(created.last_event_id, eventId);
  assert.equal(created.next_review_at, null);
  assert.equal(created.interval_days, null);
  assert.equal(created.ease_factor, null);
  assert.equal(harness.writeCount(), 1);

  const retry = await service.recordAnswer(USER_ID, request);
  assert.equal(retry.is_correct, true);
  assert.equal(retry.progress.review_count, 1);
  assert.equal(retry.progress.revision, 1);
  assert.equal(harness.writeCount(), 1);

  await assert.rejects(
    () => service.recordAnswer(USER_ID, { ...request, expected_revision: 1 }),
    { code: "QUIZ_RETRY_CONFLICT" },
  );
  assert.equal(harness.writeCount(), 1);
});

test("UNSCRAMBLE_WORD uses the same authoritative evaluation and Progress mutation", async () => {
  const harness = createTransactionHarness();
  const service = createQuizService({ quizRepository: harness.repository });
  const result = await service.recordAnswer(USER_ID, answerRequest({
    quizType: "UNSCRAMBLE_WORD",
    answer: "CAFÉ\u2003AU\u00A0LAIT",
  }));

  assert.equal(result.quiz_type, "UNSCRAMBLE_WORD");
  assert.equal(result.is_correct, true);
  assert.equal(result.normalized_answer, "café au lait");
  assert.equal(result.progress.status, "LEARNED");
  assert.equal(result.progress.review_count, 1);
  assert.equal(harness.writeCount(), 1);
});

test("space-for-hyphen equivalence is limited to VI_TO_ENGLISH and remains idempotent", async () => {
  const viHarness = createTransactionHarness({ word: "mother-in-law" });
  const viService = createQuizService({ quizRepository: viHarness.repository });
  const eventId = randomUUID();
  const request = answerRequest({ eventId, answer: "mother  in   law" });
  const accepted = await viService.recordAnswer(USER_ID, request);
  assert.equal(accepted.is_correct, true);
  assert.equal(accepted.progress.status, "LEARNED");
  assert.deepEqual(accepted.character_feedback.filter(({ expected }) => expected === "-"), [
    { position: 6, submitted: " ", expected: "-", state: "correct" },
    { position: 9, submitted: " ", expected: "-", state: "correct" },
  ]);
  await viService.recordAnswer(USER_ID, request);
  assert.equal(viHarness.getProgress(USER_ID).review_count, 1);
  assert.equal(viHarness.writeCount(), 1);

  const unscrambleHarness = createTransactionHarness({ word: "mother-in-law" });
  const unscrambleService = createQuizService({ quizRepository: unscrambleHarness.repository });
  const strict = await unscrambleService.recordAnswer(USER_ID, answerRequest({
    quizType: "UNSCRAMBLE_WORD",
    answer: "mother in law",
  }));
  assert.equal(strict.is_correct, false);
  assert.equal(strict.progress.status, "LEARNING");
});

test("incorrect assessment updates existing Progress and incompatible retry rolls back", async () => {
  const eventId = randomUUID();
  const harness = createTransactionHarness({
    progress: [progressFixture(USER_ID, {
      status: "LEARNED",
      review_count: 3,
      revision: 3,
      next_review_at: new Date("2027-01-01T00:00:00.000Z"),
      interval_days: 12,
      ease_factor: "2.50",
    })],
  });
  const service = createQuizService({ quizRepository: harness.repository });
  const incorrect = answerRequest({
    eventId,
    answer: "cafe-au-lait",
    expectedRevision: 3,
  });

  const result = await service.recordAnswer(USER_ID, incorrect);
  assert.equal(result.is_correct, false);
  assert.equal(result.progress.status, "LEARNING");
  assert.equal(result.progress.review_count, 4);
  assert.equal(result.progress.revision, 4);
  assert.equal(result.character_feedback.some(({ state }) => state === "incorrect"), true);
  const updated = harness.getProgress(USER_ID);
  assert.equal(updated.next_review_at.toISOString(), "2027-01-01T00:00:00.000Z");
  assert.equal(updated.interval_days, 12);
  assert.equal(updated.ease_factor, "2.50");

  await assert.rejects(
    () => service.recordAnswer(USER_ID, {
      ...incorrect,
      answer: "Café au lait",
    }),
    { code: "QUIZ_RETRY_CONFLICT" },
  );
  assert.equal(harness.getProgress(USER_ID).review_count, 4);
  assert.equal(harness.writeCount(), 1);
});

test("stale revision and changed question revision mutate nothing", async () => {
  const existing = progressFixture(USER_ID, { revision: 2, review_count: 2 });
  const harness = createTransactionHarness({ progress: [existing] });
  const service = createQuizService({ quizRepository: harness.repository });

  await assert.rejects(
    () => service.recordAnswer(USER_ID, answerRequest({ expectedRevision: 1 })),
    { code: "QUIZ_PROGRESS_CONFLICT" },
  );
  await assert.rejects(
    () => service.recordAnswer(USER_ID, {
      ...answerRequest({ expectedRevision: 2 }),
      question_revision: "A".repeat(43),
    }),
    { code: "QUIZ_QUESTION_CHANGED" },
  );
  assert.deepEqual(harness.getProgress(USER_ID), existing);
  assert.equal(harness.writeCount(), 0);
});

test("inaccessible Sets and removed Items are safely rejected without Progress mutation", async () => {
  const inaccessible = createTransactionHarness({ accessibleUserIds: [] });
  await assert.rejects(
    () => createQuizService({ quizRepository: inaccessible.repository })
      .recordAnswer(USER_ID, answerRequest()),
    { code: "QUIZ_SET_NOT_FOUND" },
  );
  assert.equal(inaccessible.writeCount(), 0);

  const missingItem = createTransactionHarness({ itemAvailable: false });
  await assert.rejects(
    () => createQuizService({ quizRepository: missingItem.repository })
      .recordAnswer(USER_ID, answerRequest()),
    { code: "QUIZ_ITEM_CHANGED" },
  );
  assert.equal(missingItem.writeCount(), 0);
});

test("transaction failure rolls back a partially attempted first Progress creation", async () => {
  const harness = createTransactionHarness({ failAfterCreate: true });
  const service = createQuizService({ quizRepository: harness.repository });
  await assert.rejects(
    () => service.recordAnswer(USER_ID, answerRequest()),
    /simulated transaction failure/,
  );
  assert.equal(harness.getProgress(USER_ID), null);
  assert.equal(harness.writeCount(), 0);
});

test("Progress mutation is isolated to the authenticated USER", async () => {
  const otherProgress = progressFixture(OTHER_USER_ID, {
    status: "LEARNED",
    review_count: 8,
    revision: 8,
  });
  const harness = createTransactionHarness({ progress: [otherProgress] });
  const service = createQuizService({ quizRepository: harness.repository });
  await service.recordAnswer(USER_ID, answerRequest());

  assert.equal(harness.getProgress(USER_ID).review_count, 1);
  assert.deepEqual(harness.getProgress(OTHER_USER_ID), otherProgress);
});

test("concurrent different events at one expected revision accept exactly one mutation", async () => {
  const harness = createTransactionHarness({
    progress: [progressFixture(USER_ID, { revision: 4, review_count: 4 })],
  });
  const service = createQuizService({ quizRepository: harness.repository });
  const submissions = await Promise.allSettled([
    service.recordAnswer(USER_ID, answerRequest({
      eventId: randomUUID(),
      expectedRevision: 4,
    })),
    service.recordAnswer(USER_ID, answerRequest({
      eventId: randomUUID(),
      expectedRevision: 4,
    })),
  ]);

  assert.equal(submissions.filter(({ status }) => status === "fulfilled").length, 1);
  const rejected = submissions.find(({ status }) => status === "rejected");
  assert.equal(rejected.reason.code, "QUIZ_PROGRESS_CONFLICT");
  assert.equal(harness.getProgress(USER_ID).review_count, 5);
  assert.equal(harness.getProgress(USER_ID).revision, 5);
  assert.equal(harness.writeCount(), 1);
});

test("exact answer body and approved Quiz types are validated before a transaction", async () => {
  const harness = createTransactionHarness();
  const service = createQuizService({ quizRepository: harness.repository });
  for (const input of [
    { ...answerRequest(), extra: true },
    { ...answerRequest(), quiz_type: "THIRD_TYPE" },
    { ...answerRequest(), answer: "   " },
    { ...answerRequest(), expected_revision: -1 },
  ]) {
    await assert.rejects(
      () => service.recordAnswer(USER_ID, input),
      { code: "QUIZ_VALIDATION_ERROR" },
    );
  }
  assert.equal(harness.transactionCount(), 0);
});

function answerRequest({
  eventId = randomUUID(),
  answer = "Café au lait",
  quizType = "VI_TO_ENGLISH",
  expectedRevision = 0,
} = {}) {
  return {
    event_id: eventId,
    set_id: SET_ID,
    vocabulary_id: VOCABULARY_ID,
    run_id: RUN_ID,
    question_revision: revisionFor(quizType),
    quiz_type: quizType,
    expected_revision: expectedRevision,
    answer,
  };
}

function revisionFor(quizType) {
  return createQuestionRevision({
    setId: SET_ID,
    itemId: ITEM_ID,
    position: 1,
    quizType,
    vocabularyId: VOCABULARY_ID,
    vocabularyUpdatedAt: VOCABULARY_UPDATED_AT,
    runId: RUN_ID,
    meaningId: MEANING_ID,
    meaningUpdatedAt: MEANING_UPDATED_AT,
  });
}

function progressFixture(userId, overrides = {}) {
  return {
    id: `progress-${userId}`,
    user_id: userId,
    vocabulary_id: VOCABULARY_ID,
    status: "LEARNING",
    review_count: 0,
    revision: 0,
    last_reviewed_at: null,
    last_event_id: null,
    next_review_at: null,
    interval_days: null,
    ease_factor: null,
    ...overrides,
  };
}

function createTransactionHarness({
  progress = [],
  accessibleUserIds = [USER_ID, OTHER_USER_ID],
  itemAvailable = true,
  failAfterCreate = false,
  word = "Café au lait",
} = {}) {
  let committed = {
    progress: new Map(progress.map((row) => [progressKey(row.user_id), structuredClone(row)])),
    writeCount: 0,
  };
  let tail = Promise.resolve();
  let transactions = 0;

  function transactionRepository(draft) {
    return {
      async lockAccessibleSetForUser(setId, userId) {
        return setId === SET_ID && accessibleUserIds.includes(userId)
          ? { id: SET_ID, name: "Quiz Set" }
          : null;
      },
      async lockQuestionItem(setId, vocabularyId) {
        if (!itemAvailable || setId !== SET_ID || vocabularyId !== VOCABULARY_ID) return null;
        return {
          item_id: ITEM_ID,
          position: 1,
          vocabulary_id: VOCABULARY_ID,
          word,
          vocabulary_updated_at: VOCABULARY_UPDATED_AT,
        };
      },
      async lockMeanings() {
        return [{
          id: MEANING_ID,
          part_of_speech: "noun",
          meaning_vi: "cà phê sữa",
          context: null,
          cefr_level: "A1",
          updated_at: MEANING_UPDATED_AT,
        }];
      },
      async findProgress(userId) {
        return structuredClone(draft.progress.get(progressKey(userId)) ?? null);
      },
      async createProgress(data) {
        const row = progressFixture(data.user_id, data);
        draft.progress.set(progressKey(data.user_id), row);
        draft.writeCount += 1;
        if (failAfterCreate) throw new Error("simulated transaction failure");
        return structuredClone(row);
      },
      async updateProgressAtRevision(id, expectedRevision, data) {
        const row = [...draft.progress.values()].find((candidate) => candidate.id === id);
        if (!row || row.revision !== expectedRevision) return { count: 0 };
        Object.assign(row, {
          status: data.status,
          review_count: row.review_count + data.review_count.increment,
          revision: row.revision + data.revision.increment,
          last_reviewed_at: data.last_reviewed_at,
          last_event_id: data.last_event_id,
        });
        draft.writeCount += 1;
        return { count: 1 };
      },
    };
  }

  const repository = {
    withTransaction(callback) {
      transactions += 1;
      const operation = tail.then(async () => {
        const draft = {
          progress: new Map([...committed.progress].map(([key, row]) => [key, structuredClone(row)])),
          writeCount: committed.writeCount,
        };
        const result = await callback(transactionRepository(draft));
        committed = draft;
        return result;
      });
      tail = operation.catch(() => {});
      return operation;
    },
  };

  return {
    repository,
    getProgress(userId) {
      return structuredClone(committed.progress.get(progressKey(userId)) ?? null);
    },
    writeCount() {
      return committed.writeCount;
    },
    transactionCount() {
      return transactions;
    },
  };
}

function progressKey(userId) {
  return `${userId}:${VOCABULARY_ID}`;
}
