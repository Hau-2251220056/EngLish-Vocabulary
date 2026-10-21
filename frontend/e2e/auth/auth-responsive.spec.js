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

const toastViewports = [
  { name: "mobile-320", width: 320, height: 720 },
  { name: "mobile-375", width: 375, height: 812 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "mobile-430", width: 430, height: 932 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "desktop-1366", width: 1366, height: 768 },
];

const mobileAuthViewports = [
  { name: "mobile-320", width: 320, height: 720 },
  { name: "mobile-375", width: 375, height: 812 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "mobile-430", width: 430, height: 932 },
  { name: "tablet-768", width: 768, height: 1024 },
];

const longNameUser = Object.freeze({
  ...publicUser,
  display_name: "Learner with an intentionally very long display name for responsive coverage",
});

test("Focused auth refinement review captures the blended grid and external home link", async ({ page }, testInfo) => {
  await installAuthApiMock(page);
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/login");

  const homeLink = page.getByTestId("auth-home-link");
  const authCard = page.getByTestId("auth-card");
  await expect(homeLink).toBeVisible();
  await expect(authCard.locator('[data-testid="auth-home-link"]')).toHaveCount(0);
  const gridTreatment = await page.locator(".learning-grid").evaluate((panel) => ({
    background: getComputedStyle(panel).backgroundImage,
    mask: getComputedStyle(panel, "::before").maskImage,
  }));
  expect(gridTreatment.background).toContain("radial-gradient");
  expect(gridTreatment.mask).toContain("radial-gradient");
  await page.screenshot({ path: testInfo.outputPath("auth-refinement-login-desktop-1366.png"), fullPage: true });

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/register");
  await expect(page.getByTestId("auth-home-link")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("auth-refinement-register-mobile-375.png"), fullPage: true });
});

for (const viewport of mobileAuthViewports) {
  test(`Phase 4B shows only the Auth form on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await installAuthApiMock(page);

    for (const route of ["/login", "/register"]) {
      await page.goto(route);

      await expect(page.getByTestId("auth-illustration-panel")).toBeHidden();
      await expect(page.getByTestId("auth-form-panel")).toBeVisible();
      await expect(page.getByTestId("auth-home-link")).toBeVisible();
      await expect(page.getByTestId("auth-card").locator('[data-testid="auth-home-link"]')).toHaveCount(0);
      await expectAuthFormToFit(page, route.slice(1));
      await expectNoHorizontalOverflow(page);
    }
  });
}

test("Phase 4B preserves logical mobile focus order", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await installAuthApiMock(page);
  await page.goto("/login");

  await page.getByTestId("auth-home-link").focus();
  await expect(page.getByTestId("auth-home-link")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Email")).toBeFocused();
});

test("Phase 4B keeps the mobile Login form reachable in a short viewport", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 500 });
  await installAuthApiMock(page);
  await page.goto("/login");

  await expect(page.getByTestId("auth-illustration-panel")).toBeHidden();
  const submit = page.locator('button[type="submit"]');
  await submit.scrollIntoViewIfNeeded();
  await expect(submit).toBeVisible();
  await expectNoHorizontalOverflow(page);
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeGreaterThanOrEqual(500);
});

test("Phase 4B preserves the desktop two-column Auth composition", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await installAuthApiMock(page);
  await page.goto("/login");

  const illustration = page.getByTestId("auth-illustration-panel");
  const form = page.getByTestId("auth-form-panel");
  await expect(illustration).toBeVisible();
  await expect(form).toBeVisible();
  const illustrationBounds = await illustration.boundingBox();
  const formBounds = await form.boundingBox();
  expect(illustrationBounds.x).toBeLessThan(formBounds.x);
  expect(illustrationBounds.width).toBe(formBounds.width);
});

test("Phase 4B captures the required mobile and desktop visual evidence", async ({ page }, testInfo) => {
  await installAuthApiMock(page);

  const evidence = [
    { route: "/login", width: 375, height: 812, name: "phase-4b-mobile-login-375.png" },
    { route: "/register", width: 375, height: 812, name: "phase-4b-mobile-register-375.png" },
    { route: "/register", width: 320, height: 720, name: "phase-4b-mobile-register-320.png" },
    { route: "/login", width: 375, height: 500, name: "phase-4b-mobile-login-short-375x500.png" },
    { route: "/login", width: 1366, height: 768, name: "phase-4b-desktop-login-1366.png" },
  ];

  for (const shot of evidence) {
    await page.setViewportSize({ width: shot.width, height: shot.height });
    await page.goto(shot.route);
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath(shot.name), fullPage: true });
  }
});

test("Phase 4A captures desktop registration success toast", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await installAuthApiMock(page, { "/api/auth/register": responses.registration() });
  await page.goto("/register");
  await submitValidRegistration(page);

  const toast = page.locator('.Toastify__toast[role="status"]');
  await expect(toast).toBeVisible();
  await expect(toast).toContainText("Tạo tài khoản thành công!");
  await toast.hover();
  await expect(page).toHaveURL(/\/login$/);
  await expect(toast).toHaveCount(1);
  await waitForAuthAnimations(page);
  await page.screenshot({ path: testInfo.outputPath("phase-4a-register-success-desktop-1366.png"), fullPage: true });
});

test("Phase 4A captures desktop registration global error toast", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await installAuthApiMock(page, {
    "/api/auth/register": responses.error(500, "UNEXPECTED_INTERNAL_ERROR", "Raw", "Raw detail"),
  });
  await page.goto("/register");
  await submitValidRegistration(page);

  const toast = page.locator('.Toastify__toast[role="alert"]');
  await expect(toast).toBeVisible();
  await toast.hover();
  await expect(toast).toContainText("Yêu cầu chưa thể hoàn tất. Vui lòng thử lại.");
  await page.screenshot({ path: testInfo.outputPath("phase-4a-register-error-desktop-1366.png"), fullPage: true });
});

test("Phase 4A captures a bounded reduced-motion mobile registration toast", async ({ page }, testInfo) => {
  const viewport = { width: 375, height: 812 };
  await page.setViewportSize(viewport);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installAuthApiMock(page, { "/api/auth/register": responses.registration() });
  await page.goto("/register");
  await submitValidRegistration(page);

  const toast = page.locator('.Toastify__toast[role="status"]');
  await expectSharedToastWithinViewport(page, viewport);
  await expect(toast).toContainText("Tạo tài khoản thành công!");
  await expect(page).toHaveURL(/\/login$/);
  await expect(toast).toHaveCSS("animation-name", "none");
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("phase-4a-register-success-mobile-375.png"), fullPage: true });
});

test("Phase 4A captures the unchanged inline Login error", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await installAuthApiMock(page, {
    "/api/auth/login": responses.error(401, "AUTHENTICATION_FAILED", "Raw", "Raw detail"),
  });
  await page.goto("/login");
  await page.getByLabel("Email").fill("learner@example.com");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("wrong-password");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();

  const alert = page.locator("form").getByRole("alert");
  await expect(alert).toContainText("Email hoặc mật khẩu không chính xác.");
  await expect(page.locator(".Toastify__toast")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("phase-4a-login-inline-error-desktop-1366.png"), fullPage: true });
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

for (const viewport of toastViewports) {
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
    const toast = page.locator('.Toastify__toast[role="alert"]');
    await expect(toast).toBeVisible();
    await toast.hover();
    await expect(toast).toContainText("Yêu cầu chưa thể hoàn tất");
    await expectSharedToastWithinViewport(page, viewport);
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

async function submitValidRegistration(page) {
  await page.getByLabel("Tên hiển thị").fill("Learner");
  await page.getByLabel("Email").fill("learner@example.com");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("password");
  await page.getByLabel("Xác nhận mật khẩu").fill("password");
  await page.getByRole("button", { name: "Tạo tài khoản", exact: true }).click();
}

async function waitForAuthAnimations(page) {
  await page.locator('[data-mode="login"]').evaluate(async (shell) => {
    await Promise.all(shell.getAnimations({ subtree: true }).map((animation) => animation.finished));
  });
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

async function expectSharedToastWithinViewport(page, viewport) {
  const notification = page.locator(".Toastify__toast");
  await expect(notification).toBeVisible();
  await notification.hover();
  const geometry = await notification.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return {
      bottom: box.bottom,
      left: box.left,
      position: getComputedStyle(element).position,
      right: innerWidth - box.right,
      top: box.top,
      width: box.width,
    };
  });
  expect(geometry.position).toBe("relative");
  expect(geometry.top).toBeGreaterThanOrEqual(0);
  expect(geometry.right).toBeGreaterThanOrEqual(viewport.width <= 480 ? 8 : 16);
  expect(geometry.left).toBeGreaterThanOrEqual(viewport.width <= 480 ? 8 : 16);
  expect(geometry.width).toBeLessThanOrEqual(viewport.width <= 480 ? viewport.width - 16 : 400);
  expect(geometry.bottom).toBeLessThanOrEqual(viewport.height);
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
