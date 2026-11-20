import { expect, test } from "@playwright/test";
import { deferredResponse, installAuthApiMock, publicAdmin, publicUser, responses } from "./fixtures/auth-api.js";

test("unknown public URL and direct refresh show the accessible 404 page", async ({ page }) => {
  await installAuthApiMock(page);
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/missing-public-page");
  await expect(page.getByRole("heading", { name: "Không tìm thấy trang", level: 1 })).toBeFocused();
  await expect(page.getByText("Trang bạn đang tìm kiếm không tồn tại hoặc đường dẫn đã thay đổi.")).toBeVisible();
  await expect(page.getByText("404", { exact: true })).toBeVisible();
  await expect(page).toHaveTitle("Không tìm thấy trang | ELVocab");
  await expect(page.getByRole("link", { name: "Về trang chủ" })).toHaveAttribute("href", "/");
  await expect(page.getByRole("link", { name: "Về trang chủ" })).toHaveCount(1);
  await expect(page.getByRole("button")).toHaveCount(0);
  await expect(page.getByText("Quay lại", { exact: true })).toHaveCount(0);
  await expect(page.locator("header, nav, aside, svg, .authenticated-user-app, .public-topic-app")).toHaveCount(0);
  for (const [width, minimumSize] of [[320, 100], [390, 100], [768, 130], [1366, 160]]) {
    await page.setViewportSize({ width, height: 720 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const numberSize = await page.getByText("404", { exact: true }).evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
    expect(numberSize).toBeGreaterThanOrEqual(minimumSize);
    const main = page.getByRole("main");
    expect((await main.boundingBox()).height).toBeGreaterThanOrEqual(720);
    await expect(main).toHaveCSS("background-image", /radial-gradient.*linear-gradient/);
  }
  await page.reload();
  await expect(page.getByRole("heading", { name: "Không tìm thấy trang" })).toBeFocused();
  await page.keyboard.press("Tab");
  const home = page.getByRole("link", { name: "Về trang chủ", exact: true });
  await expect(home).toBeFocused();
  expect((await home.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await home.press("Enter");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Làm chủ tiếng Anh từng từ một" })).toBeVisible();
});

test("unknown authenticated URL is standalone and returns to Dashboard", async ({ page }) => {
  await installAuthApiMock(page, { "/api/auth/me": responses.currentUser(publicUser) });
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/missing-user-page");
  await expect(page.getByRole("heading", { name: "Không tìm thấy trang" })).toBeVisible();
  await expect(page.locator("header, nav, aside, .authenticated-user-app, .authenticated-main")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Về trang chủ", exact: true })).toHaveAttribute("href", "/dashboard");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Không tìm thấy trang" })).toBeVisible();
  await expect(page.locator("header, nav, aside, .authenticated-user-app, .authenticated-main")).toHaveCount(0);
  await page.getByRole("link", { name: "Về trang chủ", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: /Chào buổi/ })).toBeVisible();
});

test("unknown Admin URL is standalone while known Admin routes remain guarded", async ({ page }) => {
  await installAuthApiMock(page, { "/api/auth/me": responses.currentUser(publicAdmin) });
  await page.goto("/admin/not-a-page");
  await expect(page.getByRole("heading", { name: "Không tìm thấy trang" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Về trang chủ", exact: true })).toHaveAttribute("href", "/dashboard");
  await expect(page.locator("header, nav, aside, .authenticated-user-app, .authenticated-main")).toHaveCount(0);
  await page.getByRole("link", { name: "Về trang chủ", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.unroute("**/api/auth/**");
  await installAuthApiMock(page, { "/api/auth/me": responses.currentUser(publicUser) });
  await page.goto("/admin/topics");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Không tìm thấy trang" })).toHaveCount(0);
});

test("unknown route waits for auth validation and preserves recoverable auth errors", async ({ page }) => {
  const pending = deferredResponse();
  await installAuthApiMock(page, { "/api/auth/me": pending.response });
  await page.goto("/missing-during-auth");
  await expect(page.getByRole("status")).toContainText("Đang kiểm tra phiên đăng nhập…");
  await expect(page.getByRole("heading", { name: "Không tìm thấy trang" })).toHaveCount(0);
  pending.resolve(responses.error(500, "INTERNAL_SERVER_ERROR", "Temporary error"));
  await expect(page.getByRole("alert")).toContainText("Không thể xác minh phiên đăng nhập lúc này.");
  await expect(page.getByRole("heading", { name: "Không tìm thấy trang" })).toHaveCount(0);
});

test("API responses remain JSON rather than rendering the frontend 404", async ({ page }) => {
  await page.route("**/api/polish-04-unknown", (route) => route.fulfill({
    status: 404,
    contentType: "application/json",
    json: { success: false, error: { code: "NOT_FOUND" } },
  }));
  const response = await page.goto("/api/polish-04-unknown");
  expect(response.status()).toBe(404);
  expect(await response.json()).toEqual({ success: false, error: { code: "NOT_FOUND" } });
  await expect(page.getByRole("heading", { name: "Không tìm thấy trang" })).toHaveCount(0);
});
