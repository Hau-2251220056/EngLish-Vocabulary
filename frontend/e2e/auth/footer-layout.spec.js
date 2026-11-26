import { expect, test } from "@playwright/test";
import { installAuthApiMock, publicAdmin, publicUser, responses } from "./fixtures/auth-api.js";

test("learner footer is shared by normal learner routes and stays out of navigation", async ({ page }) => {
  await installAuthApiMock(page, { "/api/auth/me": responses.currentUser(publicUser) });
  await page.goto("/dashboard");

  const footer = page.locator("footer.learner-footer");
  await expect(footer).toBeVisible();
  await expect(footer).toContainText("© 2026 ELVocab.");
  await expect(footer.getByRole("link", { name: "Nguồn dữ liệu" })).toHaveAttribute("href", "/data-sources");
  await expect(page.locator("aside.authenticated-sidebar").getByRole("link", { name: "Nguồn dữ liệu" })).toHaveCount(0);
});

for (const route of [
  "/learn/vocabulary-sets/demo-set",
  "/review/global",
  "/review/sets/demo-set",
  "/quiz/vocabulary-sets/demo-set",
  "/pronunciation/vocabulary-sets/demo-set",
]) {
  test(`focus route ${route} excludes the learner footer`, async ({ page }) => {
    await installAuthApiMock(page, { "/api/auth/me": responses.currentUser(publicUser) });
    await page.goto(route);
    await expect(page.locator("footer.learner-footer")).toHaveCount(0);
  });
}

test("admin shell excludes the learner footer", async ({ page }) => {
  await installAuthApiMock(page, { "/api/auth/me": responses.currentUser(publicAdmin) });
  await page.goto("/admin/topics");
  await expect(page.locator("footer.learner-footer")).toHaveCount(0);
});

for (const route of ["/login", "/register"]) {
  test(`${route} renders the quiet auth footer outside the card`, async ({ page }) => {
    await installAuthApiMock(page, { "/api/auth/me": responses.guest() });
    await page.goto(route);
    const footer = page.locator("footer.auth-footer");
    await expect(footer).toBeVisible();
    await expect(footer).toContainText("© 2026 ELVocab. Dự án phục vụ mục đích giáo dục.");
    await expect(footer.getByRole("link", { name: "Trang chủ" })).toHaveAttribute("href", "/");
    await expect(footer.getByRole("link", { name: "Nguồn dữ liệu" })).toHaveAttribute("href", "/data-sources");
    await expect(page.locator("[data-testid=auth-card] footer")).toHaveCount(0);
  });
}

for (const width of [1440, 768, 390, 320]) {
  test(`learner footer stays responsive without horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await installAuthApiMock(page, { "/api/auth/me": responses.currentUser(publicUser) });
    await page.goto("/dashboard");
    await expect(page.locator("footer.learner-footer")).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  });
}
