import assert from "node:assert/strict";
import test from "node:test";
import { VocabularySetApiError, createVocabularySetService } from "../src/services/vocabulary-set-service.js";

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

function createClient(calls) {
  return {
    async get(url, options) { calls.push(["GET", url, options]); return { data: { data: url.includes("picker") || url.endsWith("sets") ? [summary] : aggregate } }; },
    async post(url, body) { calls.push(["POST", url, body]); return { data: { data: aggregate } }; },
    async patch(url, body) { calls.push(["PATCH", url, body]); return { data: { data: aggregate } }; },
    async delete(url) { calls.push(["DELETE", url]); },
  };
}

const summary = Object.freeze({ id: "set-1", name: "Set" });
const aggregate = Object.freeze({ ...summary, items: [] });
