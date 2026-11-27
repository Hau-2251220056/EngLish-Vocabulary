import { expect, test } from "@playwright/test";
import { installAuthApiMock, publicUser, responses } from "./fixtures/auth-api.js";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    let configuration;
    window.google = {
      accounts: {
        id: {
          initialize(next) { configuration = next; },
          renderButton(container, { text, locale, width, logo_alignment: logoAlignment }) {
            const button = document.createElement("button");
            button.type = "button";
            button.textContent = {
              signin_with: "Đăng nhập với Google",
              signup_with: "Đăng ký với Google",
            }[text] ?? "Unexpected GIS label";
            button.dataset.gisText = text;
            button.dataset.gisLocale = locale;
            button.dataset.gisLogoAlignment = logoAlignment;
            button.style.width = `${width}px`;
            button.style.height = "44px";
            button.addEventListener("click", () => {
              if (!window.__GOOGLE_CANCEL__) configuration.callback({ credential: "mock-google-credential" });
            });
            container.append(button);
          },
        },
      },
    };
  });
});

const googleScreens = [
  { route: "/login", text: "signin_with", label: "Đăng nhập với Google" },
  { route: "/register", text: "signup_with", label: "Đăng ký với Google" },
];

for (const { route, text, label } of googleScreens) {
  test(`${route} renders the official-control host after the primary action`, async ({ page }) => {
    await installGoogleMocks(page);
    await page.goto(route);
    const control = page.getByTestId("google-authentication-control");
    await expect(control.getByText("Hoặc")).toBeVisible();
    const button = control.getByRole("button", { name: label });
    await expect(button).toBeVisible();
    await expect(button).toHaveAttribute("data-gis-text", text);
    await expect(button).toHaveAttribute("data-gis-locale", "vi");
    await expect(button).toHaveAttribute("data-gis-logo-alignment", "center");
    const order = await page.locator("[data-testid=auth-form-panel]").evaluate((panel) => {
      const primary = panel.querySelector('button[type="submit"]');
      const google = panel.querySelector('[data-testid="google-authentication-control"]');
      const switcher = panel.querySelector("form + p");
      return Boolean(primary && google && switcher && primary.compareDocumentPosition(google) & Node.DOCUMENT_POSITION_FOLLOWING && google.compareDocumentPosition(switcher) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    expect(order).toBe(true);
  });
}

test("Google success reuses Authentication state and navigates to Dashboard", async ({ page }) => {
  const api = await installGoogleMocks(page);
  await page.goto("/login");
  await page.getByRole("button", { name: "Đăng nhập với Google" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(api.callsFor("/api/auth/google/challenge")).toHaveLength(1);
  expect(api.callsFor("/api/auth/google")[0].body).toEqual({ credential: "mock-google-credential" });
});

test("Google failure preserves password form input and exposes one error", async ({ page }) => {
  await installGoogleMocks(page, { failLogin: true });
  await page.goto("/login");
  await page.getByLabel("Email").fill("kept@example.com");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("kept-password");
  await page.getByRole("button", { name: "Đăng nhập với Google" }).click();
  await expect(page.getByRole("alert")).toHaveCount(1);
  await expect(page.getByLabel("Email")).toHaveValue("kept@example.com");
  await expect(page.getByLabel("Mật khẩu", { exact: true })).toHaveValue("kept-password");
});

test("popup cancellation preserves form input and permits retry", async ({ page }) => {
  await page.addInitScript(() => { window.__GOOGLE_CANCEL__ = true; });
  await installGoogleMocks(page);
  await page.goto("/login");
  await page.getByLabel("Email").fill("kept@example.com");
  await page.getByRole("button", { name: "Đăng nhập với Google" }).click();
  await expect(page.getByLabel("Email")).toHaveValue("kept@example.com");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.evaluate(() => { window.__GOOGLE_CANCEL__ = false; });
  await page.getByRole("button", { name: "Đăng nhập với Google" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("Google control remains keyboard reachable", async ({ page }) => {
  await installGoogleMocks(page);
  await page.goto("/login");
  const googleButton = page.getByRole("button", { name: "Đăng nhập với Google" });
  await googleButton.focus();
  await expect(googleButton).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("SDK failure leaves password authentication available", async ({ page }) => {
  await page.addInitScript(() => { delete window.google; });
  await page.route("https://accounts.google.com/gsi/client", (route) => route.abort("failed"));
  await installGoogleMocks(page);
  await page.goto("/login");
  await expect(page.getByText("Google hiện không khả dụng. Bạn vẫn có thể dùng email và mật khẩu.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Đăng nhập", exact: true })).toBeEnabled();
});

for (const width of [1440, 1024, 768, 375, 320]) {
  test(`Google Auth layout uses page scrolling without overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width <= 390 ? 640 : 900 });
    await installGoogleMocks(page);
    for (const { route, label } of googleScreens) {
      await page.goto(route);
      const control = page.getByTestId("google-authentication-control");
      const button = control.getByRole("button", { name: label });
      await expect(button).toBeVisible();
      const buttonBox = await button.boundingBox();
      const controlBox = await control.boundingBox();
      expect(buttonBox.x).toBeGreaterThanOrEqual(controlBox.x);
      expect(buttonBox.x + buttonBox.width).toBeLessThanOrEqual(controlBox.x + controlBox.width + 1);
      expect(buttonBox.height).toBeGreaterThanOrEqual(44);
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
      const geometry = await page.evaluate(() => ({
        cardOverflow: getComputedStyle(document.querySelector("[data-testid=auth-card]")).overflowY,
        panelOverflow: getComputedStyle(document.querySelector("[data-testid=auth-form-panel]")).overflowY,
        footerAfterCard: document.querySelector("[data-testid=auth-card]").getBoundingClientRect().bottom <= document.querySelector("footer.auth-footer").getBoundingClientRect().top,
      }));
      expect(geometry.cardOverflow).not.toMatch(/auto|scroll/);
      expect(geometry.panelOverflow).not.toMatch(/auto|scroll/);
      expect(geometry.footerAfterCard).toBe(true);
    }
  });
}

async function installGoogleMocks(page, { failLogin = false } = {}) {
  return installAuthApiMock(page, {
    "/api/auth/me": responses.guest(),
    "/api/auth/google/challenge": {
      status: 201,
      json: { success: true, data: { nonce: "mock-nonce", expires_at: "2026-11-26T00:05:00.000Z" } },
    },
    "/api/auth/google": failLogin
      ? { status: 401, json: { success: false, error: { code: "GOOGLE_AUTHENTICATION_FAILED", message: "Google authentication failed." } } }
      : responses.login(publicUser),
  });
}
