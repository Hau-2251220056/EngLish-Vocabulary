import { expect, test } from "@playwright/test";
import {
  installAuthApiMock,
  publicAdmin,
  publicUser,
  responses,
} from "./fixtures/auth-api.js";

const viewports = [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1366, height: 768 },
];

test("desktop USER renders the shared layout without ADMIN navigation", async ({ page }) => {
  await page.setViewportSize(viewports[2]);
  await installAuthApiMock(page, {
    "/api/auth/me": responses.currentUser(publicUser),
  });
  await page.goto("/dashboard");

  await expect(page.locator("header.authenticated-header")).toBeVisible();
  await expect(page.locator("aside.authenticated-sidebar")).toBeVisible();
  await expect(page.locator("main.authenticated-main")).toContainText("Dashboard");
  await expect(page.locator("footer.authenticated-footer")).toHaveText("© 2026 ELVocab");
  await expect(page.locator("footer a, footer button")).toHaveCount(0);
  await expect(page.locator(".authenticated-avatar")).toHaveText("L");
  await expect(page.locator(".authenticated-header-name")).toHaveText(publicUser.display_name);
  await expect(page.getByRole("navigation").getByRole("link")).toHaveCount(2);
  await expect(page.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/dashboard");
  await expect(page.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
  await expect(page.locator('a[href="/my/vocabulary-sets"]')).toHaveCount(1);
  await expect(page.locator('a[href^="/admin/"]')).toHaveCount(0);
  await expect(page.locator(".authenticated-drawer-toggle")).toBeHidden();
  await expectNoHorizontalOverflow(page);
});

test("ADMIN keeps non-interactive context in the shared Header", async ({ page }) => {
  await installAuthApiMock(page, {
    "/api/auth/me": responses.currentUser(publicAdmin),
  });
  await page.goto("/dashboard");

  const indicator = page.locator("header .authenticated-admin-indicator");
  await expect(indicator).toHaveText(/Quản trị viên/);
  await expect(indicator).toHaveJSProperty("tagName", "SPAN");
  await expect(page.locator('a[href="/admin"]')).toHaveCount(0);
});

for (const viewport of viewports.slice(0, 2)) {
  test(`${viewport.name} drawer is accessible and does not overflow`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await installAuthApiMock(page, {
      "/api/auth/me": responses.currentUser(publicUser),
    });
    await page.goto("/dashboard");

    const toggle = page.locator(".authenticated-drawer-toggle");
    const sidebar = page.locator(".authenticated-sidebar");
    await expect(toggle).toBeVisible();
    await expect(page.locator(".authenticated-header-actions .authenticated-avatar")).toBeVisible();
    await expect(page.locator(".authenticated-header-name")).toBeHidden();
    await expect(toggle).toHaveAttribute("aria-controls", "authenticated-sidebar");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(sidebar).toHaveAttribute("inert", "");
    await expectNoHorizontalOverflow(page);

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(sidebar).toBeVisible();
    await expect(sidebar).not.toHaveAttribute("inert", "");
    await expect(page.locator(".authenticated-drawer-backdrop")).toBeVisible();
    await expect(page.locator(".authenticated-logout-button")).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.keyboard.press("Escape");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toBeFocused();
    await expect(sidebar).toHaveAttribute("inert", "");
  });
}

for (const viewport of viewports) {
  test(`${viewport.name} long identity and route content remain within the viewport`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await installAuthApiMock(page, {
      "/api/auth/me": responses.currentUser({
        ...publicUser,
        display_name: "Learner with an intentionally very long display name for responsive coverage",
      }),
    });
    await page.goto("/dashboard");
    if (viewport.width > 900) {
      await expect(page.locator(".authenticated-header-name")).toBeVisible();
    } else {
      await expect(page.locator(".authenticated-header-name")).toBeHidden();
    }
    await expect(page.locator("footer.authenticated-footer")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
}

async function expectNoHorizontalOverflow(page) {
  await expect.poll(() => page.evaluate(() => ({
    body: document.body.scrollWidth - document.body.clientWidth,
    document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }))).toEqual({ body: 0, document: 0 });
}
