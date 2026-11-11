import assert from "node:assert/strict";
import test from "node:test";
import { calculateLearningPassProgress } from "../src/dashboard/dashboard-current-learning.js";

test("current learning progress uses completed Normal-session evidence", () => {
  assert.deepEqual(calculateLearningPassProgress({ snapshot_size: 10, studied_items: 3 }), {
    isValid: true,
    percentage: 30,
    snapshotSize: 10,
    studiedItems: 3,
  });
});

test("current learning progress safely rejects zero or invalid snapshots", () => {
  for (const pass of [
    { snapshot_size: 0, studied_items: 0 },
    { snapshot_size: Number.NaN, studied_items: 1 },
    { snapshot_size: "10", studied_items: 1 },
    null,
  ]) {
    assert.deepEqual(calculateLearningPassProgress(pass), {
      isValid: false,
      percentage: 0,
      snapshotSize: 0,
      studiedItems: 0,
    });
  }
});

test("current learning progress clamps incompatible studied counts", () => {
  assert.equal(calculateLearningPassProgress({ snapshot_size: 8, studied_items: -4 }).percentage, 0);
  assert.deepEqual(calculateLearningPassProgress({ snapshot_size: 8, studied_items: 20 }), {
    isValid: true,
    percentage: 100,
    snapshotSize: 8,
    studiedItems: 8,
  });
});
