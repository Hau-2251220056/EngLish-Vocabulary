import { expect, test } from "@playwright/test";
import { deferredResponse, installAuthApiMock, publicUser, responses } from "./fixtures/auth-api.js";

const summary = { id: "personal-set-1", name: "Du lịch", description: "Từ vựng cần thiết cho chuyến đi", item_count: 2 };
const aggregate = {
  ...summary,
  topic_id: null,
  items: [
    { id: "item-1", vocabulary_id: "vocabulary-1", position: 1, word: "airport", phonetic: null, source: "CANONICAL" },
    { id: "item-2", vocabulary_id: "vocabulary-2", position: 2, word: "ticket", phonetic: null, source: "CANONICAL" },
  ],
};

async function installMySets(page, { list = [], mutation } = {}) {
  await installAuthApiMock(page, { "/api/auth/me": responses.currentUser(publicUser) });
  const calls = [];
  await page.route("**/api/my/vocabulary-sets**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    const call = { method: request.method(), pathname, body: request.postData() ? request.postDataJSON() : null };
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
  await expect(dialog.getByRole("combobox")).toHaveCount(0);
  await expect(dialog.getByRole("searchbox")).toHaveCount(0);
  await expect(dialog.getByText("Danh sách từ vựng theo thứ tự")).toHaveCount(0);

  await dialog.getByLabel("Tên bộ từ").fill("  Du lịch  ");
  await dialog.getByLabel("Mô tả (không bắt buộc)").fill("  Từ vựng cần thiết cho chuyến đi  ");
  await dialog.getByRole("button", { name: "Tạo bộ từ", exact: true }).click();

  await expect(dialog).toHaveCount(0);
  const create = calls.find((call) => call.method === "POST");
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
  expect(calls.filter((call) => call.method === "POST")).toHaveLength(1);
  gate.resolve(responses.error(500, "INTERNAL_SERVER_ERROR", "Internal server error."));
  await expect(dialog.getByRole("alert")).toContainText("Không thể lưu bộ từ");
  await expect(dialog.getByLabel("Tên bộ từ")).toHaveValue("Bộ từ đang soạn");
  await expect(dialog.getByLabel("Mô tả (không bắt buộc)")).toHaveValue("Giữ lại nội dung này");
  await submit.click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  expect(calls.filter((call) => call.method === "POST")).toHaveLength(2);
});

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

test("edit modal sends metadata only and remains within the mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const calls = await installMySets(page, { list: [summary] });
  await page.goto(`/my/vocabulary-sets/${summary.id}`);
  await expect(page.getByRole("heading", { level: 2, name: summary.name })).toBeVisible();
  await page.getByRole("button", { name: "Chỉnh sửa" }).click();

  const dialog = page.getByRole("dialog", { name: "Chỉnh sửa bộ từ" });
  await expect(dialog.getByLabel("Tên bộ từ")).toHaveValue(summary.name);
  await expect(dialog.getByRole("searchbox")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const box = await dialog.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(15);
  expect(box.x + box.width).toBeLessThanOrEqual(360);

  await dialog.getByLabel("Tên bộ từ").fill("Du lịch nâng cao");
  await dialog.getByRole("button", { name: "Lưu thay đổi" }).click();
  const update = calls.find((call) => call.method === "PATCH");
  expect(update.body).toEqual({ name: "Du lịch nâng cao", description: summary.description });
  expect(update.body).not.toHaveProperty("topic_id");
  expect(update.body).not.toHaveProperty("items");
});
