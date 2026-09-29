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

test("desktop USER renders the production shell with only approved destinations", async ({ page }) => {
  await page.setViewportSize(viewports[2]);
  await installAuthApiMock(page, {
    "/api/auth/me": responses.currentUser(publicUser),
  });
  await page.goto("/dashboard");

  await expect(page.locator("header.authenticated-header")).toBeVisible();
  await expect(page.locator("aside.authenticated-sidebar")).toBeVisible();
  await expect(page.getByRole("heading", {
    name: new RegExp(`^Chào buổi (sáng|trưa|chiều|tối), ${publicUser.display_name}$`),
  })).toBeVisible();
  await expect(page.locator("footer.authenticated-footer")).toHaveCount(0);
  await expect(page.locator("header .authenticated-brand")).toBeHidden();
  await expect(page.getByRole("button", { name: `Mở menu tài khoản của ${publicUser.display_name}` })).toBeVisible();
  await expect(page.locator(".authenticated-navigation").getByRole("link")).toHaveCount(3);
  await expect(page.getByRole("link", { name: "Trang chủ" })).toHaveAttribute("href", "/dashboard");
  await expect(page.getByRole("link", { name: "Trang chủ" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("link", { name: "Bộ từ của tôi", exact: true })).toHaveAttribute("href", "/my/vocabulary-sets");
  await expect(
    page
      .getByRole("navigation", { name: "Điều hướng ứng dụng" })
      .getByRole("link", { name: "Khám phá bộ từ" }),
  ).toHaveAttribute("href", "/topics");
  await expect(page.locator('.authenticated-navigation a[href="/my/learning-progress"]')).toHaveCount(0);
  await expect(page.locator('.authenticated-navigation a[href^="/admin/"]')).toHaveCount(0);
  await expect(page.locator(".authenticated-drawer-toggle")).toBeHidden();
  await expectNoHorizontalOverflow(page);
});

test("desktop keeps the sidebar stable while main content scrolls", async ({ page }) => {
  await page.setViewportSize(viewports[2]);
  await installAuthApiMock(page, {
    "/api/auth/me": responses.currentUser(publicUser),
  });
  await page.goto("/dashboard");
  await page.locator("main.authenticated-main").evaluate((main) => {
    const tallContent = document.createElement("div");
    tallContent.setAttribute("data-layout-overflow-probe", "");
    tallContent.style.height = "1800px";
    main.append(tallContent);
  });

  const before = await page.locator("aside.authenticated-sidebar").boundingBox();
  await page.locator("main.authenticated-main").evaluate((main) => {
    main.scrollTop = 500;
  });
  const after = await page.locator("aside.authenticated-sidebar").boundingBox();
  const scrollState = await page.evaluate(() => ({
    body: document.body.scrollTop,
    document: document.documentElement.scrollTop,
    main: document.querySelector("main.authenticated-main").scrollTop,
  }));

  expect(scrollState).toEqual({ body: 0, document: 0, main: 500 });
  expect(after.y).toBe(before.y);
  await expectNoHorizontalOverflow(page);
});

test("avatar dropdown exposes identity and Logout with accessible dismissal", async ({ page }) => {
  await page.setViewportSize(viewports[2]);
  await installAuthApiMock(page, {
    "/api/auth/me": responses.currentUser(publicAdmin),
  });
  await page.goto("/dashboard");

  const trigger = page.getByRole("button", { name: `Mở menu tài khoản của ${publicAdmin.display_name}` });
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("button", { name: "Đăng xuất" })).toHaveCount(0);

  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(".authenticated-account-dropdown")).toContainText(publicAdmin.display_name);
  await expect(page.locator(".authenticated-account-dropdown")).toContainText("Quản trị viên");
  await expect(page.getByRole("button", { name: "Đăng xuất" })).toBeVisible();
  await expect(page.getByText("Profile", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Settings", { exact: true })).toHaveCount(0);

  await page.keyboard.press("Escape");
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(trigger).toBeFocused();

  await trigger.click();
  await page.locator("main.authenticated-main").click({ position: { x: 5, y: 5 } });
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
});

for (const viewport of viewports.slice(0, 2)) {
  test(`${viewport.name} drawer is isolated, accessible, and does not overflow`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await installAuthApiMock(page, {
      "/api/auth/me": responses.currentUser(publicUser),
    });
    await page.goto("/dashboard");

    const toggle = page.locator(".authenticated-drawer-toggle");
    const sidebar = page.locator(".authenticated-sidebar");
    const shellMain = page.locator(".authenticated-shell-main");
    await expect(toggle).toBeVisible();
    await expect(page.locator(".authenticated-mobile-brand")).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-controls", "authenticated-sidebar");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(sidebar).toHaveAttribute("inert", "");
    await expectNoHorizontalOverflow(page);

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(sidebar).toBeVisible();
    await expect(sidebar).not.toHaveAttribute("inert", "");
    await expect(shellMain).toHaveAttribute("inert", "");
    await expect(page.locator(".authenticated-drawer-backdrop")).toBeVisible();
    await expect(page.getByRole("link", { name: "Trang chủ" })).toBeFocused();
    await expectNoHorizontalOverflow(page);

    await page.keyboard.press("Escape");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toBeFocused();
    await expect(sidebar).toHaveAttribute("inert", "");
    await expect(shellMain).not.toHaveAttribute("inert", "");
  });
}

test("mobile drawer closes on route selection and backdrop click", async ({ page }) => {
  await page.setViewportSize(viewports[0]);
  await installAuthApiMock(page, {
    "/api/auth/me": responses.currentUser(publicUser),
  });
  await page.goto("/dashboard");

  const toggle = page.locator(".authenticated-drawer-toggle");
  await toggle.click();
  await page
    .getByRole("navigation", { name: "Điều hướng ứng dụng" })
    .getByRole("link", { name: "Khám phá bộ từ" })
    .click();
  await expect(page).toHaveURL(/\/topics$/);
  await expect(toggle).toHaveCount(0);

  await page.goto("/dashboard");
  const restoredToggle = page.locator(".authenticated-drawer-toggle");
  await restoredToggle.click();
  await page.locator(".authenticated-drawer-backdrop").click({ position: { x: 350, y: 400 } });
  await expect(restoredToggle).toHaveAttribute("aria-expanded", "false");
  await expect(restoredToggle).toBeFocused();
});

for (const viewport of viewports) {
  test(`${viewport.name} long identity and route content remain within the viewport`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const longName = "Learner with an intentionally very long display name for responsive coverage";
    await installAuthApiMock(page, {
      "/api/auth/me": responses.currentUser({ ...publicUser, display_name: longName }),
    });
    await page.goto("/dashboard");

    const trigger = page.getByRole("button", { name: `Mở menu tài khoản của ${longName}` });
    await trigger.click();
    await expect(page.locator(".authenticated-account-identity > p")).toHaveText(longName);
    await expect(page.locator("footer.authenticated-footer")).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });
}

async function expectNoHorizontalOverflow(page) {
  await expect.poll(() => page.evaluate(() => ({
    body: document.body.scrollWidth - document.body.clientWidth,
    document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }))).toEqual({ body: 0, document: 0 });
}
