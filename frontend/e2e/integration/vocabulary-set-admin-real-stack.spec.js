import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { PrismaClient } from "../../../backend/src/generated/prisma/client.ts";
import { hashPassword } from "../../../backend/src/utils/password-security.js";
import { configureTestEnvironment } from "../../../backend/test/helpers/test-environment.js";

configureTestEnvironment({ requireReset: true });

const prisma = new PrismaClient();
const runId = randomUUID();
const prefix = `E2E-AdminSet-${runId}`;
const domain = `${runId}.admin-set.integration.test`;
const password = `Safe-${randomUUID()}`;
const admin = { email: `admin@${domain}`, display_name: "Set Administrator", role: "ADMIN", is_active: true };
const user = { email: `user@${domain}`, display_name: "Set Learner", role: "USER", is_active: true };
let topic;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await prisma.$connect();
  const password_hash = await hashPassword(password);
  await Promise.all([
    prisma.uSER.create({ data: { ...admin, password_hash } }),
    prisma.uSER.create({ data: { ...user, password_hash } }),
  ]);
  topic = await prisma.tOPIC.create({ data: { name: `${prefix} Topic` } });
  await Promise.all([
    prisma.vOCABULARY.create({ data: { word: `${prefix} alpha`, phonetic: "/ælfə/" } }),
    prisma.vOCABULARY.create({ data: { word: `${prefix} beta` } }),
  ]);
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

test("ADMIN creates, reorders, updates, and deletes a System Set", async ({ page }) => {
  await login(page, admin.email);
  await page.getByRole("link", { name: "Quản lý bộ từ" }).click();
  await expect(page.getByRole("heading", { name: "Chưa có bộ từ hệ thống" })).toBeVisible();
  await page.getByRole("button", { name: "Tạo bộ từ" }).click();
  await page.getByRole("button", { name: "Lưu bộ từ" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Tên bộ từ là bắt buộc" })).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "Hãy chọn một chủ đề" })).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "ít nhất một từ vựng" })).toBeVisible();

  await page.locator("#my-set-name").fill(`${prefix} System`);
  await page.locator("#my-set-topic").selectOption(topic.id);
  const picker = page.getByRole("group", { name: "Thêm từ vựng" });
  await picker.getByRole("searchbox", { name: "Từ khóa" }).fill(prefix);
  await picker.getByRole("button", { name: "Tìm từ" }).click();
  await picker.getByRole("button", { name: "Thêm", exact: true }).first().click();
  await picker.getByRole("button", { name: "Thêm", exact: true }).first().click();
  const orderedEditor = page.getByRole("group", { name: "Danh sách từ vựng theo thứ tự" });
  await orderedEditor.getByRole("button", { name: new RegExp(`Đưa ${prefix} beta lên`) }).click();
  await page.getByRole("button", { name: "Lưu bộ từ" }).click();

  await expect(page.getByRole("heading", { name: `${prefix} System` })).toBeVisible();
  await expect(page.locator(".my-vocabulary-set-detail ol li").first()).toContainText(`${prefix} beta`);
  const persisted = await prisma.vOCABULARY_SET.findFirst({ where: { name: `${prefix} System` }, include: { items: { orderBy: { position: "asc" }, include: { vocabulary: true } } } });
  expect(persisted?.is_public).toBe(true);
  expect(persisted?.items.map(({ vocabulary }) => vocabulary.word)).toEqual([`${prefix} beta`, `${prefix} alpha`]);

  await page.getByRole("button", { name: "Chỉnh sửa" }).click();
  await orderedEditor.getByRole("button", { name: new RegExp(`Bỏ ${prefix} alpha`) }).click();
  await page.getByRole("button", { name: "Lưu bộ từ" }).click();
  await expect(page.locator(".my-vocabulary-set-detail ol li")).toHaveCount(1);
  await page.getByRole("button", { name: "Xóa bộ từ" }).click();
  await expect(page.getByRole("dialog", { name: "Xóa bộ từ hệ thống?" })).toBeVisible();
  await page.getByRole("button", { name: "Xác nhận xóa" }).click();
  await expect(page.getByRole("heading", { name: "Chưa có bộ từ hệ thống" })).toBeVisible();
});

test("USER cannot access or navigate to ADMIN System Set management", async ({ page }) => {
  await login(page, user.email);
  await expect(page.getByRole("link", { name: "Quản lý bộ từ" })).toHaveCount(0);
  await page.goto("/admin/vocabulary-sets");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Quản lý bộ từ hệ thống" })).toHaveCount(0);
});

test("ADMIN management exposes loading, safe error retry, keyboard, and responsive states", async ({ page }) => {
  await login(page, admin.email);
  let releaseLoading;
  const loadingGate = new Promise((resolve) => { releaseLoading = resolve; });
  let failInitialLoad = true;
  await page.route("**/api/admin/vocabulary-sets", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    if (failInitialLoad) {
      await loadingGate;
      await route.fulfill({ status: 500, json: { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "Internal server error." } } });
      return;
    }
    await route.continue();
  });
  const navigation = page.goto("/admin/vocabulary-sets");
  await expect(page.getByRole("status")).toContainText("Đang tải bộ từ hệ thống");
  releaseLoading();
  await navigation;
  await expect(page.getByRole("alert")).toContainText("Không thể tải bộ từ hệ thống");
  failInitialLoad = false;
  await page.getByRole("button", { name: "Thử lại" }).click();
  await expect(page.getByRole("heading", { name: "Chưa có bộ từ hệ thống" })).toBeVisible();
  await page.unroute("**/api/admin/vocabulary-sets");

  await page.setViewportSize({ width: 375, height: 812 });
  const createButton = page.getByRole("button", { name: "Tạo bộ từ" });
  await createButton.focus();
  await expect(createButton).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

async function login(page, email) {
  await page.goto("/login");
  await page.locator("#login-email").fill(email);
  await page.locator("#login-password").fill(password);
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/dashboard$/);
}
