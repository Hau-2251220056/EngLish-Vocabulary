import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { PrismaClient } from "../../../backend/src/generated/prisma/client.ts";
import { hashPassword } from "../../../backend/src/utils/password-security.js";
import { configureTestEnvironment } from "../../../backend/test/helpers/test-environment.js";

configureTestEnvironment({ requireReset: true });

const prisma = new PrismaClient();
const runId = randomUUID();
const prefix = `E2E-Progress-${runId}`;
const domain = `${runId}.progress.integration.test`;
const password = `Safe-${randomUUID()}`;
const accounts = {
  learner: user("Progress Browser Learner"),
  outsider: user("Progress Browser Outsider"),
  firstUse: user("Progress First Use"),
  filteredEmpty: user("Progress Filtered Empty"),
  administrator: user("Progress Browser Admin", "ADMIN"),
};

let records;
let vocabularies;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await prisma.$connect();
  const passwordHash = await hashPassword(password);
  const createdUsers = await Promise.all(
    Object.entries(accounts).map(async ([key, account]) => [
      key,
      await prisma.uSER.create({
        data: { ...account, password_hash: passwordHash, is_active: true },
      }),
    ]),
  );
  records = Object.fromEntries(createdUsers);

  await prisma.vOCABULARY.createMany({
    data: Array.from({ length: 24 }, (_, index) => ({
      word: `${prefix} ${String(index + 1).padStart(2, "0")}`,
      phonetic: `/progress-${index + 1}/`,
    })),
  });
  vocabularies = await prisma.vOCABULARY.findMany({
    where: { word: { startsWith: prefix } },
    orderBy: { word: "asc" },
  });

  const statuses = [
    ...Array.from({ length: 8 }, () => "LEARNING"),
    ...Array.from({ length: 13 }, () => "LEARNED"),
    "NEEDS_REVIEW",
    "NEEDS_REVIEW",
  ];
  await prisma.lEARNING_PROGRESS.createMany({
    data: statuses.map((status, index) => ({
      user_id: records.learner.id,
      vocabulary_id: vocabularies[index].id,
      status,
      review_count: index + 1,
      revision: index + 1,
      last_reviewed_at: new Date(Date.UTC(2026, 8, 24, 23 - index)),
      last_event_id: randomUUID(),
    })),
  });
  await prisma.lEARNING_PROGRESS.createMany({
    data: [
      {
        user_id: records.outsider.id,
        vocabulary_id: vocabularies[23].id,
        status: "LEARNED",
        review_count: 99,
        revision: 99,
        last_reviewed_at: new Date(Date.UTC(2026, 8, 25)),
      },
      {
        user_id: records.filteredEmpty.id,
        vocabulary_id: vocabularies[0].id,
        status: "LEARNING",
        review_count: 1,
        revision: 1,
        last_reviewed_at: new Date(Date.UTC(2026, 8, 25)),
      },
    ],
  });
});

test.afterAll(async () => {
  try {
    const users = await prisma.uSER.findMany({
      where: { email: { endsWith: `@${domain}` } },
      select: { id: true },
    });
    const userIds = users.map(({ id }) => id);
    if (userIds.length > 0) {
      await prisma.lEARNING_PROGRESS.deleteMany({
        where: { user_id: { in: userIds } },
      });
      await prisma.aUTH_SESSION.deleteMany({
        where: { user_id: { in: userIds } },
      });
    }
    await prisma.vOCABULARY.deleteMany({
      where: { word: { startsWith: prefix } },
    });
    if (userIds.length > 0) {
      await prisma.uSER.deleteMany({ where: { id: { in: userIds } } });
    }

    expect(await controlledFixtureCount()).toBe(0);
  } finally {
    await prisma.$disconnect();
  }
});

test("USER sees isolated persisted summary, filters and paginates without writes", async ({
  page,
}) => {
  const before = await progressSnapshot(records.learner.id);
  await login(page, accounts.learner);
  await page.goto("/my/learning-progress");

  await expect(page.getByRole("heading", { name: "Tiến độ học tập" })).toBeVisible();
  await expect(page.locator(".learning-progress-summary-card")).toHaveCount(4);
  await expect(summaryCard(page, "Tổng đã bắt đầu")).toContainText("23");
  await expect(summaryCard(page, "Đang học")).toContainText("8");
  await expect(summaryCard(page, "Đã thuộc")).toContainText("13");
  await expect(summaryCard(page, "Cần ôn")).toContainText("2");
  await expect(page.locator(".learning-progress-row")).toHaveCount(20);
  await expect(page.getByText(vocabularies[23].word)).toHaveCount(0);

  const next = page.getByRole("button", { name: "Trang sau" });
  await next.click();
  await expect(page.getByText("Trang 2 / 2")).toBeVisible();
  await expect(page.locator(".learning-progress-row")).toHaveCount(3);
  await expect(page.getByRole("button", { name: "Trang trước" })).toBeFocused();

  await page.getByLabel("Trạng thái").selectOption("NEEDS_REVIEW");
  await expect(page.locator(".learning-progress-row")).toHaveCount(2);
  await expect(
    page.locator(".learning-progress-row .learning-progress-badge", {
      hasText: "Cần ôn",
    }),
  ).toHaveCount(2);
  await expect(page.getByText(/Đã ôn \d+ lần/).first()).toBeVisible();

  expect(await progressSnapshot(records.learner.id)).toEqual(before);
  expect(await prisma.lEARNING_PROGRESS.count({
    where: { user_id: records.outsider.id },
  })).toBe(1);
});

test("real loading, safe error and retry resolve through the guarded API", async ({ page }) => {
  await login(page, accounts.learner);
  let progressRequests = 0;
  let allowSuccessfulRetry = false;
  let releaseInitialFailure;
  const initialFailureGate = new Promise((resolve) => {
    releaseInitialFailure = resolve;
  });
  await page.route("**/api/learning/progress**", async (route) => {
    progressRequests += 1;
    if (!allowSuccessfulRetry) {
      await initialFailureGate;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          error: { code: "INTERNAL_SERVER_ERROR", message: "Safe failure." },
        }),
      });
      return;
    }
    await route.continue();
  });

  await page.goto("/my/learning-progress");
  await expect(page.getByRole("status")).toContainText("Đang tải tiến độ học tập");
  releaseInitialFailure();
  await expect(page.getByRole("alert")).toContainText("Không thể tải tiến độ học tập");
  allowSuccessfulRetry = true;
  await page.getByRole("button", { name: "Thử lại" }).click();
  await expect(page.locator(".learning-progress-row")).toHaveCount(20);
  expect(progressRequests).toBeGreaterThanOrEqual(2);
});

test("first-use and filtered-empty states remain distinct and accessible", async ({ page }) => {
  await login(page, accounts.firstUse);
  await page.goto("/my/learning-progress");
  await expect(page.getByRole("heading", {
    name: "Bạn chưa có tiến độ học tập",
  })).toBeVisible();
  await expect(page.getByLabel("Trạng thái")).toHaveCount(0);

  await logout(page);
  await login(page, accounts.filteredEmpty);
  await page.goto("/my/learning-progress");
  await page.getByLabel("Trạng thái").selectOption("LEARNED");
  await expect(page.getByRole("heading", {
    name: "Không có từ vựng phù hợp",
  })).toBeVisible();
  await page.getByRole("button", { name: "Xóa bộ lọc" }).click();
  await expect(page.locator(".learning-progress-row")).toHaveCount(1);
});

test("Guest and ADMIN cannot access the USER progress route", async ({ page }) => {
  await page.goto("/my/learning-progress");
  await expect(page).toHaveURL(/\/login$/);

  await login(page, accounts.administrator);
  await page.goto("/my/learning-progress");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.locator('a[href="/my/learning-progress"]')).toHaveCount(0);
});

test("desktop shell scroll and mobile keyboard layout stay accessible", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1366, height: 768 });
  await login(page, accounts.learner);
  await page.goto("/my/learning-progress");
  await expect(page.locator(".learning-progress-row")).toHaveCount(20);

  const desktop = await page.evaluate(() => {
    const content = document.querySelector(".authenticated-content");
    const sidebar = document.querySelector(".authenticated-sidebar");
    const before = sidebar.getBoundingClientRect();
    content.scrollTop = Math.min(400, content.scrollHeight - content.clientHeight);
    const after = sidebar.getBoundingClientRect();
    return {
      bodyOverflow: document.documentElement.scrollHeight - window.innerHeight,
      contentScrollable: content.scrollHeight > content.clientHeight,
      contentScrollTop: content.scrollTop,
      sidebarTopDelta: after.top - before.top,
      sidebarBottomDelta: after.bottom - before.bottom,
      sidebarAccountVisible: Boolean(sidebar.querySelector(".authenticated-account")),
    };
  });
  expect(desktop.bodyOverflow).toBeLessThanOrEqual(1);
  expect(desktop.contentScrollable).toBe(true);
  expect(desktop.contentScrollTop).toBeGreaterThan(0);
  expect(Math.abs(desktop.sidebarTopDelta)).toBeLessThanOrEqual(1);
  expect(Math.abs(desktop.sidebarBottomDelta)).toBeLessThanOrEqual(1);
  expect(desktop.sidebarAccountVisible).toBe(true);

  await page.setViewportSize({ width: 375, height: 812 });
  const drawerButton = page.getByRole("button", { name: "Mở điều hướng" });
  await expect(drawerButton).toBeVisible();
  await drawerButton.click();
  await expect(page.getByRole("complementary", { name: "Điều hướng chính" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(drawerButton).toBeFocused();

  const mobile = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - window.innerWidth,
    summaryColumns: getComputedStyle(
      document.querySelector(".learning-progress-summary"),
    ).gridTemplateColumns.split(" ").length,
    rowClickable: document.querySelectorAll(
      ".learning-progress-row a, .learning-progress-row button",
    ).length,
  }));
  expect(mobile.overflow).toBeLessThanOrEqual(1);
  expect(mobile.summaryColumns).toBe(1);
  expect(mobile.rowClickable).toBe(0);
});

function user(displayName, role = "USER") {
  const slug = displayName.toLowerCase().replaceAll(" ", "-");
  return {
    email: `${slug}@${domain}`,
    display_name: displayName,
    role,
  };
}

async function login(page, account) {
  await page.goto("/login");
  await page.locator("#login-email").fill(account.email);
  await page.locator("#login-password").fill(password);
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function logout(page) {
  await page.request.post("/api/auth/logout");
  await page.goto("/login");
}

function summaryCard(page, label) {
  return page.locator(".learning-progress-summary-card").filter({ hasText: label });
}

function progressSnapshot(userId) {
  return prisma.lEARNING_PROGRESS.findMany({
    where: { user_id: userId },
    orderBy: { id: "asc" },
    select: {
      id: true,
      status: true,
      review_count: true,
      revision: true,
      last_reviewed_at: true,
      last_event_id: true,
      updated_at: true,
    },
  });
}

async function controlledFixtureCount() {
  const [users, vocabulary] = await Promise.all([
    prisma.uSER.count({ where: { email: { endsWith: `@${domain}` } } }),
    prisma.vOCABULARY.count({ where: { word: { startsWith: prefix } } }),
  ]);
  return users + vocabulary;
}
