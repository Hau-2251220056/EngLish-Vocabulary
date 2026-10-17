import assert from "node:assert/strict";
import test from "node:test";
import { createLearningService } from "../../src/services/learning-service.js";

const USER_ID = "00000000-0000-4000-8000-000000000001";
const NOW = new Date("2026-10-17T03:00:00.000Z");

test("Progress projects authoritative XP inside the same consistent read without writes", async () => {
  const calls = [];
  const transactionalRepository = {
    async listProgressForSummary(userId) {
      calls.push(["listProgressForSummary", userId]);
      return [];
    },
    async countProgress() {
      throw new Error("Unfiltered Progress must not count separately.");
    },
    async listProgress(userId, query) {
      calls.push(["listProgress", userId, query]);
      return [];
    },
    async readUserTotalXp(userId) {
      calls.push(["readUserTotalXp", userId]);
      return 150;
    },
  };
  const repository = {
    async withConsistentRead(callback) {
      calls.push(["withConsistentRead"]);
      return callback(transactionalRepository);
    },
  };

  const result = await createLearningService({
    learningRepository: repository,
    now: () => NOW,
  }).getLearningProgress(USER_ID, {});

  assert.deepEqual(result, {
    evaluated_at: NOW,
    xp_level: {
      total_xp: 150,
      level: 3,
      level_min_xp: 150,
      next_level_xp: 300,
      is_max_level: false,
    },
    summary: { total_started: 0, learning: 0, learned: 0, needs_review: 0 },
    items: [],
    pagination: { page: 1, page_size: 20, total_items: 0, total_pages: 0 },
    filter: { status: null },
  });
  assert.deepEqual(calls, [
    ["withConsistentRead"],
    ["listProgressForSummary", USER_ID],
    ["listProgress", USER_ID, { status: null, evaluatedAt: NOW, skip: 0, take: 20 }],
    ["readUserTotalXp", USER_ID],
  ]);
});

test("filtered Progress keeps pagination semantics and reads XP from the transaction repository", async () => {
  let outerXpRead = false;
  const repository = {
    async readUserTotalXp() {
      outerXpRead = true;
      return 0;
    },
    async withConsistentRead(callback) {
      return callback({
        async listProgressForSummary() { return []; },
        async countProgress() { return 4; },
        async listProgress() { return []; },
        async readUserTotalXp() { return 49; },
      });
    },
  };

  const result = await createLearningService({
    learningRepository: repository,
    now: () => NOW,
  }).getLearningProgress(USER_ID, {
    page: "2",
    page_size: "2",
    status: "LEARNED",
  });

  assert.equal(outerXpRead, false);
  assert.deepEqual(result.xp_level, {
    total_xp: 49,
    level: 1,
    level_min_xp: 0,
    next_level_xp: 50,
    is_max_level: false,
  });
  assert.deepEqual(result.pagination, {
    page: 2,
    page_size: 2,
    total_items: 4,
    total_pages: 2,
  });
  assert.deepEqual(result.filter, { status: "LEARNED" });
});
