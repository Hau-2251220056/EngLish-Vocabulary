import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createLearningController } from "../../src/controllers/learning-controller.js";
import { createAuthenticationMiddleware } from "../../src/middleware/authentication-middleware.js";
import { createRoleAuthorizationMiddleware } from "../../src/middleware/role-authorization-middleware.js";
import { createLearningRepository } from "../../src/repositories/learning-repository.js";
import { createLearningService } from "../../src/services/learning-service.js";

const USER_ID = "10000000-0000-4000-8000-000000000001";
const VOCABULARY_ONE = "20000000-0000-4000-8000-000000000001";
const VOCABULARY_TWO = "20000000-0000-4000-8000-000000000002";
const VOCABULARY_FUTURE = "20000000-0000-4000-8000-000000000003";
const SET_ALPHA = "30000000-0000-4000-8000-000000000001";
const SET_BETA = "30000000-0000-4000-8000-000000000002";
const NOW = new Date("2026-11-08T12:00:00.000Z");

test("Review Center summary uses one instant and approved non-additive attribution", async () => {
  let pathReads = 0;
  let candidateReads = 0;
  const candidates = [
    candidate(VOCABULARY_ONE, dueProgress(), [setItem(SET_ALPHA, "Alpha", true), setItem(SET_BETA, "Beta", false), setItem(SET_ALPHA, "Alpha", true)]),
    candidate(VOCABULARY_ONE, dueProgress(), [setItem(SET_ALPHA, "Alpha", true)]),
    candidate(VOCABULARY_TWO, legacyProgress(), [setItem(SET_ALPHA, "Alpha", true)]),
    candidate(VOCABULARY_FUTURE, futureProgress(), [setItem(SET_BETA, "Beta", false)]),
  ];
  const repository = {
    withTransaction: (callback) => callback(repository, {}),
    async listReviewCenterCandidates(userId, unlockedLevels) {
      candidateReads += 1;
      assert.equal(userId, USER_ID);
      assert.deepEqual(unlockedLevels, ["A1", "A2"]);
      return candidates;
    },
  };
  const service = createLearningService({
    learningRepository: repository,
    createLearningPathRepository: () => ({
      async findPathState(userId) {
        pathReads += 1;
        assert.equal(userId, USER_ID);
        return { highest_unlocked_level: "A2" };
      },
    }),
    now: () => NOW,
  });

  const result = await service.getReviewCenterSummary(USER_ID);

  assert.deepEqual(result, {
    evaluated_at: NOW,
    due_count: 2,
    has_due_items: true,
    nearest_future_review_at: new Date("2026-11-09T12:00:00.000Z"),
    sets: [
      { set_id: SET_ALPHA, name: "Alpha", due_count: 2, set_scope: "PUBLIC" },
      { set_id: SET_BETA, name: "Beta", due_count: 1, set_scope: "PERSONAL" },
    ],
  });
  assert.equal(pathReads, 1);
  assert.equal(candidateReads, 1);
  assert.ok(result.sets.reduce((sum, set) => sum + set.due_count, 0) > result.due_count);
});

test("Review Center excludes future progress and returns truthful zero state", async () => {
  const service = serviceWith([candidate(VOCABULARY_FUTURE, futureProgress(), [setItem(SET_ALPHA, "Alpha", true)])]);
  assert.deepEqual(await service.getReviewCenterSummary(USER_ID), {
    evaluated_at: NOW,
    due_count: 0,
    has_due_items: false,
    nearest_future_review_at: new Date("2026-11-09T12:00:00.000Z"),
    sets: [],
  });
});

test("Review Center global count matches the existing Global Review summary at the same instant", async () => {
  const candidates = [
    candidate(VOCABULARY_ONE, dueProgress(), [setItem(SET_ALPHA, "Alpha", true)]),
    candidate(VOCABULARY_TWO, legacyProgress(), [setItem(SET_BETA, "Beta", false)]),
    candidate(VOCABULARY_FUTURE, futureProgress(), [setItem(SET_BETA, "Beta", false)]),
  ];
  const repository = {
    withTransaction: (callback) => callback(repository, {}),
    listReachableReviewCandidates: async () => candidates,
    listReviewCenterCandidates: async () => candidates,
  };
  const service = createLearningService({
    learningRepository: repository,
    createLearningPathRepository: () => ({ findPathState: async () => null }),
    now: () => NOW,
  });

  const global = await service.getGlobalReviewSummary(USER_ID);
  const center = await service.getReviewCenterSummary(USER_ID);
  assert.equal(center.due_count, global.due_count);
  assert.equal(center.has_due_items, global.has_due_items);
  assert.deepEqual(center.evaluated_at, global.evaluated_at);
  assert.deepEqual(center.nearest_future_review_at, global.nearest_future_review_at);
});

test("Review Center repository reads persisted progress and filters every Set membership by access", async () => {
  let query;
  const prisma = {
    lEARNING_PROGRESS: {
      findMany(input) {
        query = input;
        return [];
      },
    },
  };
  const repository = createLearningRepository(prisma);
  await repository.listReviewCenterCandidates(USER_ID, ["A1", "A2"]);

  assert.equal(query.where.user_id, USER_ID);
  const expectedAccess = {
    OR: [
      { is_public: true, cefr_level: { in: ["A1", "A2"] } },
      { is_public: false, owner_id: USER_ID },
    ],
  };
  assert.deepEqual(
    query.where.vocabulary.vocabulary_items.some.vocabulary_set,
    expectedAccess,
  );
  assert.deepEqual(
    query.select.vocabulary.select.vocabulary_items.where.vocabulary_set,
    expectedAccess,
  );
  assert.equal(query.select.vocabulary.select.vocabulary_items.select.vocabulary_set.select.name, true);
  assert.equal(query.select.vocabulary.select.vocabulary_items.select.vocabulary_set.select.is_public, true);
  assert.equal(Object.hasOwn(query.select.vocabulary.select.vocabulary_items.select.vocabulary_set.select, "owner_id"), false);
  assert.equal(Object.hasOwn(prisma, "$transaction"), false);
});

test("Review Center controller derives identity and preserves safe success/error conventions", async () => {
  const calls = [];
  const controller = createLearningController({
    learningService: {
      async getReviewCenterSummary(userId) {
        calls.push(userId);
        return { due_count: 0, has_due_items: false, evaluated_at: NOW, nearest_future_review_at: null, sets: [] };
      },
    },
  });
  const res = response();
  await controller.getReviewCenterSummary({ user: { id: USER_ID } }, res, failOnNext);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.deepEqual(calls, [USER_ID]);

  const failure = new Error("sensitive repository detail");
  const failingController = createLearningController({
    learningService: { getReviewCenterSummary: async () => { throw failure; } },
  });
  let forwarded;
  await failingController.getReviewCenterSummary(
    { user: { id: USER_ID } }, response(), (error) => { forwarded = error; },
  );
  assert.equal(forwarded, failure);
});

test("Review Center route remains behind authentication and USER authorization", async () => {
  const source = await readFile(new URL("../../src/routes/learning-routes.js", import.meta.url), "utf8");
  assert.match(source, /router\.use\(authenticationMiddleware\)/);
  assert.match(source, /router\.use\(userAuthorizationMiddleware\)/);
  assert.match(source, /router\.get\("\/review\/center", learningController\.getReviewCenterSummary\)/);

  const guest = response();
  const authenticate = createAuthenticationMiddleware({
    authenticationService: { getCurrentUser: async () => null },
  });
  await authenticate({ cookies: {} }, guest, failOnNext);
  assert.equal(guest.statusCode, 401);
  assert.equal(guest.body.error.code, "AUTHENTICATION_FAILED");

  const admin = response();
  const authorizeUser = createRoleAuthorizationMiddleware({ allowedRoles: ["USER"] });
  authorizeUser({ user: { role: "ADMIN" } }, admin, failOnNext);
  assert.equal(admin.statusCode, 403);
  assert.equal(admin.body.error.code, "FORBIDDEN");
});

test("Review Center implementation has no session or mutation dependency", async () => {
  const source = await readFile(new URL("../../src/services/learning-service.js", import.meta.url), "utf8");
  const method = source.slice(
    source.indexOf("async getReviewCenterSummary"),
    source.indexOf("async createGlobalReviewSession"),
  );
  assert.doesNotMatch(method, /createSession|recordMeaningfulEvent|calculateRatingTransition/);
  assert.match(method, /listReviewCenterCandidates/);
  assert.match(method, /summarizeReviewCenter/);
});

function serviceWith(candidates) {
  const repository = {
    withTransaction: (callback) => callback(repository, {}),
    listReviewCenterCandidates: async () => candidates,
  };
  return createLearningService({
    learningRepository: repository,
    createLearningPathRepository: () => ({ findPathState: async () => null }),
    now: () => NOW,
  });
}

function candidate(vocabularyId, progress, items) {
  return {
    id: `40000000-0000-4000-8000-${vocabularyId.slice(-12)}`,
    user_id: USER_ID,
    vocabulary_id: vocabularyId,
    review_count: 1,
    revision: 1,
    last_reviewed_at: new Date("2026-11-01T12:00:00.000Z"),
    last_event_id: null,
    ...progress,
    vocabulary: { id: vocabularyId, vocabulary_items: items },
  };
}

function setItem(id, name, isPublic) {
  return { vocabulary_set: { id, name, is_public: isPublic } };
}

function dueProgress() {
  return { status: "NEEDS_REVIEW", interval_days: 1, next_review_at: new Date("2026-11-07T12:00:00.000Z") };
}

function legacyProgress() {
  return { status: "LEARNED", interval_days: 1, next_review_at: null };
}

function futureProgress() {
  return { status: "LEARNED", interval_days: 1, next_review_at: new Date("2026-11-09T12:00:00.000Z") };
}

function response() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function failOnNext(error) {
  throw error;
}
