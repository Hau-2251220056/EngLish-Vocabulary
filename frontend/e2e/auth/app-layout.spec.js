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
  await page.setViewportSize({ width: 1536, height: 900 });
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
  await expect(page.locator("header .authenticated-brand")).toBeVisible();
  const brandLink = page.getByRole("link", { name: "Về trang chủ ELVocab" });
  await expect(brandLink).toHaveAttribute("href", "/dashboard");
  const desktopLogo = brandLink.locator(".elvocab-logo-full");
  await expect(desktopLogo).toBeVisible();
  await expect(brandLink.locator(".elvocab-logo-mobile")).toBeHidden();
  await expect.poll(() => desktopLogo.evaluate((image) => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0)).toBe(true);
  await expect.poll(() => desktopLogo.evaluate((image) => image.naturalWidth / image.naturalHeight)).toBeGreaterThan(2);
  await expect(brandLink.getByText("ELVocab", { exact: true })).toHaveCount(0);
  await expect(page.locator("aside .authenticated-brand")).toHaveCount(0);
  await expect(page.locator(".authenticated-sidebar-profile")).toContainText(publicUser.display_name);
  await expect(page.locator(".authenticated-sidebar-profile")).toContainText(publicUser.email);
  await expect(page.locator(".authenticated-sidebar-session").getByRole("button", { name: "Đăng xuất" })).toBeVisible();
  const headerNavigation = page.getByRole("navigation", { name: "Điều hướng nhanh" });
  await expect(headerNavigation.getByRole("link")).toHaveCount(3);
  await expect(headerNavigation.getByRole("link")).toHaveText(["Trang chủ", "Bộ từ của tôi", "Khám phá bộ từ"]);
  await expect(headerNavigation.getByRole("link", { name: "Trang chủ" })).toHaveAttribute("href", "/dashboard");
  await expect(headerNavigation.getByRole("link", { name: "Trang chủ" })).toHaveAttribute("aria-current", "page");
  await expect(headerNavigation.getByRole("link", { name: "Bộ từ của tôi" })).toHaveAttribute("href", "/my/vocabulary-sets");
  await expect(headerNavigation.getByRole("link", { name: "Khám phá bộ từ" })).toHaveAttribute("href", "/topics");
  await expect(headerNavigation.getByRole("link", { name: "Trang chủ" })).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(headerNavigation.getByRole("link", { name: "Trang chủ" })).toHaveCSS("color", "rgb(76, 162, 230)");
  await expect(headerNavigation.getByRole("link", { name: "Trang chủ" })).toHaveCSS("font-size", "15px");
  await expect(page.getByRole("button", { name: `Mở menu tài khoản của ${publicUser.display_name}` })).toBeVisible();
  await expect(page.locator(".authenticated-navigation").getByRole("link")).toHaveCount(3);
  await expect(page.locator(".authenticated-navigation").getByRole("link", { name: "Trang chủ" })).toHaveAttribute("href", "/dashboard");
  await expect(page.locator(".authenticated-navigation").getByRole("link", { name: "Trang chủ" })).toHaveAttribute("aria-current", "page");
  await expect(page.locator(".authenticated-navigation").getByRole("link", { name: "Bộ từ của tôi", exact: true })).toHaveAttribute("href", "/my/vocabulary-sets");
  await expect(
    page
      .getByRole("navigation", { name: "Điều hướng ứng dụng" })
      .getByRole("link", { name: "Khám phá bộ từ" }),
  ).toHaveAttribute("href", "/topics");
  await expect(page.locator('.authenticated-navigation a[href="/my/learning-progress"]')).toHaveCount(0);
  await expect(page.locator('.authenticated-navigation a[href^="/admin/"]')).toHaveCount(0);
  await expect(page.locator(".authenticated-drawer-toggle")).toBeHidden();
  const headerBox = await page.locator("header.authenticated-header").boundingBox();
  const headerInnerBox = await page.locator(".authenticated-header-inner").boundingBox();
  expect(headerBox.x).toBe(0);
  expect(headerBox.width).toBe(page.viewportSize().width);
  await expect(page.locator("header.authenticated-header")).toHaveCSS("justify-content", "normal");
  await expect(page.locator("header.authenticated-header")).toHaveCSS("gap", "0px");
  expect(headerInnerBox.width).toBeLessThanOrEqual(1440);
  expect(Math.abs(headerInnerBox.x - (page.viewportSize().width - headerInnerBox.width) / 2)).toBeLessThanOrEqual(0.5);
  const headerInsets = await page.locator("header.authenticated-header").evaluate((header) => {
    const inner = header.querySelector(".authenticated-header-inner").getBoundingClientRect();
    const brand = header.querySelector(".authenticated-brand").getBoundingClientRect();
    const avatar = header.querySelector(".authenticated-avatar-trigger").getBoundingClientRect();
    const navigation = header.querySelector(".authenticated-header-navigation").getBoundingClientRect();
    const links = [...header.querySelectorAll(".authenticated-header-link")].map((link) => link.getBoundingClientRect());
    const activeLink = header.querySelector(".authenticated-header-link.is-active");
    const activeLinkBounds = activeLink.getBoundingClientRect();
    const activeTextRange = document.createRange();
    activeTextRange.selectNodeContents(activeLink);
    const activeTextBounds = activeTextRange.getBoundingClientRect();
    const activeIndicator = getComputedStyle(activeLink, "::after");
    const indicatorTop = activeLinkBounds.bottom - Number.parseFloat(activeIndicator.bottom) - Number.parseFloat(activeIndicator.height);
    return {
      inner: { left: inner.left, right: inner.right, center: inner.left + inner.width / 2 },
      brand: { left: brand.left, right: brand.right },
      navigation: { left: navigation.left, right: navigation.right, center: navigation.left + navigation.width / 2 },
      avatar: { left: avatar.left, right: avatar.right },
      brandLeft: brand.left,
      avatarRight: avatar.right,
      navGaps: [links[1].left - links[0].right, links[2].left - links[1].right],
      indicatorBottom: activeIndicator.bottom,
      indicatorHeight: activeIndicator.height,
      indicatorTextGap: indicatorTop - activeTextBounds.bottom,
      indicatorOpacity: activeIndicator.opacity,
      viewportWidth: window.innerWidth,
    };
  });
  expect(headerInsets.brandLeft).toBeGreaterThanOrEqual(170);
  expect(headerInsets.brandLeft).toBeLessThanOrEqual(185);
  expect(headerInsets.viewportWidth - headerInsets.avatarRight).toBeGreaterThanOrEqual(170);
  expect(headerInsets.viewportWidth - headerInsets.avatarRight).toBeLessThanOrEqual(185);
  expect(Math.abs(headerInsets.navigation.center - headerInsets.inner.center)).toBeLessThanOrEqual(0.5);
  expect(headerInsets.brand.right).toBeLessThan(headerInsets.navigation.left);
  expect(headerInsets.navigation.right).toBeLessThan(headerInsets.avatar.left);
  expect(headerInsets.navGaps.every((gap) => gap >= 12 && gap <= 14)).toBe(true);
  expect(headerInsets.indicatorBottom).toBe("6px");
  expect(headerInsets.indicatorHeight).toBe("1px");
  expect(headerInsets.indicatorTextGap).toBeGreaterThanOrEqual(6);
  expect(headerInsets.indicatorTextGap).toBeLessThanOrEqual(8);
  expect(headerInsets.indicatorOpacity).toBe("1");
  const sidebarBox = await page.locator("aside.authenticated-sidebar").boundingBox();
  expect(sidebarBox.y).toBeGreaterThanOrEqual(headerBox.y + headerBox.height);
  const sidebarOrder = await page.locator("aside.authenticated-sidebar").evaluate((sidebar) => {
    const profile = sidebar.querySelector(".authenticated-sidebar-profile").getBoundingClientRect();
    const navigation = sidebar.querySelector(".authenticated-navigation").getBoundingClientRect();
    const session = sidebar.querySelector(".authenticated-sidebar-session").getBoundingClientRect();
    return { profileBottom: profile.bottom, navigationTop: navigation.top, navigationBottom: navigation.bottom, sessionTop: session.top };
  });
  expect(sidebarOrder.profileBottom).toBeLessThanOrEqual(sidebarOrder.navigationTop);
  expect(sidebarOrder.navigationBottom).toBeLessThan(sidebarOrder.sessionTop);
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

for (const width of [375, 390, 430]) {
  test(`USER mobile header composes brand, avatar, and menu at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 812 });
    await installAuthApiMock(page, {
      "/api/auth/me": responses.currentUser(publicUser),
    });
    await page.goto("/dashboard");

    const header = page.locator("header.authenticated-header");
    const brand = header.getByRole("link", { name: "Về trang chủ ELVocab" });
    const avatar = header.getByRole("button", { name: `Mở menu tài khoản của ${publicUser.display_name}` });
    const toggle = header.getByRole("button", { name: "Mở điều hướng" });
    const geometry = await header.evaluate((element) => {
      const bounds = (selector) => {
        const { left, right, width: itemWidth, height } = element.querySelector(selector).getBoundingClientRect();
        return { left, right, width: itemWidth, height };
      };
      return {
        headerHeight: element.getBoundingClientRect().height,
        brand: bounds(".authenticated-mobile-brand"),
        logo: bounds(".elvocab-logo-mobile"),
        avatar: bounds(".authenticated-avatar-trigger"),
        avatarVisual: bounds(".authenticated-avatar"),
        toggle: bounds(".authenticated-drawer-toggle"),
        menuIcon: bounds(".authenticated-drawer-toggle svg"),
        utilities: bounds(".authenticated-header-utilities"),
        utilityGap: getComputedStyle(element.querySelector(".authenticated-header-utilities")).columnGap,
      };
    });

    await expect(brand).toHaveAttribute("href", "/dashboard");
    await expect(brand.getByText("ELVocab", { exact: true })).toHaveCount(0);
    await expect(brand.locator(".elvocab-logo-mobile")).toBeVisible();
    await expect(brand.locator(".elvocab-logo-full")).toBeHidden();
    await expect.poll(() => brand.locator(".elvocab-logo-mobile").evaluate((image) => image.naturalWidth / image.naturalHeight)).toBeLessThan(1.2);
    await expect(avatar).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Điều hướng nhanh" })).toBeHidden();
    await expect(page.locator(".authenticated-header-inner")).toHaveCSS("display", "flex");
    await expect(page.locator(".authenticated-header-inner")).toHaveCSS("justify-content", "space-between");
    await expect(toggle).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    expect(geometry.brand.left).toBe(16);
    expect(geometry.brand.left).toBeLessThan(geometry.avatar.left);
    expect(geometry.avatar.left).toBeLessThan(geometry.toggle.left);
    expect(geometry.headerHeight).toBe(60);
    expect(geometry.logo.width).toBe(40);
    expect(geometry.logo.height).toBe(40);
    expect(geometry.avatarVisual.width).toBe(32);
    expect(geometry.avatarVisual.height).toBe(32);
    expect(geometry.menuIcon.width).toBe(18);
    expect(geometry.menuIcon.height).toBe(18);
    expect(geometry.utilityGap).toBe("4px");
    expect(geometry.avatar.width).toBeGreaterThanOrEqual(44);
    expect(geometry.avatar.height).toBeGreaterThanOrEqual(44);
    expect(geometry.toggle.width).toBeGreaterThanOrEqual(44);
    expect(geometry.toggle.height).toBeGreaterThanOrEqual(44);
    expect(width - geometry.utilities.right).toBeGreaterThanOrEqual(12);
    await expectNoHorizontalOverflow(page);
  });
}

test("very narrow USER header keeps the linked mark and compact utilities", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await installAuthApiMock(page, {
    "/api/auth/me": responses.currentUser(publicUser),
  });
  await page.goto("/dashboard");

  const brand = page.getByRole("link", { name: "Về trang chủ ELVocab" });
  await expect(brand.locator(".elvocab-logo-mobile")).toBeVisible();
  await expect(brand.locator(".elvocab-logo-full")).toBeHidden();
  await expect(brand.getByText("ELVocab", { exact: true })).toHaveCount(0);
  await expect.poll(() => brand.locator(".elvocab-logo-mobile").evaluate((image) => image.naturalWidth / image.naturalHeight)).toBeLessThan(1.2);
  await expect(page.locator(".authenticated-avatar-trigger")).toBeVisible();
  await expect(page.locator(".authenticated-drawer-toggle")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

for (const width of [768, 820]) {
  test(`tablet header keeps the full brand left in a flex row at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1024 });
    await installAuthApiMock(page, {
      "/api/auth/me": responses.currentUser(publicUser),
    });
    await page.goto("/dashboard");

    const headerInner = page.locator(".authenticated-header-inner");
    const brand = page.getByRole("link", { name: "Về trang chủ ELVocab" });
    const avatar = page.getByRole("button", { name: `Mở menu tài khoản của ${publicUser.display_name}` });
    const toggle = page.getByRole("button", { name: "Mở điều hướng" });
    const positions = await headerInner.evaluate((element) => ({
      brand: element.querySelector(".authenticated-mobile-brand").getBoundingClientRect().left,
      logoHeight: element.querySelector(".elvocab-logo-full").getBoundingClientRect().height,
      avatar: element.querySelector(".authenticated-avatar-trigger").getBoundingClientRect().left,
      toggle: element.querySelector(".authenticated-drawer-toggle").getBoundingClientRect().left,
    }));

    await expect(headerInner).toHaveCSS("display", "flex");
    await expect(headerInner).toHaveCSS("justify-content", "space-between");
    await expect(brand.getByText("ELVocab", { exact: true })).toHaveCount(0);
    await expect(brand.locator(".elvocab-logo-full")).toBeVisible();
    await expect(brand.locator(".elvocab-logo-mobile")).toBeHidden();
    await expect.poll(() => brand.locator(".elvocab-logo-full").evaluate((image) => image.naturalWidth / image.naturalHeight)).toBeGreaterThan(2);
    await expect(page.getByRole("navigation", { name: "Điều hướng nhanh" })).toBeHidden();
    await expect(avatar).toBeVisible();
    await expect(toggle).toBeVisible();
    expect(positions.brand).toBe(32);
    expect(positions.logoHeight).toBe(40);
    expect(positions.brand).toBeLessThan(positions.avatar);
    expect(positions.avatar).toBeLessThan(positions.toggle);
  });
}

for (const width of [1024, 1366]) {
  test(`desktop breakpoint restores the centered three-column header at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await installAuthApiMock(page, {
      "/api/auth/me": responses.currentUser(publicUser),
    });
    await page.goto("/dashboard");

    const headerInner = page.locator(".authenticated-header-inner");
    const navigation = page.getByRole("navigation", { name: "Điều hướng nhanh" });
    await expect(headerInner).toHaveCSS("display", "grid");
    await expect(navigation).toBeVisible();
    const navigationBox = await navigation.boundingBox();
    expect(Math.abs((navigationBox.x + navigationBox.width / 2) - width / 2)).toBeLessThanOrEqual(1);
  });
}

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
    await expect(page.getByRole("navigation", { name: "Điều hướng nhanh" })).toBeHidden();
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
    await expect(sidebar.locator(".authenticated-sidebar-profile")).toContainText(publicUser.email);
    await expect(sidebar.locator(".authenticated-sidebar-session").getByRole("button", { name: "Đăng xuất" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Trang chủ", exact: true })).toBeFocused();
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
