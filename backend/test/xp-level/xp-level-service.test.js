import assert from "node:assert/strict";
import test from "node:test";
import {
  XP_LEVEL_THRESHOLDS,
  deriveQuizRewardCandidate,
  deriveSrsRewardCandidate,
  projectXpLevel,
} from "../../src/services/xp-level-service.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const VOCABULARY_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_USER_ID = "33333333-3333-4333-8333-333333333333";
const OTHER_VOCABULARY_ID = "44444444-4444-4444-8444-444444444444";
const ACCEPTED_AT = new Date("2026-10-16T08:00:00.000Z");

test("projects every Level boundary immediately below, at, and above", () => {
  for (let index = 0; index < XP_LEVEL_THRESHOLDS.length; index += 1) {
    const threshold = XP_LEVEL_THRESHOLDS[index];
    const level = index + 1;
    const expected = {
      total_xp: threshold,
      level,
      level_min_xp: threshold,
      next_level_xp: index === XP_LEVEL_THRESHOLDS.length - 1
        ? null
        : XP_LEVEL_THRESHOLDS[index + 1],
      is_max_level: index === XP_LEVEL_THRESHOLDS.length - 1,
    };
    assert.deepEqual(projectXpLevel(threshold), expected);

    if (threshold > 0) {
      const below = projectXpLevel(threshold - 1);
      assert.equal(below.level, level - 1);
      assert.equal(below.next_level_xp, threshold);
    }

    const above = projectXpLevel(threshold + 1);
    assert.equal(above.level, level);
    assert.equal(above.level_min_xp, threshold);
  }
});

test("Level 15 remains MAX while XP continues beyond 5,250", () => {
  assert.deepEqual(projectXpLevel(Number.MAX_SAFE_INTEGER), {
    total_xp: Number.MAX_SAFE_INTEGER,
    level: 15,
    level_min_xp: 5250,
    next_level_xp: null,
    is_max_level: true,
  });
});

test("rejects every invalid XP representation", () => {
  for (const value of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, "50", null, undefined, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => projectXpLevel(value), /nonnegative safe integer/);
  }
});

test("initial SRS reward ignores earlier AGAIN and accepts the first passing rating", () => {
  assert.equal(deriveSrsRewardCandidate(srsInput({ rating: "AGAIN" })), null);
  for (const rating of ["HARD", "GOOD", "EASY"]) {
    assert.deepEqual(deriveSrsRewardCandidate(srsInput({ rating })), {
      reward_type: "SRS_INITIAL",
      reward_cycle: 0,
      xp_amount: 3,
    });
  }
});

test("an existing initial reward prevents another initial reward", () => {
  for (const rating of ["HARD", "GOOD", "EASY"]) {
    assert.equal(deriveSrsRewardCandidate(srsInput({ rating, has_initial_reward: true })), null);
  }
});

test("all ratings earn one due reward at the equality boundary", () => {
  for (const intervalDays of [1, 3, 7, 14, 30]) {
    for (const rating of ["AGAIN", "HARD", "GOOD", "EASY"]) {
      assert.deepEqual(deriveSrsRewardCandidate(srsInput({
        rating,
        has_initial_reward: true,
        progress: scheduledProgress({ interval_days: intervalDays }),
      })), {
        reward_type: "SRS_DUE_REVIEW",
        reward_cycle: 7,
        xp_amount: 1,
      });
    }
  }
});

test("future, immediate LEARNING, NEEDS_REVIEW, and incomplete schedules earn no due reward", () => {
  const ineligible = [
    scheduledProgress({ next_review_at: new Date(ACCEPTED_AT.getTime() + 1) }),
    scheduledProgress({ status: "LEARNING" }),
    scheduledProgress({ status: "NEEDS_REVIEW" }),
    scheduledProgress({ interval_days: null }),
    scheduledProgress({ interval_days: 2 }),
    scheduledProgress({ next_review_at: null }),
    scheduledProgress({ next_review_at: "not-a-date" }),
    scheduledProgress({ revision: 0 }),
  ];
  for (const progress of ineligible) {
    assert.equal(deriveSrsRewardCandidate(srsInput({
      rating: "GOOD",
      has_initial_reward: true,
      progress,
    })), null);
  }
});

test("due review requires exact USER and Vocabulary identity", () => {
  for (const progress of [
    scheduledProgress({ user_id: OTHER_USER_ID }),
    scheduledProgress({ vocabulary_id: OTHER_VOCABULARY_ID }),
  ]) {
    assert.equal(deriveSrsRewardCandidate(srsInput({
      rating: "GOOD",
      has_initial_reward: true,
      progress,
    })), null);
  }
});

test("legacy and Quiz-created unscheduled Progress follow Policy A", () => {
  for (const progress of [
    scheduledProgress({ status: "NEEDS_REVIEW", interval_days: null, next_review_at: null }),
    scheduledProgress({ status: "LEARNED", interval_days: null, next_review_at: null }),
  ]) {
    assert.equal(deriveSrsRewardCandidate(srsInput({ rating: "AGAIN", progress })), null);
    assert.deepEqual(deriveSrsRewardCandidate(srsInput({ rating: "GOOD", progress })), {
      reward_type: "SRS_INITIAL",
      reward_cycle: 0,
      xp_amount: 3,
    });
  }
});

test("Quiz rewards only the first authoritative correct answer", () => {
  assert.equal(deriveQuizRewardCandidate(quizInput({ is_correct: false })), null);
  assert.deepEqual(deriveQuizRewardCandidate(quizInput({ is_correct: true })), {
    reward_type: "QUIZ_FIRST_CORRECT",
    reward_cycle: 0,
    xp_amount: 3,
  });
  assert.equal(deriveQuizRewardCandidate(quizInput({
    is_correct: true,
    has_first_correct_reward: true,
  })), null);
});

test("Quiz and SRS channels remain independent for each exact Vocabulary UUID", () => {
  assert.deepEqual(deriveQuizRewardCandidate(quizInput({ is_correct: true })), {
    reward_type: "QUIZ_FIRST_CORRECT",
    reward_cycle: 0,
    xp_amount: 3,
  });
  assert.deepEqual(deriveSrsRewardCandidate(srsInput({ rating: "GOOD" })), {
    reward_type: "SRS_INITIAL",
    reward_cycle: 0,
    xp_amount: 3,
  });
  assert.deepEqual(deriveQuizRewardCandidate(quizInput({
    vocabulary_id: OTHER_VOCABULARY_ID,
    is_correct: true,
  })), {
    reward_type: "QUIZ_FIRST_CORRECT",
    reward_cycle: 0,
    xp_amount: 3,
  });
});

test("client-shaped XP, Level, Set, run, and headword fields cannot affect candidates", () => {
  const extras = {
    xp_amount: 999999,
    level: 15,
    set_id: "55555555-5555-4555-8555-555555555555",
    run_id: "66666666-6666-4666-8666-666666666666",
    headword: "same spelling",
  };
  assert.deepEqual(deriveSrsRewardCandidate(srsInput({ rating: "HARD", ...extras })), {
    reward_type: "SRS_INITIAL",
    reward_cycle: 0,
    xp_amount: 3,
  });
  assert.deepEqual(deriveQuizRewardCandidate(quizInput({ is_correct: true, ...extras })), {
    reward_type: "QUIZ_FIRST_CORRECT",
    reward_cycle: 0,
    xp_amount: 3,
  });
});

test("pure derivation does not mutate trusted input state", () => {
  const progress = scheduledProgress();
  const input = srsInput({ rating: "AGAIN", has_initial_reward: true, progress });
  const before = structuredClone(input);
  deriveSrsRewardCandidate(input);
  assert.deepEqual(input, before);
});

test("trusted candidate inputs reject malformed identity and decision values", () => {
  assert.throws(() => deriveSrsRewardCandidate(srsInput({ user_id: "not-a-uuid", rating: "GOOD" })), /UUID/);
  assert.throws(() => deriveSrsRewardCandidate(srsInput({ rating: "UNKNOWN" })), /rating/);
  assert.throws(() => deriveSrsRewardCandidate(srsInput({ rating: "GOOD", has_initial_reward: "no" })), /boolean/);
  assert.throws(() => deriveQuizRewardCandidate(quizInput({ is_correct: "yes" })), /boolean/);
  assert.throws(() => deriveQuizRewardCandidate(quizInput({ has_first_correct_reward: null })), /boolean/);
});

function srsInput(overrides = {}) {
  return {
    user_id: USER_ID,
    vocabulary_id: VOCABULARY_ID,
    rating: "GOOD",
    progress: null,
    has_initial_reward: false,
    accepted_at: ACCEPTED_AT,
    ...overrides,
  };
}

function quizInput(overrides = {}) {
  return {
    user_id: USER_ID,
    vocabulary_id: VOCABULARY_ID,
    is_correct: false,
    has_first_correct_reward: false,
    ...overrides,
  };
}

function scheduledProgress(overrides = {}) {
  return {
    user_id: USER_ID,
    vocabulary_id: VOCABULARY_ID,
    status: "LEARNED",
    interval_days: 7,
    next_review_at: ACCEPTED_AT,
    revision: 7,
    ...overrides,
  };
}
