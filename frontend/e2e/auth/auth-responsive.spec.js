import { expect, test } from "@playwright/test";
import {
  installAuthApiMock,
  publicUser,
  responses,
} from "./fixtures/auth-api.js";

const viewports = [
  { name: "mobile-375", width: 375, height: 812 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "tablet-820", width: 820, height: 1180 },
  { name: "desktop-1366", width: 1366, height: 768 },
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
  const registerBounds = await page.locator('[data-mode="register"]').boundingBox();
  expect(registerBounds.x).toBe(initialBounds.x);
  expect(registerBounds.width).toBe(initialBounds.width);
  expect(registerBounds.height).toBeGreaterThanOrEqual(initialBounds.height);

  await page.evaluate(() => { window.__authTransitionRuns = []; });
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect.poll(() => page.evaluate(() => window.__authTransitionRuns)).toContain("translate");
  expect(await page.locator('[data-mode="login"]').boundingBox()).toEqual(initialBounds);
});

for (const viewport of viewports) {
  test(`expanded Register validation and API errors stay inside a content-safe shell on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await installAuthApiMock(page, {
      "/api/auth/register": responses.error(
        500,
        "UNEXPECTED_INTERNAL_ERROR",
        "Raw internal message.",
        "raw internal detail",
      ),
    });
    await page.goto("/register");

    await page.getByRole("button", { name: "Tạo tài khoản", exact: true }).click();
    await expect(page.getByText("Vui lòng nhập email.")).toBeVisible();
    await expectRegisterHandoffContained(page);

    await page.getByLabel("Tên hiển thị").fill("Learner");
    await page.getByLabel("Email").fill("learner@example.com");
    await page.getByLabel("Mật khẩu", { exact: true }).fill("password");
    await page.getByLabel("Xác nhận mật khẩu").fill("password");
    await page.getByRole("button", { name: "Tạo tài khoản", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Yêu cầu chưa thể hoàn tất");
    await expectAuthNotificationAnchoredToViewport(page, viewport);
    await expectRegisterHandoffContained(page);
    await expectNoHorizontalOverflow(page);
  });
}

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

async function expectAuthNotificationAnchoredToViewport(page, viewport) {
  const notification = page.locator('.auth-notification[aria-hidden="false"]');
  await expect(notification).toBeVisible();
  const expectedMargin = viewport.width < 640 ? 16 : 20;
  await expect.poll(() => notification.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return { right: Math.round(innerWidth - box.right), top: Math.round(box.top) };
  })).toEqual({ right: expectedMargin, top: expectedMargin });
  const geometry = await notification.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const headingBox = document.querySelector("h1")?.getBoundingClientRect();
    return {
      bottom: box.bottom,
      left: box.left,
      overlapsHeading: Boolean(headingBox
        && box.left < headingBox.right
        && box.right > headingBox.left
        && box.top < headingBox.bottom
        && box.bottom > headingBox.top),
      position: getComputedStyle(element).position,
      right: innerWidth - box.right,
      top: box.top,
      width: box.width,
    };
  });
  expect(geometry.position).toBe("fixed");
  expect(geometry.top).toBeCloseTo(expectedMargin, 0);
  expect(geometry.right).toBeCloseTo(expectedMargin, 0);
  if (viewport.width < 640) expect(geometry.left).toBeCloseTo(16, 0);
  else expect(geometry.width).toBeLessThanOrEqual(400);
  expect(geometry.bottom).toBeLessThanOrEqual(viewport.height);
  expect(geometry.overlapsHeading).toBe(false);
}

async function expectRegisterHandoffContained(page) {
  const handoff = page.getByRole("button", { name: "Đăng nhập", exact: true });
  await handoff.scrollIntoViewIfNeeded();
  await expect(handoff).toBeVisible();
  const geometry = await page.evaluate(() => {
    const shell = document.querySelector('[data-mode="register"]');
    const panel = shell.querySelectorAll(".auth-moving-panel")[1];
    const button = [...panel.querySelectorAll("button")].find((candidate) => candidate.textContent.trim() === "Đăng nhập");
    const shellRect = shell.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    return {
      buttonBottom: buttonRect.bottom,
      buttonTop: buttonRect.top,
      panelClientHeight: panel.clientHeight,
      panelOverflowY: getComputedStyle(panel).overflowY,
      panelScrollHeight: panel.scrollHeight,
      shellBottom: shellRect.bottom,
      shellTop: shellRect.top,
    };
  });
  expect(geometry.buttonTop).toBeGreaterThanOrEqual(geometry.shellTop - 0.5);
  expect(geometry.buttonBottom).toBeLessThanOrEqual(geometry.shellBottom + 0.5);
  expect(geometry.panelOverflowY).not.toMatch(/auto|scroll/);
  expect(geometry.panelScrollHeight).toBeLessThanOrEqual(geometry.panelClientHeight + 1);
}

async function expectWithinViewport(page, selector) {
  const bounds = await page.locator(selector).boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(page.viewportSize().width + 0.5);
}
