import { expect, test } from "@playwright/test";
import { Buffer } from "node:buffer";
import { deferredResponse, installAuthApiMock, publicUser, responses } from "./fixtures/auth-api.js";

const summary = { id: "personal-set-1", name: "Du lịch", description: "Từ vựng cần thiết cho chuyến đi", item_count: 2 };
const aggregate = {
  ...summary,
  topic_id: null,
  items: [
    { id: "item-1", vocabulary_id: "vocabulary-1", position: 1, word: "airport", phonetic: null, source: "CANONICAL", primary_meaning: null },
    { id: "item-2", vocabulary_id: "vocabulary-2", position: 2, word: "ticket", phonetic: null, source: "CANONICAL", primary_meaning: null },
  ],
};

async function installMySets(page, { list = [], mutation } = {}) {
  await installAuthApiMock(page, { "/api/auth/me": responses.currentUser(publicUser) });
  const calls = [];
  await page.route("**/api/my/vocabulary-sets**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    const contentType = request.headers()["content-type"] ?? "";
    const call = {
      method: request.method(), pathname,
      body: request.postData() && contentType.includes("application/json") ? request.postDataJSON() : request.postData(),
    };
    calls.push(call);
    if (request.method() === "GET" && pathname === "/api/my/vocabulary-sets") {
      await route.fulfill({ status: 200, json: { success: true, data: list } });
      return;
    }
    if (request.method() === "GET" && pathname === `/api/my/vocabulary-sets/${summary.id}`) {
      await route.fulfill({ status: 200, json: { success: true, data: aggregate } });
      return;
    }
    if (mutation) {
      await route.fulfill(await mutation(call));
      return;
    }
    await route.fulfill({ status: 200, json: { success: true, data: aggregate } });
  });
  return calls;
}

test("create modal is metadata-only and omits Topic and items", async ({ page }) => {
  const calls = await installMySets(page);
  await page.goto("/my/vocabulary-sets");
  const trigger = page.getByRole("button", { name: "Tạo bộ từ", exact: true }).first();
  await trigger.click();

  const dialog = page.getByRole("dialog", { name: "Tạo bộ từ" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Tên bộ từ")).toBeFocused();
  await expect(dialog.getByLabel("Mô tả (không bắt buộc)")).toBeVisible();
  const cefr = dialog.getByRole("combobox", { name: /Trình độ CEFR/ });
  await expect(cefr).toBeVisible();
  await cefr.selectOption("A2");
  await expect(cefr).toHaveValue("A2");
  await cefr.selectOption("");
  await expect(dialog.getByRole("searchbox")).toHaveCount(0);
  await expect(dialog.getByText("Danh sách từ vựng theo thứ tự")).toHaveCount(0);

  await dialog.getByLabel("Tên bộ từ").fill("  Du lịch  ");
  await dialog.getByLabel("Mô tả (không bắt buộc)").fill("  Từ vựng cần thiết cho chuyến đi  ");
  await dialog.getByRole("button", { name: "Tạo bộ từ", exact: true }).click();

  await expect(dialog).toHaveCount(0);
  const createToast = page.getByText("Đã tạo bộ từ thành công.", { exact: true });
  await expect(createToast).toHaveCount(1);
  await expect(page.locator(".my-vocabulary-sets-feedback.is-success")).toHaveCount(0);
  const create = calls.find((call) => call.method === "POST");
  expect(create.body.cefr_level).toBeNull();
  expect(create.body.cover_image_url).toBeNull();
  delete create.body.cefr_level;
  delete create.body.cover_image_url;
  expect(create.body).toEqual({ name: "Du lịch", description: "Từ vựng cần thiết cho chuyến đi" });
  expect(create.body).not.toHaveProperty("topic_id");
  expect(create.body).not.toHaveProperty("items");
});

test("pending submit is guarded and a server error preserves entered values", async ({ page }) => {
  const gate = deferredResponse();
  let attempts = 0;
  const calls = await installMySets(page, {
    mutation: async () => {
      attempts += 1;
      if (attempts === 1) return gate.response;
      return responses.error(500, "INTERNAL_SERVER_ERROR", "Internal server error.");
    },
  });
  await page.goto("/my/vocabulary-sets");
  await page.getByRole("button", { name: "Tạo bộ từ", exact: true }).first().click();
  const dialog = page.getByRole("dialog", { name: "Tạo bộ từ" });
  await dialog.getByLabel("Tên bộ từ").fill("Bộ từ đang soạn");
  await dialog.getByLabel("Mô tả (không bắt buộc)").fill("Giữ lại nội dung này");
  const submit = dialog.locator('button[type="submit"]');
  await submit.dblclick();
  await expect(submit).toBeDisabled();
  await expect.poll(() => calls.filter((call) => call.method === "POST")).toHaveLength(1);
  gate.resolve(responses.error(500, "INTERNAL_SERVER_ERROR", "Internal server error."));
  await expect(dialog.getByRole("alert")).toContainText("Không thể lưu bộ từ");
  await expect(page.getByText("Đã tạo bộ từ thành công.", { exact: true })).toHaveCount(0);
  await expect(dialog.getByLabel("Tên bộ từ")).toHaveValue("Bộ từ đang soạn");
  await expect(dialog.getByLabel("Mô tả (không bắt buộc)")).toHaveValue("Giữ lại nội dung này");
  await submit.click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect.poll(() => calls.filter((call) => call.method === "POST")).toHaveLength(2);
});

test("file create persists once, retries only upload, and keeps the private-cover warning", async ({ page }) => {
  let uploadAttempts = 0;
  const calls = await installMySets(page, { mutation: async (call) => {
    if (call.pathname.endsWith("/cover")) {
      uploadAttempts += 1;
      if (uploadAttempts === 1) return responses.error(502, "COVER_STORAGE_FAILED", "Cover storage operation failed.");
    }
    return { status: call.pathname === "/api/my/vocabulary-sets" ? 201 : 200, json: { success: true, data: aggregate, meta: { storage_cleanup: "complete" } } };
  } });
  await page.goto("/my/vocabulary-sets");
  await page.getByRole("button", { name: "Tạo bộ từ", exact: true }).first().click();
  const dialog = page.getByRole("dialog", { name: "Tạo bộ từ" });
  await expect(dialog.getByText("Không tải ảnh riêng tư hoặc nhạy cảm.", { exact: true })).toBeVisible();
  await expect(dialog.getByText(/Ảnh bìa có thể được truy cập công khai/)).toHaveCount(0);
  await dialog.getByLabel("Tên bộ từ").fill("Bộ từ có ảnh");
  await dialog.locator('input[type="file"]').setInputFiles({ name: "cover.png", mimeType: "image/png", buffer: Buffer.from("mock-image") });
  await dialog.getByRole("button", { name: "Tạo bộ từ", exact: true }).click();
  const retryDialog = page.getByRole("dialog", { name: "Chỉnh sửa bộ từ" });
  await expect(retryDialog.getByRole("alert")).toContainText(/ảnh bìa chưa tải lên/i);
  await retryDialog.getByRole("button", { name: "Thử tải ảnh lại" }).click();
  await expect(retryDialog).toHaveCount(0);
  expect(calls.filter((call) => call.method === "POST" && call.pathname === "/api/my/vocabulary-sets")).toHaveLength(1);
  expect(calls.filter((call) => call.pathname.endsWith("/cover"))).toHaveLength(2);
});

for (const mode of ["create", "edit"]) {
  test(`${mode} Set picker cancellation keeps the modal and selected cover`, async ({ page }) => {
    const calls = await installMySets(page, { list: mode === "edit" ? [summary] : [] });
    await page.goto("/my/vocabulary-sets");
    if (mode === "create") {
      await page.getByRole("button", { name: "Tạo bộ từ", exact: true }).first().click();
    } else {
      await page.getByRole("button", { name: `Quản lý ${summary.name}` }).click();
      await page.getByRole("menuitem", { name: "Chỉnh sửa" }).click();
    }
    const dialog = page.getByRole("dialog", { name: mode === "create" ? "Tạo bộ từ" : "Chỉnh sửa bộ từ" });
    await dialog.getByLabel("Tên bộ từ").fill("Nội dung chưa lưu");
    await dialog.getByLabel("Mô tả (không bắt buộc)").fill("Mô tả vẫn còn");
    const fileInput = dialog.locator('input[type="file"]');
    await fileInput.setInputFiles({ name: "cover.png", mimeType: "image/png", buffer: Buffer.from("mock-image") });
    const preview = dialog.getByRole("img", { name: "Xem trước ảnh bìa bộ từ" });
    const previewSrc = await preview.getAttribute("src");
    await expect(dialog.getByText("Đã chọn: cover.png")).toBeVisible();

    await fileInput.evaluate((input) => {
      input.value = "";
      input.dispatchEvent(new Event("cancel", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));

    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Tên bộ từ")).toHaveValue("Nội dung chưa lưu");
    await expect(dialog.getByLabel("Mô tả (không bắt buộc)")).toHaveValue("Mô tả vẫn còn");
    await expect(dialog.getByText("Đã chọn: cover.png")).toBeVisible();
    await expect(preview).toHaveAttribute("src", previewSrc);
    await expect(dialog.getByText("Không tải ảnh riêng tư hoặc nhạy cảm.", { exact: true })).toBeVisible();
    expect(calls.filter((call) => ["POST", "PATCH", "PUT", "DELETE"].includes(call.method))).toHaveLength(0);
  });
}

test("Escape, backdrop, and close button dismiss safely and restore trigger focus", async ({ page }) => {
  await installMySets(page);
  await page.goto("/my/vocabulary-sets");
  const trigger = page.getByRole("button", { name: "Tạo bộ từ", exact: true }).first();

  await trigger.click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Tạo bộ từ" })).toHaveCount(0);
  await expect(trigger).toBeFocused();

  await trigger.click();
  await page.mouse.click(1, 1);
  await expect(page.getByRole("dialog", { name: "Tạo bộ từ" })).toHaveCount(0);
  await expect(trigger).toBeFocused();

  await trigger.click();
  await page.getByRole("dialog", { name: "Tạo bộ từ" }).getByRole("button", { name: "Đóng" }).click();
  await expect(page.getByRole("dialog", { name: "Tạo bộ từ" })).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("desktop metadata modal uses two columns without normal-state internal scrolling and collapses responsively", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await installMySets(page);
  await page.goto("/my/vocabulary-sets");
  await page.getByRole("button", { name: "Tạo bộ từ", exact: true }).first().click();
  const dialog = page.getByRole("dialog", { name: "Tạo bộ từ" });
  const desktop = await dialog.evaluate((element) => {
    const name = element.querySelector("#personal-set-name").getBoundingClientRect();
    const cover = element.querySelector("#personal-set-cover-cover-url").getBoundingClientRect();
    return {
      clientHeight: element.clientHeight, scrollHeight: element.scrollHeight,
      width: element.getBoundingClientRect().width, nameLeft: name.left, coverLeft: cover.left,
    };
  });
  expect(desktop.width).toBeGreaterThanOrEqual(850);
  expect(desktop.scrollHeight).toBeLessThanOrEqual(desktop.clientHeight + 1);
  expect(desktop.coverLeft).toBeGreaterThan(desktop.nameLeft + 200);
  await expect(dialog.getByRole("button", { name: "Tạo bộ từ", exact: true })).toBeInViewport();

  await page.setViewportSize({ width: 768, height: 1024 });
  expect(await dialog.evaluate((element) => ({
    noOverflow: document.documentElement.scrollWidth <= window.innerWidth,
    columns: getComputedStyle(element.querySelector("form")).gridTemplateColumns.trim().split(/\s+/).length,
  }))).toEqual({ noOverflow: true, columns: 1 });

  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = await dialog.evaluate((element) => {
    const name = element.querySelector("#personal-set-name").getBoundingClientRect();
    const cover = element.querySelector("#personal-set-cover-cover-url").getBoundingClientRect();
    return { pageWidth: document.documentElement.scrollWidth, viewportWidth: window.innerWidth, columns: getComputedStyle(element.querySelector("form")).gridTemplateColumns, coverRight: cover.right, coverTop: cover.top, nameBottom: name.bottom };
  });
  expect(mobile.pageWidth).toBeLessThanOrEqual(mobile.viewportWidth);
  expect(mobile.columns.trim().split(/\s+/)).toHaveLength(1);
  expect(mobile.coverRight).toBeLessThanOrEqual(mobile.viewportWidth);
  expect(mobile.coverTop).toBeGreaterThan(mobile.nameBottom);
});

test("edit modal sends metadata only and remains within the mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const calls = await installMySets(page, { list: [summary] });
  await page.goto("/my/vocabulary-sets");
  const card = page.getByRole("listitem").filter({ hasText: summary.name });
  await card.getByRole("button", { name: `Quản lý ${summary.name}` }).click();
  await page.getByRole("menuitem", { name: "Chỉnh sửa" }).click();

  const dialog = page.getByRole("dialog", { name: "Chỉnh sửa bộ từ" });
  await expect(dialog.getByLabel("Tên bộ từ")).toHaveValue(summary.name);
  await expect(dialog.getByRole("searchbox")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const box = await dialog.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(15);
  expect(box.x + box.width).toBeLessThanOrEqual(360);

  await dialog.getByLabel("Tên bộ từ").fill("Du lịch nâng cao");
  await dialog.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(page.getByText("Đã cập nhật bộ từ thành công.", { exact: true })).toHaveCount(1);
  const toastBounds = await page.locator(".elvocab-toast-container").boundingBox();
  expect(toastBounds.x).toBeGreaterThanOrEqual(0);
  expect(toastBounds.x + toastBounds.width).toBeLessThanOrEqual(375);
  const update = calls.find((call) => call.method === "PATCH");
  expect(update.body).toEqual({
    name: "Du lịch nâng cao", description: summary.description,
    cefr_level: null,
  });
  expect(update.body).not.toHaveProperty("topic_id");
  expect(update.body).not.toHaveProperty("items");
});

test("failed Set edit keeps the modal actionable without a success toast", async ({ page }) => {
  await installMySets(page, { list: [summary], mutation: async (call) => (
    call.method === "PATCH"
      ? responses.error(500, "INTERNAL_SERVER_ERROR", "hidden")
      : { status: 200, json: { success: true, data: aggregate } }
  ) });
  await page.goto("/my/vocabulary-sets");
  await page.getByRole("button", { name: `Quản lý ${summary.name}` }).click();
  await page.getByRole("menuitem", { name: "Chỉnh sửa" }).click();
  const dialog = page.getByRole("dialog", { name: "Chỉnh sửa bộ từ" });
  await dialog.getByLabel("Tên bộ từ").fill("Tên chưa lưu");
  await dialog.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Không thể lưu bộ từ");
  await expect(dialog.getByLabel("Tên bộ từ")).toHaveValue("Tên chưa lưu");
  await expect(page.getByText("Đã cập nhật bộ từ thành công.", { exact: true })).toHaveCount(0);
});

test("card management menu keeps delete failure recoverable and retry removes the Set", async ({ page }) => {
  let attempts = 0;
  await installMySets(page, { list: [summary], mutation: async (call) => {
    if (call.method === "DELETE") { attempts += 1; return attempts === 1 ? responses.error(500, "INTERNAL_SERVER_ERROR", "hidden") : { status: 204, body: "" }; }
    return { status: 200, json: { success: true, data: aggregate } };
  } });
  await page.goto("/my/vocabulary-sets");
  const card = page.getByRole("listitem").filter({ hasText: summary.name });
  const trigger = card.getByRole("button", { name: `Quản lý ${summary.name}` });
  await trigger.click(); await page.getByRole("menuitem", { name: "Xóa bộ từ" }).click();
  const dialog = page.getByRole("dialog", { name: "Xóa bộ từ?" });
  await dialog.getByRole("button", { name: "Xác nhận xóa" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Không thể xóa bộ từ");
  await expect(page.getByText("Đã xóa bộ từ thành công.", { exact: true })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Hủy" }).click(); await expect(trigger).toBeFocused();
  await trigger.click(); await page.getByRole("menuitem", { name: "Xóa bộ từ" }).click();
  await dialog.getByRole("button", { name: "Xác nhận xóa" }).click();
  await expect(dialog).toHaveCount(0); await expect(card).toHaveCount(0);
  await expect(page.getByText("Đã xóa bộ từ thành công.", { exact: true })).toHaveCount(1);
  await expect(page.locator(".my-vocabulary-sets-feedback.is-success")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Danh sách bộ từ" })).toBeFocused();
});
