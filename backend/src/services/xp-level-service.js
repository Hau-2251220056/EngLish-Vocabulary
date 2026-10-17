// @ts-nocheck
import { SRS_INTERVAL_DAYS, SRS_RATINGS } from "./srs-scheduler.js";

export const XP_LEVEL_THRESHOLDS = Object.freeze([
  0,
  50,
  150,
  300,
  500,
  750,
  1050,
  1400,
  1800,
  2250,
  2750,
  3300,
  3900,
  4550,
  5250,
]);

export const XP_REWARD_TYPES = Object.freeze({
  SRS_INITIAL: "SRS_INITIAL",
  SRS_DUE_REVIEW: "SRS_DUE_REVIEW",
  QUIZ_FIRST_CORRECT: "QUIZ_FIRST_CORRECT",
});

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PASSING_SRS_RATINGS = new Set(["HARD", "GOOD", "EASY"]);
const SUPPORTED_SRS_INTERVALS = new Set(SRS_INTERVAL_DAYS);

export function projectXpLevel(totalXp) {
  requireNonnegativeSafeInteger(totalXp, "totalXp");

  let thresholdIndex = 0;
  for (let index = 1; index < XP_LEVEL_THRESHOLDS.length; index += 1) {
    if (totalXp < XP_LEVEL_THRESHOLDS[index]) break;
    thresholdIndex = index;
  }

  const isMaxLevel = thresholdIndex === XP_LEVEL_THRESHOLDS.length - 1;
  return {
    total_xp: totalXp,
    level: thresholdIndex + 1,
    level_min_xp: XP_LEVEL_THRESHOLDS[thresholdIndex],
    next_level_xp: isMaxLevel ? null : XP_LEVEL_THRESHOLDS[thresholdIndex + 1],
    is_max_level: isMaxLevel,
  };
}

export function deriveSrsRewardCandidate({
  user_id: userId,
  vocabulary_id: vocabularyId,
  rating,
  progress,
  has_initial_reward: hasInitialReward,
  accepted_at: acceptedAt,
}) {
  requireUuid(userId, "user_id");
  requireUuid(vocabularyId, "vocabulary_id");
  if (!SRS_RATINGS.includes(rating)) throw new TypeError("rating must be a supported SRS rating.");
  if (typeof hasInitialReward !== "boolean") throw new TypeError("has_initial_reward must be boolean.");

  if (!hasInitialReward) {
    return PASSING_SRS_RATINGS.has(rating)
      ? rewardCandidate(XP_REWARD_TYPES.SRS_INITIAL, 0, 3)
      : null;
  }

  if (!isExactProgressIdentity(progress, userId, vocabularyId)) return null;
  if (progress.status !== "LEARNED") return null;
  if (!SUPPORTED_SRS_INTERVALS.has(progress.interval_days)) return null;
  if (!Number.isSafeInteger(progress.revision) || progress.revision <= 0) return null;

  const dueAt = asValidDate(progress.next_review_at);
  const acceptedInstant = asValidDate(acceptedAt);
  if (!dueAt || !acceptedInstant || dueAt.getTime() > acceptedInstant.getTime()) return null;

  return rewardCandidate(XP_REWARD_TYPES.SRS_DUE_REVIEW, progress.revision, 1);
}

export function deriveQuizRewardCandidate({
  user_id: userId,
  vocabulary_id: vocabularyId,
  is_correct: isCorrect,
  has_first_correct_reward: hasFirstCorrectReward,
}) {
  requireUuid(userId, "user_id");
  requireUuid(vocabularyId, "vocabulary_id");
  if (typeof isCorrect !== "boolean") throw new TypeError("is_correct must be boolean.");
  if (typeof hasFirstCorrectReward !== "boolean") {
    throw new TypeError("has_first_correct_reward must be boolean.");
  }

  return isCorrect && !hasFirstCorrectReward
    ? rewardCandidate(XP_REWARD_TYPES.QUIZ_FIRST_CORRECT, 0, 3)
    : null;
}

function rewardCandidate(rewardType, rewardCycle, xpAmount) {
  return {
    reward_type: rewardType,
    reward_cycle: rewardCycle,
    xp_amount: xpAmount,
  };
}

function isExactProgressIdentity(progress, userId, vocabularyId) {
  return Boolean(
    progress
    && typeof progress === "object"
    && !Array.isArray(progress)
    && progress.user_id === userId
    && progress.vocabulary_id === vocabularyId,
  );
}

function asValidDate(value) {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function requireNonnegativeSafeInteger(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${name} must be a nonnegative safe integer.`);
  }
}

function requireUuid(value, name) {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new TypeError(`${name} must be a UUID.`);
  }
}
