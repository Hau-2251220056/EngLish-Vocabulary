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

test("desktop Login and Register panels slide in both directions", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await installAuthApiMock(page);
  await page.goto("/login");

  const shell = page.locator('[data-mode="login"]');
  const panels = page.locator(".auth-moving-panel");
  const initialBounds = await shell.boundingBox();
  const loginSubmit = page.getByRole("button", { name: "Đăng nhập", exact: true });
  const loginEye = page.getByRole("button", { name: "Hiện mật khẩu" });
  const loginEyebrow = page.getByText("Chào mừng trở lại", { exact: true });
  const registerModeSwitch = page.getByRole("button", { name: "Tạo tài khoản", exact: true });
  const loginEmail = page.getByLabel("Email");
  const loginPassword = page.getByLabel("Mật khẩu", { exact: true });
  await expect(loginSubmit).toHaveCSS("background-color", "rgb(76, 162, 230)");
  await expect(loginEyebrow).toHaveCSS("color", "rgb(76, 162, 230)");
  await expect(registerModeSwitch).toHaveCSS("color", "rgb(76, 162, 230)");
  await loginEmail.focus();
  await expect(loginEmail).toHaveCSS("border-color", "rgb(76, 162, 230)");
  await expect(loginEmail).toHaveCSS("box-shadow", /rgba\(76, 162, 230, 0\.2\)/);
  await loginPassword.focus();
  await expect(loginPassword).toHaveCSS("border-color", "rgb(76, 162, 230)");
  await loginEye.hover();
  await expect(loginEye).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(loginEye).toHaveCSS("color", "rgb(76, 162, 230)");
  await expect(loginEyebrow).toHaveCSS("font-size", "14px");
  await expect(loginEyebrow).toHaveCSS("font-weight", "600");
  await expect(loginEyebrow).toHaveCSS("text-transform", "uppercase");
  await expect(panels.first()).toHaveCSS("transition-property", /translate/);
  await page.evaluate(() => {
    window.__authTransitionRuns = [];
    document.querySelectorAll(".auth-moving-panel").forEach((panel) => {
      panel.addEventListener("transitionrun", (event) => window.__authTransitionRuns.push(event.propertyName));
    });
  });

  await registerModeSwitch.click();
  await expect(page).toHaveURL(/\/register$/);
  await expect.poll(() => page.evaluate(() => window.__authTransitionRuns)).toContain("translate");
  const registerSubmit = page.getByRole("button", { name: "Tạo tài khoản", exact: true });
  const registerEyes = page.getByRole("button", { name: "Hiện mật khẩu" });
  const registerEyebrow = page.locator("p").filter({ hasText: /^Tạo tài khoản$/ });
  const registerDisplayName = page.getByLabel("Tên hiển thị");
  const registerConfirmPassword = page.getByLabel("Xác nhận mật khẩu");
  const loginModeSwitch = page.getByRole("button", { name: "Đăng nhập", exact: true });
  await expect(registerSubmit).toHaveCSS("background-color", "rgb(76, 162, 230)");
  await expect(registerEyebrow).toHaveCSS("color", "rgb(76, 162, 230)");
  await expect(loginModeSwitch).toHaveCSS("color", "rgb(76, 162, 230)");
  await registerDisplayName.focus();
  await expect(registerDisplayName).toHaveCSS("border-color", "rgb(76, 162, 230)");
  await registerConfirmPassword.focus();
  await expect(registerConfirmPassword).toHaveCSS("border-color", "rgb(76, 162, 230)");
  await expect(registerEyes).toHaveCount(2);
  await registerEyes.first().hover();
  await expect(registerEyes.first()).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(registerEyebrow).toHaveCSS("font-size", "14px");
  await expect(registerEyebrow).toHaveCSS("font-weight", "600");
  await expect(page.locator('[data-mode="register"]')).toHaveCSS("overflow", "hidden");
  expect(await page.locator('[data-mode="register"]').boundingBox()).toEqual(initialBounds);

  await page.evaluate(() => { window.__authTransitionRuns = []; });
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect.poll(() => page.evaluate(() => window.__authTransitionRuns)).toContain("translate");
  expect(await page.locator('[data-mode="login"]').boundingBox()).toEqual(initialBounds);
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
    await expect(page.getByRole("heading", {
      name: /^Chào buổi (sáng|trưa|chiều|tối), Learner with an intentionally very long display name for responsive coverage$/,
    })).toBeVisible();
    await expect(page.getByRole("button", { name: `Mở menu tài khoản của ${longNameUser.display_name}` })).toBeVisible();
    await expect(page.locator(".authenticated-navigation a")).toHaveCount(3);
    await expect(
      page.locator(".authenticated-navigation").locator('a[href="/my/vocabulary-sets"]'),
    ).toHaveCount(1);
    await expect(page.locator('a[href="/admin"]')).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
    await expectWithinViewport(page, ".authenticated-app");
    await expectWithinViewport(page, ".authenticated-main");
    await expectWithinViewport(page, ".authenticated-avatar-trigger");
    await expectWithinViewport(page, ".dashboard-page");

    await page.getByRole("button", { name: `Mở menu tài khoản của ${longNameUser.display_name}` }).click();
    const logout = page.locator(".authenticated-account-dropdown").getByRole("button", { name: "Đăng xuất", exact: true });
    await expect(logout).toBeVisible();
    await expect(logout).toBeEnabled();
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
