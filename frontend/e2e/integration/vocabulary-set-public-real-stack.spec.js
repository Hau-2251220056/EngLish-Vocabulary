import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { PrismaClient } from "../../../backend/src/generated/prisma/client.ts";
import { hashPassword } from "../../../backend/src/utils/password-security.js";
import { configureTestEnvironment } from "../../../backend/test/helpers/test-environment.js";

configureTestEnvironment({ requireReset: true });

const prisma = new PrismaClient();
const runId = randomUUID();
const fixturePrefix = `E2E-Set-${runId}`;
const fixtureDomain = `${runId}.vocabulary-set.integration.test`;
const fixturePassphrase = `Safe-${randomUUID()}`;
const admin = { email: `admin@${fixtureDomain}`, display_name: "System Set Administrator", role: "ADMIN", is_active: true };
let topic;
let publicSet;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await prisma.$connect();
  const password_hash = await hashPassword(fixturePassphrase);
  const account = await prisma.uSER.create({ data: { ...admin, password_hash } });
  topic = await prisma.tOPIC.create({ data: { name: `${fixturePrefix} Travel`, description: "Public Set topic" } });
  const [firstVocabulary, secondVocabulary] = await Promise.all([
    prisma.vOCABULARY.create({ data: { word: `${fixturePrefix} airport` } }),
    prisma.vOCABULARY.create({ data: { word: `${fixturePrefix} passport`, phonetic: "/pɑːspɔːt/" } }),
  ]);
  publicSet = await prisma.vOCABULARY_SET.create({
    data: {
      topic_id: topic.id,
      owner_id: account.id,
      name: `${fixturePrefix} Travel basics`,
      description: "Ordered public Vocabulary selection",
      is_public: true,
      items: { create: [{ vocabulary_id: secondVocabulary.id, position: 1 }, { vocabulary_id: firstVocabulary.id, position: 2 }] },
    },
  });
});

test.afterAll(async () => {
  try {
    await prisma.vOCABULARY_SET.deleteMany({ where: { name: { startsWith: fixturePrefix } } });
    await prisma.vOCABULARY.deleteMany({ where: { word: { startsWith: fixturePrefix } } });
    await prisma.tOPIC.deleteMany({ where: { name: { startsWith: fixturePrefix } } });
    const accounts = await prisma.uSER.findMany({ where: { email: { endsWith: `@${fixtureDomain}` } }, select: { id: true } });
    await prisma.aUTH_SESSION.deleteMany({ where: { user_id: { in: accounts.map(({ id }) => id) } } });
    await prisma.uSER.deleteMany({ where: { id: { in: accounts.map(({ id }) => id) } } });
  } finally {
    await prisma.$disconnect();
  }
});

test("Guest discovers System Sets by Topic, searches locally, and opens ordered detail", async ({ page }) => {
  const requests = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === `/api/topics/${topic.id}/vocabulary-sets`) requests.push(request.url());
  });

  await page.goto(`/topics/${topic.id}/vocabulary-sets`);
  await expect(page.getByRole("heading", { name: "Bộ từ theo chủ đề" })).toBeVisible();
  await expect(page.getByText(publicSet.name)).toBeVisible();
  const initialRequestCount = requests.length;
  const search = page.locator("#vocabulary-set-search");
  await expect(search).toHaveAccessibleName("Tìm kiếm bộ từ");
  await search.fill("không có");
  await expect(page.getByRole("heading", { name: "Không tìm thấy bộ từ phù hợp" })).toBeVisible();
  expect(requests).toHaveLength(initialRequestCount);
  await search.fill("travel basics");
  await page.getByRole("link", { name: "Xem bộ từ" }).click();

  await expect(page.getByRole("heading", { name: publicSet.name })).toBeVisible();
  const orderedItems = page.getByRole("list", { name: "Danh sách từ vựng" });
  await expect(orderedItems).toContainText(`${fixturePrefix} passport`);
  await expect(orderedItems).toContainText(`${fixturePrefix} airport`);
  await expect(orderedItems.locator("li").first()).toContainText(`${fixturePrefix} passport`);
  await expect(orderedItems.locator("li").nth(1)).toContainText(`${fixturePrefix} airport`);
  await expect(page.getByRole("complementary", { name: "Sao chép bộ từ" }).getByRole("link", { name: "Đăng nhập" })).toHaveAttribute("href", "/login");
  await expect(page.getByText(/Meaning|CEFR|Ví dụ/i)).toHaveCount(0);
});

test("Public System Set routes provide accessible loading, error/retry, and not-found states", async ({ page }) => {
  let releaseLoading;
  await page.route(`**/api/topics/${topic.id}/vocabulary-sets`, async (route) => {
    await new Promise((resolve) => { releaseLoading = resolve; });
    await route.fulfill({ status: 200, json: { success: true, data: [] } });
  });
  const navigation = page.goto(`/topics/${topic.id}/vocabulary-sets`);
  await expect(page.getByRole("status")).toBeVisible();
  releaseLoading();
  await navigation;
  await expect(page.getByRole("heading", { name: "Chưa có bộ từ" })).toBeVisible();
  await page.unroute(`**/api/topics/${topic.id}/vocabulary-sets`);

  let attempts = 0;
  await page.route(`**/api/vocabulary-sets/${publicSet.id}`, async (route) => {
    attempts += 1;
    if (attempts <= 2) {
      await route.fulfill({ status: 500, json: { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "Internal server error." } } });
      return;
    }
    await route.continue();
  });
  await page.goto(`/vocabulary-sets/${publicSet.id}`);
  await expect(page.getByRole("alert")).toBeVisible();
  await page.getByRole("button", { name: "Thử lại" }).click();
  await expect(page.getByRole("heading", { name: publicSet.name })).toBeVisible();
  await page.unroute(`**/api/vocabulary-sets/${publicSet.id}`);

  await page.goto(`/vocabulary-sets/${randomUUID()}`);
  await expect(page.getByRole("heading", { name: "Không tìm thấy bộ từ" })).toBeVisible();
});

test("Public System Set discovery remains keyboard reachable and responsive", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`/topics/${topic.id}/vocabulary-sets`);
  const search = page.locator("#vocabulary-set-search");
  await search.focus();
  await expect(search).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
