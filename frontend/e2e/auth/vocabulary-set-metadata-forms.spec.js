import { Buffer } from "node:buffer";
import { expect, test } from "@playwright/test";
import { installAuthApiMock, publicAdmin, responses } from "./fixtures/auth-api.js";

const set = {
  id: "system-set-metadata", topic_id: "topic-1", name: "System metadata", description: null,
  cefr_level: "A2", cover_image_url: "https://images.example.test/current.webp", item_count: 1,
  items: [{ id: "item-1", vocabulary_id: "vocabulary-1", position: 1, word: "book", phonetic: null }],
};

test("ADMIN metadata edit preserves membership and uploads a replacement cover", async ({ page }) => {
  await installAuthApiMock(page, { "/api/auth/me": responses.currentUser(publicAdmin) });
  const calls = [];
  await page.route("**/api/topics", (route) => route.fulfill({ status: 200, json: { success: true, data: [{ id: "topic-1", name: "Books" }] } }));
  await page.route("**/api/admin/vocabulary-sets**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    const contentType = request.headers()["content-type"] ?? "";
    calls.push({ method: request.method(), pathname, body: contentType.includes("application/json") ? request.postDataJSON() : request.postData() });
    if (request.method() === "GET" && pathname === "/api/admin/vocabulary-sets") {
      await route.fulfill({ status: 200, json: { success: true, data: [set] } }); return;
    }
    if (request.method() === "GET") { await route.fulfill({ status: 200, json: { success: true, data: set } }); return; }
    await route.fulfill({ status: 200, json: { success: true, data: { ...set, cefr_level: "B1", cover_image_url: "https://storage.example.test/new.webp" }, meta: { storage_cleanup: "complete" } } });
  });

  await page.goto("/admin/vocabulary-sets");
  await page.getByRole("button", { name: `Sửa ${set.name}` }).click();
  const editor = page.getByRole("dialog", { name: `Chỉnh sửa ${set.name}` });
  await expect(editor.getByText("Thành viên được quản lý tại trang chi tiết.")).toBeVisible();
  await expect(editor.getByText("Từ vựng trong bộ")).toHaveCount(0);
  await expect(editor.getByRole("button", { name: "Chọn từ từ Kho từ vựng" })).toHaveCount(0);
  for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 900 }, { width: 1366, height: 768 }]) {
    await page.setViewportSize(viewport);
    const bounds = await editor.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await expect(editor.getByAltText("Xem trước ảnh bìa bộ từ")).toHaveAttribute("src", set.cover_image_url);
  await editor.getByRole("combobox", { name: /CEFR/ }).selectOption("B1");
  await editor.locator('input[type="file"]').setInputFiles({ name: "replacement.png", mimeType: "image/png", buffer: Buffer.from("mock-image") });
  await editor.getByRole("button", { name: "Lưu bộ từ" }).click();

  await expect.poll(() => calls.find((call) => call.method === "PATCH")).toBeDefined();
  const patch = calls.find((call) => call.method === "PATCH");
  expect(patch.body.topic_id).toBe(set.topic_id);
  expect(patch.body.cefr_level).toBe("B1");
  expect(patch.body).not.toHaveProperty("items");
  expect(patch.body).not.toHaveProperty("cover_storage_key");
  await expect.poll(() => calls.filter((call) => call.pathname.endsWith("/cover") && call.method === "POST")).toHaveLength(1);
});
