import assert from "node:assert/strict";
import test from "node:test";
import { VocabularySetApiError, createVocabularySetService } from "../src/services/vocabulary-set-service.js";
import { initialMetadataValue, validateMetadata } from "../src/vocabulary-sets/vocabulary-set-metadata-state.js";

test("Vocabulary Set service uses only approved public, USER, ADMIN, copy, and picker endpoints", async () => {
  const calls = [];
  const client = createClient(calls);
  const service = createVocabularySetService(client);
  const input = { name: "Set" };

  await service.listPublicSystemSets("topic/id");
  await service.getPublicSystemSet("set/id");
  await service.listMySets();
  await service.getMySet("set/id");
  await service.createMySet(input);
  await service.updateMySet("set/id", input);
  await service.deleteMySet("set/id");
  await service.copySystemSet("set/id");
  await service.searchVocabularyPicker("book");
  await service.listAdminSystemSets();
  await service.getAdminSystemSet("set/id");
  await service.createAdminSystemSet(input);
  await service.updateAdminSystemSet("set/id", input);
  await service.deleteAdminSystemSet("set/id");

  assert.deepEqual(calls, [
    ["GET", "/api/topics/topic%2Fid/vocabulary-sets", undefined], ["GET", "/api/vocabulary-sets/set%2Fid", undefined],
    ["GET", "/api/my/vocabulary-sets", undefined], ["GET", "/api/my/vocabulary-sets/set%2Fid", undefined],
    ["POST", "/api/my/vocabulary-sets", input], ["PATCH", "/api/my/vocabulary-sets/set%2Fid", input], ["DELETE", "/api/my/vocabulary-sets/set%2Fid"],
    ["POST", "/api/vocabulary-sets/set%2Fid/copy", undefined], ["GET", "/api/vocabulary-set-picker", { params: { query: "book" } }],
    ["GET", "/api/admin/vocabulary-sets", undefined], ["GET", "/api/admin/vocabulary-sets/set%2Fid", undefined],
    ["POST", "/api/admin/vocabulary-sets", input], ["PATCH", "/api/admin/vocabulary-sets/set%2Fid", input], ["DELETE", "/api/admin/vocabulary-sets/set%2Fid"],
  ]);
});

test("Vocabulary Set service maps safe API, not-found, operational, and invalid-response failures", async () => {
  await assert.rejects(createVocabularySetService({ async get() { throw { response: { status: 404, data: { error: { code: "VOCABULARY_SET_NOT_FOUND", message: "Vocabulary Set was not found." } } } }; } }).getPublicSystemSet("missing"), (error) => {
    assert.equal(error instanceof VocabularySetApiError, true); assert.equal(error.kind, "not-found"); assert.equal(error.status, 404); return true;
  });
  await assert.rejects(createVocabularySetService({ async get() { throw new Error("network details"); } }).listMySets(), (error) => {
    assert.equal(error.kind, "operational"); assert.equal(error.code, "VOCABULARY_SET_REQUEST_FAILED"); return true;
  });
  await assert.rejects(createVocabularySetService({ async get() { return { data: { data: {} } }; } }).listAdminSystemSets(), (error) => {
    assert.equal(error.code, "INVALID_VOCABULARY_SET_RESPONSE"); return true;
  });
});

test("cover mutations use FormData, preserve response cleanup state, and never expose storage credentials", async () => {
  const calls = [];
  const client = {
    async post(url, body) { calls.push(["POST", url, body]); return { data: { data: aggregate, meta: { storage_cleanup: "retry_required" } } }; },
    async delete(url) { calls.push(["DELETE", url]); return { data: { data: aggregate, meta: { storage_cleanup: "complete" } } }; },
  };
  const service = createVocabularySetService(client);
  const file = new File(["image"], "cover.webp", { type: "image/webp" });
  const uploaded = await service.uploadMySetCover("set/id", file);
  assert.equal(calls[0][2] instanceof FormData, true);
  assert.equal(calls[0][2].get("cover"), file);
  assert.equal(uploaded.storage_cleanup, "retry_required");
  assert.equal((await service.removeMySetCover("set/id")).storage_cleanup, "complete");
  await service.cleanupAdminSystemSetCover("admin/id");
  assert.deepEqual(calls.slice(1), [
    ["DELETE", "/api/my/vocabulary-sets/set%2Fid/cover"],
    ["POST", "/api/admin/vocabulary-sets/admin%2Fid/cover/cleanup", undefined],
  ]);
});

test("metadata draft supports legacy nulls and mirrors only safe client hints", () => {
  assert.deepEqual(initialMetadataValue({ cefr_level: null, cover_image_url: null }), {
    cefrLevel: "", coverUrl: "", persistedCoverUrl: null, coverUrlDirty: false,
    isExisting: false, coverFile: null, removeCover: false,
  });
  assert.equal(validateMetadata({ cefrLevel: "", coverFile: null, coverUrl: "" }, { requiredCefr: true }), "Hãy chọn trình độ CEFR.");
  assert.equal(validateMetadata({ cefrLevel: "A1", coverFile: null, coverUrl: "http://example.test/a.png" }, { requiredCefr: true }), "URL ảnh bìa phải sử dụng HTTPS.");
  assert.equal(validateMetadata({ cefrLevel: "", coverFile: null, coverUrl: "https://example.test/a.png" }, { requiredCefr: false }), null);
});

test("USER detail validates and preserves deterministic display projection nulls", async () => {
  const aggregate = {
    id: "set-1", name: "Set", items: [
      { id: "item-1", vocabulary_id: "vocabulary-1", position: 1, word: "book", phonetic: null, source: "CANONICAL", primary_meaning: { part_of_speech: "noun", meaning_vi: "sách", example: { example_en: "A book", example_vi: null } } },
      { id: "item-2", vocabulary_id: "vocabulary-2", position: 2, word: "empty", phonetic: null, source: "PRIVATE", primary_meaning: null },
    ],
  };
  const service = createVocabularySetService({ async get() { return { data: { data: aggregate } }; } });
  const result = await service.getMySet("set-1");
  assert.equal(result.items[0].primary_meaning.example.example_vi, null);
  assert.equal(result.items[1].primary_meaning, null);

  const invalid = createVocabularySetService({ async get() { return { data: { data: { ...aggregate, items: [{ ...aggregate.items[0], primary_meaning: { part_of_speech: "noun", meaning_vi: "sách", example: undefined } }] } } }; } });
  await assert.rejects(invalid.getMySet("set-1"), (error) => error.code === "INVALID_VOCABULARY_SET_RESPONSE");
});

test("picker preserves canonical and same-spelling private identities with source context", async () => {
  const values = [
    { id: "canonical-book", word: "book", phonetic: null, source: "CANONICAL", primary_meaning: { part_of_speech: "noun", meaning_vi: "sÃ¡ch" } },
    { id: "private-book-1", word: "book", phonetic: null, source: "PRIVATE", primary_meaning: { part_of_speech: "verb", meaning_vi: "Ä‘áº·t chá»—" } },
    { id: "private-book-2", word: "book", phonetic: "/bÊŠk/", source: "PRIVATE", primary_meaning: { part_of_speech: "noun", meaning_vi: "quyá»ƒn sÃ¡ch" } },
  ];
  const calls = [];
  const service = createVocabularySetService({
    async get(url, options) {
      calls.push([url, options]);
      return { data: { data: values } };
    },
  });
  const results = await service.searchVocabularyPicker("book");
  assert.deepEqual(results.map(({ id }) => id), values.map(({ id }) => id));
  assert.deepEqual(results.map(({ source, editable }) => [source, editable]), [
    ["CANONICAL", false], ["PRIVATE", true], ["PRIVATE", true],
  ]);
  assert.deepEqual(results[1].primary_meaning, values[1].primary_meaning);
  assert.deepEqual(calls, [["/api/vocabulary-set-picker", { params: { query: "book" } }]]);
});

test("create-private-plus-add sends only approved fields and preserves exact result", async () => {
  const calls = [];
  const result = {
    vocabulary: { id: "private-id", word: "book", phonetic: null, meanings: [] },
    membership: { id: "item-id", vocabulary_id: "private-id", position: 2 },
  };
  const service = createVocabularySetService({
    async post(url, body) {
      calls.push([url, body]);
      return { status: 201, data: { data: result } };
    },
  });
  const input = {
    id: "forbidden-id", owner_id: "forbidden-owner", pronunciation_url: "forbidden",
    source: "PRIVATE", fingerprint: "forbidden", created_at: "forbidden",
    word: "book", phonetic: "/bÊŠk/",
    meanings: [
      { id: "forbidden-meaning", part_of_speech: "noun", meaning_vi: "sÃ¡ch", context: "reading", cefr_level: "A1", examples: [{ id: "forbidden-example", example_en: "A book", example_vi: "Má»™t quyá»ƒn sÃ¡ch" }] },
      { part_of_speech: "verb", meaning_vi: "Ä‘áº·t chá»—" },
    ],
  };
  assert.equal((await service.createPrivateVocabularyAndAdd("set/id", "operation-1", input)).vocabulary.id, "private-id");
  assert.deepEqual(calls, [["/api/my/vocabulary-sets/set%2Fid/vocabulary", {
    operation_id: "operation-1",
    vocabulary: {
      word: "book", phonetic: "/bÊŠk/",
      meanings: [
        { part_of_speech: "noun", meaning_vi: "sÃ¡ch", context: "reading", cefr_level: "A1", examples: [{ example_en: "A book", example_vi: "Má»™t quyá»ƒn sÃ¡ch" }] },
        { part_of_speech: "verb", meaning_vi: "Ä‘áº·t chá»—" },
      ],
    },
  }]]);
});

test("create-private-plus-add accepts retry 200 and normalizes operation conflicts", async () => {
  const result = { vocabulary: { id: "private-id" }, membership: { vocabulary_id: "private-id" } };
  const retryService = createVocabularySetService({
    async post() { return { status: 200, data: { data: result } }; },
  });
  assert.equal((await retryService.createPrivateVocabularyAndAdd("set", "operation", { word: "book", meanings: [] })).vocabulary.id, "private-id");
  let calls = 0;
  const conflictService = createVocabularySetService({
    async post() {
      calls += 1;
      throw { response: { status: 409, data: { error: { code: "PRIVATE_VOCABULARY_OPERATION_CONFLICT", message: "Conflict." } } } };
    },
  });
  await assert.rejects(
    conflictService.createPrivateVocabularyAndAdd("set", "operation", { word: "book", meanings: [] }),
    (error) => error.kind === "conflict" && error.code === "PRIVATE_VOCABULARY_OPERATION_CONFLICT",
  );
  assert.equal(calls, 1);
});

function createClient(calls) {
  return {
    async get(url, options) { calls.push(["GET", url, options]); return { data: { data: url.includes("picker") ? [pickerResult] : url.endsWith("sets") ? [summary] : aggregate } }; },
    async post(url, body) { calls.push(["POST", url, body]); return { data: { data: aggregate } }; },
    async patch(url, body) { calls.push(["PATCH", url, body]); return { data: { data: aggregate } }; },
    async delete(url) { calls.push(["DELETE", url]); },
  };
}

const summary = Object.freeze({ id: "set-1", name: "Set" });
const aggregate = Object.freeze({ ...summary, items: [] });
const pickerResult = Object.freeze({ id: "vocabulary-1", word: "book", phonetic: null, source: "CANONICAL", primary_meaning: null });
