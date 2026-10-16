import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { createApp } from "../../src/create-app.js";
import { createSessionFixture, createUserFixture } from "../helpers/auth-fixtures.js";
import { createTestDatabase } from "../helpers/test-database.js";
import { startHttpTestServer } from "../helpers/http-test-server.js";

let database, prisma, http, admin, owner, otherUser, topic;
let adminCookie, ownerCookie;
before(async () => { database = await createTestDatabase(); prisma = database.prisma; http = await startHttpTestServer(createApp({ prisma })); });
beforeEach(async () => {
  await database.reset();
  admin = await createUserFixture(prisma, { role: "ADMIN" });
  owner = await createUserFixture(prisma, { role: "USER" });
  otherUser = await createUserFixture(prisma, { role: "USER" });
  adminCookie = await sessionCookie(admin.id); ownerCookie = await sessionCookie(owner.id);
  topic = await prisma.tOPIC.create({ data: { name: `Quiz ${randomUUID()}` } });
});
afterEach(async () => database.reset());
after(async () => { try { if (database) await database.reset(); } finally { try { if (http) await http.close(); } finally { if (database) await database.disconnect(); } } });

test("Quiz API is USER-only and conceals foreign private Sets", async () => {
  const words = await createChoicePool();
  const publicSet = await createSet(admin.id, true, [words[0].id]);
  const ownedSet = await createSet(owner.id, false, words.slice(0, 2).map(({ id }) => id));
  const foreignSet = await createSet(otherUser.id, false, [words[0].id]);
  const runId = randomUUID();
  assertError(await getQuestions(publicSet.id, runId), 401, "AUTHENTICATION_FAILED");
  assertError(await getQuestions(publicSet.id, runId, adminCookie), 403, "FORBIDDEN");
  assert.equal((await getQuestions(publicSet.id, runId, ownerCookie)).status, 200);
  assert.equal((await getQuestions(ownedSet.id, runId, ownerCookie)).status, 200);
  assertError(await getQuestions(foreignSet.id, runId, ownerCookie), 404, "QUIZ_SET_NOT_FOUND");
  assertError(await getQuestions(publicSet.id, runId, ownerCookie, "VI_TO_ENGLISH"), 400, "QUIZ_VALIDATION_ERROR");
});

test("questions retain Set order, expose four opaque deterministic choices, and never write Progress", async () => {
  const words = await createChoicePool();
  const set = await createSet(admin.id, true, [words[1].id, words[0].id]);
  const runId = randomUUID();
  const before = await progressSnapshot();
  const first = await getQuestions(set.id, runId, ownerCookie);
  const retry = await getQuestions(set.id, runId, ownerCookie);
  assert.equal(first.status, 200, first.text); assert.deepEqual(first.json, retry.json);
  assert.deepEqual(first.json.data.questions.map(({ vocabulary_id, position }) => [vocabulary_id, position]), [[words[1].id, 1], [words[0].id, 2]]);
  for (const question of first.json.data.questions) {
    assert.equal(question.choices.length, 4);
    assert.equal(new Set(question.choices.map(({ choice_id }) => choice_id)).size, 4);
    assert.equal(new Set(question.choices.map(({ label }) => label.toLocaleLowerCase("vi"))).size, 4);
    assertNoAnswerLeak(question);
  }
  assert.deepEqual(await progressSnapshot(), before);
});

test("bounded question reads accept 1 and 10 distinct IDs in requested order without writing Progress", async () => {
  const words = await Promise.all(Array.from({ length: 10 }, (_, index) =>
    createVocabulary(`bounded-${index}-${randomUUID()}`, `bounded meaning ${index}`)));
  const set = await createSet(admin.id, true, words.map(({ id }) => id));
  const before = await progressSnapshot();
  const one = await getBoundedQuestions(set.id, randomUUID(), [words[4].id], ownerCookie);
  assert.equal(one.status, 200, one.text);
  assert.deepEqual(one.json.data.questions.map(({ vocabulary_id }) => vocabulary_id), [words[4].id]);
  const requested = words.map(({ id }) => id).reverse();
  const ten = await getBoundedQuestions(set.id, randomUUID(), requested, ownerCookie);
  assert.equal(ten.status, 200, ten.text);
  assert.deepEqual(ten.json.data.questions.map(({ vocabulary_id }) => vocabulary_id), requested);
  assert.equal(Object.hasOwn(ten.json.data, "removed_vocabulary_ids"), false);
  assert.deepEqual(await progressSnapshot(), before);
});

test("bounded question query validation returns exact safe 400 envelopes", async () => {
  const words = await Promise.all(Array.from({ length: 11 }, (_, index) =>
    createVocabulary(`validation-${index}-${randomUUID()}`, `validation meaning ${index}`)));
  const set = await createSet(admin.id, true, words.map(({ id }) => id));
  const base = `/api/quiz/sets/${set.id}/questions?type=MULTIPLE_CHOICE&run_id=${randomUUID()}`;
  const encoded = words.map(({ id }) => id).join("%2C");
  for (const path of [
    `${base}&vocabulary_ids=`,
    `${base}&vocabulary_ids=not-a-uuid`,
    `${base}&vocabulary_ids=${words[0].id}%2C${words[0].id}`,
    `${base}&vocabulary_ids=${encoded}`,
    `${base}&vocabulary_ids=${words[0].id}&vocabulary_ids=${words[1].id}`,
    `${base}&vocabulary_ids=${words[0].id}&unsupported=true`,
  ]) assertSafeError(await http.request(path, { cookie: ownerCookie }), 400, "QUIZ_VALIDATION_ERROR", "Quiz request data is invalid.");
});

test("bounded authorization conceals Sets and rejects all changed membership atomically", async () => {
  const pool = await createChoicePool();
  const validSet = await createSet(admin.id, true, pool.slice(0, 4).map(({ id }) => id));
  const foreignSet = await createSet(otherUser.id, false, [pool[0].id]);
  const otherSetWord = await createVocabulary(`other-set-${randomUUID()}`, "other set meaning");
  await createSet(admin.id, true, [otherSetWord.id]);
  const privateWord = await createVocabulary(`private-${randomUUID()}`, "private meaning", otherUser.id);
  const removedWord = await createVocabulary(`removed-${randomUUID()}`, "removed meaning");
  const removedSet = await createSet(admin.id, true, [removedWord.id, ...pool.slice(0, 3).map(({ id }) => id)]);
  await prisma.vOCABULARY_SET_ITEM.deleteMany({ where: { vocabulary_set_id: removedSet.id, vocabulary_id: removedWord.id } });
  assertSafeError(await getBoundedQuestions(randomUUID(), randomUUID(), [privateWord.id], ownerCookie), 404, "QUIZ_SET_NOT_FOUND", "Quiz set was not found.");
  assertSafeError(await getBoundedQuestions(foreignSet.id, randomUUID(), [pool[0].id], ownerCookie), 404, "QUIZ_SET_NOT_FOUND", "Quiz set was not found.");
  for (const id of [privateWord.id, otherSetWord.id]) {
    assertSafeError(await getBoundedQuestions(validSet.id, randomUUID(), [id], ownerCookie), 409, "QUIZ_ITEM_CHANGED", "Quiz vocabulary is no longer available. Refresh before trying again.");
  }
  assertSafeError(await getBoundedQuestions(removedSet.id, randomUUID(), [removedWord.id], ownerCookie), 409, "QUIZ_ITEM_CHANGED", "Quiz vocabulary is no longer available. Refresh before trying again.");
  const mixed = await getBoundedQuestions(validSet.id, randomUUID(), [pool[0].id, otherSetWord.id], ownerCookie);
  assertSafeError(mixed, 409, "QUIZ_ITEM_CHANGED", "Quiz vocabulary is no longer available. Refresh before trying again.");
  assert.equal(mixed.json?.data, undefined);
  assert.equal(JSON.stringify(mixed.json).includes(otherSetWord.id), false);
  assert.deepEqual(await progressSnapshot(), []);
});

test("bounded reads reject ineligible questions and unavailable choices atomically", async () => {
  const pool = await createChoicePool();
  const ineligible = await prisma.vOCABULARY.create({ data: { word: `ineligible-${randomUUID()}` } });
  const mixedSet = await createSet(admin.id, true, [pool[0].id, ineligible.id, ...pool.slice(1, 4).map(({ id }) => id)]);
  const mixed = await getBoundedQuestions(mixedSet.id, randomUUID(), [pool[0].id, ineligible.id], ownerCookie);
  assertSafeError(mixed, 409, "QUIZ_ITEM_CHANGED", "Quiz vocabulary is no longer available. Refresh before trying again.");
  assert.equal(mixed.json?.data, undefined);
  await database.reset();
  admin = await createUserFixture(prisma, { role: "ADMIN" });
  owner = await createUserFixture(prisma, { role: "USER" });
  adminCookie = await sessionCookie(admin.id); ownerCookie = await sessionCookie(owner.id);
  topic = await prisma.tOPIC.create({ data: { name: `Quiz ${randomUUID()}` } });
  const only = await createVocabulary(`only-${randomUUID()}`, "only safe meaning");
  const tooSmall = await createSet(admin.id, true, [only.id]);
  const unavailable = await getBoundedQuestions(tooSmall.id, randomUUID(), [only.id], ownerCookie);
  assertSafeError(unavailable, 409, "QUIZ_CHOICES_UNAVAILABLE", "Four distinct Quiz choices are not currently available.");
  assert.equal(unavailable.json?.data, undefined);
  assert.deepEqual(await progressSnapshot(), []);
});

test("legacy no-filter question reads remain compatible and read-only", async () => {
  const words = await createChoicePool();
  const set = await createSet(admin.id, true, [words[2].id, words[0].id]);
  const response = await getQuestions(set.id, randomUUID(), ownerCookie);
  assert.equal(response.status, 200, response.text);
  assert.deepEqual(response.json.data.questions.map(({ vocabulary_id }) => vocabulary_id), [words[2].id, words[0].id]);
  assert.deepEqual(await progressSnapshot(), []);
});

test("canonical fallback distractors never become questions or Progress targets and exclude foreign-private data", async () => {
  const words = await createChoicePool();
  await createVocabulary("private foreign", "riêng tư", otherUser.id);
  const set = await createSet(owner.id, false, [words[0].id]);
  const runId = randomUUID();
  const response = await getQuestions(set.id, runId, ownerCookie);
  assert.equal(response.status, 200, response.text);
  const question = response.json.data.questions[0];
  assert.deepEqual(response.json.data.questions.map(({ vocabulary_id }) => vocabulary_id), [words[0].id]);
  assert.equal(question.choices.some(({ label }) => label === "riêng tư"), false);
  const correct = question.choices.find(({ label }) => label === words[0].meaning);
  const graded = await postAnswer(answerBody(question, set.id, runId, correct.choice_id), ownerCookie);
  assert.equal(graded.status, 200, graded.text); assert.equal(graded.json.data.is_correct, true);
  const progress = await prisma.lEARNING_PROGRESS.findMany({ where: { user_id: owner.id } });
  assert.equal(progress.length, 1); assert.equal(progress[0].vocabulary_id, words[0].id);
});

test("grading is idempotent and rejects stale or tampered submissions", async () => {
  const words = await createChoicePool();
  const set = await createSet(admin.id, true, [words[0].id]);
  const runId = randomUUID();
  const question = (await getQuestions(set.id, runId, ownerCookie)).json.data.questions[0];
  const wrong = question.choices.find(({ label }) => label !== words[0].meaning);
  const body = answerBody(question, set.id, runId, wrong.choice_id);
  assert.equal((await postAnswer(body, ownerCookie)).status, 200);
  assert.equal((await postAnswer(body, ownerCookie)).status, 200);
  assertError(await postAnswer({ ...body, event_id: randomUUID() }, ownerCookie), 409, "QUIZ_PROGRESS_CONFLICT");
  assertError(await postAnswer({ ...body, event_id: randomUUID(), selected_choice_id: "A".repeat(43), expected_revision: 1 }, ownerCookie), 409, "QUIZ_CHOICE_CHANGED");
  const progress = await findProgress(owner.id, words[0].id);
  assert.deepEqual([progress.status, progress.review_count, progress.revision], ["LEARNING", 1, 1]);
  assert.equal(progress.next_review_at, null); assert.equal(progress.interval_days, null); assert.equal(progress.ease_factor, null);
});

test("concurrent answers at one revision create exactly one Progress mutation", async () => {
  const words = await createChoicePool();
  const set = await createSet(admin.id, true, [words[0].id]);
  const runId = randomUUID();
  const question = (await getQuestions(set.id, runId, ownerCookie)).json.data.questions[0];
  const responses = await Promise.all([
    postAnswer(answerBody(question, set.id, runId, question.choices[0].choice_id), ownerCookie),
    postAnswer(answerBody(question, set.id, runId, question.choices[1].choice_id), ownerCookie),
  ]);
  assert.deepEqual(responses.map(({ status }) => status).sort(), [200, 409]);
  const progress = await findProgress(owner.id, words[0].id);
  assert.deepEqual([progress.review_count, progress.revision], [1, 1]);
});

async function sessionCookie(userId) { const session = await createSessionFixture(prisma, userId); return `session_id=${session.rawToken}`; }
function createChoicePool() { return Promise.all([["wake", "thức dậy"], ["sleep", "ngủ"], ["eat", "ăn"], ["walk", "đi bộ"], ["read", "đọc"]].map(([word, meaning]) => createVocabulary(`${word}-${randomUUID()}`, meaning))); }
async function createVocabulary(word, meaning, ownerId = null) { const row = await prisma.vOCABULARY.create({ data: { owner_id: ownerId, word, meanings: { create: [{ part_of_speech: "verb", meaning_vi: meaning, cefr_level: "A1" }] } } }); return { ...row, meaning }; }
function createSet(ownerId, isPublic, ids) { return prisma.vOCABULARY_SET.create({ data: { owner_id: ownerId, topic_id: isPublic ? topic.id : null, name: `Quiz Set ${randomUUID()}`, is_public: isPublic, items: { create: ids.map((vocabularyId, position) => ({ vocabulary_id: vocabularyId, position: position + 1 })) } } }); }
function getQuestions(setId, runId, cookie, type = "MULTIPLE_CHOICE") { return http.request(`/api/quiz/sets/${setId}/questions?type=${type}&run_id=${runId}`, { cookie }); }
function getBoundedQuestions(setId, runId, vocabularyIds, cookie) { const ids = vocabularyIds.map(encodeURIComponent).join("%2C"); return http.request(`/api/quiz/sets/${setId}/questions?type=MULTIPLE_CHOICE&run_id=${runId}&vocabulary_ids=${ids}`, { cookie }); }
function answerBody(question, setId, runId, choiceId, eventId = randomUUID()) { return { event_id: eventId, set_id: setId, vocabulary_id: question.vocabulary_id, run_id: runId, question_revision: question.question_revision, quiz_type: "MULTIPLE_CHOICE", expected_revision: question.progress.revision, selected_choice_id: choiceId }; }
function postAnswer(json, cookie) { return http.request("/api/quiz/answers", { method: "POST", json, cookie }); }
function findProgress(userId, vocabularyId) { return prisma.lEARNING_PROGRESS.findUnique({ where: { user_id_vocabulary_id: { user_id: userId, vocabulary_id: vocabularyId } } }); }
function progressSnapshot() { return prisma.lEARNING_PROGRESS.findMany({ orderBy: { id: "asc" } }); }
function assertNoAnswerLeak(question) { const serialized = JSON.stringify(question); for (const field of ["correct_choice_id", "is_correct", "normalized_answer"]) assert.equal(serialized.includes(`\"${field}\"`), false, `${field} leaked`); }
function assertError(response, status, code) { assert.equal(response.status, status, response.text); assert.equal(response.json?.error?.code, code); }
function assertSafeError(response, status, code, message) { assert.equal(response.status, status, response.text); assert.deepEqual(response.json, { success: false, error: { code, message } }); }
