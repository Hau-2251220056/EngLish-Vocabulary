import { expect, test } from "@playwright/test";
import { installAuthApiMock, publicUser, responses } from "./fixtures/auth-api.js";

const publicViewports = [
  { name: "desktop-1440", width: 1440, height: 900 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "narrow-320", width: 320, height: 720 },
];

for (const viewport of publicViewports) {
  test(`guest attribution uses compact ELVocab public chrome on ${viewport.name}`, async ({ page }, testInfo) => {
    await installAuthApiMock(page, { "/api/auth/me": responses.guest() });
    await page.setViewportSize(viewport);
    await page.goto("/data-sources");

    const header = page.locator(".public-topic-header");
    const brand = page.getByRole("link", { name: "Trang chủ ELVocab" });
    await expect(header).toBeVisible();
    await expect(brand.locator("img:visible")).toHaveCount(1);
    await expect(brand).toHaveAttribute("href", "/");
    await expect(page.getByRole("navigation", { name: "Điều hướng công khai" }).getByRole("link", { name: "Trang chủ" })).toHaveAttribute("href", "/");
    await expect(page.getByRole("navigation", { name: "Điều hướng công khai" }).getByRole("link", { name: "Đăng nhập" })).toHaveAttribute("href", "/login");
    await expect(page.getByRole("heading", { level: 1, name: "Nguồn dữ liệu & Giấy phép" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Tải dữ liệu C1 chuyển thể/ })).toHaveAttribute("download", "");
    await expect(page.getByText(/211 trường hợp IPA cần thêm bằng chứng/)).toBeVisible();
    await expect(page.locator(".public-topic-heading-mark, .lucide-file-check-2")).toHaveCount(0);
    const metrics = await page.evaluate(() => ({
      headerHeight: document.querySelector(".public-topic-header").getBoundingClientRect().height,
      headingFontSize: Number.parseFloat(getComputedStyle(document.querySelector("h1")).fontSize),
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      publicBackgroundImage: getComputedStyle(document.querySelector(".public-topic-app")).backgroundImage,
      targets: [...document.querySelectorAll(".public-topic-header a")].map((element) => element.getBoundingClientRect().height),
    }));
    expect(metrics.headerHeight).toBeLessThanOrEqual(72);
    expect(metrics.headingFontSize).toBeLessThanOrEqual(40);
    expect(metrics.overflow).toBe(false);
    expect(metrics.publicBackgroundImage).toBe("none");
    expect(metrics.targets.every((height) => height >= 44)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`data-sources-${viewport.name}.png`), fullPage: true });
  });
}

test("Landing footer retains approved links and omits guest Explore", async ({ page }) => {
  await installAuthApiMock(page, { "/api/auth/me": responses.guest() });
  await page.goto("/");
  const footer = page.getByRole("navigation", { name: "Liên kết cuối trang" });
  await expect(footer.getByRole("link")).toHaveText(["Nguồn dữ liệu & Giấy phép", "Đăng nhập", "Đăng ký"]);
  await expect(footer.getByRole("link", { name: "Khám phá bộ từ" })).toHaveCount(0);
});

test("public header home, brand and login actions use deterministic destinations", async ({ page }) => {
  await installAuthApiMock(page, { "/api/auth/me": responses.guest() });
  await page.goto("/data-sources");
  await expect(page.getByRole("heading", { name: "Nguồn dữ liệu & Giấy phép" })).toBeVisible();
  const brand = page.getByRole("link", { name: "Trang chủ ELVocab" });
  await page.evaluate(() => {
    document.body.tabIndex = -1;
    document.body.focus();
  });
  await page.keyboard.press("Tab");
  await expect(brand).toBeFocused();
  await expect(brand).toHaveCSS("outline-width", "3px");
  await page.keyboard.press("Tab");
  const home = page.getByRole("navigation", { name: "Điều hướng công khai" }).getByRole("link", { name: "Trang chủ" });
  await expect(home).toBeFocused();
  await expect(home).toHaveCSS("outline-width", "3px");
  await brand.click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/data-sources");
  await home.click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/data-sources");
  await page.getByRole("navigation", { name: "Điều hướng công khai" }).getByRole("link", { name: "Đăng nhập" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("direct guest Topics access retains existing route behavior with updated public chrome", async ({ page }) => {
  await installAuthApiMock(page, { "/api/auth/me": responses.guest() });
  await page.goto("/topics");
  await expect(page.getByRole("heading", { name: "Khám phá bộ từ" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Trang chủ ELVocab" })).toBeVisible();
});

test("authenticated learner retains direct attribution access without a sidebar entry", async ({ page }) => {
  await installAuthApiMock(page, { "/api/auth/me": responses.currentUser(publicUser) });
  await page.goto("/data-sources");
  await expect(page).toHaveURL(/\/data-sources$/);
  await expect(page.locator(".authenticated-app")).toBeVisible();
  await expect(page.locator(".public-topic-header")).toHaveCount(0);
  await expect(page.locator("aside.authenticated-sidebar").getByRole("link", { name: "Nguồn dữ liệu & Giấy phép" })).toHaveCount(0);
  await expect(page.locator(".authenticated-sidebar-session").getByRole("button", { name: "Đăng xuất" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Nguồn dữ liệu & Giấy phép" })).toBeVisible();
  const explore = page.getByRole("navigation", { name: "Điều hướng ứng dụng" }).getByRole("link", { name: "Khám phá bộ từ" });
  await expect(explore).toHaveAttribute("href", "/topics");
  await explore.click();
  await expect(page).toHaveURL(/\/topics$/);
  await expect(page.getByRole("heading", { name: "Khám phá bộ từ" })).toBeVisible();
});
