import { expect, test } from "@playwright/test";
import {
  deferredResponse,
  installAuthApiMock,
  publicUser,
  responses,
} from "./fixtures/auth-api.js";

test("Login and Register validation blocks invalid requests", async ({ page }) => {
  const api = await installAuthApiMock(page);
  await page.goto("/login");

  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.getByText("Vui lòng nhập email.")).toBeVisible();
  await expect(page.getByText("Vui lòng nhập mật khẩu.")).toBeVisible();

  await page.getByLabel("Email").fill("not-an-email");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("short");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.getByText("Email không hợp lệ.")).toBeVisible();
  await expect(page.getByText("Mật khẩu phải có ít nhất 8 ký tự.")).toBeVisible();
  expect(api.callsFor("/api/auth/login")).toHaveLength(0);

  await page.goto("/register");
  await page.getByRole("button", { name: "Tạo tài khoản", exact: true }).click();
  await expect(page.getByText("Vui lòng nhập email.")).toBeVisible();
  await expect(page.getByText("Vui lòng nhập mật khẩu.")).toBeVisible();
  expect(api.callsFor("/api/auth/register")).toHaveLength(0);

  await page.getByLabel("Tên hiển thị").fill("Learner");
  await page.getByLabel("Email").fill("not-an-email");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("short");
  await page.getByLabel("Xác nhận mật khẩu").fill("short");
  await page.getByRole("button", { name: "Tạo tài khoản", exact: true }).click();
  await expect(page.getByText("Email không hợp lệ.")).toBeVisible();
  await expect(page.getByText("Mật khẩu phải có ít nhất 8 ký tự.")).toBeVisible();
  expect(api.callsFor("/api/auth/register")).toHaveLength(0);

  await page.getByLabel("Email").fill("learner@example.com");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("password");
  await page.getByLabel("Xác nhận mật khẩu").fill("different");
  await page.getByRole("button", { name: "Tạo tài khoản", exact: true }).click();
  await expect(page.getByText("Mật khẩu xác nhận không khớp.")).toBeVisible();
  expect(api.callsFor("/api/auth/register")).toHaveLength(0);
});

test("valid registration locks submission and hands Guest off to Login", async ({ page }) => {
  const pending = deferredResponse();
  const api = await installAuthApiMock(page, {
    "/api/auth/register": pending.response,
  });
  await page.goto("/register");

  await page.getByLabel("Tên hiển thị").fill("Learner");
  await page.getByLabel("Email").fill("LEARNER@EXAMPLE.COM");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("password");
  await page.getByLabel("Xác nhận mật khẩu").fill("password");
  await page.getByRole("button", { name: "Tạo tài khoản", exact: true }).click();

  const pendingButton = page.getByRole("button", { name: "Đang tạo tài khoản..." });
  await expect(pendingButton).toBeDisabled();
  expect(api.callsFor("/api/auth/register")).toHaveLength(1);

  pending.resolve(responses.registration());
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByLabel("Email")).toHaveValue("LEARNER@EXAMPLE.COM");
  expect(api.callsFor("/api/auth/register")[0].body).toEqual({
    display_name: "Learner",
    email: "learner@example.com",
    password: "password",
  });
  expect(api.callsFor("/api/auth/login")).toHaveLength(0);
});

test("valid Login exposes pending state, deduplicates and enters Dashboard", async ({ page }) => {
  const pending = deferredResponse();
  const api = await installAuthApiMock(page, {
    "/api/auth/login": pending.response,
  });
  await page.goto("/login");

  await page.getByLabel("Email").fill("LEARNER@EXAMPLE.COM");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("password");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();

  const pendingButton = page.getByRole("button", { name: "Đang đăng nhập..." });
  await expect(pendingButton).toBeDisabled();
  await pendingButton.dispatchEvent("click");
  expect(api.callsFor("/api/auth/login")).toHaveLength(1);

  pending.resolve(responses.login(publicUser));
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", {
    name: /^Chào buổi (sáng|trưa|chiều|tối), Learner\.$/,
  })).toBeVisible();
  expect(api.callsFor("/api/auth/login")[0].body).toEqual({
    email: "learner@example.com",
    password: "password",
  });

  expect(await page.evaluate(() => ({
    local: { ...localStorage },
    session: { ...sessionStorage },
  }))).toEqual({ local: {}, session: {} });
  await expect(page.getByText("raw-session-fixture-must-be-ignored")).toHaveCount(0);
});

test("Login and Register API failures show only approved safe errors", async ({ page }) => {
  await installAuthApiMock(page, {
    "/api/auth/login": responses.error(
      401,
      "AUTHENTICATION_FAILED",
      "Authentication failed.",
      "raw login detail",
    ),
    "/api/auth/register": responses.error(
      409,
      "EMAIL_ALREADY_EXISTS",
      "Email already exists.",
      "raw registration detail",
    ),
  });

  await page.goto("/login");
  await page.getByLabel("Email").fill("learner@example.com");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("wrong-password");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Email hoặc mật khẩu không chính xác.");
  await expect(page.getByText("raw login detail")).toHaveCount(0);

  await page.goto("/register");
  await page.getByLabel("Tên hiển thị").fill("Learner");
  await page.getByLabel("Email").fill("learner@example.com");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("password");
  await page.getByLabel("Xác nhận mật khẩu").fill("password");
  await page.getByRole("button", { name: "Tạo tài khoản", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Email này đã được đăng ký.");
  await expect(page.getByText("raw registration detail")).toHaveCount(0);
});

test("backend validation and generic API failures use safe fallback messages", async ({ page }) => {
  await installAuthApiMock(page, {
    "/api/auth/login": responses.error(
      400,
      "VALIDATION_ERROR",
      "Raw backend validation message.",
      "raw validation detail",
    ),
    "/api/auth/register": responses.error(
      500,
      "UNEXPECTED_INTERNAL_ERROR",
      "Raw internal message.",
      "raw internal detail",
    ),
  });

  await page.goto("/login");
  await page.getByLabel("Email").fill("learner@example.com");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("password");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Vui lòng kiểm tra lại thông tin và thử lại.",
  );
  await expect(page.getByText("Raw backend validation message.")).toHaveCount(0);

  await page.goto("/register");
  await page.getByLabel("Tên hiển thị").fill("Learner");
  await page.getByLabel("Email").fill("learner@example.com");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("password");
  await page.getByLabel("Xác nhận mật khẩu").fill("password");
  await page.getByRole("button", { name: "Tạo tài khoản", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Yêu cầu chưa thể hoàn tất. Vui lòng thử lại.",
  );
  await expect(page.getByText("Raw internal message.")).toHaveCount(0);
});

test("network failure produces the approved operational Login error", async ({ page }) => {
  await installAuthApiMock(page, {
    "/api/auth/login": responses.abort(),
  });
  await page.goto("/login");
  await page.getByLabel("Email").fill("learner@example.com");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("password");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();

  await expect(page.getByRole("alert")).toContainText(
    "Không thể kết nối đến máy chủ. Vui lòng thử lại.",
  );
});
