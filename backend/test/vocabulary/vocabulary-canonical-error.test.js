import assert from "node:assert/strict";
import { test } from "node:test";
import { createVocabularyService } from "../../src/services/vocabulary-service.js";

test("ADMIN Vocabulary maps only the canonical word constraint to duplicate behavior", async () => {
  const canonicalCollision = persistenceError({
    modelName: "VOCABULARY",
    target: ["lower(word::text)"],
  });
  await assert.rejects(
    createWithFailure(canonicalCollision),
    { code: "VOCABULARY_WORD_ALREADY_EXISTS" },
  );

  const unrelatedCollision = persistenceError({
    modelName: "VOCABULARY",
    target: ["unrelated_field"],
  });
  await assert.rejects(
    createWithFailure(unrelatedCollision),
    (error) => error === unrelatedCollision,
  );
});

test("ADMIN canonical create rejects client-controlled ownership and scope fields", async () => {
  const repository = {
    findCanonicalByWordInsensitive() {
      throw new Error("Repository must not be called for invalid input.");
    },
  };
  const service = createVocabularyService({ vocabularyRepository: repository });
  for (const field of ["owner_id", "scope", "source", "visibility"]) {
    await assert.rejects(
      service.createVocabulary({
        word: "Canonical",
        meanings: [{
          part_of_speech: "noun",
          meaning_vi: "nghia",
          examples: [],
        }],
        [field]: field === "owner_id" ? "00000000-0000-4000-8000-000000000001" : "PRIVATE",
      }),
      { code: "VALIDATION_ERROR" },
    );
  }
});

function createWithFailure(error) {
  const repository = {
    findCanonicalByWordInsensitive() {
      return null;
    },
    withTransaction(callback) {
      return callback({
        ...repository,
        createAggregate() {
          throw error;
        },
      });
    },
  };
  return createVocabularyService({ vocabularyRepository: repository })
    .createVocabulary({
      word: "Canonical",
      meanings: [{
        part_of_speech: "noun",
        meaning_vi: "nghia",
        examples: [],
      }],
    });
}

function persistenceError(meta) {
  return Object.assign(new Error("Unique constraint failed"), {
    code: "P2002",
    meta,
  });
}
