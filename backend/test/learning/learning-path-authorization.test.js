import assert from "node:assert/strict";
import test from "node:test";
import {
  createLearningPathActivityAuthorizer,
  LearningPathServiceError,
} from "../../src/services/learning-path-service.js";

const USER_ID = "00000000-0000-4000-8000-000000000001";
const SET_ID = "00000000-0000-4000-8000-000000000002";

test("activity authorization requires and uses the caller transaction", async () => {
  const transaction = { marker: "transaction" };
  let receivedTransaction;
  const authorize = createLearningPathActivityAuthorizer({
    createLearningPathRepository(candidate) {
      receivedTransaction = candidate;
      return repository({ is_public: true, cefr_level: "A1" }, null);
    },
  });
  await authorize(transaction, USER_ID, SET_ID);
  assert.equal(receivedTransaction, transaction);
});

test("locked public A1-C1 activity is denied with one stable code", async () => {
  const authorize = authorizer({ is_public: true, cefr_level: "B1" }, { highest_unlocked_level: "A2" });
  await assert.rejects(
    authorize({}, USER_ID, SET_ID),
    (error) => error instanceof LearningPathServiceError && error.code === "CEFR_LEVEL_LOCKED",
  );
});

test("unlocked public, public null-CEFR, and private Sets retain activity access", async () => {
  await authorizer({ is_public: true, cefr_level: "A2" }, { highest_unlocked_level: "A2" })({}, USER_ID, SET_ID);
  await authorizer({ is_public: true, cefr_level: null }, null)({}, USER_ID, SET_ID);
  await authorizer({ is_public: false, cefr_level: "C1" }, null)({}, USER_ID, SET_ID);
});

test("classification is locked before path state is read", async () => {
  const calls = [];
  const authorize = createLearningPathActivityAuthorizer({
    createLearningPathRepository() {
      return {
        async lockActivitySetClassification() { calls.push("lock-set"); return { is_public: true, cefr_level: "A1" }; },
        async findPathState() { calls.push("read-path"); return null; },
      };
    },
  });
  await authorize({}, USER_ID, SET_ID);
  assert.deepEqual(calls, ["lock-set", "read-path"]);
});

function authorizer(set, state) {
  return createLearningPathActivityAuthorizer({
    createLearningPathRepository: () => repository(set, state),
  });
}

function repository(set, state) {
  return {
    lockActivitySetClassification: async () => set,
    findPathState: async () => state,
  };
}
