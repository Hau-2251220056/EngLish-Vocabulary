import { expect, test } from "@playwright/test";
import {
  deferredResponse,
  installAuthApiMock,
  publicAdmin,
  publicUser,
  responses,
} from "./fixtures/auth-api.js";

test("initialization shows a neutral status without protected-content flash", async ({ page }) => {
  const pending = deferredResponse();
  await installAuthApiMock(page, { "/api/auth/me": pending.response });

  await page.goto("/dashboard");
  await expect(page.getByRole("status")).toContainText("Đang kiểm tra phiên đăng nhập…");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toHaveCount(0);
  await expect(page.getByRole("navigation")).toHaveCount(0);

  pending.resolve(responses.currentUser(publicUser));
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
});

test("Guest route table redirects without an expiration warning", async ({ page }) => {
  await installAuthApiMock(page);

  for (const path of ["/dashboard", "/", "/unknown-route"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText("Phiên đăng nhập đã hết hạn.")).toHaveCount(0);
  }

  await page.goto("/register");
  await expect(page).toHaveURL(/\/register$/);
});

test("authenticated Guest routes redirect to Dashboard", async ({ page }) => {
  await installAuthApiMock(page, {
    "/api/auth/me": responses.currentUser(publicUser),
  });

  for (const path of ["/login", "/register"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/dashboard$/);
  }
});

test("USER receives USER navigation and no Admin indicator", async ({ page }) => {
  await installAuthApiMock(page, {
    "/api/auth/me": responses.currentUser(publicUser),
  });
  await page.goto("/dashboard");

  await expect(page.locator(".authenticated-header-name")).toHaveText(publicUser.display_name);
  await expect(page.getByText("Quản trị viên")).toHaveCount(0);
  const links = page.getByRole("navigation").getByRole("link");
  await expect(links).toHaveCount(3);
  await expect(page.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/dashboard");
  await expect(page.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
  await expect(page.locator('a[href="/my/vocabulary-sets"]')).toHaveCount(1);
  await expect(page.locator('a[href="/my/learning-progress"]')).toHaveCount(1);
  await expect(page.locator('a[href="/admin"]')).toHaveCount(0);

  await page.locator('a[href="/my/learning-progress"]').click();
  await expect(page).toHaveURL(/\/my\/learning-progress$/);
  await expect(page.locator("h1#learning-progress-title")).toBeVisible();
});

test("ADMIN receives a non-interactive Admin indicator", async ({ page }) => {
  await installAuthApiMock(page, {
    "/api/auth/me": responses.currentUser(publicAdmin),
  });
  await page.goto("/dashboard");

  const indicator = page.getByText("Quản trị viên", { exact: true });
  await expect(indicator).toBeVisible();
  await expect(indicator).toHaveJSProperty("tagName", "SPAN");
  await expect(indicator).not.toHaveAttribute("role", "button");
  await expect(page.locator('a[href="/my/learning-progress"]')).toHaveCount(0);
  await expect(page.locator('a[href="/admin"]')).toHaveCount(0);

  await page.goto("/my/learning-progress");
  await expect(page).toHaveURL(/\/dashboard$/);
});
