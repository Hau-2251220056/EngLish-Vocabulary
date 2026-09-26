import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { PrismaClient } from "../../../backend/src/generated/prisma/client.ts";
import { hashPassword } from "../../../backend/src/utils/password-security.js";
import { configureTestEnvironment } from "../../../backend/test/helpers/test-environment.js";

configureTestEnvironment({ requireReset: true });

const prisma = new PrismaClient();
const runId = randomUUID();
const fixturePrefix = `E2E-${runId}`;
const fixtureDomain = `${runId}.topic.integration.test`;
const password = `Safe-${randomUUID()}`;
const user = {
  email: `user@${fixtureDomain}`,
  displayName: "Topic Browser User",
  role: "USER",
};
const admin = {
  email: `admin@${fixtureDomain}`,
  displayName: "Topic Browser Administrator",
  role: "ADMIN",
};
let describedTopic;
let nullableTopic;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await prisma.$connect();
  const passwordHash = await hashPassword(password);
  await prisma.uSER.createMany({
    data: [user, admin].map((account) => ({
      email: account.email,
      password_hash: passwordHash,
      display_name: account.displayName,
      role: account.role,
      is_active: true,
    })),
  });
  describedTopic = await prisma.tOPIC.create({
    data: {
      name: `${fixturePrefix} Travel`,
      description: "Vocabulary for a real browser journey",
    },
  });
  nullableTopic = await prisma.tOPIC.create({
    data: { name: `${fixturePrefix} Nature`, description: null },
  });
});

test.afterAll(async () => {
  try {
    await prisma.tOPIC.deleteMany({ where: { name: { startsWith: fixturePrefix } } });
    const accounts = await prisma.uSER.findMany({
      where: { email: { endsWith: `@${fixtureDomain}` } },
      select: { id: true },
    });
    const ids = accounts.map(({ id }) => id);
    if (ids.length > 0) {
      await prisma.aUTH_SESSION.deleteMany({ where: { user_id: { in: ids } } });
      await prisma.uSER.deleteMany({ where: { id: { in: ids } } });
    }
  } finally {
    await prisma.$disconnect();
  }
});

test("@topic Guest reads real Topic metadata and searches client-side", async ({ page }) => {
  const topicRequests = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/topics") topicRequests.push(request.url());
  });

  await page.goto("/topics");
  await expect(page.getByRole("link", { name: "Đăng nhập" })).toHaveAttribute("href", "/login");
  await expect(page.locator("#topic-list-title")).toBeVisible();
  await expect(page.getByText(describedTopic.name)).toBeVisible();
  await expect(page.getByText(nullableTopic.name)).toBeVisible();
  await expect(page.getByText("Chưa có mô tả cho chủ đề này.")).toBeVisible();
  await expect(page.locator("#topic-search")).toHaveAccessibleName("Tìm kiếm chủ đề");
  const initialRequestCount = topicRequests.length;

  await page.locator("#topic-search").fill("real browser journey");
  await expect(page.getByText(describedTopic.name)).toBeVisible();
  await expect(page.getByText(nullableTopic.name)).toBeHidden();
  expect(topicRequests).toHaveLength(initialRequestCount);

  await page.locator("#topic-search").fill("no matching topic value");
  await expect(page.getByRole("heading", { name: "Không tìm thấy chủ đề phù hợp" })).toBeVisible();
  expect(topicRequests).toHaveLength(initialRequestCount);

  await page.goto(`/topics/${describedTopic.id}`);
  await expect(page.getByRole("heading", { name: describedTopic.name })).toBeVisible();
  await expect(page.getByText(describedTopic.description)).toBeVisible();
  await expect(page.getByText(/Ngày tạo/)).toBeVisible();
  await expect(page.getByText(/Cập nhật/)).toBeVisible();
  await expect(page.getByText(/Vocabulary Set|tiến độ|XP/i)).toHaveCount(0);
});

test("@topic public loading, empty, error/retry and not-found states are safe", async ({ page }) => {
  let resolveList;
  await page.route("**/api/topics", async (route) => {
    await new Promise((resolve) => { resolveList = resolve; });
    await route.fulfill({ status: 200, json: { success: true, data: [] } });
  });
  const navigation = page.goto("/topics");
  await expect(page.getByRole("status")).toBeVisible();
  resolveList();
  await navigation;
  await expect(page.getByRole("heading", { name: "Chưa có chủ đề" })).toBeVisible();
  await page.unroute("**/api/topics");

  let attempts = 0;
  await page.route("**/api/topics", async (route) => {
    attempts += 1;
    if (attempts <= 2) {
      await route.fulfill({ status: 500, json: { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "Internal server error." } } });
      return;
    }
    await route.fulfill({ status: 200, json: { success: true, data: [describedTopic] } });
  });
  await page.reload();
  await expect(page.getByRole("alert")).toBeVisible();
  await page.getByRole("button", { name: "Thử lại" }).click();
  await expect(page.getByText(describedTopic.name)).toBeVisible();
  await page.unroute("**/api/topics");

  await page.goto(`/topics/${randomUUID()}`);
  await expect(page.getByRole("heading", { name: "Không tìm thấy chủ đề" })).toBeVisible();
});

test("@topic USER reaches public Topics but not ADMIN management", async ({ page }) => {
  await login(page, user);
  await expect(page.getByText(user.displayName).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Quản lý chủ đề" })).toHaveCount(0);

  await page.goto("/topics");
  await expect(page.getByText(describedTopic.name)).toBeVisible();
  await expect(page).toHaveURL(/\/topics$/);
  await expect(page.getByRole("link", { name: "Đăng nhập" })).toHaveCount(0);
  const dashboardLink = page.getByRole("link", { name: `Đến Dashboard của ${user.displayName}` });
  await expect(dashboardLink).toHaveAttribute("href", "/dashboard");
  await expect(page.locator(".public-topic-avatar")).toHaveText("T");
  await dashboardLink.click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/admin/topics");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", {
    name: /^Chào buổi (sáng|trưa|chiều|tối), Topic Browser User\.$/,
  })).toBeVisible();
});

test("@topic unauthenticated ADMIN route follows the existing login redirect", async ({ page }) => {
  await page.goto("/admin/topics");
  await expect(page).toHaveURL(/\/login$/, { timeout: 15_000 });
});

test("@topic ADMIN navigation and real CRUD preserve validation and PATCH semantics", async ({ page }) => {
  const createdName = `${fixturePrefix} Created`;
  const renamedName = `${fixturePrefix} Renamed`;
  let patchBody;
  page.on("request", (request) => {
    if (request.method() === "PATCH" && new URL(request.url()).pathname.startsWith("/api/admin/topics/")) {
      patchBody = request.postDataJSON();
    }
  });

  await login(page, admin);
  await page.goto(`/topics/${nullableTopic.id}`);
  await expect(page.getByRole("link", { name: "Đăng nhập" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: `Đến Dashboard của ${admin.displayName}` })).toHaveAttribute("href", "/dashboard");
  await expect(page.locator(".public-topic-avatar")).toHaveText("T");
  await expect(page.getByRole("heading", { name: nullableTopic.name })).toBeVisible();
  await expect(page.getByText("Chưa có mô tả cho chủ đề này.")).toBeVisible();
  await page.goto("/dashboard");
  await expect(page.getByRole("link", { name: "Quản lý chủ đề" })).toBeVisible();
  await page.getByRole("link", { name: "Quản lý chủ đề" }).click();
  await expect(page).toHaveURL(/\/admin\/topics$/);
  await expect(page.getByRole("heading", { name: "Quản lý chủ đề" })).toBeVisible();
  await expect(page.locator("#admin-topic-search")).toHaveAccessibleName("Tìm kiếm chủ đề");

  await page.getByRole("button", { name: "Tạo chủ đề" }).click();
  await page.locator("#topic-name").fill("   ");
  await page.getByRole("button", { name: "Lưu chủ đề" }).click();
  await expect(page.locator("#topic-name")).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#topic-name")).toHaveAttribute("aria-describedby", "topic-name-error");

  await page.locator("#topic-name").fill(`  ${createdName}  `);
  await page.locator("#topic-description").fill("Created through the real ADMIN API");
  await page.getByRole("button", { name: "Lưu chủ đề" }).click();
  await expect(page.getByRole("status")).toContainText("Đã tạo chủ đề thành công");
  await expect(page.getByRole("row", { name: new RegExp(createdName) })).toBeVisible();

  await page.getByRole("button", { name: `Tạo chủ đề` }).click();
  await page.locator("#topic-name").fill(createdName.toLowerCase());
  await page.getByRole("button", { name: "Lưu chủ đề" }).click();
  await expect(page.getByRole("alert")).toContainText("Tên chủ đề đã tồn tại");
  await page.getByRole("button", { name: "Đóng biểu mẫu" }).click();

  await page.getByRole("button", { name: `Xem ${createdName}` }).click();
  await expect(page.getByRole("heading", { name: createdName })).toBeVisible();
  await page.getByRole("button", { name: "Đóng chi tiết" }).click();

  await page.getByRole("button", { name: `Sửa ${createdName}` }).click();
  await page.locator("#topic-description").fill("");
  await page.getByRole("button", { name: "Lưu chủ đề" }).click();
  expect(patchBody).toEqual({ description: null });
  await expect(page.getByText("Chưa có mô tả cho chủ đề này.")).toBeVisible();
  await page.getByRole("button", { name: "Đóng chi tiết" }).click();

  await page.getByRole("button", { name: `Sửa ${createdName}` }).click();
  await page.locator("#topic-name").fill(renamedName);
  await page.getByRole("button", { name: "Lưu chủ đề" }).click();
  await expect(page.getByRole("row", { name: new RegExp(renamedName) })).toBeVisible();
  expect(patchBody).toEqual({ name: renamedName });

  const deleteButton = page.getByRole("button", { name: `Xóa ${renamedName}` });
  await deleteButton.focus();
  await deleteButton.click();
  const dialog = page.getByRole("dialog", { name: "Xóa chủ đề?" });
  await expect(dialog).toContainText(renamedName);
  await expect(page.getByRole("button", { name: "Hủy" })).toBeFocused();
  await page.getByRole("button", { name: "Hủy" }).click();
  await expect(deleteButton).toBeFocused();
  await deleteButton.click();
  await page.getByRole("button", { name: "Xác nhận xóa" }).click();
  await expect(page.getByRole("status")).toContainText("Đã xóa chủ đề thành công");
  await expect(page.getByText(renamedName)).toHaveCount(0);
});

test("@topic failed ADMIN deletion keeps the Topic and actionable dialog state", async ({ page }) => {
  await login(page, admin);
  await page.goto("/admin/topics");
  const deleteButton = page.getByRole("button", { name: `Xóa ${nullableTopic.name}` });
  await page.route(`**/api/admin/topics/${nullableTopic.id}`, async (route) => {
    if (route.request().method() === "DELETE") {
      await route.fulfill({ status: 500, json: { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "Internal server error." } } });
      return;
    }
    await route.continue();
  });
  await deleteButton.click();
  await page.getByRole("button", { name: "Xác nhận xóa" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("alert")).toContainText("Không thể hoàn tất hành động");
  await page.getByRole("button", { name: "Hủy" }).click();
  await expect(page.getByText(nullableTopic.name)).toBeVisible();
});

for (const viewport of [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1366, height: 768 },
]) {
  test(`@topic ${viewport.name} ADMIN layout, navigation and focus remain usable`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await login(page, admin);
    const drawerToggle = page.locator(".authenticated-drawer-toggle");
    if (viewport.width <= 900) {
      await drawerToggle.click();
      await expect(drawerToggle).toHaveAttribute("aria-expanded", "true");
    } else {
      await expect(drawerToggle).toBeHidden();
    }
    const topicLink = page.getByRole("link", { name: "Quản lý chủ đề" });
    await focusWithKeyboard(page, topicLink);
    await expect(topicLink).toBeFocused();
    await expect(topicLink).toHaveCSS("box-shadow", /rgb/);
    await topicLink.click();
    await expect(page).toHaveURL(/\/admin\/topics$/);
    await expect(page.getByRole("heading", { name: "Quản lý chủ đề" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
}

async function login(page, account) {
  await page.goto("/login");
  await page.locator("#login-email").fill(account.email);
  await page.locator("#login-password").fill(password);
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function expectNoHorizontalOverflow(page) {
  await expect.poll(() => page.evaluate(() => ({
    body: document.body.scrollWidth - document.body.clientWidth,
    document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }))).toEqual({ body: 0, document: 0 });
}

async function focusWithKeyboard(page, target) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((element) => element === document.activeElement)) return;
  }
  throw new Error("Keyboard navigation did not reach the ADMIN Topic link.");
}
