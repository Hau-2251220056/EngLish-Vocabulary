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
const FIXED_NOW = new Date("2026-10-04T03:15:00.000Z");
const TEST_PREFIX = `lrn-${randomUUID().slice(0, 8)}`;

before(async () => {
  database = await createTestDatabase();
  prisma = database.prisma;
  http = await startHttpTestServer(createApp({
    prisma,
    learningNow: () => new Date(FIXED_NOW),
  }));
});

beforeEach(async () => {
  await cleanupLearningSuiteFixtures();
  admin = await createUserFixture(prisma, { email: `${TEST_PREFIX}-admin@example.test`, role: "ADMIN" });
  owner = await createUserFixture(prisma, { email: `${TEST_PREFIX}-owner@example.test`, role: "USER" });
  otherUser = await createUserFixture(prisma, { email: `${TEST_PREFIX}-other@example.test`, role: "USER" });
  const adminSession = await createSessionFixture(prisma, admin.id);
  const ownerSession = await createSessionFixture(prisma, owner.id);
  const otherSession = await createSessionFixture(prisma, otherUser.id);
  adminCookie = `session_id=${adminSession.rawToken}`;
  ownerCookie = `session_id=${ownerSession.rawToken}`;
  otherCookie = `session_id=${otherSession.rawToken}`;
  topic = await prisma.tOPIC.create({
    data: { name: `${TEST_PREFIX} topic` },
  });
});

afterEach(async () => {
  await cleanupLearningSuiteFixtures();
});

after(async () => {
  try {
    if (prisma) await cleanupLearningSuiteFixtures();
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

test("Learning suite cleanup preserves an unrelated authenticated TEST user", async () => {
  const sentinel = await createUserFixture(prisma, {
    email: `manual-session-sentinel-${randomUUID()}@example.test`,
  });
  const sentinelSession = await createSessionFixture(prisma, sentinel.id);

  try {
    await cleanupLearningSuiteFixtures();
    assert.equal(
      await prisma.aUTH_SESSION.count({ where: { id: sentinelSession.session.id } }),
      1,
    );
    assert.equal(await prisma.uSER.count({ where: { id: sentinel.id } }), 1);
  } finally {
    await prisma.aUTH_SESSION.deleteMany({ where: { user_id: sentinel.id } });
    await prisma.uSER.deleteMany({ where: { id: sentinel.id } });
  }
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
  const ownedResponse = await http.request(`/api/learning/sets/${ownedSet.id}`, { cookie: ownerCookie });
  assert.equal(ownedResponse.status, 200);
  assert.equal(ownedResponse.json.data.topic, null);
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

  const response = await http.request(`/api/learning/sets/${set.id}?mode=NORMAL`, {
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
    stored_status: null,
    effective_status: "NEW",
    stage: 0,
    interval_days: null,
    next_review_at: null,
    review_count: 0,
    revision: 0,
    last_reviewed_at: null,
  });
  assert.equal(response.json.data.cards[1].progress.status, "LEARNED");
  assert.equal(response.json.data.cards[1].progress.review_count, 3);
  assert.equal(response.json.data.cards[1].progress.revision, 3);
  assert.equal(response.json.data.mode, "NORMAL");
  assert.equal(response.json.data.total_items, 2);
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

test("Personal Vocabulary keeps exact same-spelling identities, shared progress and edited content", async () => {
  const sharedWord = `${TEST_PREFIX}-book-${randomUUID()}`;
  const canonical = await prisma.vOCABULARY.create({ data: { word: sharedWord, pronunciation_url: "https://example.test/canonical-book.mp3", meanings: { create: { part_of_speech: "noun", meaning_vi: "canonical meaning", cefr_level: "A1" } } } });
  const privateOne = await prisma.vOCABULARY.create({ data: { owner_id: owner.id, word: sharedWord, pronunciation_url: null, meanings: { create: [
    { part_of_speech: "verb", meaning_vi: "private booking meaning", cefr_level: "A2" },
    { part_of_speech: "noun", meaning_vi: "private book meaning", cefr_level: "B2" },
  ] } } });
  const privateTwo = await prisma.vOCABULARY.create({ data: { owner_id: owner.id, word: sharedWord, pronunciation_url: null, meanings: { create: { part_of_speech: "noun", meaning_vi: "second private meaning", cefr_level: "A1" } } } });
  const setA = await createSet({ ownerId: owner.id, isPublic: false, vocabularyIds: [privateTwo.id, canonical.id, privateOne.id] });
  const setB = await createSet({ ownerId: owner.id, isPublic: false, vocabularyIds: [privateOne.id] });

  const response = await http.request(`/api/learning/sets/${setA.id}`, { cookie: ownerCookie });
  assert.equal(response.status, 200, response.text);
  assert.deepEqual(response.json.data.cards.map((card) => [card.id, card.position, card.word]), [
    [privateTwo.id, 1, sharedWord], [canonical.id, 2, sharedWord], [privateOne.id, 3, sharedWord],
  ]);
  assert.equal(response.json.data.cards[1].pronunciation_url, "https://example.test/canonical-book.mp3");
  assert.equal(response.json.data.cards[2].pronunciation_url, null);
  assert.deepEqual(
    response.json.data.cards[2].meanings
      .map(({ part_of_speech, meaning_vi }) => [part_of_speech, meaning_vi])
      .sort((left, right) => left[0].localeCompare(right[0])),
    [["noun", "private book meaning"], ["verb", "private booking meaning"]],
  );

  for (const vocabulary of [canonical, privateOne, privateTwo]) {
    assertProgress(await postEvent(ownerCookie, eventBody({ setId: setA.id, vocabularyId: vocabulary.id, rating: "GOOD" })), { status: "LEARNED", reviewCount: 1, revision: 1 });
  }
  assert.equal(await prisma.lEARNING_PROGRESS.count({ where: { user_id: owner.id } }), 3);
  const reused = await http.request(`/api/learning/sets/${setB.id}?mode=NORMAL`, { cookie: ownerCookie });
  assert.equal(reused.json.data.cards[0].id, privateOne.id);
  assert.equal(reused.json.data.cards[0].progress.revision, 1);

  await prisma.vOCABULARY_SET_ITEM.delete({ where: { vocabulary_set_id_vocabulary_id: { vocabulary_set_id: setA.id, vocabulary_id: privateOne.id } } });
  await prisma.vOCABULARY.update({ where: { id: privateOne.id }, data: { word: "reserve" } });
  const afterEdit = await http.request(`/api/learning/sets/${setB.id}?mode=NORMAL`, { cookie: ownerCookie });
  assert.equal(afterEdit.json.data.cards[0].id, privateOne.id);
  assert.equal(afterEdit.json.data.cards[0].word, "reserve");
  assert.equal(afterEdit.json.data.cards[0].progress.revision, 1);
  assert.equal((await findProgress(owner.id, privateOne.id)).revision, 1);
  assertError(await http.request(`/api/learning/sets/${setA.id}`, { cookie: otherCookie }), 404, "LEARNING_SET_NOT_FOUND");
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
  assert.equal(await testProgressCount(), 0);
});

test("SRS and NORMAL modes validate, order eligibility and remain read-only", async () => {
  const fresh = await createVocabulary("mode-new");
  const future = await createVocabulary("mode-future");
  const due = await createVocabulary("mode-due");
  const legacy = await createVocabulary("mode-legacy");
  const set = await createSet({
    ownerId: admin.id,
    isPublic: true,
    vocabularyIds: [fresh.id, future.id, due.id, legacy.id],
  });
  await createProgress({
    userId: owner.id,
    vocabularyId: future.id,
    status: "LEARNED",
    intervalDays: 7,
    nextReviewAt: new Date(FIXED_NOW.getTime() + 60_000),
  });
  await createProgress({
    userId: owner.id,
    vocabularyId: due.id,
    status: "LEARNED",
    intervalDays: 3,
    nextReviewAt: new Date(FIXED_NOW),
  });
  await createProgress({
    userId: owner.id,
    vocabularyId: legacy.id,
    status: "LEARNED",
    intervalDays: 2,
    nextReviewAt: null,
  });
  const before = await prisma.lEARNING_PROGRESS.findMany({ orderBy: { id: "asc" } });

  for (const suffix of ["", "?mode=SRS"]) {
    const response = await http.request(`/api/learning/sets/${set.id}${suffix}`, {
      cookie: ownerCookie,
    });
    assert.equal(response.status, 200, response.text);
    assert.equal(response.json.data.mode, "SRS");
    assert.equal(response.json.data.evaluated_at, FIXED_NOW.toISOString());
    assert.equal(response.json.data.total_items, 4);
    assert.equal(response.json.data.eligible_count, 3);
    assert.equal(
      response.json.data.next_review_at,
      new Date(FIXED_NOW.getTime() + 60_000).toISOString(),
    );
    assert.deepEqual(
      response.json.data.cards.map((card) => card.id),
      [due.id, legacy.id, fresh.id],
    );
    assert.deepEqual(
      response.json.data.cards.map((card) => [
        card.progress.stored_status,
        card.progress.effective_status,
        card.progress.stage,
      ]),
      [
        ["LEARNED", "NEEDS_REVIEW", 2],
        ["LEARNED", "LEARNED", 0],
        [null, "NEW", 0],
      ],
    );
    assert.equal(
      response.json.data.cards.every((card) => card.rating_previews),
      true,
    );
  }

  const normal = await http.request(`/api/learning/sets/${set.id}?mode=NORMAL`, {
    cookie: ownerCookie,
  });
  assert.equal(normal.status, 200, normal.text);
  assert.equal(normal.json.data.mode, "NORMAL");
  assert.equal(normal.json.data.total_items, 4);
  assert.deepEqual(
    normal.json.data.cards.map((card) => card.id),
    [fresh.id, future.id, due.id, legacy.id],
  );
  assert.equal(
    normal.json.data.cards.some((card) => Object.hasOwn(card, "rating_previews")),
    false,
  );
  assert.deepEqual(
    await prisma.lEARNING_PROGRESS.findMany({ orderBy: { id: "asc" } }),
    before,
  );

  for (const query of ["mode=", "mode=normal", "mode=UNKNOWN", "mode=SRS&mode=NORMAL", "extra=1"]) {
    assertError(
      await http.request(`/api/learning/sets/${set.id}?${query}`, { cookie: ownerCookie }),
      400,
      "VALIDATION_ERROR",
    );
  }
});

test("SRS reads expose the authoritative full rating-preview matrix", async () => {
  const vocabularies = await Promise.all(
    [0, 1, 2, 3, 4, 5].map((stage) => createVocabulary(`preview-stage-${stage}`)),
  );
  const set = await createSet({
    ownerId: admin.id,
    isPublic: true,
    vocabularyIds: vocabularies.map(({ id }) => id),
  });
  const intervals = [null, 1, 3, 7, 14, 30];
  for (let stage = 1; stage <= 5; stage += 1) {
    await createProgress({
      userId: owner.id,
      vocabularyId: vocabularies[stage].id,
      status: "LEARNED",
      intervalDays: intervals[stage],
      nextReviewAt: new Date(FIXED_NOW),
    });
  }

  const response = await http.request(`/api/learning/sets/${set.id}?mode=SRS`, {
    cookie: ownerCookie,
  });
  assert.equal(response.status, 200, response.text);
  const expectedPassingIntervals = [
    [1, 3, 7],
    [1, 3, 7],
    [3, 7, 14],
    [7, 14, 30],
    [14, 30, 30],
    [30, 30, 30],
  ];
  for (let stage = 0; stage <= 5; stage += 1) {
    const card = response.json.data.cards.find(({ id }) => id === vocabularies[stage].id);
    assert.deepEqual(card.rating_previews, {
      AGAIN: { kind: "SESSION_REQUEUE", interval_days: null },
      HARD: { kind: "SCHEDULED", interval_days: expectedPassingIntervals[stage][0] },
      GOOD: { kind: "SCHEDULED", interval_days: expectedPassingIntervals[stage][1] },
      EASY: { kind: "SCHEDULED", interval_days: expectedPassingIntervals[stage][2] },
    });
  }
});

test("non-empty Sets with no eligible SRS cards return an up-to-date snapshot", async () => {
  const vocabulary = await createVocabulary("up-to-date");
  const set = await createSet({
    ownerId: admin.id,
    isPublic: true,
    vocabularyIds: [vocabulary.id],
  });
  const nextReviewAt = new Date(FIXED_NOW.getTime() + 3 * 24 * 60 * 60 * 1000);
  await createProgress({
    userId: owner.id,
    vocabularyId: vocabulary.id,
    status: "LEARNED",
    intervalDays: 3,
    nextReviewAt,
  });

  const response = await http.request(`/api/learning/sets/${set.id}`, {
    cookie: ownerCookie,
  });
  assert.equal(response.status, 200, response.text);
  assert.equal(response.json.data.total_items, 1);
  assert.equal(response.json.data.eligible_count, 0);
  assert.deepEqual(response.json.data.cards, []);
  assert.equal(response.json.data.next_review_at, nextReviewAt.toISOString());
});

test("progress view is USER-only, isolated, minimal, compatible and read-only", async () => {
  const learningVocabulary = await createVocabulary("progress-learning");
  const learnedVocabulary = await createVocabulary("progress-learned");
  const reviewVocabulary = await createVocabulary("progress-review");
  const otherVocabulary = await createVocabulary("progress-other");
  await createProgress({
    userId: owner.id,
    vocabularyId: learningVocabulary.id,
    status: "LEARNING",
    reviewCount: 2,
    revision: 2,
    lastReviewedAt: new Date("2026-09-21T00:00:00.000Z"),
  });
  await createProgress({
    userId: owner.id,
    vocabularyId: learnedVocabulary.id,
    status: "LEARNED",
    reviewCount: 3,
    revision: 3,
    lastReviewedAt: new Date("2026-09-22T00:00:00.000Z"),
  });
  await createProgress({
    userId: owner.id,
    vocabularyId: reviewVocabulary.id,
    status: "NEEDS_REVIEW",
    reviewCount: 4,
    revision: 4,
    lastReviewedAt: null,
  });
  await createProgress({
    userId: otherUser.id,
    vocabularyId: otherVocabulary.id,
    status: "LEARNED",
    reviewCount: 9,
    revision: 9,
    lastReviewedAt: new Date("2026-09-24T00:00:00.000Z"),
  });
  const before = await prisma.lEARNING_PROGRESS.findMany({
    orderBy: { id: "asc" },
  });

  assertError(
    await http.request("/api/learning/progress"),
    401,
    "AUTHENTICATION_FAILED",
  );
  assertError(
    await http.request("/api/learning/progress", { cookie: adminCookie }),
    403,
    "FORBIDDEN",
  );

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await http.request("/api/learning/progress", {
      cookie: ownerCookie,
    });
    assert.equal(response.status, 200, response.text);
    assert.deepEqual(response.json.data.summary, {
      total_started: 3,
      learning: 1,
      learned: 1,
      needs_review: 1,
    });
    assert.deepEqual(response.json.data.pagination, {
      page: 1,
      page_size: 20,
      total_items: 3,
      total_pages: 1,
    });
    assert.deepEqual(response.json.data.filter, { status: null });
    assert.deepEqual(
      response.json.data.items.map(({ vocabulary }) => vocabulary.id),
      [learnedVocabulary.id, learningVocabulary.id, reviewVocabulary.id],
    );
    for (const item of response.json.data.items) {
      assert.deepEqual(Object.keys(item).sort(), [
        "interval_days",
        "last_reviewed_at",
        "next_review_at",
        "review_count",
        "status",
        "vocabulary",
      ]);
      assert.deepEqual(Object.keys(item.vocabulary).sort(), [
        "id",
        "phonetic",
        "word",
      ]);
      assert.equal(item.vocabulary.id === otherVocabulary.id, false);
      for (const excluded of [
        "created_at",
        "last_event_id",
        "revision",
        "user_id",
      ]) {
        assert.equal(Object.hasOwn(item, excluded), false);
      }
    }
  }

  assert.deepEqual(
    await prisma.lEARNING_PROGRESS.findMany({ orderBy: { id: "asc" } }),
    before,
  );
});

test("progress view paginates, filters and orders deterministically with an unfiltered summary", async () => {
  const vocabularies = await Promise.all(
    ["newest", "created-later", "id-later", "id-earlier", "null-date"].map(
      (name) => createVocabulary(`ordered-${name}`),
    ),
  );
  const tiedCreatedAt = new Date("2026-09-20T00:00:00.000Z");
  await Promise.all([
    createProgress({
      id: "00000000-0000-4000-8000-000000000005",
      userId: owner.id,
      vocabularyId: vocabularies[0].id,
      status: "LEARNING",
      createdAt: new Date("2026-09-21T00:00:00.000Z"),
      lastReviewedAt: new Date("2026-09-24T00:00:00.000Z"),
    }),
    createProgress({
      id: "00000000-0000-4000-8000-000000000004",
      userId: owner.id,
      vocabularyId: vocabularies[1].id,
      status: "LEARNED",
      createdAt: new Date("2026-09-22T00:00:00.000Z"),
      lastReviewedAt: new Date("2026-09-23T00:00:00.000Z"),
    }),
    createProgress({
      id: "00000000-0000-4000-8000-000000000003",
      userId: owner.id,
      vocabularyId: vocabularies[2].id,
      status: "LEARNING",
      createdAt: tiedCreatedAt,
      lastReviewedAt: new Date("2026-09-23T00:00:00.000Z"),
    }),
    createProgress({
      id: "00000000-0000-4000-8000-000000000002",
      userId: owner.id,
      vocabularyId: vocabularies[3].id,
      status: "LEARNED",
      createdAt: tiedCreatedAt,
      lastReviewedAt: new Date("2026-09-23T00:00:00.000Z"),
    }),
    createProgress({
      id: "00000000-0000-4000-8000-000000000001",
      userId: owner.id,
      vocabularyId: vocabularies[4].id,
      status: "NEEDS_REVIEW",
      createdAt: new Date("2026-09-24T00:00:00.000Z"),
      lastReviewedAt: null,
    }),
  ]);

  const firstPage = await http.request(
    "/api/learning/progress?page=1&page_size=2",
    { cookie: ownerCookie },
  );
  assert.equal(firstPage.status, 200, firstPage.text);
  assert.deepEqual(firstPage.json.data.summary, {
    total_started: 5,
    learning: 2,
    learned: 2,
    needs_review: 1,
  });
  assert.deepEqual(firstPage.json.data.pagination, {
    page: 1,
    page_size: 2,
    total_items: 5,
    total_pages: 3,
  });
  assert.deepEqual(
    firstPage.json.data.items.map(({ vocabulary }) => vocabulary.id),
    [vocabularies[0].id, vocabularies[1].id],
  );

  const secondPage = await http.request(
    "/api/learning/progress?page=2&page_size=2",
    { cookie: ownerCookie },
  );
  assert.equal(secondPage.status, 200, secondPage.text);
  assert.deepEqual(
    secondPage.json.data.items.map(({ vocabulary }) => vocabulary.id),
    [vocabularies[3].id, vocabularies[2].id],
  );

  const lastPage = await http.request(
    "/api/learning/progress?page=3&page_size=2",
    { cookie: ownerCookie },
  );
  assert.equal(lastPage.status, 200, lastPage.text);
  assert.deepEqual(
    lastPage.json.data.items.map(({ vocabulary }) => vocabulary.id),
    [vocabularies[4].id],
  );

  const learned = await http.request(
    "/api/learning/progress?page=1&page_size=1&status=LEARNED",
    { cookie: ownerCookie },
  );
  assert.equal(learned.status, 200, learned.text);
  assert.deepEqual(learned.json.data.summary, firstPage.json.data.summary);
  assert.deepEqual(learned.json.data.pagination, {
    page: 1,
    page_size: 1,
    total_items: 2,
    total_pages: 2,
  });
  assert.deepEqual(learned.json.data.filter, { status: "LEARNED" });
  assert.equal(learned.json.data.items[0].status, "LEARNED");

  const outOfRange = await http.request(
    "/api/learning/progress?page=9&page_size=2&status=NEEDS_REVIEW",
    { cookie: ownerCookie },
  );
  assert.equal(outOfRange.status, 200, outOfRange.text);
  assert.deepEqual(outOfRange.json.data.items, []);
  assert.deepEqual(outOfRange.json.data.summary, firstPage.json.data.summary);
  assert.deepEqual(outOfRange.json.data.pagination, {
    page: 9,
    page_size: 2,
    total_items: 1,
    total_pages: 1,
  });
});

test("progress view rejects malformed, repeated, unknown and unsupported queries safely", async () => {
  const invalidQueries = [
    "page=0",
    "page=-1",
    "page=1.5",
    "page=01",
    "page=9007199254740992",
    "page_size=0",
    "page_size=101",
    "status=NEW",
    "status=learned",
    "status=",
    "search=word",
    "page=1&page=2",
    "status=LEARNED&status=LEARNING",
  ];
  for (const query of invalidQueries) {
    assertError(
      await http.request(`/api/learning/progress?${query}`, {
        cookie: ownerCookie,
      }),
      400,
      "VALIDATION_ERROR",
    );
  }
  assert.equal(await testProgressCount(), 0);
});

test("progress summary, filters and items share one derived due boundary", async () => {
  const [learning, due, future, persistedReview, legacy] = await Promise.all(
    ["learning", "due", "future", "persisted-review", "legacy"].map((name) =>
      createVocabulary(`derived-${name}`),
    ),
  );
  await Promise.all([
    createProgress({ userId: owner.id, vocabularyId: learning.id, status: "LEARNING" }),
    createProgress({
      userId: owner.id,
      vocabularyId: due.id,
      status: "LEARNED",
      intervalDays: 1,
      nextReviewAt: new Date(FIXED_NOW),
    }),
    createProgress({
      userId: owner.id,
      vocabularyId: future.id,
      status: "LEARNED",
      intervalDays: 1,
      nextReviewAt: new Date(FIXED_NOW.getTime() + 1),
    }),
    createProgress({
      userId: owner.id,
      vocabularyId: persistedReview.id,
      status: "NEEDS_REVIEW",
      intervalDays: 7,
    }),
    createProgress({
      userId: owner.id,
      vocabularyId: legacy.id,
      status: "LEARNED",
      intervalDays: 2,
    }),
  ]);
  const before = await prisma.lEARNING_PROGRESS.findMany({ orderBy: { id: "asc" } });

  const all = await http.request("/api/learning/progress?page=1&page_size=20", {
    cookie: ownerCookie,
  });
  assert.equal(all.status, 200, all.text);
  assert.equal(all.json.data.evaluated_at, FIXED_NOW.toISOString());
  assert.deepEqual(all.json.data.summary, {
    total_started: 5,
    learning: 1,
    learned: 2,
    needs_review: 2,
  });
  const statusById = Object.fromEntries(
    all.json.data.items.map((item) => [item.vocabulary.id, item.status]),
  );
  assert.equal(statusById[due.id], "NEEDS_REVIEW");
  assert.equal(statusById[future.id], "LEARNED");
  assert.equal(statusById[legacy.id], "LEARNED");

  const review = await http.request(
    "/api/learning/progress?page=1&page_size=20&status=NEEDS_REVIEW",
    { cookie: ownerCookie },
  );
  assert.equal(review.status, 200, review.text);
  assert.equal(review.json.data.pagination.total_items, 2);
  assert.deepEqual(
    new Set(review.json.data.items.map((item) => item.vocabulary.id)),
    new Set([due.id, persistedReview.id]),
  );
  assert.ok(review.json.data.items.every((item) => item.status === "NEEDS_REVIEW"));
  assert.deepEqual(
    await prisma.lEARNING_PROGRESS.findMany({ orderBy: { id: "asc" } }),
    before,
  );
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
    rating: "GOOD",
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
    { ...valid, rating: "KNOWN" },
    { ...valid, expected_revision: -1 },
    { ...valid, expected_revision: 0.5 },
    { ...valid, event_id: "invalid" },
    { ...valid, user_id: owner.id },
    { ...valid, rating: undefined },
    { ...valid, outcome: "REMEMBERED", rating: undefined },
  ]) {
    assertError(await postEvent(ownerCookie, invalid), 400, "VALIDATION_ERROR");
  }
  assert.equal(await testProgressCount(), 0);
});

test("all four ratings persist authoritative scheduler fields", async () => {
  const vocabularies = await Promise.all(
    ["again", "hard", "good", "easy"].map((name) => createVocabulary(`rating-${name}`)),
  );
  const set = await createSet({
    ownerId: admin.id,
    isPublic: true,
    vocabularyIds: vocabularies.map(({ id }) => id),
  });
  const expectations = [
    ["AGAIN", "LEARNING", 0, null, FIXED_NOW],
    ["HARD", "LEARNED", 1, 1, new Date(FIXED_NOW.getTime() + 86_400_000)],
    ["GOOD", "LEARNED", 2, 3, new Date(FIXED_NOW.getTime() + 3 * 86_400_000)],
    ["EASY", "LEARNED", 3, 7, new Date(FIXED_NOW.getTime() + 7 * 86_400_000)],
  ];

  for (let index = 0; index < expectations.length; index += 1) {
    const [rating, status, stage, intervalDays, nextReviewAt] = expectations[index];
    const response = await postEvent(ownerCookie, eventBody({
      setId: set.id,
      vocabularyId: vocabularies[index].id,
      rating,
    }));
    assertProgress(response, { status, reviewCount: 1, revision: 1 });
    assert.equal(response.json.data.vocabulary_id, vocabularies[index].id);
    assert.equal(response.json.data.stage, stage);
    assert.equal(response.json.data.interval_days, intervalDays);
    assert.equal(response.json.data.next_review_at, nextReviewAt.toISOString());
    const persisted = await findProgress(owner.id, vocabularies[index].id);
    assert.equal(persisted.status, status);
    assert.equal(persisted.interval_days, intervalDays);
    assert.equal(persisted.next_review_at.toISOString(), nextReviewAt.toISOString());
    assert.equal(persisted.last_reviewed_at.toISOString(), FIXED_NOW.toISOString());
    assert.equal(persisted.ease_factor, null);
  }
});

test("future scheduled progress rejects a new event but current-event retry remains idempotent", async () => {
  const vocabulary = await createVocabulary("future-conflict");
  const set = await createSet({
    ownerId: admin.id,
    isPublic: true,
    vocabularyIds: [vocabulary.id],
  });
  const accepted = eventBody({
    setId: set.id,
    vocabularyId: vocabulary.id,
    rating: "GOOD",
  });
  const first = await postEvent(ownerCookie, accepted);
  assert.equal(first.status, 200, first.text);
  const before = await findProgress(owner.id, vocabulary.id);

  const retry = await postEvent(ownerCookie, { ...accepted, rating: "EASY" });
  assert.equal(retry.status, 200, retry.text);
  assert.deepEqual(retry.json.data, first.json.data);
  assert.deepEqual(await findProgress(owner.id, vocabulary.id), before);

  assertError(
    await postEvent(ownerCookie, {
      ...accepted,
      event_id: randomUUID(),
      expected_revision: 1,
    }),
    409,
    "LEARNING_PROGRESS_CHANGED",
  );
  assert.deepEqual(await findProgress(owner.id, vocabulary.id), before);
});

test("meaningful ratings transition progress once with retry and stale revision protection", async () => {
  const vocabulary = await createVocabulary("transitions");
  const set = await createSet({
    ownerId: admin.id,
    isPublic: true,
    vocabularyIds: [vocabulary.id],
  });
  const first = eventBody({
    setId: set.id,
    vocabularyId: vocabulary.id,
    rating: "AGAIN",
  });
  let response = await postEvent(ownerCookie, first);
  assertProgress(response, { status: "LEARNING", reviewCount: 1, revision: 1 });
  const firstResult = response.json.data;
  response = await postEvent(ownerCookie, first);
  assert.deepEqual(response.json.data, firstResult);

  assertError(
    await postEvent(ownerCookie, { ...first, event_id: randomUUID() }),
    409,
    "LEARNING_PROGRESS_CHANGED",
  );
  response = await postEvent(ownerCookie, { ...first, rating: "EASY" });
  assert.deepEqual(response.json.data, firstResult);

  const second = {
    ...first,
    event_id: randomUUID(),
    expected_revision: 1,
    rating: "GOOD",
  };
  response = await postEvent(ownerCookie, second);
  assertProgress(response, { status: "LEARNED", reviewCount: 2, revision: 2 });
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
  assert.equal(persisted.next_review_at.toISOString(), "2026-10-07T03:15:00.000Z");
  assert.equal(persisted.interval_days, 3);
  assert.equal(persisted.ease_factor, null);
});

test("AGAIN stays immediately eligible until a later passing rating resolves it", async () => {
  const vocabulary = await createVocabulary("again-lifecycle");
  const set = await createSet({
    ownerId: admin.id,
    isPublic: true,
    vocabularyIds: [vocabulary.id],
  });
  const again = eventBody({
    setId: set.id,
    vocabularyId: vocabulary.id,
    rating: "AGAIN",
  });

  let response = await postEvent(ownerCookie, again);
  assertProgress(response, { status: "LEARNING", reviewCount: 1, revision: 1 });
  let persisted = await findProgress(owner.id, vocabulary.id);
  assert.equal(persisted.status, "LEARNING");
  assert.equal(persisted.interval_days, null);
  assert.equal(persisted.next_review_at.toISOString(), FIXED_NOW.toISOString());
  assert.equal(persisted.last_reviewed_at.toISOString(), FIXED_NOW.toISOString());
  assert.equal(persisted.last_event_id, again.event_id);

  response = await http.request(`/api/learning/sets/${set.id}?mode=SRS`, {
    cookie: ownerCookie,
  });
  assert.equal(response.status, 200, response.text);
  assert.equal(response.json.data.eligible_count, 1);
  assert.equal(response.json.data.cards[0].id, vocabulary.id);
  assert.equal(response.json.data.cards[0].progress.status, "LEARNING");
  assert.equal(response.json.data.cards[0].progress.revision, 1);

  const good = eventBody({
    setId: set.id,
    vocabularyId: vocabulary.id,
    expectedRevision: 1,
    rating: "GOOD",
  });
  response = await postEvent(ownerCookie, good);
  assertProgress(response, { status: "LEARNED", reviewCount: 2, revision: 2 });
  persisted = await findProgress(owner.id, vocabulary.id);
  assert.equal(persisted.status, "LEARNED");
  assert.equal(persisted.interval_days, 3);
  assert.equal(
    persisted.next_review_at.toISOString(),
    "2026-10-07T03:15:00.000Z",
  );
  assert.equal(persisted.last_reviewed_at.toISOString(), FIXED_NOW.toISOString());
  assert.equal(persisted.last_event_id, good.event_id);

  response = await http.request(`/api/learning/sets/${set.id}?mode=SRS`, {
    cookie: ownerCookie,
  });
  assert.equal(response.status, 200, response.text);
  assert.equal(response.json.data.eligible_count, 0);
  assert.deepEqual(response.json.data.cards, []);
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
    rating: "GOOD",
  });
  assertError(await postEvent(otherCookie, body), 404, "LEARNING_SET_NOT_FOUND");
  assert.equal(await testProgressCount(), 0);
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
    rating: "GOOD",
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
      rating: "AGAIN",
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
      if (property === "$transaction") {
        return async () => {
          throw new Error(sensitiveValues.join(" | "));
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

    const progressResponse = await failingHttp.request("/api/learning/progress", {
      cookie: ownerCookie,
    });
    assert.equal(progressResponse.status, 500);
    assert.deepEqual(progressResponse.json, {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred.",
      },
    });
    for (const value of sensitiveValues) {
      assert.equal(progressResponse.text.includes(value), false);
    }
  } finally {
    await failingHttp.close();
  }
});

async function cleanupLearningSuiteFixtures() {
  const users = await prisma.uSER.findMany({
    where: { email: { startsWith: TEST_PREFIX } },
    select: { id: true },
  });
  const userIds = users.map(({ id }) => id);
  const sets = await prisma.vOCABULARY_SET.findMany({
    where: {
      OR: [
        { name: { startsWith: TEST_PREFIX } },
        ...(userIds.length > 0 ? [{ owner_id: { in: userIds } }] : []),
      ],
    },
    select: { id: true },
  });
  const setIds = sets.map(({ id }) => id);
  const vocabularies = await prisma.vOCABULARY.findMany({
    where: {
      OR: [
        { word: { startsWith: TEST_PREFIX } },
        ...(userIds.length > 0 ? [{ owner_id: { in: userIds } }] : []),
      ],
    },
    select: { id: true },
  });
  const vocabularyIds = vocabularies.map(({ id }) => id);

  await prisma.$transaction(async (transaction) => {
    await transaction.pRIVATE_VOCABULARY_CREATE_OPERATION.deleteMany({
      where: {
        OR: [
          ...(userIds.length > 0 ? [{ owner_id: { in: userIds } }] : []),
          ...(setIds.length > 0 ? [{ vocabulary_set_id: { in: setIds } }] : []),
          ...(vocabularyIds.length > 0 ? [{ vocabulary_id: { in: vocabularyIds } }] : []),
        ],
      },
    });
    await transaction.lEARNING_PROGRESS.deleteMany({
      where: {
        OR: [
          ...(userIds.length > 0 ? [{ user_id: { in: userIds } }] : []),
          ...(vocabularyIds.length > 0 ? [{ vocabulary_id: { in: vocabularyIds } }] : []),
        ],
      },
    });
    if (userIds.length > 0) {
      await transaction.aUTH_SESSION.deleteMany({ where: { user_id: { in: userIds } } });
    }
    if (setIds.length > 0) {
      await transaction.vOCABULARY_SET_ITEM.deleteMany({ where: { vocabulary_set_id: { in: setIds } } });
      await transaction.vOCABULARY_SET.deleteMany({ where: { id: { in: setIds } } });
    }
    if (vocabularyIds.length > 0) {
      await transaction.vOCABULARY.deleteMany({ where: { id: { in: vocabularyIds } } });
    }
    await transaction.tOPIC.deleteMany({
      where: { name: { startsWith: TEST_PREFIX }, vocabulary_sets: { none: {} } },
    });
    if (userIds.length > 0) {
      await transaction.uSER.deleteMany({ where: { id: { in: userIds } } });
    }
  }, { maxWait: 30_000, timeout: 120_000 });
}

function testProgressCount() {
  return prisma.lEARNING_PROGRESS.count({
    where: { user_id: { in: [admin.id, owner.id, otherUser.id] } },
  });
}

async function createVocabulary(prefix, { nested = false } = {}) {
  const vocabulary = await prisma.vOCABULARY.create({
    data: {
      word: `${TEST_PREFIX}-${prefix}-${randomUUID()}`,
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
      topic_id: isPublic ? topic.id : null,
      name: `${TEST_PREFIX} set ${randomUUID()}`,
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
  rating,
}) {
  return {
    event_id: eventId,
    set_id: setId,
    vocabulary_id: vocabularyId,
    expected_revision: expectedRevision,
    rating,
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

function createProgress({
  id,
  userId,
  vocabularyId,
  status,
  reviewCount = 1,
  revision = 1,
  lastReviewedAt,
  createdAt,
  intervalDays,
  nextReviewAt,
}) {
  return prisma.lEARNING_PROGRESS.create({
    data: {
      ...(id ? { id } : {}),
      user_id: userId,
      vocabulary_id: vocabularyId,
      status,
      review_count: reviewCount,
      revision,
      last_reviewed_at: lastReviewedAt,
      ...(intervalDays !== undefined ? { interval_days: intervalDays } : {}),
      ...(nextReviewAt !== undefined ? { next_review_at: nextReviewAt } : {}),
      ...(createdAt ? { created_at: createdAt } : {}),
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
