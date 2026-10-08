import { expect, test } from "@playwright/test";
import { Buffer } from "node:buffer";
import { installAuthApiMock, publicUser, responses } from "./fixtures/auth-api.js";

const sets = [
  { id: "set-travel", name: "Travel English", description: "Từ vựng cho những chuyến đi.", cefr_level: "A2", cover_image_url: "https://covers.example.test/travel.webp", item_count: 8 },
  { id: "set-empty", name: "Bộ từ mới", description: null, cefr_level: null, cover_image_url: null, item_count: 0 },
  { id: "set-work", name: "Office Basics", description: "Giao tiếp nơi công sở.", cefr_level: "B1", cover_image_url: "https://covers.example.test/broken.webp", item_count: 3 },
];
const coverCases = [
  { ...sets[0], id: "set-managed", name: "Managed Cover", cover_image_url: "https://covers.example.test/managed.webp" },
  ...sets,
];

async function openMySets(page, data = sets) {
  await installAuthApiMock(page, { "/api/auth/me": responses.currentUser(publicUser) });
  await page.route("https://covers.example.test/travel.webp", (route) => route.fulfill({ status: 200, contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64") }));
  await page.route("https://covers.example.test/managed.webp", (route) => route.fulfill({ status: 200, contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64") }));
  await page.route("https://covers.example.test/broken.webp", (route) => route.fulfill({ status: 404, body: "" }));
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
  await expect(list.getByRole("link", { name: "Xem", exact: true })).toHaveCount(3);
  await expect(list.getByRole("listitem").filter({ hasText: "Bộ từ mới" }).getByRole("link", { name: "Xem", exact: true })).toHaveAttribute("href", "/my/vocabulary-sets/set-empty");
  await expect(list.getByRole("link", { name: /Chi tiết/i })).toHaveCount(0);
  await expect(list.getByRole("button", { name: /Quản lý/ })).toHaveCount(3);
  const travelCard = list.getByRole("listitem").filter({ hasText: "Travel English" });
  await expect(travelCard.getByText("A2", { exact: true })).toBeVisible();
  await expect(travelCard.locator('[data-cover-state="persisted"] img')).toHaveAttribute("src", sets[0].cover_image_url);
  const coverGeometry = await travelCard.locator('[data-cover-state="persisted"]').evaluate((cover) => ({
    height: cover.getBoundingClientRect().height,
    objectFit: getComputedStyle(cover.querySelector("img")).objectFit,
    overflow: getComputedStyle(cover).overflow,
  }));
  expect(coverGeometry.height).toBeGreaterThanOrEqual(112);
  expect(coverGeometry.objectFit).toBe("cover");
  expect(coverGeometry.overflow).toBe("hidden");
  await expect(list.getByRole("listitem").filter({ hasText: "Bộ từ mới" }).locator('[data-cover-state="fallback"]')).toBeVisible();
  await expect(list.getByRole("listitem").filter({ hasText: "Office Basics" }).locator('[data-cover-state="fallback"]')).toBeVisible();

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
  await expect(page.getByRole("dialog", { name: "Tạo bộ từ" })).toBeVisible();
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

test("card action menu is keyboard accessible and only one menu remains open", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await openMySets(page);

  const firstTrigger = page.getByRole("button", { name: /Quản lý/ }).first();
  await firstTrigger.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menuitem", { name: "Chỉnh sửa" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(firstTrigger).toBeFocused();

  await firstTrigger.click();
  await page.getByRole("button", { name: /Quản lý/ }).nth(1).click();
  await expect(page.getByRole("menu")).toHaveCount(1);
  await page.getByRole("main").click({ position: { x: 2, y: 2 } });
  await expect(page.getByRole("menu")).toHaveCount(0);
});

test("card action menu uses clipping-safe viewport placement", async ({ page }) => {
  const manySets = Array.from({ length: 12 }, (_, index) => ({
    id: `set-${index}`,
    name: `Vocabulary Set ${index + 1}`,
    description: "A stable card used to verify viewport-aware action placement.",
    item_count: index,
  }));
  await page.setViewportSize({ width: 1366, height: 768 });
  await openMySets(page, manySets);

  const firstTrigger = page.getByRole("button", { name: /Quản lý/ }).first();
  await firstTrigger.click();
  const menu = page.getByRole("menu");
  await expect(menu).toHaveAttribute("data-placement", "bottom");

  const initialGap = await menu.evaluate((element) => {
    const trigger = document.querySelector('.action-menu-trigger[aria-expanded="true"]');
    return Math.round(element.getBoundingClientRect().top - trigger.getBoundingClientRect().bottom);
  });
  expect(initialGap).toBe(6);
  await page.evaluate(() => window.scrollBy(0, 80));
  await expect.poll(async () => menu.evaluate((element) => {
    const trigger = document.querySelector('.action-menu-trigger[aria-expanded="true"]');
    return Math.round(element.getBoundingClientRect().top - trigger.getBoundingClientRect().bottom);
  })).toBe(6);

  await page.keyboard.press("Escape");
  const lastTrigger = page.getByRole("button", { name: /Quản lý/ }).last();
  await lastTrigger.scrollIntoViewIfNeeded();
  await lastTrigger.evaluate((element) => element.scrollIntoView({ block: "end" }));
  await lastTrigger.click();
  await expect(menu).toHaveAttribute("data-placement", "top");
  const desktopBounds = await menu.boundingBox();
  expect(desktopBounds.y).toBeGreaterThanOrEqual(8);
  expect(desktopBounds.y + desktopBounds.height).toBeLessThanOrEqual(760);
});

test("card action menu remains inside a 390px mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await openMySets(page, sets);
  const lastTrigger = page.getByRole("button", { name: /Quản lý/ }).last();
  await lastTrigger.evaluate((element) => element.scrollIntoView({ block: "end" }));
  await lastTrigger.click();

  const menuBounds = await page.getByRole("menu").boundingBox();
  expect(menuBounds.x).toBeGreaterThanOrEqual(8);
  expect(menuBounds.x + menuBounds.width).toBeLessThanOrEqual(382);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

for (const viewport of [
  { name: "mobile", width: 390, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1366, height: 768 },
]) {
  test(`${viewport.name} list and action menu stay inside the viewport`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openMySets(page, coverCases);
    const cards = page.locator(".my-vocabulary-set-card");
    await expect(cards).toHaveCount(4);
    for (let index = 0; index < 4; index += 1) {
      const clipping = await cards.nth(index).evaluate((card) => {
        const cover = card.querySelector(".my-vocabulary-set-card-art");
        const cardBounds = card.getBoundingClientRect();
        const coverBounds = cover.getBoundingClientRect();
        const image = cover.querySelector("img");
        return {
          cardOverflow: getComputedStyle(card).overflow,
          cardRadius: Number.parseFloat(getComputedStyle(card).borderTopLeftRadius),
          coverBottomInside: coverBounds.bottom <= cardBounds.bottom + 0.5,
          coverLeftInside: coverBounds.left >= cardBounds.left - 0.5,
          coverOverflow: getComputedStyle(cover).overflow,
          coverRightInside: coverBounds.right <= cardBounds.right + 0.5,
          imageObjectFit: image ? getComputedStyle(image).objectFit : null,
        };
      });
      expect(clipping.cardOverflow).toBe("hidden");
      expect(clipping.cardRadius).toBeGreaterThan(0);
      expect(clipping.coverOverflow).toBe("hidden");
      expect(clipping.coverLeftInside).toBe(true);
      expect(clipping.coverRightInside).toBe(true);
      expect(clipping.coverBottomInside).toBe(true);
      if (index < 2) expect(clipping.imageObjectFit).toBe("cover");
    }
    await expect(cards.nth(0).locator('[data-cover-state="persisted"]')).toBeVisible();
    await expect(cards.nth(1).locator('[data-cover-state="persisted"]')).toBeVisible();
    await expect(cards.nth(2).locator('[data-cover-state="fallback"]')).toBeVisible();
    await expect(cards.nth(3).locator('[data-cover-state="fallback"]')).toBeVisible();
    await page.getByRole("button", { name: /Quản lý/ }).first().click();
    const menuBounds = await page.getByRole("menu").boundingBox();
    const overflow = await page.evaluate(() => ({
      body: document.body.scrollWidth - document.body.clientWidth,
      document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }));
    expect(menuBounds.x).toBeGreaterThanOrEqual(8);
    expect(menuBounds.x + menuBounds.width).toBeLessThanOrEqual(viewport.width - 8);
    expect(menuBounds.y).toBeGreaterThanOrEqual(8);
    expect(menuBounds.y + menuBounds.height).toBeLessThanOrEqual(viewport.height - 8);
    expect(overflow.body).toBeLessThanOrEqual(1);
    expect(overflow.document).toBeLessThanOrEqual(1);
  });
}
