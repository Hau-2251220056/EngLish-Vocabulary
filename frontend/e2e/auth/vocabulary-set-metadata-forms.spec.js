import { Buffer } from "node:buffer";
import { expect, test } from "@playwright/test";
import { installAuthApiMock, publicAdmin, responses } from "./fixtures/auth-api.js";

const set = {
  id: "system-set-metadata", topic_id: "topic-1", name: "System metadata", description: null,
  cefr_level: "A2", cover_image_url: "https://images.example.test/current.webp", item_count: 1,
  items: [{ id: "item-1", vocabulary_id: "vocabulary-1", position: 1, word: "book", phonetic: null }],
};

test("ADMIN edits required CEFR and uploads a replacement without changing Topic or membership", async ({ page }) => {
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
  const editor = page.locator(".my-vocabulary-set-editor");
  const pickerTrigger = editor.getByRole("button", { name: "Thêm từ vựng" });
  await expect(editor.getByRole("searchbox", { name: "Từ khóa" })).toHaveCount(0);
  for (const [index, viewport] of [{ width: 390, height: 844 }, { width: 768, height: 900 }, { width: 1366, height: 768 }].entries()) {
    await page.setViewportSize(viewport);
    await pickerTrigger.click();
    const picker = page.getByRole("dialog", { name: "Thêm từ vựng" });
    await expect(picker).toBeVisible();
    await expect(picker.getByRole("searchbox", { name: "Từ khóa" })).toBeFocused();
    const bounds = await picker.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (index === 0) await page.keyboard.press("Escape");
    else if (index === 1) await picker.getByRole("button", { name: "Hủy" }).click();
    else await picker.getByRole("button", { name: "Đóng" }).click();
    await expect(picker).toHaveCount(0);
    await expect(pickerTrigger).toBeFocused();
  }
  await expect(page.getByAltText("Xem trước ảnh bìa bộ từ")).toHaveAttribute("src", set.cover_image_url);
  await page.getByRole("combobox", { name: /CEFR/ }).selectOption("B1");
  await page.locator('input[type="file"]').setInputFiles({ name: "replacement.png", mimeType: "image/png", buffer: Buffer.from("mock-image") });
  await page.getByRole("button", { name: "Lưu bộ từ" }).click();

  const patch = calls.find((call) => call.method === "PATCH");
  expect(patch.body.topic_id).toBe(set.topic_id);
  expect(patch.body.cefr_level).toBe("B1");
  expect(patch.body.items).toEqual([{ vocabulary_id: "vocabulary-1" }]);
  expect(patch.body).not.toHaveProperty("cover_storage_key");
  await expect.poll(() => calls.filter((call) => call.pathname.endsWith("/cover") && call.method === "POST")).toHaveLength(1);
});
