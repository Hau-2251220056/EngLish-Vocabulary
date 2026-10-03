import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { PrismaClient } from "../../../backend/src/generated/prisma/client.ts";
import { hashPassword } from "../../../backend/src/utils/password-security.js";
import { configureTestEnvironment } from "../../../backend/test/helpers/test-environment.js";

configureTestEnvironment({ requireReset: true });

const prisma = new PrismaClient();
const runId = randomUUID();
const prefix = `E2E-MySet-${runId}`;
const domain = `${runId}.my-set.integration.test`;
const password = `Safe-${randomUUID()}`;
const user = { email: `user@${domain}`, display_name: "My Set Learner", role: "USER", is_active: true };
let topic;
let sourceSet;
let vocabularyIds;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await prisma.$connect();
  const [owner, admin] = await Promise.all([
    prisma.uSER.create({ data: { ...user, password_hash: await hashPassword(password) } }),
    prisma.uSER.create({ data: { email: `admin@${domain}`, display_name: "Copy Source Admin", role: "ADMIN", is_active: true, password_hash: await hashPassword(password) } }),
  ]);
  topic = await prisma.tOPIC.create({ data: { name: `${prefix} Topic` } });
  const [first, second] = await Promise.all([
    prisma.vOCABULARY.create({ data: { word: `${prefix} alpha`, phonetic: "/ælfə/" } }),
    prisma.vOCABULARY.create({ data: { word: `${prefix} beta` } }),
  ]);
  vocabularyIds = [first.id, second.id];
  sourceSet = await prisma.vOCABULARY_SET.create({ data: { topic_id: topic.id, owner_id: admin.id, name: `${prefix} System`, is_public: true, items: { create: [{ vocabulary_id: first.id, position: 1 }, { vocabulary_id: second.id, position: 2 }] } } });
  expect(owner.id).toBeTruthy();
});

test.afterAll(async () => {
  try {
    await prisma.vOCABULARY_SET.deleteMany({ where: { name: { startsWith: prefix } } });
    await prisma.vOCABULARY.deleteMany({ where: { word: { startsWith: prefix } } });
    await prisma.tOPIC.deleteMany({ where: { name: { startsWith: prefix } } });
    const accounts = await prisma.uSER.findMany({ where: { email: { endsWith: `@${domain}` } }, select: { id: true } });
    await prisma.aUTH_SESSION.deleteMany({ where: { user_id: { in: accounts.map(({ id }) => id) } } });
    await prisma.uSER.deleteMany({ where: { id: { in: accounts.map(({ id }) => id) } } });
  } finally { await prisma.$disconnect(); }
});

test("USER creates and metadata-edits a topicless Set without changing ordered membership", async ({ page }) => {
  const topicRequests = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/topics") topicRequests.push(request.url());
  });
  await login(page);
  await page
    .getByRole("navigation", { name: "Điều hướng ứng dụng" })
    .getByRole("link", { name: "Bộ từ của tôi", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "Bạn chưa có bộ từ nào" })).toBeVisible();
  await page.getByRole("button", { name: "Tạo bộ từ", exact: true }).first().click();
  const createDialog = page.getByRole("dialog", { name: "Tạo bộ từ" });
  await createDialog.getByLabel("Tên bộ từ").fill(`${prefix} Private`);
  await expect(createDialog.getByRole("combobox")).toHaveCount(0);
  await expect(createDialog.getByRole("searchbox")).toHaveCount(0);
  await createDialog.getByRole("button", { name: "Tạo bộ từ", exact: true }).click();
  await expect(page.getByRole("heading", { name: `${prefix} Private` })).toBeVisible();
  expect(topicRequests).toEqual([]);
  const created = await prisma.vOCABULARY_SET.findFirstOrThrow({ where: { name: `${prefix} Private` } });
  expect(created.topic_id).toBeNull();
  await prisma.vOCABULARY_SET_ITEM.createMany({ data: [
    { vocabulary_set_id: created.id, vocabulary_id: vocabularyIds[1], position: 1 },
    { vocabulary_set_id: created.id, vocabulary_id: vocabularyIds[0], position: 2 },
  ] });
  await page.reload();
  const before = await prisma.vOCABULARY_SET_ITEM.findMany({ where: { vocabulary_set_id: created.id }, orderBy: { position: "asc" } });
  await page.getByRole("main").getByRole("link", { name: "Bộ từ của tôi", exact: true }).click();
  const createdCard = page.getByRole("listitem").filter({
    has: page.getByRole("heading", { level: 3, name: `${prefix} Private`, exact: true }),
  });
  await createdCard.getByRole("button", { name: `Quản lý ${prefix} Private` }).click();
  await createdCard.getByRole("menuitem", { name: "Chỉnh sửa" }).click();
  const editDialog = page.getByRole("dialog", { name: "Chỉnh sửa bộ từ" });
  await expect(editDialog.getByRole("searchbox")).toHaveCount(0);
  await editDialog.getByLabel("Tên bộ từ").fill(`${prefix} Private Updated`);
  await editDialog.getByLabel("Mô tả (không bắt buộc)").fill("Metadata only");
  await editDialog.getByRole("button", { name: "Lưu thay đổi" }).click();
  const updatedCard = page.getByRole("listitem").filter({
    has: page.getByRole("heading", { level: 3, name: `${prefix} Private Updated`, exact: true }),
  });
  await expect(updatedCard).toBeVisible();
  const after = await prisma.vOCABULARY_SET_ITEM.findMany({ where: { vocabulary_set_id: created.id }, orderBy: { position: "asc" } });
  expect(after.map(({ id, vocabulary_id, position }) => ({ id, vocabulary_id, position }))).toEqual(before.map(({ id, vocabulary_id, position }) => ({ id, vocabulary_id, position })));
  await updatedCard.getByRole("button", { name: `Quản lý ${prefix} Private Updated` }).click();
  await updatedCard.getByRole("menuitem", { name: "Xóa bộ từ" }).click();
  await expect(page.getByRole("dialog", { name: "Xóa bộ từ?" })).toBeVisible();
  await page.getByRole("button", { name: "Xác nhận xóa" }).click();
  await expect(page).toHaveURL(/\/my\/vocabulary-sets$/);
  await expect(page.getByRole("heading", { name: "Bạn chưa có bộ từ nào" })).toBeVisible();
});

test("USER copies a public System Set into an independent private Set", async ({ page }) => {
  await login(page);
  await page.goto(`/vocabulary-sets/${sourceSet.id}`);
  await page.getByRole("button", { name: "Sao chép bộ từ" }).click();
  await expect(page).toHaveURL(/\/my\/vocabulary-sets\//);
  await expect(page.getByRole("heading", { name: sourceSet.name })).toBeVisible();
  await expect(page.getByRole("table").locator("tbody tr")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Chỉnh sửa", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Xóa bộ từ", exact: true })).toHaveCount(0);
  await page.getByRole("main").getByRole("link", { name: "Bộ từ của tôi", exact: true }).click();
  const copiedCard = page.getByRole("listitem").filter({
    has: page.getByRole("heading", { level: 3, name: sourceSet.name, exact: true }),
  });
  await copiedCard.getByRole("button", { name: `Quản lý ${sourceSet.name}` }).click();
  await expect(copiedCard.getByRole("menuitem", { name: "Chỉnh sửa" })).toBeVisible();
  await expect(copiedCard.getByRole("menuitem", { name: "Xóa bộ từ" })).toBeVisible();
  const copy = await prisma.vOCABULARY_SET.findFirstOrThrow({
    where: { owner: { email: user.email }, name: sourceSet.name },
    include: { items: { orderBy: { position: "asc" } } },
  });
  const source = await prisma.vOCABULARY_SET.findUniqueOrThrow({
    where: { id: sourceSet.id }, include: { items: { orderBy: { position: "asc" } } },
  });
  expect(copy.topic_id).toBeNull();
  expect(copy.items.map(({ vocabulary_id }) => vocabulary_id)).toEqual(source.items.map(({ vocabulary_id }) => vocabulary_id));
});

async function login(page) {
  await page.goto("/login");
  await page.locator("#login-email").fill(user.email);
  await page.locator("#login-password").fill(password);
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/dashboard$/);
}
