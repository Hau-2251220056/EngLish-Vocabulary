import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { createApp } from "../../src/create-app.js";
import { createSessionFixture, createUserFixture } from "../helpers/auth-fixtures.js";
import { createTestDatabase } from "../helpers/test-database.js";
import { startHttpTestServer } from "../helpers/http-test-server.js";

let database;
let prisma;
let http;
let topic;
let owner;
let otherUser;
let ownerCookie;
let otherUserCookie;
let adminCookie;

before(async () => {
  database = await createTestDatabase();
  prisma = database.prisma;
  http = await startHttpTestServer(createApp({ prisma }));
});

beforeEach(async () => {
  await database.reset();
  owner = await createUserFixture(prisma, { role: "USER" });
  otherUser = await createUserFixture(prisma, { role: "USER" });
  const admin = await createUserFixture(prisma, { role: "ADMIN" });
  ownerCookie = await cookieFor(owner.id);
  otherUserCookie = await cookieFor(otherUser.id);
  adminCookie = await cookieFor(admin.id);
  topic = await prisma.tOPIC.create({ data: { name: `PV06-${randomUUID()}` } });
});

afterEach(async () => { await database.reset(); });
after(async () => {
  try { if (database) await database.reset(); }
  finally {
    try { if (http) await http.close(); }
    finally { if (database) await database.disconnect(); }
  }
});

test("PV-06 creates a complete private aggregate and appends it atomically", async () => {
  const set = await createPrivateSet(owner.id);
  const operationId = randomUUID();
  const response = await createAndAdd(set.id, operationId, {
    word: "  book  ",
    phonetic: "/bÊŠk/",
    meanings: [
      {
        part_of_speech: " noun ",
        meaning_vi: " sÃ¡ch ",
        context: "reading",
        cefr_level: "A1",
        examples: [{ example_en: "This is a book.", example_vi: "ÄÃ¢y lÃ  má»™t quyá»ƒn sÃ¡ch." }],
      },
      { part_of_speech: "verb", meaning_vi: "Ä‘áº·t chá»—" },
    ],
  });

  assert.equal(response.status, 201, response.text);
  const { vocabulary, membership } = response.json.data;
  assert.equal(vocabulary.word, "book");
  assert.equal(vocabulary.meanings.length, 2);
  assert.equal(
    vocabulary.meanings.find(({ part_of_speech }) => part_of_speech === "noun").examples.length,
    1,
  );
  assert.equal(membership.vocabulary_id, vocabulary.id);
  assert.equal(membership.position, 1);
  const stored = await prisma.vOCABULARY.findUniqueOrThrow({ where: { id: vocabulary.id } });
  assert.equal(stored.owner_id, owner.id);
  assert.equal(stored.pronunciation_url, null);
  assert.equal(await prisma.pRIVATE_VOCABULARY_CREATE_OPERATION.count({ where: { operation_id: operationId } }), 1);

  const detail = await http.request(`/api/my/vocabulary/${vocabulary.id}`, { cookie: ownerCookie });
  assert.equal(detail.status, 200);
  const picker = await http.request("/api/vocabulary-set-picker?query=book", { cookie: ownerCookie });
  assert.equal(picker.json.data.some(({ id }) => id === vocabulary.id), true);
  const updated = await http.request(`/api/my/vocabulary/${vocabulary.id}`, {
    method: "PATCH", cookie: ownerCookie, json: { word: "book-updated" },
  });
  assert.equal(updated.status, 200, updated.text);
  assert.equal(updated.json.data.id, vocabulary.id);
  assert.equal(updated.json.data.word, "book-updated");
});

test("PV-06 validates private create fields and authorization without partial writes", async () => {
  const owned = await createPrivateSet(owner.id);
  const foreign = await createPrivateSet(otherUser.id);
  const system = await prisma.vOCABULARY_SET.create({ data: {
    topic_id: topic.id, owner_id: owner.id, name: "System", is_public: true,
  } });
  const before = await stateCounts();
  const attempts = [
    [undefined, owned.id, validRequest(randomUUID()), 401],
    [adminCookie, owned.id, validRequest(randomUUID()), 403],
    [ownerCookie, foreign.id, validRequest(randomUUID()), 404],
    [ownerCookie, system.id, validRequest(randomUUID()), 404],
    [ownerCookie, randomUUID(), validRequest(randomUUID()), 404],
    [ownerCookie, owned.id, { operation_id: randomUUID(), vocabulary: { word: "empty", meanings: [] } }, 400],
    [ownerCookie, owned.id, { operation_id: randomUUID(), vocabulary: { word: "bad", meanings: [{ part_of_speech: "noun" }] } }, 400],
    [ownerCookie, owned.id, { operation_id: randomUUID(), vocabulary: { word: "bad", meanings: [{ part_of_speech: "noun", meaning_vi: "x" }], pronunciation_url: "https://forbidden" } }, 400],
    [ownerCookie, owned.id, { operation_id: randomUUID(), vocabulary: { word: "bad", meanings: [{ part_of_speech: "noun", meaning_vi: "x" }], owner_id: owner.id } }, 400],
    [ownerCookie, owned.id, { operation_id: randomUUID(), vocabulary: { word: "bad", meanings: [{ id: randomUUID(), part_of_speech: "noun", meaning_vi: "x" }] } }, 400],
    [ownerCookie, owned.id, { ...validRequest(randomUUID()), request_fingerprint: "client" }, 400],
  ];
  for (const [cookie, setId, json, expected] of attempts) {
    const response = await http.request(`/api/my/vocabulary-sets/${setId}/vocabulary`, {
      method: "POST", cookie, json,
    });
    assert.equal(response.status, expected, response.text);
  }
  assert.deepEqual(await stateCounts(), before);
});

test("PV-06 retries converge, conflicts are stable, and new operations create same-headword identities", async () => {
  const setOne = await createPrivateSet(owner.id);
  const setTwo = await createPrivateSet(owner.id);
  await prisma.vOCABULARY.create({ data: { word: "book" } });
  await prisma.vOCABULARY.create({ data: { owner_id: owner.id, word: "book" } });
  const operationId = randomUUID();
  const firstPayload = validRequest(operationId, "book");
  const first = await postCreate(setOne.id, ownerCookie, firstPayload);
  assert.equal(first.status, 201, first.text);

  const reorderedEquivalent = {
    vocabulary: {
      meanings: [{ meaning_vi: "nghÄ©a", part_of_speech: "noun" }],
      word: "book",
    },
    operation_id: operationId,
  };
  const retry = await postCreate(setOne.id, ownerCookie, reorderedEquivalent);
  assert.equal(retry.status, 200, retry.text);
  assert.equal(retry.json.data.vocabulary.id, first.json.data.vocabulary.id);
  assert.equal((await aggregateCounts(owner.id)).vocabulary, 2);

  const changedPayload = await postCreate(setOne.id, ownerCookie, validRequest(operationId, "changed"));
  assert.equal(changedPayload.status, 409);
  assert.equal(changedPayload.json.error.code, "PRIVATE_VOCABULARY_OPERATION_CONFLICT");
  const changedSet = await postCreate(setTwo.id, ownerCookie, firstPayload);
  assert.equal(changedSet.status, 409);

  const newOperation = await postCreate(setOne.id, ownerCookie, validRequest(randomUUID(), "book"));
  assert.equal(newOperation.status, 201, newOperation.text);
  assert.notEqual(newOperation.json.data.vocabulary.id, first.json.data.vocabulary.id);
  const otherUserSet = await createPrivateSet(otherUser.id);
  const otherCreation = await postCreate(otherUserSet.id, otherUserCookie, validRequest(randomUUID(), "book"));
  assert.equal(otherCreation.status, 201, otherCreation.text);
  assert.notEqual(otherCreation.json.data.vocabulary.id, first.json.data.vocabulary.id);
});

test("PV-06 concurrent same operation converges on one complete persisted result", async () => {
  const set = await createPrivateSet(owner.id);
  const operationId = randomUUID();
  const [one, two] = await Promise.all([
    postCreate(set.id, ownerCookie, validRequest(operationId, "concurrent-same")),
    postCreate(set.id, ownerCookie, validRequest(operationId, "concurrent-same")),
  ]);
  assert.deepEqual([one.status, two.status].sort(), [200, 201]);
  assert.equal(one.json.data.vocabulary.id, two.json.data.vocabulary.id);
  const id = one.json.data.vocabulary.id;
  assert.equal(await prisma.vOCABULARY.count({ where: { id } }), 1);
  assert.equal(await prisma.vOCABULARY_MEANING.count({ where: { vocabulary_id: id } }), 1);
  assert.equal(await prisma.vOCABULARY_SET_ITEM.count({ where: { vocabulary_set_id: set.id, vocabulary_id: id } }), 1);
  assert.equal(await prisma.pRIVATE_VOCABULARY_CREATE_OPERATION.count({ where: { operation_id: operationId } }), 1);
});

test("PV-06 concurrent distinct operations serialize append positions without lost membership", async () => {
  const seed = await prisma.vOCABULARY.create({ data: { word: `seed-${randomUUID()}` } });
  const set = await createPrivateSet(owner.id, [seed.id]);
  const [one, two] = await Promise.all([
    postCreate(set.id, ownerCookie, validRequest(randomUUID(), "concurrent-one")),
    postCreate(set.id, ownerCookie, validRequest(randomUUID(), "concurrent-two")),
  ]);
  assert.equal(one.status, 201, one.text);
  assert.equal(two.status, 201, two.text);
  assert.notEqual(one.json.data.vocabulary.id, two.json.data.vocabulary.id);
  const items = await prisma.vOCABULARY_SET_ITEM.findMany({
    where: { vocabulary_set_id: set.id }, orderBy: { position: "asc" },
  });
  assert.deepEqual(items.map(({ position }) => position), [1, 2, 3]);
  assert.deepEqual(
    new Set(items.map(({ vocabulary_id }) => vocabulary_id)),
    new Set([seed.id, one.json.data.vocabulary.id, two.json.data.vocabulary.id]),
  );
});

test("PV-06 operation collision on different Sets rolls back the losing aggregate and membership", async () => {
  const setOne = await createPrivateSet(owner.id);
  const setTwo = await createPrivateSet(owner.id);
  const operationId = randomUUID();
  const before = await stateCounts();
  const [one, two] = await Promise.all([
    postCreate(setOne.id, ownerCookie, validRequest(operationId, "atomic-one")),
    postCreate(setTwo.id, ownerCookie, validRequest(operationId, "atomic-two")),
  ]);
  assert.deepEqual([one.status, two.status].sort(), [201, 409]);
  const after = await stateCounts();
  assert.equal(after.vocabulary, before.vocabulary + 1);
  assert.equal(after.meaning, before.meaning + 1);
  assert.equal(after.example, before.example);
  assert.equal(after.item, before.item + 1);
  assert.equal(after.operation, before.operation + 1);
});

async function cookieFor(userId) {
  const session = await createSessionFixture(prisma, userId);
  return `session_id=${session.rawToken}`;
}

async function createPrivateSet(ownerId, vocabularyIds = []) {
  return prisma.vOCABULARY_SET.create({ data: {
    topic_id: null,
    owner_id: ownerId,
    name: `Private-${randomUUID()}`,
    is_public: false,
    items: { create: vocabularyIds.map((vocabulary_id, index) => ({ vocabulary_id, position: index + 1 })) },
  } });
}

function validRequest(operationId, word = `private-${randomUUID()}`) {
  return {
    operation_id: operationId,
    vocabulary: { word, meanings: [{ part_of_speech: "noun", meaning_vi: "nghÄ©a" }] },
  };
}

function postCreate(setId, cookie, json) {
  return http.request(`/api/my/vocabulary-sets/${setId}/vocabulary`, {
    method: "POST", cookie, json,
  });
}

function createAndAdd(setId, operationId, vocabulary) {
  return postCreate(setId, ownerCookie, { operation_id: operationId, vocabulary });
}

async function stateCounts() {
  const [vocabulary, meaning, example, item, operation] = await Promise.all([
    prisma.vOCABULARY.count(),
    prisma.vOCABULARY_MEANING.count(),
    prisma.vOCABULARY_EXAMPLE.count(),
    prisma.vOCABULARY_SET_ITEM.count(),
    prisma.pRIVATE_VOCABULARY_CREATE_OPERATION.count(),
  ]);
  return { vocabulary, meaning, example, item, operation };
}

async function aggregateCounts(ownerId) {
  return { vocabulary: await prisma.vOCABULARY.count({ where: { owner_id: ownerId } }) };
}
