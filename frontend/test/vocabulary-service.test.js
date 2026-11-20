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

test("private Vocabulary GET/PATCH use exact IDs and sanitize editable aggregate fields", async () => {
  const calls = [];
  const privateVocabulary = {
    id: "private/id", word: "book", phonetic: null,
    meanings: [
      { id: "meaning-1", part_of_speech: "noun", meaning_vi: "sÃ¡ch", context: null, cefr_level: "A1", examples: [{ id: "example-1", example_en: "A book", example_vi: null }] },
      { id: "meaning-2", part_of_speech: "verb", meaning_vi: "Ä‘áº·t chá»—", context: null, cefr_level: null, examples: [] },
    ],
  };
  const client = {
    async get(url) { calls.push(["GET", url]); return { data: { data: privateVocabulary } }; },
    async patch(url, body) { calls.push(["PATCH", url, body]); return { data: { data: privateVocabulary } }; },
  };
  const service = createVocabularyService(client);
  assert.equal((await service.getPrivateVocabulary("private/id")).meanings.length, 2);
  await service.updatePrivateVocabulary("private/id", {
    ...privateVocabulary,
    owner_id: "forbidden", pronunciation_url: "forbidden", source: "PRIVATE",
    operation_id: "forbidden", created_at: "forbidden",
  });
  assert.deepEqual(calls, [
    ["GET", "/api/my/vocabulary/private%2Fid"],
    ["PATCH", "/api/my/vocabulary/private%2Fid", {
      word: "book", phonetic: null, meanings: privateVocabulary.meanings,
    }],
  ]);
});

const summary = Object.freeze({ id: "vocabulary-1", word: "book" });
const vocabulary = Object.freeze({
  ...summary,
  phonetic: null,
  pronunciation_url: null,
  meanings: [],
});
