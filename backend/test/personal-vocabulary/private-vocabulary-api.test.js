import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, afterEach, before, test } from "node:test";
import { createApp } from "../../src/create-app.js";
import { createSessionFixture, createUserFixture } from "../helpers/auth-fixtures.js";
import { createTestDatabase } from "../helpers/test-database.js";
import { startHttpTestServer } from "../helpers/http-test-server.js";

let database, prisma, http;
before(async () => { database = await createTestDatabase(); prisma = database.prisma; http = await startHttpTestServer(createApp({ prisma })); });
afterEach(async () => { await database.reset(); });
after(async () => { if (http) await http.close(); if (database) await database.disconnect(); });

test("owner GET returns exact same-spelling private identities and conceals inaccessible IDs", async () => {
  const owner = await user(); const other = await user(); const cookie = await session(owner);
  const first = await privateVocabulary(owner.id, "book", "first");
  const second = await privateVocabulary(owner.id, "book", "second");
  const foreign = await privateVocabulary(other.id, "book", "foreign");
  const canonical = await prisma.vOCABULARY.create({ data: { word: `canonical-${randomUUID()}` } });
  const firstResponse = await request(first.id, cookie);
  const secondResponse = await request(second.id, cookie);
  assert.equal(firstResponse.status, 200); assert.equal(secondResponse.status, 200);
  assert.equal(firstResponse.json.data.id, first.id); assert.equal(secondResponse.json.data.id, second.id);
  assert.equal(firstResponse.json.data.meanings[0].meaning_vi, "first");
  for (const id of [foreign.id, canonical.id, randomUUID()]) {
    const response = await request(id, cookie);
    assert.equal(response.status, 404); assert.equal(response.json.error.code, "VOCABULARY_NOT_FOUND");
  }
  assert.equal((await request(first.id)).status, 401);
  assert.equal((await request(first.id, await session(await user("ADMIN")))).status, 403);
  assert.equal("owner_id" in firstResponse.json.data, false);
  assert.equal("pronunciation_url" in firstResponse.json.data, false);
});

test("owner PATCH atomically updates exact private aggregate with multiple Meanings and Examples", async () => {
  const owner = await user(); const cookie = await session(owner);
  const vocabulary = await privateVocabulary(owner.id, "before", "old");
  const oldMeaning = vocabulary.meanings[0]; const oldExample = oldMeaning.examples[0];
  const response = await request(vocabulary.id, cookie, {
    method: "PATCH",
    json: { word: "after", phonetic: "/after/", meanings: [
      { id: oldMeaning.id, part_of_speech: "verb", meaning_vi: "updated", context: "ctx", cefr_level: "B2", examples: [{ id: oldExample.id, example_en: "Updated example." }, { example_en: "Added." }] },
      { part_of_speech: "noun", meaning_vi: "second", context: null, cefr_level: "A2", examples: [] },
    ] },
  });
  assert.equal(response.status, 200, response.text); assert.equal(response.json.data.id, vocabulary.id);
  assert.equal(response.json.data.word, "after"); assert.equal(response.json.data.meanings.length, 2);
  assert.deepEqual(response.json.data.meanings.map((x) => x.part_of_speech), ["verb", "noun"]);
  assert.equal(response.json.data.meanings[0].examples.length, 2);
});

test("private PATCH allows canonical and same-owner word collisions without merge or Progress changes", async () => {
  const owner = await user(); const cookie = await session(owner);
  const canonical = await prisma.vOCABULARY.create({ data: { word: "book" } });
  const first = await privateVocabulary(owner.id, "book", "one");
  const second = await privateVocabulary(owner.id, "reserve", "two");
  const progress = await prisma.lEARNING_PROGRESS.create({ data: { user_id: owner.id, vocabulary_id: second.id, status: "LEARNING" } });
  const response = await request(second.id, cookie, { method: "PATCH", json: { word: "book" } });
  assert.equal(response.status, 200); assert.equal(response.json.data.id, second.id);
  assert.equal(await prisma.vOCABULARY.count({ where: { word: { equals: "book", mode: "insensitive" } } }), 3);
  assert.equal((await prisma.vOCABULARY.findUniqueOrThrow({ where: { id: first.id } })).id, first.id);
  assert.equal((await prisma.vOCABULARY.findUniqueOrThrow({ where: { id: canonical.id } })).id, canonical.id);
  assert.deepEqual(await prisma.lEARNING_PROGRESS.findUniqueOrThrow({ where: { id: progress.id } }), progress);
});

test("private PATCH rejects forbidden, cross-owner, canonical, and invalid aggregate updates atomically", async () => {
  const owner = await user(); const other = await user(); const cookie = await session(owner);
  const own = await privateVocabulary(owner.id, "unchanged", "original");
  const foreign = await privateVocabulary(other.id, "foreign", "foreign");
  const canonical = await prisma.vOCABULARY.create({ data: { word: `canonical-${randomUUID()}` } });
  const before = await prisma.vOCABULARY.findUniqueOrThrow({ where: { id: own.id }, include: { meanings: { include: { examples: true } } } });
  for (const field of ["id", "owner_id", "owner", "pronunciation_url", "created_at", "updated_at", "source", "type", "visibility", "operation_id"]) {
    const response = await request(own.id, cookie, { method: "PATCH", json: { [field]: "forbidden" } });
    assert.equal(response.status, 400, field);
  }
  for (const id of [foreign.id, canonical.id]) {
    const response = await request(id, cookie, { method: "PATCH", json: { word: "blocked" } });
    assert.equal(response.status, 404); assert.equal(response.json.error.code, "VOCABULARY_NOT_FOUND");
  }
  const invalid = await request(own.id, cookie, { method: "PATCH", json: { word: "partial", meanings: [] } });
  assert.equal(invalid.status, 400);
  const foreignChild = await request(own.id, cookie, { method: "PATCH", json: {
    word: "partial-child",
    meanings: [{ id: randomUUID(), part_of_speech: "noun", meaning_vi: "invalid", examples: [] }],
  } });
  assert.equal(foreignChild.status, 400);
  assert.deepEqual(await prisma.vOCABULARY.findUniqueOrThrow({ where: { id: own.id }, include: { meanings: { include: { examples: true } } } }), before);
  assert.equal((await prisma.vOCABULARY.findUniqueOrThrow({ where: { id: foreign.id } })).word, "foreign");
});

function user(role = "USER") { return createUserFixture(prisma, { role, password_hash: "test-hash" }); }
async function session(account) { const value = await createSessionFixture(prisma, account.id); return `session_id=${value.rawToken}`; }
function request(id, cookie, options = {}) { return http.request(`/api/my/vocabulary/${id}`, { ...options, cookie }); }
function privateVocabulary(ownerId, word, meaning) {
  return prisma.vOCABULARY.create({ data: { owner_id: ownerId, word, meanings: { create: { part_of_speech: "noun", meaning_vi: meaning, context: "context", cefr_level: "A1", examples: { create: { example_en: `${meaning} example.` } } } } }, include: { meanings: { include: { examples: true } } } });
}
