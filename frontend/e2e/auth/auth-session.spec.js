import { expect, test } from "@playwright/test";
import {
  deferredResponse,
  installAuthApiMock,
  publicUser,
  responses,
} from "./fixtures/auth-api.js";

test("Logout pending state deduplicates and successful Logout becomes Guest", async ({ page }) => {
  const pending = deferredResponse();
  const api = await installAuthApiMock(page, {
    "/api/auth/me": responses.currentUser(publicUser),
    "/api/auth/logout": pending.response,
  });
  await page.goto("/dashboard");

  await page.getByRole("button", { name: "Đăng xuất" }).click();
  const pendingLogout = page.getByRole("button", { name: "Đang đăng xuất…" });
  await expect(pendingLogout).toBeDisabled();
  await expect(pendingLogout).toHaveAttribute("aria-busy", "true");
  await pendingLogout.dispatchEvent("click");
  expect(api.callsFor("/api/auth/logout")).toHaveLength(1);

  pending.resolve(responses.noContent());
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText("Phiên đăng nhập đã hết hạn.")).toHaveCount(0);
  await expect(page.getByText(/đăng xuất thành công/i)).toHaveCount(0);
});

test("idempotent Logout success follows the normal success flow", async ({ page }) => {
  await installAuthApiMock(page, {
    "/api/auth/me": responses.currentUser(publicUser),
    "/api/auth/logout": responses.noContent(),
  });
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("Logout failure preserves identity and hides raw details", async ({ page }) => {
  await installAuthApiMock(page, {
    "/api/auth/me": responses.currentUser(publicUser),
    "/api/auth/logout": responses.error(
      500,
      "AUTH_OPERATION_FAILED",
      "Internal session deletion failed.",
      "raw persistence detail",
    ),
  });
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Đăng xuất" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.locator(".authenticated-header-name")).toHaveText(publicUser.display_name);
  await expect(page.getByRole("button", { name: "Đăng xuất" })).toBeEnabled();
  await expect(page.getByRole("alert")).toContainText(
    "Không thể đăng xuất lúc này. Vui lòng thử lại.",
  );
  await expect(page.getByText("raw persistence detail")).toHaveCount(0);
  await expect(page.getByText("Internal session deletion failed.")).toHaveCount(0);
});

test("session-expiration component alert is accessible and dismissible", async ({ page }) => {
  await page.goto("/playwright/session-expired.html");

  const alert = page.getByRole("alert");
  await expect(alert).toContainText(
    "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
  );
  await page.getByRole("button", { name: "Đóng thông báo phiên đăng nhập" }).click();
  await expect(alert).toHaveCount(0);
});
