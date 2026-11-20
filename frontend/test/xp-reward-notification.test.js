import assert from "node:assert/strict";
import test from "node:test";
import { showXpRewardToast } from "../src/components/xp-reward-notification.js";

const sourceEventId = "22222222-2222-4222-8222-222222222222";

test("positive backend-confirmed XP uses the existing success Toast with the actual amount", () => {
  const calls = [];
  const shown = new Set();

  assert.equal(showXpRewardToast(reward(), shown, (...args) => calls.push(args)), true);
  assert.deepEqual(calls, [["Bạn vừa nhận +3 XP!", `xp-reward:${sourceEventId}`]]);
});

test("zero and replayed XP remain silent", () => {
  const calls = [];
  const shown = new Set();

  assert.equal(showXpRewardToast(reward({ xp_earned: 0 }), shown, (...args) => calls.push(args)), false);
  assert.equal(showXpRewardToast(reward({ replayed: true }), shown, (...args) => calls.push(args)), false);
  assert.deepEqual(calls, []);
});

test("the same confirmed source event cannot create a duplicate Toast in one UI flow", () => {
  const calls = [];
  const shown = new Set();
  const notify = (...args) => calls.push(args);

  assert.equal(showXpRewardToast(reward({ xp_earned: 1 }), shown, notify), true);
  assert.equal(showXpRewardToast(reward({ xp_earned: 1 }), shown, notify), false);
  assert.deepEqual(calls, [["Bạn vừa nhận +1 XP!", `xp-reward:${sourceEventId}`]]);
});

function reward(overrides = {}) {
  return {
    source_event_id: sourceEventId,
    xp_earned: 3,
    replayed: false,
    total_xp: 3,
    level: 1,
    level_min_xp: 0,
    next_level_xp: 50,
    is_max_level: false,
    ...overrides,
  };
}
