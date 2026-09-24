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
let admin;
let owner;
let otherUser;
let topic;
let adminCookie;
let ownerCookie;
let otherCookie;

before(async () => {
  database = await createTestDatabase();
  prisma = database.prisma;
  http = await startHttpTestServer(createApp({ prisma }));
});

beforeEach(async () => {
  await database.reset();
  admin = await createUserFixture(prisma, { role: "ADMIN" });
  owner = await createUserFixture(prisma, { role: "USER" });
  otherUser = await createUserFixture(prisma, { role: "USER" });
  const adminSession = await createSessionFixture(prisma, admin.id);
  const ownerSession = await createSessionFixture(prisma, owner.id);
  const otherSession = await createSessionFixture(prisma, otherUser.id);
  adminCookie = `session_id=${adminSession.rawToken}`;
  ownerCookie = `session_id=${ownerSession.rawToken}`;
  otherCookie = `session_id=${otherSession.rawToken}`;
  topic = await prisma.tOPIC.create({
    data: { name: `Learning test topic ${randomUUID()}` },
  });
});

afterEach(async () => {
  await database.reset();
});

after(async () => {
  try {
    if (database) await database.reset();
  } finally {
    try {
      if (http) await http.close();
    } finally {
      if (database) await database.disconnect();
    }
  }
});

test("database enforces Learning Progress identity, checks and external delete behavior", async () => {
  const vocabulary = await createVocabulary("constraints");
  const set = await createSet({
    ownerId: owner.id,
    isPublic: false,
    vocabularyIds: [vocabulary.id],
  });
  const progress = await prisma.lEARNING_PROGRESS.create({
    data: {
      user_id: owner.id,
      vocabulary_id: vocabulary.id,
      status: "LEARNING",
    },
  });
  assert.equal(progress.review_count, 0);
  assert.equal(progress.revision, 0);
  assert.equal(progress.next_review_at, null);

  await assert.rejects(
    () => prisma.lEARNING_PROGRESS.create({
      data: {
        user_id: owner.id,
        vocabulary_id: vocabulary.id,
        status: "LEARNING",
      },
    }),
    { code: "P2002" },
  );
  for (const data of [
    { status: "NEW" },
    { review_count: -1 },
    { revision: -1 },
    { interval_days: 0 },
  ]) {
    await assert.rejects(
      () => prisma.lEARNING_PROGRESS.update({ where: { id: progress.id }, data }),
      /constraint|violat/i,
    );
  }
  await assert.rejects(
    () => prisma.uSER.delete({ where: { id: owner.id } }),
    { code: "P2003" },
  );
  await assert.rejects(
    () => prisma.vOCABULARY.delete({ where: { id: vocabulary.id } }),
    { code: "P2003" },
  );
  await prisma.vOCABULARY_SET.delete({ where: { id: set.id } });
  assert.equal(
    await prisma.lEARNING_PROGRESS.count({ where: { id: progress.id } }),
    1,
  );
});

test("learning Set access is USER-only and conceals inaccessible private Sets", async () => {
  const vocabulary = await createVocabulary("access");
  const systemSet = await createSet({
    ownerId: admin.id,
    isPublic: true,
    vocabularyIds: [vocabulary.id],
  });
  const ownedSet = await createSet({
    ownerId: owner.id,
    isPublic: false,
    vocabularyIds: [vocabulary.id],
  });
  const otherSet = await createSet({
    ownerId: otherUser.id,
    isPublic: false,
    vocabularyIds: [vocabulary.id],
  });

  assertError(await http.request(`/api/learning/sets/${systemSet.id}`), 401, "AUTHENTICATION_FAILED");
  assertError(
    await http.request(`/api/learning/sets/${systemSet.id}`, { cookie: adminCookie }),
    403,
    "FORBIDDEN",
  );
  assert.equal(
    (await http.request(`/api/learning/sets/${systemSet.id}`, { cookie: ownerCookie })).status,
    200,
  );
  assert.equal(
    (await http.request(`/api/learning/sets/${ownedSet.id}`, { cookie: ownerCookie })).status,
    200,
  );
  for (const setId of [otherSet.id, randomUUID()]) {
    assertError(
      await http.request(`/api/learning/sets/${setId}`, { cookie: ownerCookie }),
      404,
      "LEARNING_SET_NOT_FOUND",
    );
  }
});

test("learning payload is ordered, complete, deterministic and read-only with conceptual NEW", async () => {
  const firstVocabulary = await createVocabulary("first", { nested: true });
  const secondVocabulary = await createVocabulary("second");
  const set = await createSet({
    ownerId: admin.id,
    isPublic: true,
    vocabularyIds: [secondVocabulary.id, firstVocabulary.id],
  });
  const progress = await prisma.lEARNING_PROGRESS.create({
    data: {
      user_id: owner.id,
      vocabulary_id: firstVocabulary.id,
      status: "LEARNED",
      review_count: 3,
      revision: 3,
      last_reviewed_at: new Date("2026-09-23T00:00:00.000Z"),
    },
  });
  const before = await prisma.lEARNING_PROGRESS.findMany({
    where: { user_id: owner.id },
  });

  const response = await http.request(`/api/learning/sets/${set.id}`, {
    cookie: ownerCookie,
  });
  assert.equal(response.status, 200, response.text);
  assert.deepEqual(response.json.data.topic, { id: topic.id, name: topic.name });
  assert.equal(Object.hasOwn(response.json.data, "owner_id"), false);
  assert.deepEqual(
    response.json.data.cards.map(({ id, position }) => [id, position]),
    [[secondVocabulary.id, 1], [firstVocabulary.id, 2]],
  );
  assert.deepEqual(response.json.data.cards[0].progress, {
    status: "NEW",
    review_count: 0,
    revision: 0,
    last_reviewed_at: null,
  });
  assert.equal(response.json.data.cards[1].progress.status, "LEARNED");
  assert.equal(response.json.data.cards[1].progress.review_count, 3);
  assert.equal(response.json.data.cards[1].progress.revision, 3);
  assert.equal(Object.hasOwn(response.json.data.cards[1].progress, "next_review_at"), false);
  assert.deepEqual(
    response.json.data.cards[1].meanings.map(({ meaning_vi }) => meaning_vi),
    ["early meaning", "late meaning"],
  );
  assert.deepEqual(
    response.json.data.cards[1].meanings[0].examples.map(({ example_en }) => example_en),
    ["Early example.", "Late example."],
  );
  assert.deepEqual(await prisma.lEARNING_PROGRESS.findMany({ where: { user_id: owner.id } }), before);
  assert.equal(
    await prisma.lEARNING_PROGRESS.count({ where: { id: progress.id } }),
    1,
  );
});

test("learning payload validation and empty Set failures use approved safe errors", async () => {
  const emptySet = await createSet({
    ownerId: owner.id,
    isPublic: false,
    vocabularyIds: [],
  });
  assertError(
    await http.request(`/api/learning/sets/${emptySet.id}`, { cookie: ownerCookie }),
    409,
    "LEARNING_SET_EMPTY",
  );
  assertError(
    await http.request("/api/learning/sets/not-a-uuid", { cookie: ownerCookie }),
    400,
    "VALIDATION_ERROR",
  );
  assert.equal(await prisma.lEARNING_PROGRESS.count(), 0);
});

test("event API enforces authentication and exact approved input", async () => {
  const vocabulary = await createVocabulary("validation");
  const set = await createSet({
    ownerId: admin.id,
    isPublic: true,
    vocabularyIds: [vocabulary.id],
  });
  const valid = eventBody({
    setId: set.id,
    vocabularyId: vocabulary.id,
    outcome: "REMEMBERED",
  });
  assertError(
    await http.request("/api/learning/events", { method: "POST", json: valid }),
    401,
    "AUTHENTICATION_FAILED",
  );
  assertError(
    await postEvent(adminCookie, valid),
    403,
    "FORBIDDEN",
  );
  for (const invalid of [
    { ...valid, outcome: "KNOWN" },
    { ...valid, expected_revision: -1 },
    { ...valid, expected_revision: 0.5 },
    { ...valid, event_id: "invalid" },
    { ...valid, user_id: owner.id },
    { ...valid, outcome: undefined },
  ]) {
    assertError(await postEvent(ownerCookie, invalid), 400, "VALIDATION_ERROR");
  }
  assert.equal(await prisma.lEARNING_PROGRESS.count(), 0);
});

test("meaningful outcomes transition progress once with retry and stale revision protection", async () => {
  const vocabulary = await createVocabulary("transitions");
  const set = await createSet({
    ownerId: admin.id,
    isPublic: true,
    vocabularyIds: [vocabulary.id],
  });
  const first = eventBody({
    setId: set.id,
    vocabularyId: vocabulary.id,
    outcome: "REMEMBERED",
  });
  let response = await postEvent(ownerCookie, first);
  assertProgress(response, { status: "LEARNED", reviewCount: 1, revision: 1 });
  const firstResult = response.json.data;
  response = await postEvent(ownerCookie, first);
  assert.deepEqual(response.json.data, firstResult);

  assertError(
    await postEvent(ownerCookie, { ...first, event_id: randomUUID() }),
    409,
    "LEARNING_PROGRESS_CHANGED",
  );
  const second = {
    ...first,
    event_id: randomUUID(),
    expected_revision: 1,
    outcome: "STUDY_AGAIN",
  };
  response = await postEvent(ownerCookie, second);
  assertProgress(response, { status: "LEARNING", reviewCount: 2, revision: 2 });
  assertError(await postEvent(ownerCookie, first), 409, "LEARNING_PROGRESS_CHANGED");

  const persisted = await prisma.lEARNING_PROGRESS.findUniqueOrThrow({
    where: {
      user_id_vocabulary_id: {
        user_id: owner.id,
        vocabulary_id: vocabulary.id,
      },
    },
  });
  assert.equal(persisted.last_event_id, second.event_id);
  assert.equal(persisted.next_review_at, null);
  assert.equal(persisted.interval_days, null);
  assert.equal(persisted.ease_factor, null);
});

test("events enforce private ownership, current membership and per-USER isolation transactionally", async () => {
  const vocabulary = await createVocabulary("isolation");
  const set = await createSet({
    ownerId: owner.id,
    isPublic: false,
    vocabularyIds: [vocabulary.id],
  });
  const body = eventBody({
    setId: set.id,
    vocabularyId: vocabulary.id,
    outcome: "REMEMBERED",
  });
  assertError(await postEvent(otherCookie, body), 404, "LEARNING_SET_NOT_FOUND");
  assert.equal(await prisma.lEARNING_PROGRESS.count(), 0);
  assert.equal((await postEvent(ownerCookie, body)).status, 200);
  assert.equal(
    await prisma.lEARNING_PROGRESS.count({ where: { user_id: otherUser.id } }),
    0,
  );

  await prisma.vOCABULARY_SET_ITEM.delete({
    where: {
      vocabulary_set_id_vocabulary_id: {
        vocabulary_set_id: set.id,
        vocabulary_id: vocabulary.id,
      },
    },
  });
  const before = await prisma.lEARNING_PROGRESS.findUniqueOrThrow({
    where: {
      user_id_vocabulary_id: {
        user_id: owner.id,
        vocabulary_id: vocabulary.id,
      },
    },
  });
  assertError(
    await postEvent(ownerCookie, {
      ...body,
      event_id: randomUUID(),
      expected_revision: 1,
    }),
    409,
    "LEARNING_SET_ITEM_CHANGED",
  );
  assert.deepEqual(
    await prisma.lEARNING_PROGRESS.findUniqueOrThrow({ where: { id: before.id } }),
    before,
  );
});

test("concurrent first events preserve idempotency and optimistic concurrency", async () => {
  const sameVocabulary = await createVocabulary("same-race");
  const differentVocabulary = await createVocabulary("different-race");
  const set = await createSet({
    ownerId: admin.id,
    isPublic: true,
    vocabularyIds: [sameVocabulary.id, differentVocabulary.id],
  });
  const same = eventBody({
    setId: set.id,
    vocabularyId: sameVocabulary.id,
    outcome: "REMEMBERED",
  });
  const sameResponses = await Promise.all([
    postEvent(ownerCookie, same),
    postEvent(ownerCookie, same),
  ]);
  assert.deepEqual(sameResponses.map(({ status }) => status).sort(), [200, 200]);
  const sameProgress = await findProgress(owner.id, sameVocabulary.id);
  assert.equal(sameProgress.review_count, 1);
  assert.equal(sameProgress.revision, 1);

  const different = [randomUUID(), randomUUID()].map((eventId) =>
    eventBody({
      eventId,
      setId: set.id,
      vocabularyId: differentVocabulary.id,
      outcome: "STUDY_AGAIN",
    }),
  );
  const differentResponses = await Promise.all(
    different.map((body) => postEvent(ownerCookie, body)),
  );
  assert.deepEqual(differentResponses.map(({ status }) => status).sort(), [200, 409]);
  const differentProgress = await findProgress(owner.id, differentVocabulary.id);
  assert.equal(differentProgress.review_count, 1);
  assert.equal(differentProgress.revision, 1);
});

test("unexpected Learning failures use the final safe 500 contract", async () => {
  const sensitiveValues = ["database-credential-value", "session-secret-value", "stack trace"];
  const failingPrisma = new Proxy(prisma, {
    get(target, property) {
      if (property === "vOCABULARY_SET") {
        return {
          findFirst() {
            throw new Error(sensitiveValues.join(" | "));
          },
        };
      }
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  const failingHttp = await startHttpTestServer(createApp({ prisma: failingPrisma }));
  try {
    const response = await failingHttp.request(`/api/learning/sets/${randomUUID()}`, {
      cookie: ownerCookie,
    });
    assert.equal(response.status, 500);
    assert.deepEqual(response.json, {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred.",
      },
    });
    for (const value of sensitiveValues) {
      assert.equal(response.text.includes(value), false);
    }
  } finally {
    await failingHttp.close();
  }
});

async function createVocabulary(prefix, { nested = false } = {}) {
  const vocabulary = await prisma.vOCABULARY.create({
    data: {
      word: `learning-${prefix}-${randomUUID()}`,
      phonetic: "/test/",
      pronunciation_url: "https://example.test/audio.mp3",
    },
  });
  if (!nested) return vocabulary;

  const earlyMeaning = await prisma.vOCABULARY_MEANING.create({
    data: {
      vocabulary_id: vocabulary.id,
      part_of_speech: "noun",
      meaning_vi: "early meaning",
      context: "early context",
      cefr_level: "A1",
      created_at: new Date("2026-01-01T00:00:00.000Z"),
    },
  });
  await prisma.vOCABULARY_MEANING.create({
    data: {
      vocabulary_id: vocabulary.id,
      part_of_speech: "verb",
      meaning_vi: "late meaning",
      created_at: new Date("2026-02-01T00:00:00.000Z"),
    },
  });
  await prisma.vOCABULARY_EXAMPLE.createMany({
    data: [
      {
        meaning_id: earlyMeaning.id,
        example_en: "Late example.",
        example_vi: "Ví dụ muộn.",
        created_at: new Date("2026-01-02T00:00:00.000Z"),
      },
      {
        meaning_id: earlyMeaning.id,
        example_en: "Early example.",
        example_vi: "Ví dụ sớm.",
        created_at: new Date("2026-01-01T00:00:00.000Z"),
      },
    ],
  });
  return vocabulary;
}

function createSet({ ownerId, isPublic, vocabularyIds }) {
  return prisma.vOCABULARY_SET.create({
    data: {
      owner_id: ownerId,
      topic_id: topic.id,
      name: `Learning Set ${randomUUID()}`,
      is_public: isPublic,
      items: {
        create: vocabularyIds.map((vocabularyId, index) => ({
          vocabulary_id: vocabularyId,
          position: index + 1,
        })),
      },
    },
  });
}

function eventBody({
  eventId = randomUUID(),
  setId,
  vocabularyId,
  expectedRevision = 0,
  outcome,
}) {
  return {
    event_id: eventId,
    set_id: setId,
    vocabulary_id: vocabularyId,
    expected_revision: expectedRevision,
    outcome,
  };
}

function postEvent(cookie, json) {
  return http.request("/api/learning/events", {
    method: "POST",
    cookie,
    json,
  });
}

function findProgress(userId, vocabularyId) {
  return prisma.lEARNING_PROGRESS.findUniqueOrThrow({
    where: {
      user_id_vocabulary_id: {
        user_id: userId,
        vocabulary_id: vocabularyId,
      },
    },
  });
}

function assertProgress(response, { status, reviewCount, revision }) {
  assert.equal(response.status, 200, response.text);
  assert.equal(response.json.data.status, status);
  assert.equal(response.json.data.review_count, reviewCount);
  assert.equal(response.json.data.revision, revision);
  assert.equal(typeof response.json.data.last_reviewed_at, "string");
}

function assertError(response, status, code) {
  assert.equal(response.status, status, response.text);
  assert.equal(response.json.success, false);
  assert.equal(response.json.error.code, code);
  assert.equal(typeof response.json.error.message, "string");
}
