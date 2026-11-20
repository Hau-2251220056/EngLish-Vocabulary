import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createVocabularySetService } from "../../src/services/vocabulary-set-service.js";

const ownerId = randomUUID();
const destinationId = randomUUID();
const sourceId = randomUUID();
const vocabularyId = randomUUID();

test("public item add locks the owned destination, validates source membership, and appends the exact ID", async () => {
  const calls = [];
  const membership = { id: randomUUID(), vocabulary_id: vocabularyId, position: 3 };
  const service = createVocabularySetService({
    vocabularySetRepository: repository({ calls, membership }),
  });

  assert.deepEqual(await service.addPublicVocabularyItem(ownerId, destinationId, {
    source_set_id: sourceId,
    vocabulary_id: vocabularyId,
  }), membership);
  assert.deepEqual(calls, [
    ["lock", destinationId, ownerId],
    ["source", sourceId, vocabularyId],
    ["append", destinationId, vocabularyId],
  ]);
});

test("public item add conceals foreign destinations and rejects invalid source membership", async () => {
  const foreign = createVocabularySetService({
    vocabularySetRepository: repository({ lockResult: null }),
  });
  await assert.rejects(
    foreign.addPublicVocabularyItem(ownerId, destinationId, { source_set_id: sourceId, vocabulary_id: vocabularyId }),
    (error) => error.code === "VOCABULARY_SET_NOT_FOUND",
  );

  const invalidSource = createVocabularySetService({
    vocabularySetRepository: repository({ sourceResult: null }),
  });
  await assert.rejects(
    invalidSource.addPublicVocabularyItem(ownerId, destinationId, { source_set_id: sourceId, vocabulary_id: vocabularyId }),
    (error) => error.code === "VOCABULARY_NOT_FOUND",
  );
});

test("public item add maps exact membership uniqueness to the approved conflict", async () => {
  const service = createVocabularySetService({
    vocabularySetRepository: repository({ appendError: Object.assign(new Error("unique"), { code: "P2002" }) }),
  });
  await assert.rejects(
    service.addPublicVocabularyItem(ownerId, destinationId, { source_set_id: sourceId, vocabulary_id: vocabularyId }),
    (error) => error.code === "VOCABULARY_ALREADY_IN_SET",
  );
});

function repository({ appendError, calls = [], lockResult = { id: destinationId }, membership, sourceResult = { id: randomUUID() } } = {}) {
  const value = membership ?? { id: randomUUID(), vocabulary_id: vocabularyId, position: 1 };
  const instance = {
    async withTransaction(callback) { return callback(instance); },
    async lockPrivateSetForOwner(setId, userId) { calls.push(["lock", setId, userId]); return lockResult; },
    async findPublicCanonicalMembership(setId, itemId) { calls.push(["source", setId, itemId]); return sourceResult; },
    async appendVocabularyToLockedSet(setId, itemId) {
      calls.push(["append", setId, itemId]);
      if (appendError) throw appendError;
      return value;
    },
  };
  return instance;
}
