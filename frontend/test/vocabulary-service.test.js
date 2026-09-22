import assert from "node:assert/strict";
import test from "node:test";
import {
  VocabularyApiError,
  createVocabularyService,
} from "../src/services/vocabulary-service.js";

test("Vocabulary service uses only approved ADMIN aggregate endpoints", async () => {
  const calls = [];
  const client = {
    async get(url) {
      calls.push({ method: "GET", url });
      return {
        data: {
          data: url === "/api/admin/vocabulary" ? [summary] : vocabulary,
        },
      };
    },
    async post(url, body) {
      calls.push({ method: "POST", url, body });
      return { data: { data: vocabulary } };
    },
    async patch(url, body) {
      calls.push({ method: "PATCH", url, body });
      return { data: { data: vocabulary } };
    },
    async delete(url) {
      calls.push({ method: "DELETE", url });
    },
  };
  const service = createVocabularyService(client);
  const input = { word: "book", meanings: [] };

  assert.deepEqual(await service.listVocabulary(), [summary]);
  assert.deepEqual(await service.getVocabulary("vocabulary/id"), vocabulary);
  assert.deepEqual(await service.createVocabulary(input), vocabulary);
  assert.deepEqual(await service.updateVocabulary("vocabulary/id", input), vocabulary);
  await service.deleteVocabulary("vocabulary/id");

  assert.deepEqual(calls, [
    { method: "GET", url: "/api/admin/vocabulary" },
    { method: "GET", url: "/api/admin/vocabulary/vocabulary%2Fid" },
    { method: "POST", url: "/api/admin/vocabulary", body: input },
    { method: "PATCH", url: "/api/admin/vocabulary/vocabulary%2Fid", body: input },
    { method: "DELETE", url: "/api/admin/vocabulary/vocabulary%2Fid" },
  ]);
});

test("Vocabulary service maps safe API, operational, and invalid-response errors", async () => {
  const duplicateService = createVocabularyService({
    async post() {
      throw {
        response: {
          status: 409,
          data: {
            error: {
              code: "VOCABULARY_WORD_ALREADY_EXISTS",
              message: "A Vocabulary word already exists.",
            },
          },
        },
      };
    },
  });
  await assert.rejects(duplicateService.createVocabulary({}), (error) => {
    assert.equal(error instanceof VocabularyApiError, true);
    assert.equal(error.kind, "api");
    assert.equal(error.status, 409);
    assert.equal(error.code, "VOCABULARY_WORD_ALREADY_EXISTS");
    return true;
  });

  const unavailableService = createVocabularyService({
    async get() {
      throw new Error("network details");
    },
  });
  await assert.rejects(unavailableService.listVocabulary(), (error) => {
    assert.equal(error.kind, "operational");
    assert.equal(error.code, "VOCABULARY_REQUEST_FAILED");
    assert.equal(error.message, "Vocabulary service is unavailable.");
    return true;
  });

  const invalidResponseService = createVocabularyService({
    async get() {
      return { data: { data: {} } };
    },
  });
  await assert.rejects(invalidResponseService.listVocabulary(), (error) => {
    assert.equal(error.kind, "operational");
    assert.equal(error.code, "INVALID_VOCABULARY_RESPONSE");
    return true;
  });
});

const summary = Object.freeze({ id: "vocabulary-1", word: "book" });
const vocabulary = Object.freeze({
  ...summary,
  phonetic: null,
  pronunciation_url: null,
  meanings: [],
});
