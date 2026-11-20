import assert from "node:assert/strict";
import test from "node:test";
import {
  formatNewXpFeedback,
  isRewardProjection,
  isXpLevelProjection,
} from "../src/services/xp-level-response.js";

const EVENT_ID = "22222222-2222-4222-8222-222222222222";

test("XP/Level validation accepts zero, intermediate and MAX backend projections", () => {
  for (const projection of [
    xpLevel({ total_xp: 0, level: 1, level_min_xp: 0, next_level_xp: 50 }),
    xpLevel(),
    xpLevel({ total_xp: 6000, level: 15, level_min_xp: 5250, next_level_xp: null, is_max_level: true }),
  ]) assert.equal(isXpLevelProjection(projection), true);
});

test("XP/Level validation rejects malformed, inconsistent and non-exact projections", () => {
  for (const projection of [
    null,
    xpLevel({ total_xp: -1 }),
    xpLevel({ total_xp: 2.5 }),
    xpLevel({ level: 0 }),
    xpLevel({ level: 16 }),
    xpLevel({ level_min_xp: 51 }),
    xpLevel({ next_level_xp: 50 }),
    xpLevel({ next_level_xp: null }),
    xpLevel({ level: 15, next_level_xp: null, is_max_level: false }),
    xpLevel({ is_max_level: true, next_level_xp: null }),
    { ...xpLevel(), threshold_table: [] },
  ]) assert.equal(isXpLevelProjection(projection), false);
});

test("reward validation accepts original, replay, zero and MAX projections", () => {
  for (const reward of [
    rewardProjection(),
    rewardProjection({ xp_earned: 0 }),
    rewardProjection({ xp_earned: 1, replayed: true }),
    rewardProjection({ total_xp: 6000, level: 15, level_min_xp: 5250, next_level_xp: null, is_max_level: true }),
  ]) assert.equal(isRewardProjection(reward), true);
});

test("XP feedback is transient only for newly committed positive rewards", () => {
  assert.equal(formatNewXpFeedback(rewardProjection({ xp_earned: 3, replayed: false })), "+3 XP");
  assert.equal(formatNewXpFeedback(rewardProjection({ xp_earned: 1, replayed: false })), "+1 XP");
  assert.equal(formatNewXpFeedback(rewardProjection({ xp_earned: 0, replayed: false })), null);
  assert.equal(formatNewXpFeedback(rewardProjection({ xp_earned: 3, replayed: true })), null);
  assert.equal(formatNewXpFeedback(null), null);
});

test("reward validation rejects unsupported awards, malformed identity and internal fields", () => {
  for (const reward of [
    null,
    rewardProjection({ source_event_id: "event-1" }),
    rewardProjection({ xp_earned: 2 }),
    rewardProjection({ replayed: 0 }),
    rewardProjection({ total_xp: Number.MAX_SAFE_INTEGER + 1 }),
    { ...rewardProjection(), reward_cycle: 0 },
  ]) assert.equal(isRewardProjection(reward), false);
});

function xpLevel(overrides = {}) {
  return {
    total_xp: 50,
    level: 2,
    level_min_xp: 50,
    next_level_xp: 150,
    is_max_level: false,
    ...overrides,
  };
}

function rewardProjection(overrides = {}) {
  return {
    source_event_id: EVENT_ID,
    xp_earned: 3,
    replayed: false,
    ...xpLevel(),
    ...overrides,
  };
}
