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

test("USER creates, edits ordered private items with the editor picker, and confirms deletion", async ({ page }) => {
  await login(page);
  await page.getByRole("link", { name: "Bộ từ của tôi", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Chưa có bộ từ riêng" })).toBeVisible();
  await page.getByRole("button", { name: "Tạo bộ từ" }).click();
  await page.locator("#my-set-name").fill(`${prefix} Private`);
  await page.locator("#my-set-topic").selectOption(topic.id);
  await page.getByRole("button", { name: "Lưu bộ từ" }).click();
  await expect(page.getByRole("heading", { name: `${prefix} Private` })).toBeVisible();
  await page.getByRole("button", { name: "Chỉnh sửa" }).click();
  const picker = page.getByRole("group", { name: "Thêm từ vựng" });
  await picker.getByRole("searchbox", { name: "Từ khóa" }).fill(prefix);
  await picker.getByRole("button", { name: "Tìm từ" }).click();
  await picker.getByRole("button", { name: "Thêm", exact: true }).first().click();
  await picker.getByRole("button", { name: "Thêm", exact: true }).first().click();
  const orderedEditor = page.getByRole("group", { name: "Danh sách từ vựng theo thứ tự" });
  await expect(orderedEditor.getByRole("listitem")).toHaveCount(2);
  await orderedEditor.getByRole("button", { name: new RegExp(`Đưa ${prefix} beta lên`) }).click();
  await page.getByRole("button", { name: "Lưu bộ từ" }).click();
  const orderedDetail = page.locator(".my-vocabulary-set-detail ol");
  await expect(orderedDetail.locator("li").first()).toContainText(`${prefix} beta`);
  await page.getByRole("button", { name: "Xóa bộ từ" }).click();
  await expect(page.getByRole("dialog", { name: "Xóa bộ từ?" })).toBeVisible();
  await page.getByRole("button", { name: "Xác nhận xóa" }).click();
  await expect(page).toHaveURL(/\/my\/vocabulary-sets$/);
  await expect(page.getByRole("heading", { name: "Chưa có bộ từ riêng" })).toBeVisible();
});

test("USER copies a public System Set into an independent private Set", async ({ page }) => {
  await login(page);
  await page.goto(`/vocabulary-sets/${sourceSet.id}`);
  await page.getByRole("button", { name: "Sao chép bộ từ" }).click();
  await expect(page).toHaveURL(/\/my\/vocabulary-sets\//);
  await expect(page.getByRole("heading", { name: sourceSet.name })).toBeVisible();
  await expect(page.locator(".my-vocabulary-set-detail ol li")).toHaveCount(2);
  await expect(page.getByText("Riêng tư").first()).toBeVisible();
});

async function login(page) {
  await page.goto("/login");
  await page.locator("#login-email").fill(user.email);
  await page.locator("#login-password").fill(password);
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/dashboard$/);
}
