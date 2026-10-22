import { expect, test } from "@playwright/test";
import {
  deferredResponse,
  installAuthApiMock,
  publicAdmin,
  publicUser,
  responses,
} from "./fixtures/auth-api.js";

const landingHeading = "Làm chủ tiếng Anh từng từ một";

test("pending Guest restoration at root shows only the Landing-specific loading state", async ({ page }) => {
  const pending = deferredResponse();
  await installAuthApiMock(page, { "/api/auth/me": pending.response });

  await page.goto("/");

  const loadingState = page.getByTestId("landing-loading-state");
  await expect(loadingState).toBeVisible();
  await expect(loadingState.getByRole("status")).toHaveText("Đang tải ELVocab…");
  await expect(page.getByRole("heading", { level: 1, name: landingHeading })).toHaveCount(0);
  await expect(page.getByRole("link")).toHaveCount(0);
  await expect(page.getByRole("button")).toHaveCount(0);

  pending.resolve(responses.guest());
  await expect(page.getByRole("heading", { level: 1, name: landingHeading })).toBeVisible();
  await expect(page.getByRole("link", { name: "Bắt đầu miễn phí", exact: true }).first()).toBeVisible();
});

for (const actor of [publicUser, publicAdmin]) {
  test(`pending ${actor.role} restoration redirects without a Landing flash`, async ({ page }) => {
    const pending = deferredResponse();
    await installAuthApiMock(page, { "/api/auth/me": pending.response });

    await page.goto("/");
    await expect(page.getByTestId("landing-loading-state")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: landingHeading })).toHaveCount(0);
    await expect(page.getByRole("link")).toHaveCount(0);

    pending.resolve(responses.currentUser(actor));
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByTestId("landing-loading-state")).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1, name: landingHeading })).toHaveCount(0);
  });
}

for (const path of ["/login", "/register", "/dashboard"]) {
  test(`${path} retains the existing Authentication loading state`, async ({ page }) => {
    const pending = deferredResponse();
    await installAuthApiMock(page, { "/api/auth/me": pending.response });

    await page.goto(path);
    await expect(page.getByRole("status")).toContainText("Đang kiểm tra phiên đăng nhập…");
    await expect(page.getByTestId("landing-loading-state")).toHaveCount(0);

    pending.resolve(responses.guest());
    await expect(page).toHaveURL(path === "/dashboard" ? /\/login$/ : new RegExp(`${path}$`));
  });
}

test("Landing loading state is responsive and reduced-motion safe", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const pending = deferredResponse();
  await installAuthApiMock(page, { "/api/auth/me": pending.response });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const loadingState = page.getByTestId("landing-loading-state");
  await expect(loadingState).toBeVisible();
  await expect(page.getByTestId("landing-loading-hero-skeleton")).toHaveCSS("animation-name", "none");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  await page.screenshot({ path: testInfo.outputPath("guest-landing-loading-desktop-1440.png"), fullPage: true });

  await page.setViewportSize({ width: 375, height: 812 });
  await expect(loadingState).toBeVisible();
  await expect(page.getByTestId("landing-loading-navbar-placeholder")).toBeHidden();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  await page.screenshot({ path: testInfo.outputPath("guest-landing-loading-mobile-375.png"), fullPage: true });
});
