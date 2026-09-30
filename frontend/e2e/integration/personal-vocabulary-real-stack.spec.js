import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { PrismaClient } from "../../../backend/src/generated/prisma/client.ts";
import { hashPassword } from "../../../backend/src/utils/password-security.js";
import { configureTestEnvironment } from "../../../backend/test/helpers/test-environment.js";

configureTestEnvironment({ requireReset: true });
const prisma = new PrismaClient();
const run = randomUUID();
const prefix = `PV-E2E-${run}`;
const domain = `${run}.pv.integration.test`;
const password = `Safe-${randomUUID()}`;
const accounts = {
  owner: { email: `owner@${domain}`, display_name: "PV Owner", role: "USER", is_active: true },
  outsider: { email: `outsider@${domain}`, display_name: "PV Outsider", role: "USER", is_active: true },
  admin: { email: `admin@${domain}`, display_name: "PV Admin", role: "ADMIN", is_active: true },
};
const ids = { users: [], vocabulary: [], sets: [], operations: [], topic: null };
let owner; let outsider; let admin; let canonical; let privateOne; let privateTwo;
let setA; let setB; let learningSet; let quizSet; let systemSet; let emptySet;

test.describe.configure({ mode: "serial" });
test.setTimeout(120_000);

test.beforeAll(async () => {
  await prisma.$connect();
  const password_hash = await hashPassword(password);
  [owner, outsider, admin] = await Promise.all(Object.values(accounts).map((data) => prisma.uSER.create({ data: { ...data, password_hash } })));
  ids.users.push(owner.id, outsider.id, admin.id);
  const topic = await prisma.tOPIC.create({ data: { name: `${prefix} Topic` } }); ids.topic = topic.id;
  canonical = await word(null, "book", "noun", "canonical book");
  privateOne = await word(owner.id, "book", "verb", "private booking");
  privateTwo = await word(owner.id, "book", "noun", "private volume");
  const foreign = await word(outsider.id, "book", "adjective", "foreign hidden");
  setA = await set(owner.id, false, "Set A", [canonical.id, privateOne.id, privateTwo.id]);
  setB = await set(owner.id, false, "Set B", [privateOne.id]);
  learningSet = await set(owner.id, false, "Learning", [privateOne.id]);
  quizSet = await set(owner.id, false, "Quiz", [privateOne.id, privateTwo.id]);
  systemSet = await set(admin.id, true, "System", [canonical.id]);
  emptySet = await set(owner.id, false, "Empty", []);
  await prisma.lEARNING_PROGRESS.create({ data: { user_id: owner.id, vocabulary_id: privateOne.id, status: "LEARNING", revision: 1, review_count: 1 } });
  expect(foreign.id).toBeTruthy();
});

test.afterAll(async () => {
  try {
    await prisma.lEARNING_PROGRESS.deleteMany({ where: { user_id: { in: ids.users } } });
    await prisma.pRIVATE_VOCABULARY_CREATE_OPERATION.deleteMany({ where: { owner_id: { in: ids.users } } });
    await prisma.vOCABULARY_SET.deleteMany({ where: { id: { in: ids.sets } } });
    await prisma.vOCABULARY.deleteMany({ where: { id: { in: ids.vocabulary } } });
    if (ids.topic) await prisma.tOPIC.deleteMany({ where: { id: ids.topic } });
    await prisma.aUTH_SESSION.deleteMany({ where: { user_id: { in: ids.users } } });
    await prisma.uSER.deleteMany({ where: { id: { in: ids.users } } });
  } finally { await prisma.$disconnect(); }
});

test("create action double-submit persists one private identity and membership", async ({ page }) => {
  await login(page, accounts.owner);
  await openEditor(page, emptySet.id);
  await page.getByRole("button", { name: "Tạo từ mới" }).click();
  const dialog = page.getByRole("dialog", { name: "Tạo và thêm vào bộ từ" });
  const createdWord = `${prefix}-created`;
  await dialog.locator("#private-vocabulary-word").fill(createdWord);
  await dialog.getByLabel("Loại từ").fill("noun");
  await dialog.getByLabel("Nghĩa tiếng Việt").fill("nghĩa tạo mới");
  let posts = 0;
  page.on("request", (request) => { if (request.method() === "POST" && request.url().includes(`/api/my/vocabulary-sets/${emptySet.id}/vocabulary`)) posts += 1; });
  const submit = dialog.getByRole("button", { name: "Tạo và thêm" });
  await submit.evaluate((button) => { button.click(); button.click(); });
  await expect(dialog).toHaveCount(0);
  expect(posts).toBe(1);
  const created = await prisma.vOCABULARY.findMany({ where: { owner_id: owner.id, word: createdWord } });
  expect(created).toHaveLength(1); ids.vocabulary.push(created[0].id);
  expect(await prisma.vOCABULARY_SET_ITEM.count({ where: { vocabulary_set_id: emptySet.id, vocabulary_id: created[0].id } })).toBe(1);
  expect(await prisma.pRIVATE_VOCABULARY_CREATE_OPERATION.count({ where: { vocabulary_id: created[0].id } })).toBe(1);
});

test("reuse edit remove and zero-membership recovery preserve identity and Progress", async ({ page }) => {
  await login(page, accounts.owner);
  await openEditor(page, setA.id);
  const item = page.getByRole("group", { name: "Danh sách từ vựng theo thứ tự" }).getByRole("listitem").filter({ hasText: "book" }).nth(1);
  await item.getByRole("button", { name: "Sửa" }).click();
  const dialog = page.getByRole("dialog", { name: "Chỉnh sửa từ vựng" });
  await dialog.locator("#private-vocabulary-word").fill("reserve");
  await dialog.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(async () => (await prisma.vOCABULARY.findUnique({ where: { id: privateOne.id } })).word).toBe("reserve");
  await removeAndSave(page, setA.id, "reserve");
  await removeAndSave(page, setB.id, "reserve");
  await removeAndSave(page, learningSet.id, "reserve");
  expect(await prisma.vOCABULARY.count({ where: { id: privateOne.id } })).toBe(1);
  expect(await prisma.lEARNING_PROGRESS.count({ where: { user_id: owner.id, vocabulary_id: privateOne.id } })).toBe(1);
  await openEditor(page, setA.id);
  const picker = page.getByRole("group", { name: "Thêm từ vựng" });
  await picker.getByRole("searchbox").fill("reserve"); await picker.getByRole("button", { name: "Tìm từ" }).click();
  await expect(picker.getByText("reserve", { exact: true })).toBeVisible();
});

test("same-word identities remain distinct and cross-user search/direct IDs are concealed", async ({ page }) => {
  await login(page, accounts.owner); await openEditor(page, setA.id);
  const picker = page.getByRole("group", { name: "Thêm từ vựng" });
  await picker.getByRole("searchbox").fill("book"); await picker.getByRole("button", { name: "Tìm từ" }).click();
  await expect(picker.getByRole("listitem")).toHaveCount(2);
  await expect(picker.getByText("Hệ thống", { exact: true })).toBeVisible();
  await expect(picker.getByText("Của tôi", { exact: true })).toBeVisible();
  await login(page, accounts.outsider);
  const result = await page.evaluate(async (id) => ({
    search: await fetch("/api/vocabulary-set-picker?query=reserve").then((r) => r.json()),
    direct: await fetch(`/api/my/vocabulary/${id}`).then(async (r) => ({ status: r.status, body: await r.json() })),
  }), privateOne.id);
  expect(result.search.data.some(({ id }) => id === privateOne.id)).toBe(false);
  expect(result.direct.status).toBe(404);
  expect(result.direct.body.error.code).toBe("VOCABULARY_NOT_FOUND");
});

test("System Set rejects private ID while its private copy accepts owner-private content", async ({ page }) => {
  await login(page, accounts.owner);
  const copiedResponse = page.waitForResponse((response) => response.url().includes(`/api/vocabulary-sets/${systemSet.id}/copy`) && response.status() === 201);
  await page.goto(`/vocabulary-sets/${systemSet.id}`); await page.getByRole("button", { name: "Sao chép bộ từ" }).click();
  const copiedPayload = await (await copiedResponse).json(); const copiedId = copiedPayload.data.id; ids.sets.push(copiedId);
  const copiedItems = await prisma.vOCABULARY_SET_ITEM.findMany({ where: { vocabulary_set_id: copiedId } });
  expect(copiedItems.map(({ vocabulary_id }) => vocabulary_id)).toEqual([canonical.id]);
  await login(page, accounts.admin);
  const systemAttempt = await page.evaluate(async ({ setId, topicId, privateId }) => fetch(`/api/admin/vocabulary-sets/${setId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic_id: topicId, name: "System", description: null, items: [{ vocabulary_id: privateId }] }) }).then(async (r) => ({ status: r.status, body: await r.json() })), { setId: systemSet.id, topicId: ids.topic, privateId: privateTwo.id });
  expect(systemAttempt.status).toBe(404);
  await login(page, accounts.owner);
  await openEditor(page, copiedId); const picker = page.getByRole("group", { name: "Thêm từ vựng" });
  await picker.getByRole("searchbox").fill("book"); await picker.getByRole("button", { name: "Tìm từ" }).click();
  await picker.getByRole("listitem").filter({ hasText: "private volume" }).getByRole("button", { name: "Thêm" }).click();
  await page.getByRole("button", { name: "Lưu bộ từ" }).click();
  await expect(page.getByRole("button", { name: "Đang lưu…" })).toHaveCount(0);
  await expect.poll(() => prisma.vOCABULARY_SET_ITEM.count({ where: { vocabulary_set_id: copiedId, vocabulary_id: privateTwo.id } })).toBe(1);
});

test("Flashcard renders exact private content/POS and speaks the exact private word", async ({ page }) => {
  await prisma.vOCABULARY_SET_ITEM.create({ data: { vocabulary_set_id: learningSet.id, vocabulary_id: privateOne.id, position: 1 } });
  await page.addInitScript(() => {
    window.__spoken = [];
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: { cancel() {}, getVoices() { return []; }, speak(value) { window.__spoken.push(value.text); } },
    });
    Object.defineProperty(window, "SpeechSynthesisUtterance", {
      configurable: true,
      value: class { constructor(text) { this.text = text; } },
    });
  });
  await login(page, accounts.owner); await page.goto(`/learn/vocabulary-sets/${learningSet.id}`);
  await expect(page.getByRole("heading", { name: "reserve" })).toBeVisible();
  await page.getByText("Nhấn hoặc Space để lật thẻ").click();
  await expect(page.getByRole("heading", { name: "private booking" })).toBeVisible();
  await expect(page.getByText("verb", { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__spoken)).toEqual(["reserve"]);
});

test("both Quiz modes retain exact private identities, selected meaning and POS", async ({ page }) => {
  await prisma.vOCABULARY.update({ where: { id: privateOne.id }, data: { word: "book" } });
  await login(page, accounts.owner);
  const viResponse = page.waitForResponse((r) => r.url().includes(`/api/quiz/sets/${quizSet.id}/questions`) && r.status() === 200);
  await page.goto(`/quiz/vocabulary-sets/${quizSet.id}?type=VI_TO_ENGLISH`);
  const vi = await (await viResponse).json(); expect(vi.data.questions.map((q) => q.vocabulary_id)).toEqual([privateOne.id, privateTwo.id]);
  await expect(page.getByRole("heading", { name: "private booking" })).toBeVisible(); await expect(page.getByText("verb", { exact: true })).toBeVisible();
  await page.getByLabel("Câu trả lời bằng tiếng Anh").fill("book"); await page.getByRole("button", { name: "Kiểm tra đáp án" }).click();
  await expect(page.getByRole("heading", { name: "Chính xác" })).toBeVisible();
  const unResponse = page.waitForResponse((r) => r.url().includes(`/api/quiz/sets/${quizSet.id}/questions`) && r.status() === 200);
  await page.goto(`/quiz/vocabulary-sets/${quizSet.id}?type=UNSCRAMBLE_WORD`);
  const un = await (await unResponse).json(); expect(un.data.questions.map((q) => q.vocabulary_id)).toEqual([privateOne.id, privateTwo.id]);
  expect(un.data.questions[0].prompt.tiles.map((tile) => tile.character).sort()).toEqual([..."book"].sort());
  await expect(page.getByRole("heading", { name: "private booking" })).toBeVisible(); await expect(page.getByText("verb", { exact: true })).toBeVisible();
});

async function login(page, account) { await page.context().clearCookies(); await page.goto("/login"); await page.locator("#login-email").fill(account.email); await page.locator("#login-password").fill(password); await page.locator('form button[type="submit"]').click(); await expect(page).toHaveURL(/dashboard/); }
async function openEditor(page, setId) { await page.goto(`/my/vocabulary-sets/${setId}`); await page.getByRole("button", { name: "Chỉnh sửa" }).click(); }
async function removeAndSave(page, setId, wordValue) { await openEditor(page, setId); await page.getByRole("button", { name: `Xóa ${wordValue} khỏi bộ từ` }).click(); await page.getByRole("button", { name: "Lưu bộ từ" }).click(); }
async function word(ownerId, value, part, meaning) { const record = await prisma.vOCABULARY.create({ data: { owner_id: ownerId, word: value, meanings: { create: { part_of_speech: part, meaning_vi: meaning, cefr_level: "A1" } } } }); ids.vocabulary.push(record.id); return record; }
async function set(ownerId, isPublic, suffix, vocabularyIds) { const record = await prisma.vOCABULARY_SET.create({ data: { owner_id: ownerId, topic_id: isPublic ? ids.topic : null, name: `${prefix} ${suffix}`, is_public: isPublic, items: { create: vocabularyIds.map((vocabulary_id, index) => ({ vocabulary_id, position: index + 1 })) } } }); ids.sets.push(record.id); return record; }
