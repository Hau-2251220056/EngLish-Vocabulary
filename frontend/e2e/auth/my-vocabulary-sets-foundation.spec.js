import { expect, test } from "@playwright/test";
import { installAuthApiMock, publicUser, responses } from "./fixtures/auth-api.js";

const sets = [
  { id: "set-travel", name: "Travel English", description: "Từ vựng cho những chuyến đi.", item_count: 8 },
  { id: "set-empty", name: "Bộ từ mới", description: null, item_count: 0 },
  { id: "set-work", name: "Office Basics", description: "Giao tiếp nơi công sở.", item_count: 3 },
];

async function openMySets(page, data = sets) {
  await installAuthApiMock(page, { "/api/auth/me": responses.currentUser(publicUser) });
  await page.route("**/api/my/vocabulary-sets", (route) => route.fulfill({ status: 200, json: { success: true, data } }));
  await page.route("**/api/topics", (route) => route.fulfill({ status: 200, json: { success: true, data: [] } }));
  await page.goto("/my/vocabulary-sets");
}

test("renders authoritative Set summaries, safe actions, search and client sorting", async ({ page }) => {
  await openMySets(page);

  const list = page.getByRole("list", { name: "Các bộ từ của tôi" });
  await expect(list.getByRole("listitem")).toHaveCount(3);
  await expect(list).toContainText("Travel English");
  await expect(list).toContainText("8 từ vựng");
  await expect(list).toContainText("Từ vựng cho những chuyến đi.");
  await expect(list.getByRole("link", { name: "Học", exact: true })).toHaveCount(2);
  await expect(list.getByRole("listitem").filter({ hasText: "Bộ từ mới" }).getByRole("link", { name: "Học", exact: true })).toHaveCount(0);
  await expect(list.getByRole("link", { name: "Xem chi tiết Travel English" })).toHaveAttribute("href", "/my/vocabulary-sets/set-travel");

  const search = page.getByRole("searchbox", { name: "Tìm bộ từ" });
  await search.fill("công sở");
  await expect(list.getByRole("listitem")).toHaveCount(1);
  await expect(list).toContainText("Office Basics");
  await search.fill("không tồn tại");
  await expect(page.getByRole("heading", { name: "Không tìm thấy bộ từ phù hợp" })).toBeVisible();
  await page.getByRole("button", { name: "Xóa tìm kiếm" }).click();

  await page.getByRole("combobox", { name: "Sắp xếp bộ từ" }).selectOption("count-asc");
  await expect(list.getByRole("heading", { level: 3 }).nth(0)).toHaveText("Bộ từ mới");
  await expect(list.getByRole("heading", { level: 3 }).nth(2)).toHaveText("Travel English");
});

test("first-use state offers the existing create behavior and Topics route", async ({ page }) => {
  await openMySets(page, []);

  await expect(page.getByRole("heading", { name: "Bạn chưa có bộ từ nào" })).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: "Khám phá bộ từ" })).toHaveAttribute("href", "/topics");
  await page.getByRole("button", { name: "Tạo bộ từ đầu tiên" }).click();
  await expect(page.getByRole("heading", { name: "Tạo bộ từ riêng" })).toBeVisible();
});

test("load error remains distinct and keyboard retry restores the list", async ({ page }) => {
  await installAuthApiMock(page, { "/api/auth/me": responses.currentUser(publicUser) });
  let calls = 0;
  let retrying = false;
  await page.route("**/api/my/vocabulary-sets", async (route) => {
    calls += 1;
    await route.fulfill(retrying
      ? { status: 200, json: { success: true, data: sets } }
      : { status: 500, json: { success: false, error: { code: "INTERNAL_SERVER_ERROR" } } });
  });
  await page.goto("/my/vocabulary-sets");

  await expect(page.getByRole("alert")).toContainText("Không thể tải bộ từ");
  const retry = page.getByRole("button", { name: "Thử lại" });
  await retry.focus();
  const callsBeforeRetry = calls;
  retrying = true;
  await page.keyboard.press("Enter");
  await expect(page.getByRole("list", { name: "Các bộ từ của tôi" })).toBeVisible();
  expect(calls).toBe(callsBeforeRetry + 1);
});

for (const viewport of [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
]) {
  test(`${viewport.name} list has no horizontal overflow`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openMySets(page, [{ ...sets[0], name: "A deliberately long Vocabulary Set name that must wrap safely on every viewport" }]);
    const overflow = await page.evaluate(() => ({
      body: document.body.scrollWidth - document.body.clientWidth,
      document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }));
    expect(overflow.body).toBeLessThanOrEqual(1);
    expect(overflow.document).toBeLessThanOrEqual(1);
  });
}
