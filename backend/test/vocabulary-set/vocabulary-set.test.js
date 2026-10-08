import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { createApp } from "../../src/create-app.js";
import { createSessionFixture, createUserFixture } from "../helpers/auth-fixtures.js";
import { createTestDatabase } from "../helpers/test-database.js";
import { startHttpTestServer } from "../helpers/http-test-server.js";
import { createFakeVocabularySetCoverStorage } from "../helpers/fake-vocabulary-set-cover-storage.js";
import { createVocabularySetCoverImageProcessor } from "../../src/images/vocabulary-set-cover-image-processor.js";
import sharp from "sharp";

let database;
let prisma;
let http;
let topic;
let firstVocabulary;
let secondVocabulary;
let thirdVocabulary;
let adminCookie;
let ownerCookie;
let otherUserCookie;
let owner;
let otherUser;
let coverStorage;
const runId = randomUUID();
const fixturePrefix = `VS-${runId}`;
const fixtureDomain = `${runId}.vocabulary-set.backend.test`;

before(async () => {
  database = await createTestDatabase();
  prisma = database.prisma;
  coverStorage = createFakeVocabularySetCoverStorage({ namespace: "api-test" });
  http = await startHttpTestServer(createApp({
    prisma,
    coverStorage,
    coverImageProcessor: createVocabularySetCoverImageProcessor(),
  }));
});

beforeEach(async () => {
  await cleanupRunOwnedFixtures();
  coverStorage.objects.clear();
  coverStorage.calls.length = 0;
  const admin = await createUserFixture(prisma, {
    email: `admin@${fixtureDomain}`,
    role: "ADMIN",
  });
  owner = await createUserFixture(prisma, {
    email: `owner@${fixtureDomain}`,
    role: "USER",
  });
  otherUser = await createUserFixture(prisma, {
    email: `other@${fixtureDomain}`,
    role: "USER",
  });
  const adminSession = await createSessionFixture(prisma, admin.id);
  const ownerSession = await createSessionFixture(prisma, owner.id);
  const otherSession = await createSessionFixture(prisma, otherUser.id);
  adminCookie = `session_id=${adminSession.rawToken}`;
  ownerCookie = `session_id=${ownerSession.rawToken}`;
  otherUserCookie = `session_id=${otherSession.rawToken}`;
  topic = await prisma.tOPIC.create({ data: { name: `${fixturePrefix} Set test topic` } });
  firstVocabulary = await createVocabulary("set-first");
  secondVocabulary = await createVocabulary("set-second");
  thirdVocabulary = await createVocabulary("set-third");
});

afterEach(async () => { await cleanupRunOwnedFixtures(); });
after(async () => {
  try { if (database) await cleanupRunOwnedFixtures(); }
  finally {
    try { if (http) await http.close(); }
    finally { if (database) await database.disconnect(); }
  }
});

test("database materializes approved Set constraints and owned/external delete behavior", async () => {
  const system = await createSystemSet({ items: [firstVocabulary.id] });
  const copied = await copySystemSet(system.id);
  assert.equal(copied.topic_id, null);
  const storedCopy = await prisma.vOCABULARY_SET.findUniqueOrThrow({ where: { id: copied.id } });
  assert.equal(storedCopy.topic_id, null);
  await assert.rejects(
    () => prisma.vOCABULARY_SET.create({ data: {
      topic_id: null, owner_id: owner.id, name: "Invalid public Set", is_public: true,
    } }),
    /public_topic_required|constraint/i,
  );
  await assert.rejects(
    () => prisma.tOPIC.delete({ where: { id: topic.id } }),
    { code: "P2003" },
  );
  await assert.rejects(
    () => prisma.vOCABULARY.delete({ where: { id: firstVocabulary.id } }),
    { code: "P2003" },
  );
  await assert.rejects(
    () => prisma.vOCABULARY_SET_ITEM.create({ data: {
      vocabulary_set_id: copied.id, vocabulary_id: secondVocabulary.id, position: 0,
    } }),
    /position|constraint/i,
  );
  await assert.rejects(
    () => prisma.vOCABULARY_SET_ITEM.create({ data: {
      vocabulary_set_id: copied.id, vocabulary_id: firstVocabulary.id, position: 2,
    } }),
    { code: "P2002" },
  );
  await prisma.vOCABULARY_SET.delete({ where: { id: copied.id } });
  assert.equal(await prisma.vOCABULARY_SET_ITEM.count({ where: { vocabulary_set_id: copied.id } }), 0);
});

test("Guest discovers only public System summaries and full ordered detail", async () => {
  const system = await createSystemSet({ items: [secondVocabulary.id, firstVocabulary.id] });
  await createPrivateSet();
  let response = await http.request(`/api/topics/${topic.id}/vocabulary-sets`);
  assert.equal(response.status, 200);
  assert.equal(response.json.data.length, 1);
  assert.equal(response.json.data[0].id, system.id);
  assert.equal(response.json.data[0].cefr_level, "B1");
  assert.equal(response.json.data[0].cover_image_url, null);
  assert.equal(Object.hasOwn(response.json.data[0], "cover_storage_key"), false);
  response = await http.request(`/api/vocabulary-sets/${system.id}`);
  assert.equal(response.status, 200);
  assert.deepEqual(response.json.data.items.map(({ vocabulary_id, position }) => [vocabulary_id, position]), [
    [secondVocabulary.id, 1], [firstVocabulary.id, 2],
  ]);
  assert.deepEqual(Object.keys(response.json.data.items[0]).sort(), ["created_at", "id", "phonetic", "position", "vocabulary_id", "word"]);
});

test("ADMIN manages complete non-empty System aggregates and USER cannot mutate them", async () => {
  assert.equal((await http.request("/api/admin/vocabulary-sets", {
    method: "POST", cookie: adminCookie,
    json: { name: "Missing topic", items: [{ vocabulary_id: firstVocabulary.id }] },
  })).status, 400);
  let response = await http.request("/api/admin/vocabulary-sets", {
    method: "POST", cookie: adminCookie,
    json: { topic_id: topic.id, name: "  System Set  ", description: "description", cefr_level: "B1", items: [{ vocabulary_id: firstVocabulary.id }, { vocabulary_id: secondVocabulary.id }] },
  });
  assert.equal(response.status, 201);
  const systemId = response.json.data.id;
  assert.equal(response.json.data.name, "System Set");
  const replacementTopic = await prisma.tOPIC.create({ data: { name: `${fixturePrefix} Replacement` } });
  response = await http.request(`/api/admin/vocabulary-sets/${systemId}`, {
    method: "PATCH", cookie: adminCookie, json: { topic_id: replacementTopic.id },
  });
  assert.equal(response.status, 200);
  assert.equal(response.json.data.topic_id, replacementTopic.id);
  assert.equal((await http.request(`/api/admin/vocabulary-sets/${systemId}`, {
    method: "PATCH", cookie: adminCookie, json: { topic_id: null },
  })).status, 400);
  response = await http.request(`/api/admin/vocabulary-sets/${systemId}`, {
    method: "PATCH", cookie: adminCookie,
    json: { description: null, items: [{ vocabulary_id: secondVocabulary.id }, { vocabulary_id: thirdVocabulary.id }] },
  });
  assert.equal(response.status, 200);
  assert.equal(response.json.data.description, null);
  assert.deepEqual(response.json.data.items.map(({ vocabulary_id, position }) => [vocabulary_id, position]), [[secondVocabulary.id, 1], [thirdVocabulary.id, 2]]);
  assert.equal((await http.request(`/api/admin/vocabulary-sets/${systemId}`, { method: "PATCH", cookie: ownerCookie, json: { name: "forged" } })).status, 403);
  assert.equal((await http.request(`/api/admin/vocabulary-sets/${systemId}`, { method: "DELETE", cookie: adminCookie })).status, 204);
});

test("Set metadata validates CEFR and external HTTPS covers without exposing storage keys", async () => {
  for (const cefr_level of ["A1", "A2", "B1", "B2", "C1"]) {
    const response = await http.request("/api/admin/vocabulary-sets", {
      method: "POST",
      cookie: adminCookie,
      json: {
        topic_id: topic.id,
        name: `${fixturePrefix} CEFR ${cefr_level}`,
        cefr_level,
        cover_image_url: `https://images.example.test/${cefr_level.toLowerCase()}.jpg`,
        items: [{ vocabulary_id: firstVocabulary.id }],
      },
    });
    assert.equal(response.status, 201, response.text);
    assert.equal(response.json.data.cefr_level, cefr_level);
    assert.equal(response.json.data.cover_image_url, `https://images.example.test/${cefr_level.toLowerCase()}.jpg`);
    assert.equal(Object.hasOwn(response.json.data, "cover_storage_key"), false);
  }

  for (const json of [
    { topic_id: topic.id, name: "Missing CEFR", items: [{ vocabulary_id: firstVocabulary.id }] },
    { topic_id: topic.id, name: "Null CEFR", cefr_level: null, items: [{ vocabulary_id: firstVocabulary.id }] },
    { topic_id: topic.id, name: "C2", cefr_level: "C2", items: [{ vocabulary_id: firstVocabulary.id }] },
    { topic_id: topic.id, name: "Arbitrary", cefr_level: "BEGINNER", items: [{ vocabulary_id: firstVocabulary.id }] },
    { topic_id: topic.id, name: "Key injection", cefr_level: "A1", cover_storage_key: "test/vocabulary-sets/foreign/key.webp", items: [{ vocabulary_id: firstVocabulary.id }] },
  ]) {
    assert.equal((await http.request("/api/admin/vocabulary-sets", {
      method: "POST", cookie: adminCookie, json,
    })).status, 400);
  }

  for (const cover_image_url of [
    "http://images.example.test/cover.jpg",
    "data:image/png;base64,AAAA",
    "javascript:alert(1)",
    "file:///cover.jpg",
    "/relative/cover.jpg",
    "not a URL",
    "https://user:password@images.example.test/cover.jpg",
    `https://images.example.test/${"a".repeat(2048)}`,
  ]) {
    assert.equal((await http.request("/api/my/vocabulary-sets", {
      method: "POST", cookie: ownerCookie,
      json: { name: `${fixturePrefix} Invalid cover`, cover_image_url },
    })).status, 400);
  }

  const adminList = await http.request("/api/admin/vocabulary-sets", { cookie: adminCookie });
  assert.equal(adminList.status, 200);
  assert.equal(adminList.json.data.some(({ cefr_level }) => cefr_level === "C1"), true);
  assert.equal(adminList.json.data.every((set) => Object.hasOwn(set, "cover_storage_key") === false), true);
});

test("Personal metadata is nullable, clearable, patch-safe, and copied from external System metadata", async () => {
  let response = await http.request("/api/my/vocabulary-sets", {
    method: "POST", cookie: ownerCookie,
    json: {
      name: `${fixturePrefix} Personal metadata`,
      cefr_level: "C1",
      cover_image_url: "https://images.example.test/personal.webp",
    },
  });
  assert.equal(response.status, 201, response.text);
  const personalId = response.json.data.id;
  assert.equal(response.json.data.cefr_level, "C1");
  assert.equal(response.json.data.cover_image_url, "https://images.example.test/personal.webp");
  assert.equal(Object.hasOwn(response.json.data, "cover_storage_key"), false);
  const privateList = await http.request("/api/my/vocabulary-sets", { cookie: ownerCookie });
  const privateSummary = privateList.json.data.find(({ id }) => id === personalId);
  assert.equal(privateSummary.cefr_level, "C1");
  assert.equal(privateSummary.cover_image_url, "https://images.example.test/personal.webp");
  assert.equal(Object.hasOwn(privateSummary, "cover_storage_key"), false);

  response = await http.request(`/api/my/vocabulary-sets/${personalId}`, {
    method: "PATCH", cookie: ownerCookie, json: { name: `${fixturePrefix} Metadata renamed` },
  });
  assert.equal(response.status, 200);
  assert.equal(response.json.data.cefr_level, "C1");
  assert.equal(response.json.data.cover_image_url, "https://images.example.test/personal.webp");

  response = await http.request(`/api/my/vocabulary-sets/${personalId}`, {
    method: "PATCH", cookie: ownerCookie, json: { cefr_level: null, cover_image_url: null },
  });
  assert.equal(response.status, 200);
  assert.equal(response.json.data.cefr_level, null);
  assert.equal(response.json.data.cover_image_url, null);
  assert.equal((await prisma.vOCABULARY_SET.findUniqueOrThrow({ where: { id: personalId } })).cover_storage_key, null);
  assert.equal((await http.request(`/api/my/vocabulary-sets/${personalId}`, {
    method: "PATCH", cookie: ownerCookie, json: { cefr_level: "C2" },
  })).status, 400);
  assert.equal((await http.request(`/api/my/vocabulary-sets/${personalId}`, {
    method: "PATCH", cookie: ownerCookie, json: { cover_storage_key: "forbidden" },
  })).status, 400);

  const system = await createSystemSet({
    items: [firstVocabulary.id],
    cefrLevel: "A2",
    coverImageUrl: "https://images.example.test/system.png",
  });
  const copy = await copySystemSet(system.id);
  assert.equal(copy.cefr_level, "A2");
  assert.equal(copy.cover_image_url, "https://images.example.test/system.png");
  assert.equal(Object.hasOwn(copy, "cover_storage_key"), false);
  const persistedCopy = await prisma.vOCABULARY_SET.findUniqueOrThrow({ where: { id: copy.id } });
  assert.equal(persistedCopy.cover_storage_key, null);
});

test("legacy null metadata reads safely and a System edit requires CEFR", async () => {
  const legacySystem = await prisma.vOCABULARY_SET.create({
    data: {
      topic_id: topic.id,
      owner_id: owner.id,
      name: `${fixturePrefix} Legacy System`,
      is_public: true,
      items: { create: { vocabulary_id: firstVocabulary.id, position: 1 } },
    },
  });
  let response = await http.request(`/api/vocabulary-sets/${legacySystem.id}`);
  assert.equal(response.status, 200);
  assert.equal(response.json.data.cefr_level, null);
  assert.equal(response.json.data.cover_image_url, null);
  assert.equal(Object.hasOwn(response.json.data, "cover_storage_key"), false);

  response = await http.request(`/api/admin/vocabulary-sets/${legacySystem.id}`, {
    method: "PATCH", cookie: adminCookie, json: { description: "Still missing CEFR" },
  });
  assert.equal(response.status, 400);
  response = await http.request(`/api/admin/vocabulary-sets/${legacySystem.id}`, {
    method: "PATCH", cookie: adminCookie,
    json: { description: "Now valid", cefr_level: "A1" },
  });
  assert.equal(response.status, 200);
  assert.equal(response.json.data.cefr_level, "A1");
});

test("cover API authenticates before multipart and enforces System/Personal ownership", async () => {
  const system = await createSystemSet({ items: [firstVocabulary.id] });
  const personal = await createPrivateSet();
  const png = await sharp({ create: { width: 32, height: 16, channels: 3, background: "#2563eb" } }).png().toBuffer();

  let response = await http.request(`/api/admin/vocabulary-sets/${system.id}/cover`, {
    method: "POST",
    rawBody: Buffer.from("not-even-multipart"),
    headers: { "content-type": "multipart/form-data; boundary=missing" },
  });
  assert.equal(response.status, 401);
  assert.equal(coverStorage.calls.length, 0);
  response = await http.request(`/api/admin/vocabulary-sets/${system.id}/cover`, {
    method: "POST", cookie: ownerCookie,
    rawBody: Buffer.from("not-even-multipart"),
    headers: { "content-type": "multipart/form-data; boundary=missing" },
  });
  assert.equal(response.status, 403);
  assert.equal(coverStorage.calls.length, 0);

  response = await uploadCover(`/api/admin/vocabulary-sets/${system.id}/cover`, adminCookie, png, "image/png");
  assert.equal(response.status, 200, response.text);
  assert.equal(response.json.meta.storage_cleanup, "complete");
  assert.equal(response.json.data.cover_image_url.startsWith("https://storage.example.test/"), true);
  assert.equal(Object.hasOwn(response.json.data, "cover_storage_key"), false);
  assert.equal((await prisma.vOCABULARY_SET.findUniqueOrThrow({ where: { id: system.id } })).cover_storage_key !== null, true);

  response = await uploadCover(`/api/my/vocabulary-sets/${personal.id}/cover`, otherUserCookie, png, "image/png");
  assert.equal(response.status, 404);
  response = await uploadCover(`/api/my/vocabulary-sets/${personal.id}/cover`, ownerCookie, png, "image/png");
  assert.equal(response.status, 200, response.text);

  const invalid = new FormData();
  invalid.append("cover", new Blob([Buffer.from("<svg></svg>")], { type: "image/svg+xml" }), "cover.svg");
  response = await http.request(`/api/my/vocabulary-sets/${personal.id}/cover`, {
    method: "POST", cookie: ownerCookie, rawBody: invalid,
  });
  assert.equal(response.status, 415);

  const mismatch = await uploadCover(`/api/my/vocabulary-sets/${personal.id}/cover`, ownerCookie, png, "image/jpeg");
  assert.equal(mismatch.status, 415);
  const beforeRejected = await prisma.vOCABULARY_SET.findUniqueOrThrow({ where: { id: personal.id } });

  const unexpected = new FormData();
  unexpected.append("cover", new Blob([png], { type: "image/png" }), "cover.png");
  unexpected.append("caption", "forbidden");
  response = await http.request(`/api/my/vocabulary-sets/${personal.id}/cover`, {
    method: "POST", cookie: ownerCookie, rawBody: unexpected,
  });
  assert.equal(response.status, 400);
  const multiple = new FormData();
  multiple.append("cover", new Blob([png], { type: "image/png" }), "one.png");
  multiple.append("cover", new Blob([png], { type: "image/png" }), "two.png");
  response = await http.request(`/api/my/vocabulary-sets/${personal.id}/cover`, {
    method: "POST", cookie: ownerCookie, rawBody: multiple,
  });
  assert.equal(response.status, 400);
  const oversized = Buffer.alloc((5 * 1024 * 1024) + 1, 0x41);
  response = await uploadCover(`/api/my/vocabulary-sets/${personal.id}/cover`, ownerCookie, oversized, "image/png");
  assert.equal(response.status, 413);
  assert.deepEqual(await prisma.vOCABULARY_SET.findUniqueOrThrow({ where: { id: personal.id } }), beforeRejected);

  coverStorage.failNext("upload");
  response = await uploadCover(`/api/my/vocabulary-sets/${personal.id}/cover`, ownerCookie, png, "image/png");
  assert.equal(response.status, 502);
  assert.deepEqual(await prisma.vOCABULARY_SET.findUniqueOrThrow({ where: { id: personal.id } }), beforeRejected);

  response = await http.request(`/api/my/vocabulary-sets/${personal.id}/cover`, {
    method: "DELETE", cookie: ownerCookie,
  });
  assert.equal(response.status, 200);
  assert.equal(response.json.data.cover_image_url, null);
  assert.equal(response.json.meta.storage_cleanup, "complete");
  response = await http.request(`/api/my/vocabulary-sets/${personal.id}/cover/cleanup`, {
    method: "POST", cookie: ownerCookie,
  });
  assert.equal(response.status, 200);
  assert.equal(response.json.meta.storage_cleanup, "complete");
});

test("managed covers replace, copy independently, clean safely, and block Set deletion on cleanup failure", async () => {
  const system = await createSystemSet({ items: [firstVocabulary.id] });
  const png = await sharp({ create: { width: 40, height: 20, channels: 3, background: "#16a34a" } }).png().toBuffer();
  let response = await uploadCover(`/api/admin/vocabulary-sets/${system.id}/cover`, adminCookie, png, "image/png");
  assert.equal(response.status, 200, response.text);
  const first = await prisma.vOCABULARY_SET.findUniqueOrThrow({ where: { id: system.id } });

  coverStorage.failNext("remove", "COVER_STORAGE_CLEANUP_FAILED");
  response = await uploadCover(`/api/admin/vocabulary-sets/${system.id}/cover`, adminCookie, png, "image/png");
  assert.equal(response.status, 200, response.text);
  assert.equal(response.json.meta.storage_cleanup, "retry_required");
  const replacement = await prisma.vOCABULARY_SET.findUniqueOrThrow({ where: { id: system.id } });
  assert.notEqual(replacement.cover_storage_key, first.cover_storage_key);
  assert.equal(coverStorage.objects.has(first.cover_storage_key), true);

  response = await http.request(`/api/admin/vocabulary-sets/${system.id}/cover/cleanup`, { method: "POST", cookie: adminCookie });
  assert.equal(response.status, 200);
  assert.equal(coverStorage.objects.has(first.cover_storage_key), false);
  assert.equal(coverStorage.objects.has(replacement.cover_storage_key), true);

  const copy = await copySystemSet(system.id);
  const copied = await prisma.vOCABULARY_SET.findUniqueOrThrow({ where: { id: copy.id } });
  assert.notEqual(copied.cover_storage_key, replacement.cover_storage_key);
  assert.equal(coverStorage.objects.has(copied.cover_storage_key), true);

  response = await http.request(`/api/admin/vocabulary-sets/${system.id}`, {
    method: "PATCH", cookie: adminCookie, json: { cover_image_url: "https://images.example.test/external.webp" },
  });
  assert.equal(response.status, 200);
  assert.equal(response.json.data.cover_image_url, "https://images.example.test/external.webp");
  assert.equal(coverStorage.objects.has(replacement.cover_storage_key), false);
  assert.equal(coverStorage.objects.has(copied.cover_storage_key), true);

  coverStorage.failNext("remove", "COVER_STORAGE_CLEANUP_FAILED");
  response = await http.request(`/api/my/vocabulary-sets/${copy.id}`, { method: "DELETE", cookie: ownerCookie });
  assert.equal(response.status, 502);
  assert.notEqual(await prisma.vOCABULARY_SET.findUnique({ where: { id: copy.id } }), null);
  response = await http.request(`/api/my/vocabulary-sets/${copy.id}`, { method: "DELETE", cookie: ownerCookie });
  assert.equal(response.status, 204);
  assert.equal(await prisma.vOCABULARY_SET.findUnique({ where: { id: copy.id } }), null);
  assert.equal(coverStorage.objects.has(copied.cover_storage_key), false);
});

test("System aggregate validation and failed replacement leave existing ordered Items intact", async () => {
  const system = await createSystemSet({ items: [firstVocabulary.id, secondVocabulary.id] });
  const invalidBodies = [
    { topic_id: topic.id, name: "empty", cefr_level: "A1", items: [] },
    { topic_id: topic.id, name: "duplicate", cefr_level: "A1", items: [{ vocabulary_id: firstVocabulary.id }, { vocabulary_id: firstVocabulary.id }] },
    { topic_id: topic.id, name: "unknown", cefr_level: "A1", items: [{ vocabulary_id: randomUUID() }] },
  ];
  for (const json of invalidBodies) {
    const response = await http.request("/api/admin/vocabulary-sets", { method: "POST", cookie: adminCookie, json });
    assert.equal(response.status, json.name === "unknown" ? 404 : 400);
  }
  const response = await http.request(`/api/admin/vocabulary-sets/${system.id}`, {
    method: "PATCH", cookie: adminCookie, json: { items: [{ vocabulary_id: firstVocabulary.id }, { vocabulary_id: randomUUID() }] },
  });
  assert.equal(response.status, 404);
  const saved = await prisma.vOCABULARY_SET.findUnique({
    where: { id: system.id }, include: { items: { orderBy: { position: "asc" } } },
  });
  assert.deepEqual(saved.items.map(({ vocabulary_id, position }) => [vocabulary_id, position]), [[firstVocabulary.id, 1], [secondVocabulary.id, 2]]);
});

test("USER private CRUD enforces owner-only private visibility and complete ordered replacement", async () => {
  let response = await http.request("/api/my/vocabulary-sets", {
    method: "POST", cookie: ownerCookie,
    json: { name: "Private draft", items: [] },
  });
  assert.equal(response.status, 201);
  const privateId = response.json.data.id;
  assert.equal(response.json.data.is_public, false);
  assert.equal(response.json.data.topic_id, null);
  assert.equal((await http.request("/api/my/vocabulary-sets", {
    method: "POST", cookie: ownerCookie, json: { topic_id: topic.id, name: "Topic rejected" },
  })).status, 400);
  assert.equal((await http.request(`/api/my/vocabulary-sets/${privateId}`, {
    method: "PATCH", cookie: ownerCookie, json: { topic_id: topic.id },
  })).status, 400);
  response = await http.request(`/api/my/vocabulary-sets/${privateId}`, {
    method: "PATCH", cookie: ownerCookie,
    json: { items: [{ vocabulary_id: thirdVocabulary.id }, { vocabulary_id: firstVocabulary.id }] },
  });
  assert.equal(response.status, 200);
  assert.deepEqual(response.json.data.items.map(({ vocabulary_id, position }) => [vocabulary_id, position]), [[thirdVocabulary.id, 1], [firstVocabulary.id, 2]]);
  assert.equal((await http.request(`/api/my/vocabulary-sets/${privateId}`, { cookie: otherUserCookie })).status, 404);
  assert.equal((await http.request(`/api/my/vocabulary-sets/${privateId}`, { method: "PATCH", cookie: otherUserCookie, json: { name: "leak" } })).status, 404);
  assert.equal((await http.request(`/api/my/vocabulary-sets/${privateId}`, { method: "PATCH", cookie: ownerCookie, json: { is_public: true } })).status, 400);
  assert.equal((await http.request(`/api/my/vocabulary-sets/${privateId}`, { method: "DELETE", cookie: ownerCookie })).status, 204);
});

test("USER owner detail projects the first deterministic Meaning and Example without changing public detail", async () => {
  const vocabulary = await prisma.vOCABULARY.create({ data: { word: `${fixturePrefix}-projection-${randomUUID()}` } });
  const firstMeaning = await prisma.vOCABULARY_MEANING.create({ data: {
    vocabulary_id: vocabulary.id,
    part_of_speech: "noun",
    meaning_vi: "nghĩa đầu tiên",
    cefr_level: "C2",
    created_at: new Date("2024-01-01T00:00:00.000Z"),
  } });
  await prisma.vOCABULARY_EXAMPLE.createMany({ data: [
    { meaning_id: firstMeaning.id, example_en: "First example", example_vi: null, created_at: new Date("2024-01-01T00:00:00.000Z") },
    { meaning_id: firstMeaning.id, example_en: "Second example", example_vi: "Ví dụ thứ hai", created_at: new Date("2024-01-02T00:00:00.000Z") },
  ] });
  await prisma.vOCABULARY_MEANING.create({ data: {
    vocabulary_id: vocabulary.id,
    part_of_speech: "verb",
    meaning_vi: "nghĩa CEFR thấp hơn nhưng tạo sau",
    cefr_level: "A1",
    created_at: new Date("2024-01-02T00:00:00.000Z"),
  } });
  const personal = await createPrivateSet();
  let response = await http.request(`/api/my/vocabulary-sets/${personal.id}`, {
    method: "PATCH", cookie: ownerCookie, json: { items: [{ vocabulary_id: vocabulary.id }] },
  });
  assert.equal(response.status, 200, response.text);
  assert.deepEqual(response.json.data.items[0].primary_meaning, {
    part_of_speech: "noun",
    meaning_vi: "nghĩa đầu tiên",
    example: { example_en: "First example", example_vi: null },
  });

  const noMeaning = await prisma.vOCABULARY.create({ data: { word: `${fixturePrefix}-no-meaning-${randomUUID()}` } });
  response = await http.request(`/api/my/vocabulary-sets/${personal.id}`, {
    method: "PATCH", cookie: ownerCookie, json: { items: [{ vocabulary_id: noMeaning.id }] },
  });
  assert.equal(response.json.data.items[0].primary_meaning, null);

  const system = await createSystemSet({ items: [vocabulary.id] });
  response = await http.request(`/api/vocabulary-sets/${system.id}`);
  assert.equal(Object.hasOwn(response.json.data.items[0], "primary_meaning"), false);
});

test("USER metadata update preserves a legacy Personal Set Topic reference", async () => {
  const legacy = await prisma.vOCABULARY_SET.create({ data: {
    topic_id: topic.id, owner_id: owner.id, name: "Legacy Personal", is_public: false,
  } });
  const response = await http.request(`/api/my/vocabulary-sets/${legacy.id}`, {
    method: "PATCH", cookie: ownerCookie, json: { name: "Legacy renamed" },
  });
  assert.equal(response.status, 200, response.text);
  assert.equal(response.json.data.topic_id, topic.id);
  assert.equal((await prisma.vOCABULARY_SET.findUniqueOrThrow({ where: { id: legacy.id } })).topic_id, topic.id);
});

test("USER copy creates independent private Set and leaves System source unchanged", async () => {
  const system = await createSystemSet({ items: [thirdVocabulary.id, firstVocabulary.id] });
  const copy = await copySystemSet(system.id);
  assert.notEqual(copy.id, system.id);
  assert.equal(copy.is_public, false);
  assert.equal(copy.topic_id, null);
  assert.notDeepEqual(copy.items.map(({ id }) => id), system.items.map(({ id }) => id));
  assert.deepEqual(copy.items.map(({ vocabulary_id, position }) => [vocabulary_id, position]), [[thirdVocabulary.id, 1], [firstVocabulary.id, 2]]);
  await http.request(`/api/my/vocabulary-sets/${copy.id}`, { method: "PATCH", cookie: ownerCookie, json: { items: [] } });
  const source = await http.request(`/api/vocabulary-sets/${system.id}`);
  assert.equal(source.status, 200);
  assert.equal(source.json.data.items.length, 2);
});

test("owner-aware picker returns canonical and own-private metadata without foreign-private leakage", async () => {
  const word = `${fixturePrefix}-picker-shared-${randomUUID()}`;
  const canonical = await prisma.vOCABULARY.create({ data: { word, meanings: { create: { part_of_speech: "noun", meaning_vi: "system" } } } });
  const ownOne = await prisma.vOCABULARY.create({ data: { owner_id: owner.id, word, meanings: { create: { part_of_speech: "verb", meaning_vi: "mine one" } } } });
  const ownTwo = await prisma.vOCABULARY.create({ data: { owner_id: owner.id, word, meanings: { create: { part_of_speech: "noun", meaning_vi: "mine two" } } } });
  const foreign = await prisma.vOCABULARY.create({ data: { owner_id: otherUser.id, word, meanings: { create: { part_of_speech: "noun", meaning_vi: "secret" } } } });
  let response = await http.request(`/api/vocabulary-set-picker?query=${encodeURIComponent(word)}`, { cookie: ownerCookie });
  assert.equal(response.status, 200);
  assert.deepEqual(new Set(response.json.data.map(({ id }) => id)), new Set([canonical.id, ownOne.id, ownTwo.id]));
  assert.equal(response.json.data.some(({ id }) => id === foreign.id), false);
  assert.deepEqual(Object.keys(response.json.data[0]).sort(), ["id", "phonetic", "primary_meaning", "source", "word"]);
  assert.deepEqual(new Set(response.json.data.map(({ source }) => source)), new Set(["CANONICAL", "PRIVATE"]));
  assert.equal(response.json.data.find(({ id }) => id === ownOne.id).primary_meaning.meaning_vi, "mine one");
  response = await http.request(`/api/vocabulary-set-picker?query=${encodeURIComponent(word)}`, { cookie: adminCookie });
  assert.deepEqual(response.json.data.map(({ id }) => id), [canonical.id]);

  for (let index = 0; index < 21; index += 1) await createVocabulary(`picker-${index}`);
  response = await http.request("/api/vocabulary-set-picker?query=picker-", { cookie: ownerCookie });
  assert.equal(response.status, 200);
  assert.equal(response.json.data.length, 20);
  assert.equal((await http.request("/api/vocabulary-set-picker?query=picker", { cookie: adminCookie })).status, 200);
  assert.equal((await http.request("/api/vocabulary-set-picker?query=", { cookie: ownerCookie })).status, 400);
  assert.equal((await http.request("/api/vocabulary-set-picker")).status, 401);
  assert.equal((await http.request("/api/vocabulary")).status, 404);
});

test("private Set accepts canonical and owned same-spelling IDs, rejects foreign IDs atomically, and removal preserves Vocabulary and Progress", async () => {
  const word = `${fixturePrefix}-membership-${randomUUID()}`;
  const canonical = await prisma.vOCABULARY.create({ data: { word } });
  const ownOne = await prisma.vOCABULARY.create({ data: { owner_id: owner.id, word } });
  const ownTwo = await prisma.vOCABULARY.create({ data: { owner_id: owner.id, word } });
  const foreign = await prisma.vOCABULARY.create({ data: { owner_id: otherUser.id, word } });
  const set = await createPrivateSet();
  let response = await http.request(`/api/my/vocabulary-sets/${set.id}`, { method: "PATCH", cookie: ownerCookie, json: { items: [canonical.id, ownOne.id, ownTwo.id].map((vocabulary_id) => ({ vocabulary_id })) } });
  assert.equal(response.status, 200, response.text);
  assert.deepEqual(response.json.data.items.map(({ vocabulary_id }) => vocabulary_id), [canonical.id, ownOne.id, ownTwo.id]);
  assert.deepEqual(response.json.data.items.map(({ source }) => source), ["CANONICAL", "PRIVATE", "PRIVATE"]);
  response = await http.request(`/api/my/vocabulary-sets/${set.id}`, { method: "PATCH", cookie: ownerCookie, json: { items: [{ vocabulary_id: ownOne.id }, { vocabulary_id: ownOne.id }] } });
  assert.equal(response.status, 400);
  response = await http.request(`/api/my/vocabulary-sets/${set.id}`, { method: "PATCH", cookie: ownerCookie, json: { items: [{ vocabulary_id: canonical.id }, { vocabulary_id: foreign.id }] } });
  assert.equal(response.status, 404);
  assert.deepEqual((await prisma.vOCABULARY_SET_ITEM.findMany({ where: { vocabulary_set_id: set.id }, orderBy: { position: "asc" } })).map(({ vocabulary_id }) => vocabulary_id), [canonical.id, ownOne.id, ownTwo.id]);
  const progress = await prisma.lEARNING_PROGRESS.create({ data: { user_id: owner.id, vocabulary_id: ownOne.id, status: "LEARNING" } });
  response = await http.request(`/api/my/vocabulary-sets/${set.id}`, { method: "PATCH", cookie: ownerCookie, json: { items: [] } });
  assert.equal(response.status, 200);
  assert.equal(await prisma.vOCABULARY.count({ where: { id: ownOne.id } }), 1);
  assert.deepEqual(await prisma.lEARNING_PROGRESS.findUniqueOrThrow({ where: { id: progress.id } }), progress);
  const picker = await http.request(`/api/vocabulary-set-picker?query=${encodeURIComponent(word)}`, { cookie: ownerCookie });
  assert.equal(picker.json.data.some(({ id }) => id === ownOne.id), true);
  const systemAttempt = await http.request("/api/admin/vocabulary-sets", { method: "POST", cookie: adminCookie, json: { topic_id: topic.id, name: "Private forbidden", cefr_level: "A1", items: [{ vocabulary_id: ownOne.id }] } });
  assert.equal(systemAttempt.status, 404);
});

test("all protected Set routes retain authentication and safe error contracts", async () => {
  const system = await createSystemSet({ items: [firstVocabulary.id] });
  for (const request of [
    http.request("/api/admin/vocabulary-sets"),
    http.request("/api/my/vocabulary-sets"),
    http.request(`/api/vocabulary-sets/${system.id}/copy`, { method: "POST" }),
  ]) {
    const response = await request;
    assert.equal(response.status, 401);
    assert.equal(response.json.error.code, "AUTHENTICATION_FAILED");
  }
  const response = await http.request(`/api/vocabulary-sets/${randomUUID()}/copy`, { method: "POST", cookie: ownerCookie });
  assert.equal(response.status, 404);
  assert.equal(response.json.error.code, "VOCABULARY_SET_NOT_FOUND");
});

async function createVocabulary(word) {
  return prisma.vOCABULARY.create({
    data: { word: `${fixturePrefix}-${word}-${randomUUID()}`, meanings: { create: { part_of_speech: "noun", meaning_vi: "nghĩa" } } },
  });
}

async function createSystemSet({ items, cefrLevel = "B1", coverImageUrl } = {}) {
  const response = await http.request("/api/admin/vocabulary-sets", {
    method: "POST", cookie: adminCookie,
    json: {
      topic_id: topic.id,
      name: `${fixturePrefix} System-${randomUUID()}`,
      cefr_level: cefrLevel,
      ...(coverImageUrl === undefined ? {} : { cover_image_url: coverImageUrl }),
      items: items.map((vocabulary_id) => ({ vocabulary_id })),
    },
  });
  assert.equal(response.status, 201);
  return response.json.data;
}

async function createPrivateSet() {
  const response = await http.request("/api/my/vocabulary-sets", {
    method: "POST", cookie: ownerCookie, json: { name: `${fixturePrefix} Private-${randomUUID()}` },
  });
  assert.equal(response.status, 201);
  return response.json.data;
}

async function copySystemSet(systemSetId) {
  const response = await http.request(`/api/vocabulary-sets/${systemSetId}/copy`, { method: "POST", cookie: ownerCookie });
  assert.equal(response.status, 201, JSON.stringify(response.json));
  return response.json.data;
}

async function uploadCover(path, cookie, buffer, mimetype) {
  const form = new FormData();
  form.append("cover", new Blob([buffer], { type: mimetype }), "cover-image");
  return http.request(path, { method: "POST", cookie, rawBody: form });
}

async function cleanupRunOwnedFixtures() {
  if (!prisma) return;

  await prisma.$transaction(async (transaction) => {
    const users = await transaction.uSER.findMany({
      where: { email: { endsWith: `@${fixtureDomain}` } },
      select: { id: true },
    });
    const userIds = users.map(({ id }) => id);
    const sets = await transaction.vOCABULARY_SET.findMany({
      where: { owner_id: { in: userIds } },
      select: { id: true },
    });
    const setIds = sets.map(({ id }) => id);

    await transaction.lEARNING_PROGRESS.deleteMany({
      where: {
        OR: [
          { user_id: { in: userIds } },
          { vocabulary: { word: { startsWith: fixturePrefix } } },
        ],
      },
    });
    await transaction.pRIVATE_VOCABULARY_CREATE_OPERATION.deleteMany({
      where: {
        OR: [
          { owner_id: { in: userIds } },
          { vocabulary_set_id: { in: setIds } },
        ],
      },
    });
    await transaction.aUTH_SESSION.deleteMany({
      where: { user_id: { in: userIds } },
    });
    await transaction.vOCABULARY_SET_ITEM.deleteMany({
      where: { vocabulary_set_id: { in: setIds } },
    });
    await transaction.vOCABULARY_SET.deleteMany({
      where: { id: { in: setIds } },
    });
    await transaction.vOCABULARY.deleteMany({
      where: { word: { startsWith: fixturePrefix } },
    });
    await transaction.tOPIC.deleteMany({
      where: { name: { startsWith: fixturePrefix } },
    });
    await transaction.uSER.deleteMany({
      where: { id: { in: userIds } },
    });
  }, { maxWait: 30_000, timeout: 120_000 });
}
