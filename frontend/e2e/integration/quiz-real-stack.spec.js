import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { PrismaClient } from "../../../backend/src/generated/prisma/client.ts";
import { hashPassword } from "../../../backend/src/utils/password-security.js";
import { configureTestEnvironment } from "../../../backend/test/helpers/test-environment.js";

configureTestEnvironment({ requireReset: true });
const prisma = new PrismaClient();
const run = randomUUID();
const prefix = `E2E-Quiz-${run}`;
const domain = `${run}.quiz.integration.test`;
const password = `Safe-${randomUUID()}`;
const learner = account("learner", "USER"), administrator = account("admin", "ADMIN"), outsider = account("outsider", "USER");
const created = { userIds: [], vocabularyIds: [], setIds: [], topicId: null };
let learnerRecord, adminRecord, outsiderRecord, systemSet, ownedSet, foreignSet, systemWords, ownedWords;

test.describe.configure({ mode: "serial" });
test.beforeAll(async () => {
  await prisma.$connect(); const passwordHash = await hashPassword(password);
  learnerRecord = await createUser(learner, passwordHash); adminRecord = await createUser(administrator, passwordHash); outsiderRecord = await createUser(outsider, passwordHash);
  const topic = await prisma.tOPIC.create({ data: { name: `${prefix} Topic` } }); created.topicId = topic.id;
  const unique = run.replaceAll("-", "").slice(0, 10);
  systemWords = [await createVocabulary(`quiz${unique}wake`, "thức dậy"), await createVocabulary(`quiz${unique}travel`, "du lịch")];
  ownedWords = [await createVocabulary(`quiz${unique}sleep`, "ngủ"), await createVocabulary(`quiz${unique}eat`, "ăn")];
  systemSet = await createSet(adminRecord.id, true, "System", systemWords);
  ownedSet = await createSet(learnerRecord.id, false, "Owned", ownedWords);
  foreignSet = await createSet(outsiderRecord.id, false, "Foreign", systemWords);
});
test.afterEach(async () => { if (created.userIds.length && created.vocabularyIds.length) await prisma.lEARNING_PROGRESS.deleteMany({ where: { user_id: { in: created.userIds }, vocabulary_id: { in: created.vocabularyIds } } }); });
test.afterAll(async () => { try { await targetedCleanup(); } finally { await prisma.$disconnect(); } });

test("USER completes ordered Multiple Choice questions through authoritative Progress mutations", async ({ page }) => {
  await login(page, learner); await page.goto(`/quiz/vocabulary-sets/${systemSet.id}`);
  await expect(page.getByRole("heading", { name: systemWords[0].word })).toBeFocused();
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  await page.getByRole("radio", { name: /thức dậy/ }).check();
  await page.getByRole("button", { name: "Kiểm tra đáp án" }).press("Enter");
  await expect(page.getByRole("heading", { name: "Chính xác" })).toBeFocused();
  await expectProgress(learnerRecord.id, systemWords[0].id, "LEARNED", 1, 1);
  await page.getByRole("button", { name: "Câu tiếp theo" }).click();
  await expect(page.getByRole("heading", { name: systemWords[1].word })).toBeFocused();
  await page.getByRole("radio", { name: /thức dậy/ }).check();
  await page.getByRole("button", { name: "Kiểm tra đáp án" }).click();
  await expect(page.getByRole("heading", { name: "Chưa chính xác" })).toBeVisible();
  await expectProgress(learnerRecord.id, systemWords[1].id, "LEARNING", 1, 1);
  await page.getByRole("button", { name: "Xem kết quả" }).click();
  await expect(page.getByRole("heading", { name: "Hoàn thành Quiz" })).toBeFocused();
  const beforeRestart = await progressSnapshot(learnerRecord.id);
  await page.getByRole("button", { name: "Bắt đầu lại" }).click();
  await expect(page.getByRole("heading", { name: systemWords[0].word })).toBeFocused();
  expect(await progressSnapshot(learnerRecord.id)).toEqual(beforeRestart);
});

test("choices are opaque, deterministic and responsive without adding distractor Progress", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" }); await page.setViewportSize({ width: 390, height: 844 }); await login(page, learner);
  const response = page.waitForResponse((item) => item.url().includes(`/api/quiz/sets/${ownedSet.id}/questions`) && item.status() === 200);
  await page.goto(`/quiz/vocabulary-sets/${ownedSet.id}`); const payload = await (await response).json();
  expect(payload.data.quiz_type).toBe("MULTIPLE_CHOICE"); expect(payload.data.questions).toHaveLength(2);
  for (const question of payload.data.questions) {
    expect(question.choices).toHaveLength(4);
    expect(new Set(question.choices.map(({ choice_id }) => choice_id)).size).toBe(4);
    expect(JSON.stringify(question)).not.toContain("correct_choice_id");
  }
  const reload = page.waitForResponse((item) => item.url().includes(`/api/quiz/sets/${ownedSet.id}/questions`) && item.status() === 200);
  await page.reload(); expect((await (await reload).json()).data.questions).toEqual(payload.data.questions);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  for (const radio of await page.getByRole("radio").all()) expect((await radio.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await expect(page.getByRole("progressbar").locator("span")).toHaveCSS("transition-duration", "0s");
  expect(await progressSnapshot(learnerRecord.id)).toEqual([]);
});

test("Guest, ADMIN, foreign private access and read-only navigation create no Progress", async ({ page }) => {
  const before = await progressSnapshot(learnerRecord.id);
  await page.goto(`/quiz/vocabulary-sets/${systemSet.id}`); await expect(page).toHaveURL(/\/login$/);
  await login(page, administrator); await page.goto(`/quiz/vocabulary-sets/${systemSet.id}`); await expect(page).toHaveURL(/\/dashboard$/); await logoutThroughApi(page);
  await login(page, learner); await page.goto(`/quiz/vocabulary-sets/${foreignSet.id}`); await expect(page.getByRole("heading", { name: "Không thể mở Quiz" })).toBeVisible();
  await page.goto(`/quiz/vocabulary-sets/${systemSet.id}`); await expect(page.getByRole("heading", { name: systemWords[0].word })).toBeVisible();
  await page.getByRole("button", { name: "Quay lại" }).first().click(); await expect(page).toHaveURL(new RegExp(`/vocabulary-sets/${systemSet.id}$`));
  expect(await progressSnapshot(learnerRecord.id)).toEqual(before);
});

function account(name, role) { return { email: `${name}@${domain}`, display_name: `Quiz ${name}`, role, is_active: true }; }
async function createUser(data, passwordHash) { const user = await prisma.uSER.create({ data: { ...data, password_hash: passwordHash } }); created.userIds.push(user.id); return user; }
async function createVocabulary(word, meaning) { const vocabulary = await prisma.vOCABULARY.create({ data: { word, meanings: { create: [{ part_of_speech: "verb", meaning_vi: meaning, cefr_level: "A1" }] } } }); created.vocabularyIds.push(vocabulary.id); return { ...vocabulary, meaning }; }
async function createSet(ownerId, isPublic, suffix, words) { const set = await prisma.vOCABULARY_SET.create({ data: { owner_id: ownerId, topic_id: isPublic ? created.topicId : null, name: `${prefix} ${suffix}`, is_public: isPublic, items: { create: words.map(({ id }, index) => ({ vocabulary_id: id, position: index + 1 })) } } }); created.setIds.push(set.id); return set; }
async function login(page, data) { await page.goto("/login"); await page.locator("#login-email").fill(data.email); await page.locator("#login-password").fill(password); await page.locator('form button[type="submit"]').click(); await expect(page).toHaveURL(/\/dashboard$/); }
async function logoutThroughApi(page) { await page.request.post("/api/auth/logout"); await page.goto("/login"); }
async function expectProgress(userId, vocabularyId, status, reviewCount, revision) { await expect.poll(async () => prisma.lEARNING_PROGRESS.findUnique({ where: { user_id_vocabulary_id: { user_id: userId, vocabulary_id: vocabularyId } } })).toMatchObject({ status, review_count: reviewCount, revision }); }
function progressSnapshot(userId) { return prisma.lEARNING_PROGRESS.findMany({ where: { user_id: userId }, orderBy: { vocabulary_id: "asc" } }); }
async function targetedCleanup() { if (created.userIds.length) { await prisma.lEARNING_PROGRESS.deleteMany({ where: { user_id: { in: created.userIds } } }); await prisma.aUTH_SESSION.deleteMany({ where: { user_id: { in: created.userIds } } }); } if (created.setIds.length) await prisma.vOCABULARY_SET.deleteMany({ where: { id: { in: created.setIds } } }); if (created.vocabularyIds.length) await prisma.vOCABULARY.deleteMany({ where: { id: { in: created.vocabularyIds } } }); if (created.topicId) await prisma.tOPIC.deleteMany({ where: { id: created.topicId } }); if (created.userIds.length) await prisma.uSER.deleteMany({ where: { id: { in: created.userIds } } }); }
