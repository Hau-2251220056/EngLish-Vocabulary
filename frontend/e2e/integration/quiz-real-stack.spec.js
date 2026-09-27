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
const learner = account("learner", "USER");
const administrator = account("admin", "ADMIN");
const outsider = account("outsider", "USER");
const created = { userIds: [], vocabularyIds: [], setIds: [], topicId: null };

let learnerRecord;
let adminRecord;
let outsiderRecord;
let systemSet;
let ownedSet;
let foreignSet;
let systemWords;
let ownedWords;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await prisma.$connect();
  const passwordHash = await hashPassword(password);
  learnerRecord = await createUser(learner, passwordHash);
  adminRecord = await createUser(administrator, passwordHash);
  outsiderRecord = await createUser(outsider, passwordHash);
  const topic = await prisma.tOPIC.create({ data: { name: `${prefix} Topic` } });
  created.topicId = topic.id;

  const unique = run.replaceAll("-", "").slice(0, 10);
  const identityCharacter = String.fromCodePoint(0x4e00 + Number.parseInt(run.slice(0, 4), 16) % 15000);
  systemWords = [
    await createVocabulary(`quiz${unique}book`, "quyển sách kiểm thử"),
    await createVocabulary(`quiz${unique}travel`, "du lịch kiểm thử"),
  ];
  ownedWords = [
    await createVocabulary(`book-case-${unique}`, "từ ghép có ký tự lặp"),
    await createVocabulary(`${identityCharacter}-${identityCharacter}'${identityCharacter} ${identityCharacter}.${identityCharacter}`, "ký tự đồng nhất"),
  ];
  systemSet = await createSet(adminRecord.id, true, "System", systemWords);
  ownedSet = await createSet(learnerRecord.id, false, "Owned", ownedWords);
  foreignSet = await createSet(outsiderRecord.id, false, "Foreign", systemWords);
});

test.afterEach(async () => {
  if (created.userIds.length && created.vocabularyIds.length) {
    await prisma.lEARNING_PROGRESS.deleteMany({
      where: {
        user_id: { in: created.userIds },
        vocabulary_id: { in: created.vocabularyIds },
      },
    });
  }
});

test.afterAll(async () => {
  try {
    await targetedCleanup();
  } finally {
    await prisma.$disconnect();
  }
});

test("USER completes ordered public VI_TO_ENGLISH through authoritative Progress mutations", async ({ page }) => {
  await login(page, learner);
  await page.goto(`/quiz/vocabulary-sets/${systemSet.id}?type=VI_TO_ENGLISH`);
  await expect(page.getByRole("heading", { name: "quyển sách kiểm thử" })).toBeFocused();
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");

  await page.getByLabel("Câu trả lời bằng tiếng Anh").fill(systemWords[0].word);
  await page.getByRole("button", { name: "Kiểm tra đáp án" }).press("Enter");
  await expect(page.getByRole("heading", { name: "Chính xác" })).toBeFocused();
  await expect(page.getByRole("status")).toContainText("Bạn đã trả lời đúng");
  await expectProgress(learnerRecord.id, systemWords[0].id, "LEARNED", 1, 1);

  await page.getByRole("button", { name: "Câu tiếp theo" }).click();
  await expect(page.getByRole("heading", { name: "du lịch kiểm thử" })).toBeFocused();
  await page.getByLabel("Câu trả lời bằng tiếng Anh").fill("definitely incorrect");
  await page.getByRole("button", { name: "Kiểm tra đáp án" }).click();
  await expect(page.getByRole("heading", { name: "Chưa chính xác" })).toBeVisible();
  await expectProgress(learnerRecord.id, systemWords[1].id, "LEARNING", 1, 1);
  await page.getByRole("button", { name: "Xem kết quả" }).click();
  await expect(page.getByRole("heading", { name: "Hoàn thành Quiz" })).toBeFocused();

  const beforeRestart = await progressSnapshot(learnerRecord.id);
  await page.getByRole("button", { name: "Làm lại Quiz" }).click();
  await expect(page.getByRole("heading", { name: "quyển sách kiểm thử" })).toBeFocused();
  expect(await progressSnapshot(learnerRecord.id)).toEqual(beforeRestart);
});

test("owned UNSCRAMBLE_WORD consumes server tile order with duplicates, fixed separators and identity fallback", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, learner);
  const questionResponse = page.waitForResponse((response) =>
    response.url().includes(`/api/quiz/sets/${ownedSet.id}/questions`) && response.status() === 200,
  );
  await page.goto(`/quiz/vocabulary-sets/${ownedSet.id}?type=UNSCRAMBLE_WORD`);
  const questionPayload = await (await questionResponse).json();
  const firstPrompt = questionPayload.data.questions[0].prompt;
  const suppliedCharacters = firstPrompt.tiles.map(({ character }) => character);
  expect(new Set(firstPrompt.tiles.map(({ tile_id }) => tile_id)).size).toBe(firstPrompt.tiles.length);

  const reloadResponse = page.waitForResponse((response) =>
    response.url().includes(`/api/quiz/sets/${ownedSet.id}/questions`) && response.status() === 200,
  );
  await page.reload();
  const reloadedPayload = await (await reloadResponse).json();
  expect(reloadedPayload.data.run_id).toBe(questionPayload.data.run_id);
  expect(reloadedPayload.data.questions[0].prompt.tiles).toEqual(firstPrompt.tiles);

  const pool = page.getByRole("group", { name: "Các ký tự có thể chọn" });
  await expect(pool.getByRole("button")).toHaveText(suppliedCharacters);
  const duplicateCharacter = "o";
  await expect(pool.getByRole("button", { name: new RegExp(`Chọn ký tự ${duplicateCharacter}`) })).toHaveCount(2);
  const originalPool = await pool.getByRole("button").allTextContents();
  await pool.getByRole("button", { name: new RegExp(`Chọn ký tự ${duplicateCharacter}`) }).first().press("Enter");
  await page.getByRole("button", { name: new RegExp(`Bỏ ký tự ${duplicateCharacter}`) }).press("Enter");
  await expect(pool.getByRole("button")).toHaveText(originalPool);

  const separatorValues = firstPrompt.slots.filter(({ kind }) => kind === "separator").map(({ value }) => value);
  const separators = page.locator(".quiz-answer-slot.is-separator");
  await expect(separators).toHaveText(separatorValues);
  expect(await separators.evaluateAll((nodes) => nodes.every((node) => node.tagName === "SPAN"))).toBe(true);
  while (await pool.getByRole("button").count()) await pool.getByRole("button").first().press("Enter");
  await page.getByRole("button", { name: "Kiểm tra đáp án" }).press("Enter");
  await expect(page.getByRole("heading", { name: /Chính xác|Chưa chính xác/ })).toBeFocused();
  await page.getByRole("button", { name: "Câu tiếp theo" }).click();

  await expect(page.getByText(/không thể đảo thành một thứ tự khác/)).toBeVisible();
  const identityPool = page.getByRole("group", { name: "Các ký tự có thể chọn" });
  const identityCharacters = await identityPool.getByRole("button").allTextContents();
  expect(new Set(identityCharacters).size).toBe(1);
  while (await identityPool.getByRole("button").count()) {
    await identityPool.getByRole("button").first().press("Enter");
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(page.locator(".quiz-progress-track > span")).toHaveCSS("transition-duration", "0s");
  const submitBox = await page.getByRole("button", { name: "Kiểm tra đáp án" }).boundingBox();
  expect(submitBox.height).toBeGreaterThanOrEqual(44);
  await page.getByRole("button", { name: "Kiểm tra đáp án" }).press("Enter");
  await expect(page.getByRole("button", { name: "Xem kết quả" })).toBeVisible();
});

test("Guest, ADMIN, foreign private access and read-only navigation create no Progress", async ({ page }) => {
  const before = await progressSnapshot(learnerRecord.id);
  await page.goto(`/quiz/vocabulary-sets/${systemSet.id}?type=VI_TO_ENGLISH`);
  await expect(page).toHaveURL(/\/login$/);

  await login(page, administrator);
  await page.goto(`/quiz/vocabulary-sets/${systemSet.id}?type=VI_TO_ENGLISH`);
  await expect(page).toHaveURL(/\/dashboard$/);
  await logoutThroughApi(page);

  await login(page, learner);
  await page.goto(`/quiz/vocabulary-sets/${foreignSet.id}?type=VI_TO_ENGLISH`);
  await expect(page.getByRole("heading", { name: "Không thể mở Quiz" })).toBeVisible();
  await page.goto(`/quiz/vocabulary-sets/${systemSet.id}?type=VI_TO_ENGLISH`);
  await expect(page.getByRole("heading", { name: "quyển sách kiểm thử" })).toBeVisible();
  await page.getByRole("button", { name: "Quay lại" }).first().click();
  await expect(page.getByRole("heading", { name: "Chọn loại Quiz" })).toBeVisible();
  expect(await progressSnapshot(learnerRecord.id)).toEqual(before);
});

function account(name, role) {
  return {
    email: `${name}@${domain}`,
    display_name: `Quiz ${name}`,
    role,
    is_active: true,
  };
}

async function createUser(data, passwordHash) {
  const user = await prisma.uSER.create({ data: { ...data, password_hash: passwordHash } });
  created.userIds.push(user.id);
  return user;
}

async function createVocabulary(word, meaning) {
  const vocabulary = await prisma.vOCABULARY.create({
    data: {
      word,
      meanings: {
        create: [{ part_of_speech: "noun", meaning_vi: meaning, cefr_level: "A1" }],
      },
    },
  });
  created.vocabularyIds.push(vocabulary.id);
  return vocabulary;
}

async function createSet(ownerId, isPublic, suffix, vocabularies) {
  const set = await prisma.vOCABULARY_SET.create({
    data: {
      owner_id: ownerId,
      topic_id: created.topicId,
      name: `${prefix} ${suffix}`,
      is_public: isPublic,
      items: {
        create: vocabularies.map(({ id }, index) => ({ vocabulary_id: id, position: index + 1 })),
      },
    },
  });
  created.setIds.push(set.id);
  return set;
}

async function login(page, accountData) {
  await page.goto("/login");
  await page.locator("#login-email").fill(accountData.email);
  await page.locator("#login-password").fill(password);
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function logoutThroughApi(page) {
  await page.request.post("/api/auth/logout");
  await page.goto("/login");
}

async function expectProgress(userId, vocabularyId, status, reviewCount, revision) {
  await expect.poll(async () => prisma.lEARNING_PROGRESS.findUnique({
    where: { user_id_vocabulary_id: { user_id: userId, vocabulary_id: vocabularyId } },
  })).toMatchObject({ status, review_count: reviewCount, revision });
}

function progressSnapshot(userId) {
  return prisma.lEARNING_PROGRESS.findMany({ where: { user_id: userId }, orderBy: { vocabulary_id: "asc" } });
}

async function targetedCleanup() {
  if (created.userIds.length) {
    await prisma.lEARNING_PROGRESS.deleteMany({ where: { user_id: { in: created.userIds } } });
    await prisma.aUTH_SESSION.deleteMany({ where: { user_id: { in: created.userIds } } });
  }
  if (created.setIds.length) await prisma.vOCABULARY_SET.deleteMany({ where: { id: { in: created.setIds } } });
  if (created.vocabularyIds.length) await prisma.vOCABULARY.deleteMany({ where: { id: { in: created.vocabularyIds } } });
  if (created.topicId) await prisma.tOPIC.deleteMany({ where: { id: created.topicId } });
  if (created.userIds.length) await prisma.uSER.deleteMany({ where: { id: { in: created.userIds } } });
}
