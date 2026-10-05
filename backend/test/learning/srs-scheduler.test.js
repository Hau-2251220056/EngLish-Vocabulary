import assert from "node:assert/strict";
import test from "node:test";
import {
  SRS_INTERVAL_DAYS,
  calculateRatingTransition,
  evaluateProgress,
  intervalForStage,
  stageForInterval,
} from "../../src/services/srs-scheduler.js";

const NOW = new Date("2026-10-04T03:15:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

test("stage encoding accepts only the approved ladder", () => {
  assert.deepEqual(SRS_INTERVAL_DAYS, [1, 3, 7, 14, 30]);
  assert.equal(stageForInterval(null), 0);
  assert.equal(stageForInterval(2), 0);
  for (let stage = 1; stage <= 5; stage += 1) {
    assert.equal(stageForInterval(intervalForStage(stage)), stage);
  }
});

test("every stage and rating follows the deterministic matrix", () => {
  const expected = [
    { HARD: 1, GOOD: 2, EASY: 3 },
    { HARD: 1, GOOD: 2, EASY: 3 },
    { HARD: 2, GOOD: 3, EASY: 4 },
    { HARD: 3, GOOD: 4, EASY: 5 },
    { HARD: 4, GOOD: 5, EASY: 5 },
    { HARD: 5, GOOD: 5, EASY: 5 },
  ];

  for (let stage = 0; stage <= 5; stage += 1) {
    const progress = stage === 0
      ? null
      : {
          status: "NEEDS_REVIEW",
          interval_days: intervalForStage(stage),
          next_review_at: NOW,
        };
    const again = calculateRatingTransition(progress, "AGAIN", NOW);
    assert.deepEqual(
      pickTransition(again),
      ["LEARNING", 0, null, NOW.toISOString()],
    );

    for (const rating of ["HARD", "GOOD", "EASY"]) {
      const transition = calculateRatingTransition(progress, rating, NOW);
      const expectedStage = expected[stage][rating];
      const interval = intervalForStage(expectedStage);
      assert.deepEqual(pickTransition(transition), [
        "LEARNED",
        expectedStage,
        interval,
        new Date(NOW.getTime() + interval * DAY).toISOString(),
      ]);
    }
  }
});

test("due equality and immediately before/after boundaries are exact", () => {
  const scheduled = {
    status: "LEARNED",
    interval_days: 7,
    next_review_at: NOW,
  };
  assert.equal(evaluateProgress(scheduled, new Date(NOW.getTime() - 1)).is_eligible, false);
  assert.equal(evaluateProgress(scheduled, NOW).effective_status, "NEEDS_REVIEW");
  assert.equal(evaluateProgress(scheduled, new Date(NOW.getTime() + 1)).is_eligible, true);
});

test("legacy and persisted states normalize without mutating their input", () => {
  const cases = [
    [{ status: "LEARNING", interval_days: 30, next_review_at: null }, ["LEARNING", 0, true, true]],
    [{ status: "NEEDS_REVIEW", interval_days: 14, next_review_at: null }, ["NEEDS_REVIEW", 4, true, false]],
    [{ status: "NEEDS_REVIEW", interval_days: 2, next_review_at: NOW }, ["NEEDS_REVIEW", 0, true, true]],
    [{ status: "LEARNED", interval_days: 3, next_review_at: null }, ["LEARNED", 2, true, true]],
    [{ status: "LEARNED", interval_days: null, next_review_at: NOW }, ["LEARNED", 0, true, true]],
    [{ status: "LEARNED", interval_days: 2, next_review_at: NOW }, ["LEARNED", 0, true, true]],
    [{ status: "LEARNED", interval_days: 1, next_review_at: new Date(NOW.getTime() + DAY) }, ["LEARNED", 1, false, false]],
  ];

  for (const [progress, expected] of cases) {
    const before = structuredClone(progress);
    const result = evaluateProgress(progress, NOW);
    assert.deepEqual(
      [result.effective_status, result.stage, result.is_eligible, result.is_legacy_unscheduled],
      expected,
    );
    assert.deepEqual(progress, before);
  }
  assert.deepEqual(
    [evaluateProgress(null, NOW).effective_status, evaluateProgress(null, NOW).stage],
    ["NEW", 0],
  );
});

test("scheduler rejects unknown ratings and invalid clocks", () => {
  assert.throws(() => calculateRatingTransition(null, "REMEMBERED", NOW), /rating/i);
  assert.throws(() => calculateRatingTransition(null, "GOOD", "invalid"), /acceptedAt/);
  assert.throws(() => evaluateProgress(null, "invalid"), /evaluatedAt/);
});

function pickTransition(transition) {
  return [
    transition.status,
    transition.stage,
    transition.interval_days,
    transition.next_review_at.toISOString(),
  ];
}
