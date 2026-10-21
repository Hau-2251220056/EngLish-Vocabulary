import { expect, test } from "@playwright/test";
import {
  installAuthApiMock,
  publicAdmin,
  publicUser,
  responses,
} from "./fixtures/auth-api.js";

const viewports = [
  { name: "narrow-320", width: 320, height: 700 },
  { name: "mobile-375", width: 375, height: 812 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "desktop-1024", width: 1024, height: 768 },
  { name: "desktop-1366", width: 1366, height: 768 },
  { name: "desktop-1440", width: 1440, height: 900 },
  { name: "desktop-1536", width: 1536, height: 900 },
];

const howItWorksMobileViewports = [
  { name: "narrow-320", width: 320, height: 700 },
  { name: "mobile-375", width: 375, height: 812 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "mobile-430", width: 430, height: 900 },
  { name: "tablet-768", width: 768, height: 1024 },
];

test("Guest root presents accurate Landing content and working authentication CTAs", async ({ page }) => {
  await installAuthApiMock(page);
  await page.goto("/");

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1, name: "Làm chủ tiếng Anh từng từ một" })).toBeVisible();
  await expect(page.locator('img[alt="ELVocab"]')).toBeVisible();
  await expect(page.getByRole("link", { name: "Đăng nhập", exact: true }).first()).toHaveAttribute("href", "/login");
  await expect(page.getByRole("link", { name: "Bắt đầu miễn phí", exact: true }).first()).toHaveAttribute("href", "/register");
  await expect(page.getByTestId("feature-grid").locator("article")).toHaveCount(6);
  await expect(page.getByTestId("step-list").locator("li")).toHaveCount(3);
  await expect(page.getByText("Đánh giá", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/VocabAI/i)).toHaveCount(0);
  await expect(page.getByText(/\d+[,.]?\d*\+?\s*(người dùng|học viên)|đảm bảo ghi nhớ|chấm điểm phát âm/i)).toHaveCount(0);
});

test("Xem demo moves focus to the static product demonstration", async ({ page }) => {
  await installAuthApiMock(page);
  await page.goto("/");

  await page.getByRole("link", { name: "Xem demo" }).click();
  await expect(page).toHaveURL(/#san-pham-demo$/);
  await expect(page.locator("#san-pham-demo")).toBeFocused();
  await expect(page.getByRole("heading", { name: "Một không gian học tập tập trung và dễ sử dụng" })).toBeVisible();
  await expect(page.getByText(/bản demo tĩnh, không phải dữ liệu/i)).toBeVisible();
});

test("Product Preview sidebar is a static vocabulary index without search semantics", async ({ page }) => {
  await installAuthApiMock(page);
  await page.goto("/");

  const preview = page.locator("#san-pham-demo");
  await expect(preview.getByRole("heading", { name: "Giao tiếp hằng ngày" }).first()).toBeVisible();
  await expect(preview.getByText("Danh sách từ vựng")).toBeVisible();
  await expect(preview.getByLabel("Từ số 1 trên tổng số 3 từ")).toHaveText("01 / 03");
  const vocabularyList = preview.getByRole("list", { name: "Từ vựng trong bản demo" });
  await expect(vocabularyList.getByRole("listitem")).toHaveCount(3);
  await expect(vocabularyList.getByText("curious", { exact: true })).toBeVisible();
  await expect(vocabularyList.getByText("resilient", { exact: true })).toBeVisible();
  await expect(vocabularyList.getByText("achieve", { exact: true })).toBeVisible();
  await expect(preview.getByText("Tìm trong bộ từ")).toHaveCount(0);
  await expect(preview.getByRole("searchbox")).toHaveCount(0);
});

test("manual card, flip control and keyboard activation expose only the active face", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installAuthApiMock(page);
  await page.goto("/");
  const card = page.getByTestId("preview-flashcard");
  const flipButton = page.getByRole("button", { name: "Lật thẻ", exact: true });

  await expect(card).toHaveAttribute("data-face", "front");
  await expect(card).toHaveAccessibleName(/mặt trước/i);
  await expect(card.locator(".preview-card-back")).toHaveAttribute("aria-hidden", "true");
  await card.click();
  await expect(card).toHaveAttribute("data-face", "back");
  await expect(card.locator(".preview-card-back")).toHaveAttribute("aria-hidden", "false");
  await expect(card.getByText("tò mò, ham tìm hiểu")).toBeVisible();
  await page.waitForTimeout(650);
  await flipButton.click();
  await expect(card).toHaveAttribute("data-face", "front");
  await page.waitForTimeout(650);
  await card.focus();
  await page.keyboard.press("Space");
  await expect(card).toHaveAttribute("data-face", "back");
  await expect(card).toBeFocused();
});

test("manual interaction permanently cancels the pending automatic demonstration", async ({ page }) => {
  await page.clock.install();
  await installAuthApiMock(page);
  await page.goto("/");
  const card = page.getByTestId("preview-flashcard");
  await card.scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "Lật thẻ", exact: true }).click();
  await expect(card).toHaveAttribute("data-face", "back");
  await page.getByRole("button", { name: "Lật thẻ", exact: true }).click();
  await expect(card).toHaveAttribute("data-face", "back");
  await page.clock.fastForward(15_000);
  await expect(card).toHaveAttribute("data-face", "back");
});

test("automatic Flashcard demonstration runs once and returns to the front", async ({ page }) => {
  await page.clock.install();
  await installAuthApiMock(page);
  await page.goto("/");
  const card = page.getByTestId("preview-flashcard");
  await card.scrollIntoViewIfNeeded();
  await page.clock.fastForward(2_400);
  await expect(card).toHaveAttribute("data-face", "front");
  await page.clock.fastForward(200);
  await expect(card).toHaveAttribute("data-face", "back");
  await page.clock.fastForward(2_100);
  await expect(card).toHaveAttribute("data-face", "front");
  await page.clock.fastForward(15_000);
  await expect(card).toHaveAttribute("data-face", "front");
});

test("reduced motion disables automatic Flashcard animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.install();
  await installAuthApiMock(page);
  await page.goto("/");
  const card = page.getByTestId("preview-flashcard");
  await card.scrollIntoViewIfNeeded();
  await page.clock.fastForward(15_000);
  await expect(card).toHaveAttribute("data-face", "front");
  await expect(card.locator(".preview-card-flipper")).toHaveCSS("transition-duration", "0.001s");
});

for (const actor of [publicUser, publicAdmin]) {
  test(`authenticated ${actor.role} root redirects to Dashboard`, async ({ page }) => {
    await installAuthApiMock(page, { "/api/auth/me": responses.currentUser(actor) });
    await page.goto("/");
    await expect(page).toHaveURL(/\/dashboard$/);
  });
}

test("mobile menu exposes navigation, closes with Escape and restores focus", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await installAuthApiMock(page);
  await page.goto("/");

  const trigger = page.getByRole("button", { name: "Mở menu" });
  await trigger.click();
  const closeTrigger = page.getByRole("button", { name: "Đóng menu" });
  await expect(closeTrigger).toHaveAttribute("aria-expanded", "true");
  const menu = page.getByRole("navigation", { name: "Điều hướng trang giới thiệu trên di động" });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("link", { name: "Tính năng" })).toHaveAttribute("href", "#tinh-nang");
  await expect(menu.getByRole("link", { name: "Cách hoạt động" })).toHaveAttribute("href", "#cach-hoat-dong");

  await page.keyboard.press("Escape");
  await expect(page.getByRole("navigation", { name: "Điều hướng trang giới thiệu trên di động" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Mở menu" })).toBeFocused();
});

for (const viewport of viewports) {
  test(`${viewport.name} Landing layout has no horizontal overflow`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await installAuthApiMock(page);
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("#san-pham-demo")).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();
    await expect.poll(() => page.evaluate(() => ({
      body: document.body.scrollWidth - document.body.clientWidth,
      document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }))).toEqual({ body: 0, document: 0 });
    await expect.poll(() => page.locator("#landing-title").evaluate((heading) => {
      const headingRect = heading.getBoundingClientRect();
      const emphasisRect = heading.querySelector("span").getBoundingClientRect();
      return {
        overflow: getComputedStyle(heading).overflow,
        topIsVisible: emphasisRect.top >= headingRect.top - 1,
        bottomIsVisible: emphasisRect.bottom <= headingRect.bottom + 1,
      };
    })).toEqual({ overflow: "visible", topIsVisible: true, bottomIsVisible: true });
  });
}

for (const viewport of viewports.filter(({ width }) => width <= 390)) {
  test(`${viewport.name} uses the approved compact Landing composition`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize(viewport);
    await installAuthApiMock(page);
    await page.goto("/");

    const ctas = page.getByTestId("hero-cta-row").locator("a");
    await expect(ctas).toHaveCount(2);
    const ctaBoxes = await ctas.evaluateAll((items) => items.map((item) => {
      const box = item.getBoundingClientRect();
      return { top: box.top, bottom: box.bottom, width: box.width, scrollWidth: item.scrollWidth, clientWidth: item.clientWidth };
    }));
    expect(Math.abs(ctaBoxes[0].top - ctaBoxes[1].top)).toBeLessThanOrEqual(1);
    expect(Math.abs(ctaBoxes[0].bottom - ctaBoxes[1].bottom)).toBeLessThanOrEqual(1);
    expect(ctaBoxes.every(({ scrollWidth, clientWidth }) => scrollWidth <= clientWidth)).toBe(true);
    await expect(ctas.nth(0)).toHaveAttribute("href", "/register");
    await expect(ctas.nth(1)).toHaveAttribute("href", "#san-pham-demo");

    await expect(page.locator("#preview-index-title")).toBeHidden();
    const capabilities = page.getByTestId("preview-capability-grid").locator(":scope > div");
    await expect(capabilities).toHaveCount(3);
    const capabilityBoxes = await capabilities.evaluateAll((items) => items.map((item) => {
      const box = item.getBoundingClientRect();
      return { top: box.top, bottom: box.bottom, left: box.left, right: box.right };
    }));
    expect(new Set(capabilityBoxes.map(({ top }) => Math.round(top))).size).toBe(1);
    expect(new Set(capabilityBoxes.map(({ bottom }) => Math.round(bottom))).size).toBe(1);
    expect(capabilityBoxes.at(-1).right).toBeLessThanOrEqual(viewport.width);
    const cardBox = await page.getByTestId("preview-flashcard").boundingBox();
    expect(cardBox.y).toBeGreaterThanOrEqual(capabilityBoxes[0].bottom);

    const featureCards = page.getByTestId("feature-grid").locator("article");
    await expect(featureCards).toHaveCount(6);
    const featureBoxes = await featureCards.evaluateAll((items) => items.map((item) => {
      const box = item.getBoundingClientRect();
      return { left: box.left, top: box.top, height: box.height };
    }));
    expect(new Set(featureBoxes.map(({ left }) => Math.round(left))).size).toBe(2);
    expect(new Set(featureBoxes.map(({ top }) => Math.round(top))).size).toBe(3);
    expect(Math.max(...featureBoxes.map(({ height }) => height)) - Math.min(...featureBoxes.map(({ height }) => height))).toBeLessThanOrEqual(1);
    await expect(featureCards.locator("p")).toHaveCount(6);
    for (const description of await featureCards.locator("p").all()) await expect(description).toBeVisible();
  });
}

test("desktop Product Preview preserves the Phase 1 sidebar-center-capabilities structure", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await installAuthApiMock(page);
  await page.goto("/");

  const sidebar = page.locator("aside").filter({ has: page.getByText("Danh sách từ vựng") });
  const card = page.getByTestId("preview-flashcard");
  const capabilityGrid = page.getByTestId("preview-capability-grid");
  await expect(sidebar).toBeVisible();
  const [sidebarBox, cardBox, capabilityBox] = await Promise.all([
    sidebar.boundingBox(),
    card.boundingBox(),
    capabilityGrid.boundingBox(),
  ]);
  expect(sidebarBox.x + sidebarBox.width).toBeLessThanOrEqual(cardBox.x);
  expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(capabilityBox.x);
  expect(Math.abs(cardBox.y - capabilityBox.y)).toBeLessThanOrEqual(1);
});

test("mobile Flashcard retains manual flip behavior", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 375, height: 812 });
  await installAuthApiMock(page);
  await page.goto("/");
  const card = page.getByTestId("preview-flashcard");
  await card.scrollIntoViewIfNeeded();
  await expect(card).toHaveAttribute("data-face", "front");
  await card.click();
  await expect(card).toHaveAttribute("data-face", "back");
});

for (const viewport of howItWorksMobileViewports) {
  test(`${viewport.name} How It Works uses alternating orthogonal connectors`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await installAuthApiMock(page);
    await page.goto("/");

    const list = page.getByTestId("step-list");
    const steps = list.getByRole("listitem");
    const connectors = page.getByTestId("mobile-step-connector");
    await expect(steps).toHaveCount(3);
    await expect(connectors).toHaveCount(2);
    await expect(connectors.nth(0)).toHaveAttribute("data-direction", "right");
    await expect(connectors.nth(1)).toHaveAttribute("data-direction", "left");
    await expect(connectors.nth(0)).toHaveAttribute("aria-hidden", "true");

    const geometry = await list.evaluate((listElement) => {
      const stepElements = [...listElement.querySelectorAll("li")];
      return [...listElement.querySelectorAll('[data-testid="mobile-step-connector"]')].map((connector, index) => {
        const box = connector.getBoundingClientRect();
        const currentIcon = stepElements[index].querySelector('[data-testid="step-icon"]').getBoundingClientRect();
        const nextIcon = stepElements[index + 1].querySelector('[data-testid="step-icon"]').getBoundingClientRect();
        const currentBadge = stepElements[index].querySelector('[data-testid="step-icon"] span').getBoundingClientRect();
        const nextBadge = stepElements[index + 1].querySelector('[data-testid="step-icon"] span').getBoundingClientRect();
        const readableBoxes = [
          ...stepElements[index].querySelectorAll("h3, p"),
          ...stepElements[index + 1].querySelectorAll("h3, p"),
        ].map((element) => {
          const rect = element.getBoundingClientRect();
          return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
        });
        const styles = getComputedStyle(connector);
        return {
          direction: connector.dataset.direction,
          box: { left: box.left, right: box.right, top: box.top, bottom: box.bottom },
          currentIcon: {
            left: currentIcon.left,
            right: currentIcon.right,
            centerY: currentIcon.top + currentIcon.height / 2,
          },
          nextIcon: {
            left: nextIcon.left,
            right: nextIcon.right,
            centerY: nextIcon.top + nextIcon.height / 2,
          },
          currentBadgeBottom: currentBadge.bottom,
          nextBadgeBottom: nextBadge.bottom,
          readableBoxes,
          borderRadius: styles.borderRadius,
          borderTopStyle: styles.borderTopStyle,
          borderBottomStyle: styles.borderBottomStyle,
          borderLeftStyle: styles.borderLeftStyle,
          borderRightStyle: styles.borderRightStyle,
          borderLeftWidth: styles.borderLeftWidth,
          borderRightWidth: styles.borderRightWidth,
        };
      });
    });

    for (const connector of geometry) {
      expect(Math.abs(connector.box.top - connector.currentIcon.centerY)).toBeLessThanOrEqual(1);
      expect(Math.abs(connector.box.bottom - connector.nextIcon.centerY)).toBeLessThanOrEqual(1);
      expect(connector.box.top).toBeGreaterThan(connector.currentBadgeBottom);
      expect(connector.box.bottom).toBeGreaterThan(connector.nextBadgeBottom);
      expect(connector.borderRadius).toBe("0px");
      expect(connector.borderTopStyle).toBe("dashed");
      expect(connector.borderBottomStyle).toBe("dashed");
      if (connector.direction === "right") {
        expect(Math.abs(connector.box.left - connector.currentIcon.right)).toBeLessThanOrEqual(1);
        expect(Math.abs(connector.box.left - connector.nextIcon.right)).toBeLessThanOrEqual(1);
        expect(connector.borderRightStyle).toBe("dashed");
        expect(connector.borderRightWidth).toBe("1px");
        expect(connector.borderLeftWidth).toBe("0px");
        expect(connector.readableBoxes.every(({ right }) => connector.box.right >= right + 8)).toBe(true);
        expect(Math.min(...connector.readableBoxes.map(({ right }) => connector.box.right - right))).toBeLessThanOrEqual(14);
      } else {
        expect(Math.abs(connector.box.right - connector.currentIcon.left)).toBeLessThanOrEqual(1);
        expect(Math.abs(connector.box.right - connector.nextIcon.left)).toBeLessThanOrEqual(1);
        expect(connector.borderLeftStyle).toBe("dashed");
        expect(connector.borderLeftWidth).toBe("1px");
        expect(connector.borderRightWidth).toBe("0px");
        expect(connector.readableBoxes.every(({ left }) => connector.box.left <= left - 8)).toBe(true);
        expect(Math.min(...connector.readableBoxes.map(({ left }) => left - connector.box.left))).toBeLessThanOrEqual(14);
      }
    }

    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  });
}

test("desktop How It Works preserves its horizontal connector", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installAuthApiMock(page);
  await page.goto("/");
  for (const connector of await page.getByTestId("mobile-step-connector").all()) {
    await expect(connector).toBeHidden();
  }
  await expect(page.getByTestId("desktop-step-connector")).toBeVisible();
  const positions = await page.getByTestId("step-list").getByRole("listitem").evaluateAll((items) => items.map((item) => {
    const box = item.getBoundingClientRect();
    return { left: box.left, top: box.top };
  }));
  expect(new Set(positions.map(({ left }) => Math.round(left))).size).toBe(3);
  expect(new Set(positions.map(({ top }) => Math.round(top))).size).toBe(1);
});

test("capture orthogonal How It Works mobile evidence", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installAuthApiMock(page);
  for (const viewport of howItWorksMobileViewports) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.locator("#cach-hoat-dong").screenshot({
      path: testInfo.outputPath(`how-it-works-orthogonal-${viewport.width}.png`),
      style: "header { visibility: hidden !important; }",
    });
  }
});

test("desktop navbar keeps navigation and authentication actions grouped on the right", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await installAuthApiMock(page);
  await page.goto("/");

  const logo = page.getByRole("link", { name: "Trang chủ ELVocab" });
  const rightGroup = page.getByTestId("landing-navbar-right-group");
  await expect(rightGroup).toBeVisible();
  const positions = await Promise.all([logo, rightGroup].map((item) => item.boundingBox()));
  expect(positions[0].x + positions[0].width).toBeLessThan(positions[1].x);
  await expect(rightGroup.getByRole("link", { name: "Tính năng" })).toBeVisible();
  await expect(rightGroup.getByRole("link", { name: "Đăng nhập" })).toBeVisible();
});

test("Landing uses the approved grid treatment and distinct soft feature-card accents", async ({ page }) => {
  await installAuthApiMock(page);
  await page.goto("/");
  await expect(page.locator("#landing-title")).toBeVisible();

  const appearance = await page.evaluate(() => {
    const hero = document.querySelector(".landing-hero-grid");
    const finalCta = document.querySelector(".landing-final-cta");
    const cards = [...document.querySelectorAll('[data-testid="feature-grid"] article')];
    return {
      heroBackground: getComputedStyle(hero).backgroundColor,
      heroGrid: getComputedStyle(hero, "::before").backgroundImage,
      heroGridMask: getComputedStyle(hero, "::before").maskImage,
      previewBackground: getComputedStyle(document.querySelector(".landing-preview-continuity")).backgroundColor,
      finalCtaBackground: getComputedStyle(finalCta).backgroundImage,
      primaryButton: getComputedStyle(document.querySelector('a[href="/register"]')).backgroundColor,
      cards: cards.map((card) => ({
        background: getComputedStyle(card).backgroundColor,
        border: getComputedStyle(card).borderColor,
      })),
    };
  });

  expect(appearance.heroBackground).toBe("rgb(255, 255, 255)");
  expect(appearance.previewBackground).toBe("rgb(255, 255, 255)");
  expect(appearance.heroGrid.match(/linear-gradient/g)?.length).toBe(2);
  expect(appearance.heroGridMask).toContain("radial-gradient");
  expect(appearance.finalCtaBackground).toContain("linear-gradient");
  expect(appearance.primaryButton).toBe("rgb(75, 140, 204)");
  expect(appearance.cards).toHaveLength(6);
  expect(appearance.cards.every(({ background, border }) => background !== "rgba(0, 0, 0, 0)" && border !== "rgb(255, 255, 255)")).toBe(true);
  expect(new Set(appearance.cards.map(({ background }) => background)).size).toBe(6);
  await expect(page.getByRole("heading", { level: 3, name: "Quiz trắc nghiệm" })).toBeVisible();
  await expect(page.getByText("Luyện tập với các câu hỏi trắc nghiệm rõ ràng, dễ thao tác và bám sát nội dung bạn đang học.")).toBeVisible();
});

test("desktop section links update the fragment, focus the target and scroll smoothly", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await installAuthApiMock(page);
  await page.goto("/");
  await expect(page.locator("#landing-title")).toBeVisible();

  for (const { label, hash } of [
    { label: "Tính năng", hash: "#tinh-nang" },
    { label: "Cách hoạt động", hash: "#cach-hoat-dong" },
  ]) {
    await page.evaluate((targetHash) => {
      window.__landingScrollBehavior = null;
      document.querySelector(targetHash).scrollIntoView = (options) => {
        window.__landingScrollBehavior = options.behavior;
      };
    }, hash);
    await page.getByTestId("landing-navbar-right-group").getByRole("link", { name: label }).click();
    await expect(page).toHaveURL(new RegExp(`${hash}$`));
    await expect(page.locator(hash)).toBeFocused();
    await expect.poll(() => page.evaluate(() => window.__landingScrollBehavior)).toBe("smooth");
  }
});

test("reduced motion uses instant demo scrolling", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installAuthApiMock(page);
  await page.goto("/");
  await expect(page.locator("#san-pham-demo")).toBeVisible();
  await page.evaluate(() => {
    window.__demoScrollBehavior = null;
    const target = document.querySelector("#san-pham-demo");
    target.scrollIntoView = (options) => { window.__demoScrollBehavior = options.behavior; };
  });

  await page.getByRole("link", { name: "Xem demo" }).click();
  await expect.poll(() => page.evaluate(() => window.__demoScrollBehavior)).toBe("auto");
});

for (const path of ["/login", "/register"]) {
  test(`${path} provides a working return link to the Landing page`, async ({ page }) => {
    await installAuthApiMock(page);
    await page.goto(path);
    const returnLink = page.getByRole("link", { name: "Quay về trang chủ" });
    await expect(returnLink).toHaveAttribute("href", "/");
    await expect(page.getByTestId("auth-card").getByRole("link", { name: "Quay về trang chủ" })).toHaveCount(0);
    const geometry = await Promise.all([
      returnLink.boundingBox(),
      page.getByTestId("auth-card").boundingBox(),
    ]);
    expect(geometry[0].y + geometry[0].height).toBeLessThanOrEqual(geometry[1].y);
    await returnLink.click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator("#landing-title")).toBeVisible();
  });
}

test("Focused UI review captures desktop and mobile Landing evidence", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installAuthApiMock(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("landing-refinement-desktop-1440.png"), fullPage: true });
  const preview = page.locator("#san-pham-demo");
  await preview.scrollIntoViewIfNeeded();
  await preview.screenshot({ path: testInfo.outputPath("product-preview-desktop-front-1440.png") });
  await page.getByTestId("feature-grid").screenshot({ path: testInfo.outputPath("feature-section-desktop-1440.png") });
  await page.locator("aside").filter({ has: page.getByText("Danh sách từ vựng") }).screenshot({ path: testInfo.outputPath("product-preview-sidebar-1440.png") });
  await page.getByTestId("preview-flashcard").click();
  await expect(page.getByTestId("preview-flashcard")).toHaveAttribute("data-face", "back");
  await preview.screenshot({ path: testInfo.outputPath("product-preview-desktop-back-1440.png") });

  await page.setViewportSize({ width: 320, height: 700 });
  await page.reload();
  await expect(page.getByTestId("preview-flashcard")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("hero-product-preview-mobile-320.png"), fullPage: true });

  await page.setViewportSize({ width: 375, height: 812 });
  await page.reload();
  await page.locator("#san-pham-demo").screenshot({ path: testInfo.outputPath("product-preview-mobile-375.png") });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.getByTestId("feature-grid").screenshot({ path: testInfo.outputPath("feature-section-mobile-390.png") });

});
