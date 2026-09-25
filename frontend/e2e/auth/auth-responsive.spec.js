import { expect, test } from "@playwright/test";
import {
  installAuthApiMock,
  publicUser,
  responses,
} from "./fixtures/auth-api.js";

const viewports = [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1366, height: 768 },
];

const longNameUser = Object.freeze({
  ...publicUser,
  display_name: "Learner with an intentionally very long display name for responsive coverage",
});

for (const viewport of viewports) {
  test(`${viewport.name} ${viewport.width}x${viewport.height} keeps critical Auth UI usable`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await installAuthApiMock(page, {
      "/api/auth/login": responses.login(longNameUser),
    });

    await page.goto("/login");
    await expectAuthFormToFit(page, "login");

    await page.getByRole("button", { name: "Tạo tài khoản", exact: true }).click();
    await expect(page).toHaveURL(/\/register$/);
    await expectAuthFormToFit(page, "register");

    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expectAuthFormToFit(page, "login");
    await page.getByLabel("Email").fill("learner@example.com");
    await page.getByLabel("Mật khẩu", { exact: true }).fill("password");
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.locator(".authenticated-header-name")).toHaveText(longNameUser.display_name);
    await expect(page.locator(".authenticated-navigation a")).toHaveCount(3);
    await expect(page.locator('a[href="/my/vocabulary-sets"]')).toHaveCount(1);
    await expect(page.locator('a[href="/admin"]')).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
    await expectWithinViewport(page, ".authenticated-layout");
    await expectWithinViewport(page, ".authenticated-main");
    if (viewport.width > 900) await expectWithinViewport(page, ".authenticated-header-name");
    await expectWithinViewport(page, '[aria-labelledby="dashboard-title"] > section');

    const logout = page.getByRole("button", { name: "Đăng xuất", exact: true });
    if (viewport.width <= 900) await page.locator(".authenticated-drawer-toggle").click();
    await expect(logout).toBeVisible();
    await expect(logout).toBeEnabled();
    if (viewport.width <= 900) await page.waitForTimeout(250);
    await expectWithinViewport(page, ".authenticated-logout-button");
    await logout.click();
    await expect(page).toHaveURL(/\/login$/);
  });
}

async function expectAuthFormToFit(page, mode) {
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Mật khẩu", { exact: true })).toBeVisible();

  if (mode === "register") {
    await expect(page.getByLabel("Tên hiển thị")).toBeVisible();
    await expect(page.getByLabel("Xác nhận mật khẩu")).toBeVisible();
    await expect(page.getByRole("button", { name: "Tạo tài khoản", exact: true })).toBeEnabled();
  } else {
    await expect(page.getByRole("button", { name: "Đăng nhập", exact: true })).toBeEnabled();
  }

  await expectNoHorizontalOverflow(page);
}

async function expectNoHorizontalOverflow(page) {
  await expect
    .poll(() =>
      page.evaluate(() => ({
        body: document.body.scrollWidth - document.body.clientWidth,
        document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      })),
    )
    .toEqual({ body: 0, document: 0 });
}

async function expectWithinViewport(page, selector) {
  const bounds = await page.locator(selector).boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(page.viewportSize().width + 0.5);
}
