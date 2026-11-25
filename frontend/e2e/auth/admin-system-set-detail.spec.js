import { expect, test } from "@playwright/test";
import { installAuthApiMock, publicAdmin, publicUser, responses } from "./fixtures/auth-api.js";

const topic = { id: "topic-1", name: "Giao tiếp", description: "Từ vựng giao tiếp" };
const catalog = [
  item("word-1", "communicate", "/kəˈmjuːnɪkeɪt/", "verb", "giao tiếp"),
  item("word-2", "clarify", "/ˈklærəfaɪ/", "verb", "làm rõ"),
  item("word-3", "collaboration", "/kəˌlæbəˈreɪʃn/", "noun", "sự cộng tác"),
];
const summary = { id: "set-1", topic_id: topic.id, name: "Giao tiếp chuyên nghiệp", description: "Bộ từ dài dùng cho môi trường làm việc quốc tế.", cefr_level: "B1", cover_image_url: null, item_count: 2 };

async function installAdmin(page, { catalogItems = catalog, failFirstDetail = false, failMembershipSave = false, initialIds = ["word-1", "word-2"] } = {}) {
  await installAuthApiMock(page, { "/api/auth/me": responses.currentUser(publicAdmin) }, { mockTopics: false });
  let detailFailures = failFirstDetail ? 2 : 0;
  let aggregate = detailFrom(initialIds, catalogItems);
  const patches = [];
  await page.route("**/api/topics", (route) => route.fulfill({ status: 200, json: { success: true, data: [topic] } }));
  await page.route("**/api/admin/vocabulary", (route) => route.fulfill({ status: 200, json: { success: true, data: catalogItems.map(({ vocabulary_id, word, phonetic }) => ({ id: vocabulary_id, word, phonetic, meaning_count: 1 })) } }));
  await page.route("**/api/vocabulary-set-picker**", (route) => route.fulfill({ status: 200, json: { success: true, data: catalogItems.map((entry) => ({ id: entry.vocabulary_id, word: entry.word, phonetic: entry.phonetic, source: "CANONICAL", primary_meaning: entry.primary_meaning })) } }));
  await page.route("**/api/admin/vocabulary-sets", async (route) => {
    if (route.request().method() === "POST") {
      patches.push({ method: "POST", body: route.request().postDataJSON() });
      await route.fulfill({ status: 201, json: { success: true, data: aggregate } });
      return;
    }
    await route.fulfill({ status: 200, json: { success: true, data: [summary] } });
  });
  await page.route("**/api/admin/vocabulary-sets/set-1", async (route) => {
    if (route.request().method() === "PATCH") {
      const body = route.request().postDataJSON();
      patches.push({ method: "PATCH", body });
      if (failMembershipSave && Object.hasOwn(body, "items")) {
        await route.fulfill({ status: 500, json: { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "Safe failure" } } });
        return;
      }
      if (body.items) aggregate = detailFrom(body.items.map((entry) => entry.vocabulary_id), catalogItems);
      else aggregate = { ...aggregate, ...body };
      await route.fulfill({ status: 200, json: { success: true, data: aggregate } });
      return;
    }
    if (detailFailures > 0) {
      detailFailures -= 1;
      await route.fulfill({ status: 404, json: { success: false, error: { code: "VOCABULARY_SET_NOT_FOUND", message: "Missing" } } });
      return;
    }
    await route.fulfill({ status: 200, json: { success: true, data: aggregate } });
  });
  return { patches };
}

test("ADMIN navigates to routed System Set detail and manages one ordered draft PATCH", async ({ page }) => {
  const mock = await installAdmin(page);
  await page.goto("/admin/vocabulary-sets");
  await page.getByRole("link", { name: "Xem chi tiết" }).click();
  await expect(page).toHaveURL(/\/admin\/vocabulary-sets\/set-1$/);
  await expect(page.getByRole("heading", { name: "Giao tiếp chuyên nghiệp" })).toBeVisible();
  await expect(page.getByText("Giao tiếp", { exact: true })).toBeVisible();
  await expect(page.getByText("communicate", { exact: true })).toBeVisible();
  await expect(page.getByText("clarify", { exact: true })).toBeVisible();
  const singlePagePagination = page.getByRole("navigation", { name: "Phân trang" });
  await expect(singlePagePagination).toContainText("Hiển thị 1–2 / 2 kết quả");
  await expect(singlePagePagination.getByRole("button", { name: "Trước" })).toBeDisabled();
  await expect(singlePagePagination.getByRole("button", { name: "Sau" })).toBeDisabled();

  await page.getByLabel("Tìm trong bộ từ").fill("làm rõ");
  await expect(page.getByText("communicate", { exact: true })).toHaveCount(0);
  await expect(page.getByText("clarify", { exact: true })).toBeVisible();
  await page.getByLabel("Tìm trong bộ từ").fill("");

  await page.getByRole("button", { name: "Đưa communicate xuống" }).click();
  expect(mock.patches).toHaveLength(0);
  await page.getByRole("button", { name: "Thêm từ vựng" }).click();
  const picker = page.getByRole("dialog", { name: "Chọn từ từ Kho từ vựng" });
  await expect(picker.getByRole("checkbox", { name: /communicate/ })).toBeChecked();
  await expect(picker.getByRole("checkbox", { name: /clarify/ })).toBeChecked();
  await picker.getByLabel("Tìm trong Kho từ vựng").fill("collab");
  await picker.getByRole("checkbox", { name: /collaboration/ }).check();
  await picker.getByRole("button", { name: "Xác nhận (3)" }).click();
  expect(mock.patches).toHaveLength(0);
  await expect(page.getByText("collaboration", { exact: true })).toBeVisible();

  const removeTrigger = page.getByRole("button", { name: "Gỡ clarify khỏi bộ từ" });
  await removeTrigger.click();
  const removeDialog = page.getByRole("dialog", { name: "Gỡ từ khỏi bộ từ?" });
  await expect(removeDialog).toContainText("Bạn muốn gỡ từ “clarify” khỏi bộ từ này?");
  await expect(removeDialog).toContainText("Sau khi xác nhận, hãy nhấn “Lưu thay đổi” trên trang để hoàn tất.");
  await removeDialog.getByRole("button", { name: "Hủy" }).click();
  await expect(page.getByText("clarify", { exact: true })).toBeVisible();
  await expect(removeTrigger).toBeFocused();
  expect(mock.patches).toHaveLength(0);
  await removeTrigger.click();
  await removeDialog.getByRole("button", { name: "Gỡ khỏi danh sách" }).click();
  expect(mock.patches).toHaveLength(0);
  await page.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(page.locator(".admin-toast").filter({ hasText: "Lưu danh sách từ thành công" })).toBeVisible();
  await expect(page.getByText("Danh sách đã được lưu")).toBeVisible();
  await expect(page.locator(".admin-topic-feedback.is-success")).toHaveCount(0);
  expect(mock.patches).toEqual([{ method: "PATCH", body: { items: [{ vocabulary_id: "word-1" }, { vocabulary_id: "word-3" }] } }]);
});

test("detail paginates the complete draft and reorders across page boundaries", async ({ page }) => {
  const largeCatalog = generatedCatalog(21);
  const ids = largeCatalog.map(({ vocabulary_id }) => vocabulary_id);
  const mock = await installAdmin(page, { catalogItems: largeCatalog, initialIds: ids });
  await page.goto("/admin/vocabulary-sets/set-1");
  const pagination = page.getByRole("navigation", { name: "Phân trang" });
  await expect(page.locator(".admin-set-item-list > li")).toHaveCount(10);
  await expect(pagination).toContainText("Hiển thị 1–10 / 21 kết quả");
  await expect(page.locator(".admin-set-item-position")).toHaveText(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]);

  await page.getByRole("button", { name: "Đưa term-10 xuống" }).click();
  await expect(pagination).toContainText("Trang 2/3");
  const movedItem = page.getByText("term-10", { exact: true }).locator("../..");
  await expect(movedItem).toBeVisible();
  await expect(movedItem.locator(".admin-set-item-position")).toHaveText("11");
  await page.getByRole("button", { name: "Đưa term-10 lên" }).click();
  await expect(pagination).toContainText("Trang 1/3");

  await page.getByRole("button", { name: "Sau" }).click();
  await page.getByRole("button", { name: "Sau" }).click();
  await expect(pagination).toContainText("Hiển thị 21–21 / 21 kết quả");
  await page.getByLabel("Tìm trong bộ từ").fill("term-21");
  await expect(pagination).toContainText("Hiển thị 1–1 / 1 kết quả");
  await expect(page.locator(".admin-set-item-position")).toHaveText("21");
  await expect(page.getByText("Xóa nội dung tìm kiếm để sắp xếp thứ tự từ vựng.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Đưa term-21 lên" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Đưa term-21 xuống" })).toBeDisabled();
  await page.getByLabel("Tìm trong bộ từ").fill("");
  await expect(pagination).toContainText("Trang 1/3");

  await page.getByRole("button", { name: "Sau" }).click();
  await page.getByRole("button", { name: "Đưa term-11 xuống" }).click();
  await page.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect.poll(() => mock.patches.length).toBe(1);
  expect(mock.patches[0].body.items).toHaveLength(21);
  const reorderedIds = [...ids];
  [reorderedIds[10], reorderedIds[11]] = [reorderedIds[11], reorderedIds[10]];
  expect(mock.patches[0].body.items.map(({ vocabulary_id }) => vocabulary_id)).toEqual(reorderedIds);
});

test("exactly twenty items use two complete pages with correct disabled controls", async ({ page }) => {
  const largeCatalog = generatedCatalog(20);
  await installAdmin(page, { catalogItems: largeCatalog, initialIds: largeCatalog.map(({ vocabulary_id }) => vocabulary_id) });
  await page.goto("/admin/vocabulary-sets/set-1");
  const pagination = page.getByRole("navigation", { name: "Phân trang" });
  await expect(pagination).toContainText("Hiển thị 1–10 / 20 kết quả");
  await expect(pagination.getByRole("button", { name: "Trước" })).toBeDisabled();
  await expect(pagination.getByRole("button", { name: "Sau" })).toBeEnabled();
  await pagination.getByRole("button", { name: "Sau" }).click();
  await expect(pagination).toContainText("Hiển thị 11–20 / 20 kết quả");
  await expect(pagination.getByRole("button", { name: "Trước" })).toBeEnabled();
  await expect(pagination.getByRole("button", { name: "Sau" })).toBeDisabled();
});

test("adding on another page preserves the full draft and removal clamps the page", async ({ page }) => {
  const largeCatalog = generatedCatalog(12);
  const initialIds = largeCatalog.slice(0, 11).map(({ vocabulary_id }) => vocabulary_id);
  const mock = await installAdmin(page, { catalogItems: largeCatalog, initialIds });
  await page.goto("/admin/vocabulary-sets/set-1");
  const pagination = page.getByRole("navigation", { name: "Phân trang" });
  await page.getByRole("button", { name: "Sau" }).click();
  await expect(pagination).toContainText("Hiển thị 11–11 / 11 kết quả");

  await page.getByRole("button", { name: "Thêm từ vựng" }).click();
  const picker = page.getByRole("dialog", { name: "Chọn từ từ Kho từ vựng" });
  await picker.getByRole("checkbox", { name: /term-12/ }).check();
  await picker.getByRole("button", { name: "Xác nhận (12)" }).click();
  await expect(pagination).toContainText("Hiển thị 11–12 / 12 kết quả");
  await expect(page.getByText("term-12", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Gỡ term-12 khỏi bộ từ" }).click();
  await page.getByRole("dialog", { name: "Gỡ từ khỏi bộ từ?" }).getByRole("button", { name: "Gỡ khỏi danh sách" }).click();
  await page.getByRole("button", { name: "Gỡ term-11 khỏi bộ từ" }).click();
  await page.getByRole("dialog", { name: "Gỡ từ khỏi bộ từ?" }).getByRole("button", { name: "Gỡ khỏi danh sách" }).click();
  await expect(pagination).toContainText("Hiển thị 1–10 / 10 kết quả");
  await expect(page.getByText("term-01", { exact: true })).toBeVisible();
  expect(mock.patches).toHaveLength(0);

  await page.getByRole("button", { name: "Bỏ thay đổi" }).click();
  await page.getByRole("dialog", { name: "Bỏ các thay đổi chưa lưu?" }).getByRole("button", { name: "Bỏ thay đổi" }).click();
  await expect(pagination).toContainText("Hiển thị 1–10 / 11 kết quả");
  await expect(page.getByText("Danh sách đã được lưu")).toBeVisible();
});

test("membership failure preserves the draft and dirty navigation is protected", async ({ page }) => {
  const mock = await installAdmin(page, { failMembershipSave: true });
  await page.goto("/admin/vocabulary-sets/set-1");
  await page.getByRole("button", { name: "Đưa communicate xuống" }).click();
  await page.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(page.getByText("Bản nháp vẫn được giữ để bạn thử lại.")).toBeVisible();
  await expect(page.getByText("Có thay đổi chưa lưu")).toBeVisible();
  expect(mock.patches[0].body.items).toEqual([{ vocabulary_id: "word-2" }, { vocabulary_id: "word-1" }]);

  const backLink = page.locator(".admin-set-detail-back");
  await backLink.click();
  const leaveDialog = page.getByRole("dialog", { name: "Rời trang khi chưa lưu?" });
  await expect(leaveDialog).toContainText("Các thay đổi chưa lưu sẽ bị mất nếu bạn rời trang.");
  await page.keyboard.press("Escape");
  await expect(backLink).toBeFocused();
  await expect(page).toHaveURL(/\/admin\/vocabulary-sets\/set-1$/);
  await backLink.click();
  await leaveDialog.getByRole("button", { name: "Ở lại" }).click();
  await expect(backLink).toBeFocused();
  await expect(page.getByText("Có thay đổi chưa lưu")).toBeVisible();
  const vocabularyLink = page.getByRole("navigation", { name: "Điều hướng ứng dụng" }).getByRole("link", { name: /Kho từ vựng/ });
  await vocabularyLink.click();
  await leaveDialog.getByRole("button", { name: "Rời trang" }).click();
  await expect(page).toHaveURL(/\/admin\/vocabulary$/);
});

test("picker cancellation and discard keep the authoritative membership", async ({ page }) => {
  const mock = await installAdmin(page);
  await page.goto("/admin/vocabulary-sets/set-1");
  await page.getByRole("button", { name: "Thêm từ vựng" }).click();
  const picker = page.getByRole("dialog", { name: "Chọn từ từ Kho từ vựng" });
  await picker.getByRole("checkbox", { name: /collaboration/ }).check();
  await picker.getByRole("button", { name: "Hủy" }).click();
  await expect(page.getByText("collaboration", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Đưa communicate xuống" }).click();
  const discardTrigger = page.getByRole("button", { name: "Bỏ thay đổi" });
  await discardTrigger.click();
  const discardDialog = page.getByRole("dialog", { name: "Bỏ các thay đổi chưa lưu?" });
  await expect(discardDialog).toContainText("Danh sách từ vựng sẽ được khôi phục về lần lưu gần nhất.");
  await discardDialog.getByRole("button", { name: "Tiếp tục chỉnh sửa" }).click();
  await expect(discardTrigger).toBeFocused();
  await expect(page.getByText("Có thay đổi chưa lưu")).toBeVisible();
  await discardTrigger.click();
  await discardDialog.getByRole("button", { name: "Bỏ thay đổi" }).click();
  await expect(page.getByText("Danh sách đã được lưu")).toBeVisible();
  expect(mock.patches).toHaveLength(0);
});

test("clean membership navigation leaves immediately without a confirmation", async ({ page }) => {
  await installAdmin(page);
  await page.goto("/admin/vocabulary-sets/set-1");
  await page.locator(".admin-set-detail-back").click();
  await expect(page).toHaveURL(/\/admin\/vocabulary-sets$/);
  await expect(page.getByRole("dialog", { name: "Rời trang khi chưa lưu?" })).toHaveCount(0);
});

test("final membership cannot be removed and metadata PATCH omits items", async ({ page }) => {
  const mock = await installAdmin(page);
  await page.goto("/admin/vocabulary-sets/set-1");
  await page.getByRole("button", { name: "Gỡ clarify khỏi bộ từ" }).click();
  await page.getByRole("dialog", { name: "Gỡ từ khỏi bộ từ?" }).getByRole("button", { name: "Gỡ khỏi danh sách" }).click();
  const finalRemove = page.getByRole("button", { name: /Không thể gỡ communicate/ });
  await expect(finalRemove).toBeDisabled();
  await expect(finalRemove).toHaveAttribute("title", "Bộ từ cần ít nhất một từ vựng");

  await page.getByRole("button", { name: "Chỉnh sửa thông tin" }).click();
  const editor = page.getByRole("dialog", { name: /Chỉnh sửa Giao tiếp chuyên nghiệp/ });
  await expect(editor.getByText("Danh sách từ vựng theo thứ tự")).toHaveCount(0);
  await editor.getByLabel("Mô tả").fill("Mô tả metadata mới");
  await expect(editor.getByLabel("Mô tả")).toHaveValue("Mô tả metadata mới");
  await editor.getByRole("button", { name: "Lưu bộ từ" }).click();
  await expect(editor).toHaveCount(0);
  await expect(page.locator(".admin-toast").filter({ hasText: "Cập nhật bộ từ thành công" })).toBeVisible();
  await expect.poll(() => mock.patches.length).toBe(1);
  const metadataPatch = mock.patches[0];
  expect(metadataPatch.body.description).toBe("Mô tả metadata mới");
  expect(metadataPatch.body).not.toHaveProperty("items");
});

test("detail fetch failure retries and USER cannot enter the ADMIN route", async ({ page }) => {
  await installAdmin(page, { failFirstDetail: true });
  await page.goto("/admin/vocabulary-sets/set-1");
  await expect(page.getByRole("heading", { name: "Không thể tải bộ từ hệ thống" })).toBeVisible();
  await page.getByRole("button", { name: "Thử lại" }).click();
  await expect(page.getByRole("heading", { name: "Giao tiếp chuyên nghiệp" })).toBeVisible();

  await page.unrouteAll({ behavior: "wait" });
  await installAuthApiMock(page, { "/api/auth/me": responses.currentUser(publicUser) });
  let adminCalls = 0;
  await page.route("**/api/admin/vocabulary-sets/set-1", (route) => { adminCalls += 1; return route.abort("failed"); });
  await page.goto("/admin/vocabulary-sets/set-1");
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(adminCalls).toBe(0);
});

test("CREATE uses a compact required picker and submits at least one item", async ({ page }) => {
  const mock = await installAdmin(page);
  await page.goto("/admin/vocabulary-sets");
  await page.getByRole("button", { name: "Tạo bộ từ" }).click();
  const editor = page.getByRole("dialog", { name: "Tạo bộ từ hệ thống" });
  await editor.getByLabel("Tên bộ từ").fill("Bộ từ mới");
  await expect(editor.getByLabel("Tên bộ từ")).toHaveValue("Bộ từ mới");
  await editor.getByLabel("Chủ đề").selectOption(topic.id);
  await editor.getByLabel(/CEFR/).selectOption("B1");
  await editor.getByRole("button", { name: "Lưu bộ từ" }).click();
  await expect(editor.getByText("Bộ từ hệ thống cần ít nhất một từ vựng.")).toBeVisible();
  await page.screenshot({ fullPage: true, path: "test-results/admin-system-set-create-zero-validation.png" });
  await editor.getByRole("button", { name: "Chọn từ từ Kho từ vựng" }).click();
  const picker = page.getByRole("dialog", { name: "Chọn từ từ Kho từ vựng" });
  await page.screenshot({ fullPage: true, path: "test-results/admin-system-set-picker-populated.png" });
  await picker.getByRole("checkbox", { name: /communicate/ }).check();
  await picker.getByRole("checkbox", { name: /clarify/ }).check();
  const selectedBadges = picker.getByText("Đã chọn", { exact: true });
  await expect(selectedBadges).toHaveCount(2);
  for (const badge of await selectedBadges.all()) {
    const geometry = await badge.evaluate((element) => { const rect = element.getBoundingClientRect(), row = element.closest("label").getBoundingClientRect(); return { width: rect.width, rowWidth: row.width, rightGap: row.right - rect.right }; });
    expect(geometry.width).toBeLessThan(90);
    expect(geometry.width).toBeLessThan(geometry.rowWidth / 2);
    expect(geometry.rightGap).toBeGreaterThanOrEqual(0);
  }
  await page.screenshot({ fullPage: true, path: "test-results/admin-system-set-picker-selected.png" });
  await picker.getByRole("button", { name: "Xác nhận (2)" }).click();
  await expect(editor.getByLabel("Tên bộ từ")).toHaveValue("Bộ từ mới");
  await expect(editor.getByText("2 từ đã chọn")).toBeVisible();
  await editor.getByRole("button", { name: "Đưa clarify lên" }).click();
  await editor.getByRole("button", { name: "Chọn từ từ Kho từ vựng" }).click();
  await page.getByRole("dialog", { name: "Chọn từ từ Kho từ vựng" }).getByRole("checkbox", { name: /collaboration/ }).check();
  await page.getByRole("dialog", { name: "Chọn từ từ Kho từ vựng" }).getByRole("button", { name: "Hủy" }).click();
  await expect(editor.getByText("2 từ đã chọn")).toBeVisible();
  await page.screenshot({ fullPage: true, path: "test-results/admin-system-set-create-compact.png" });
  await editor.getByRole("button", { name: "Lưu bộ từ" }).click();
  await expect(editor).toHaveCount(0);
  const createdToast = page.locator(".admin-toast").filter({ hasText: "Tạo bộ từ thành công" });
  await expect(createdToast).toBeVisible();
  await expect(createdToast).toHaveCount(1);
  await createdToast.locator(".Toastify__close-button").click();
  await expect(createdToast).toHaveCount(0);
  await expect.poll(() => mock.patches.length).toBe(1);
  const create = mock.patches.find(({ method }) => method === "POST");
  expect(create.body.items).toEqual([{ vocabulary_id: "word-2" }, { vocabulary_id: "word-1" }]);
});

for (const height of [900, 768, 600]) {
  test(`System Set Create and Edit footers stay visible at 1440x${height}`, async ({ page }) => {
    await installAdmin(page);
    await page.setViewportSize({ width: 1440, height });
    await page.goto("/admin/vocabulary-sets");
    await page.getByRole("button", { name: "Tạo bộ từ" }).click();
    const createDialog = page.getByRole("dialog", { name: "Tạo bộ từ hệ thống" });
    await expectDialogFooterVisible(createDialog, page, height < 900);
    if (height === 600) await page.screenshot({ fullPage: true, path: "test-results/admin-system-set-create-footer-600.png" });
    await createDialog.getByLabel("Tên bộ từ").fill("Bộ từ dài");
    page.once("dialog", (dialog) => dialog.accept());
    await createDialog.getByRole("button", { name: "Hủy" }).click();
    await page.getByRole("button", { name: `Sửa ${summary.name}` }).click();
    const editDialog = page.getByRole("dialog", { name: `Chỉnh sửa ${summary.name}` });
    await expectDialogFooterVisible(editDialog, page, false);
    if (height === 600) await page.screenshot({ fullPage: true, path: "test-results/admin-system-set-edit-footer-600.png" });
    await editDialog.getByRole("button", { name: "Hủy" }).click();
  });
}

async function expectDialogFooterVisible(dialog, page, expectScroll) {
  const result = await dialog.evaluate((element) => {
    const footer = element.querySelector(":scope > .admin-dialog-frame > footer");
    const body = element.querySelector(":scope > .admin-dialog-frame > .admin-dialog-body");
    const dialogRect = element.getBoundingClientRect(), footerRect = footer.getBoundingClientRect();
    return { dialogTop: dialogRect.top, dialogBottom: dialogRect.bottom, footerTop: footerRect.top, footerBottom: footerRect.bottom, viewportHeight: window.innerHeight, bodyClientHeight: body.clientHeight, bodyScrollHeight: body.scrollHeight, footerPosition: getComputedStyle(footer).position };
  });
  expect(result.dialogTop).toBeGreaterThanOrEqual(0);
  expect(result.footerTop).toBeGreaterThanOrEqual(result.dialogTop);
  expect(result.footerBottom).toBeLessThanOrEqual(result.dialogBottom + 1);
  expect(result.footerBottom).toBeLessThanOrEqual(result.viewportHeight);
  expect(await dialog.getByRole("button", { name: "Hủy" }).isEnabled()).toBe(true);
  expect(await dialog.getByRole("button", { name: "Lưu bộ từ" }).isVisible()).toBe(true);
  if (expectScroll) expect(result.bodyScrollHeight).toBeGreaterThan(result.bodyClientHeight);
  await page.keyboard.press("Tab");
}

for (const width of [1440, 1280, 1024, 768, 390, 375, 320]) {
  test(`System Set detail remains contained at ${width}px`, async ({ page }) => {
    await installAdmin(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/admin/vocabulary-sets/set-1");
    await expect(page.getByRole("heading", { name: "Giao tiếp chuyên nghiệp" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole("button", { name: "Đưa communicate xuống" }).click();
    const discardTrigger = page.getByRole("button", { name: "Bỏ thay đổi" });
    await discardTrigger.click();
    await expect(page.getByRole("dialog", { name: "Bỏ các thay đổi chưa lưu?" })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.keyboard.press("Escape");
    await expect(discardTrigger).toBeFocused();
    const removeTrigger = page.getByRole("button", { name: "Gỡ clarify khỏi bộ từ" });
    await removeTrigger.click();
    await expect(page.getByRole("dialog", { name: "Gỡ từ khỏi bộ từ?" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.keyboard.press("Escape");
    await expect(removeTrigger).toBeFocused();
    if ([1440, 390, 320].includes(width)) await page.screenshot({ fullPage: true, path: `test-results/admin-system-set-detail-${width}.png` });
  });
}

function item(id, word, phonetic, partOfSpeech, meaning) { return { id: `membership-${id}`, vocabulary_id: id, position: 0, word, phonetic, primary_meaning: { part_of_speech: partOfSpeech, meaning_vi: meaning, example: null } }; }
function detailFrom(ids, source = catalog) { return { ...summary, item_count: ids.length, items: ids.map((id, index) => ({ ...source.find((item) => item.vocabulary_id === id), position: index + 1 })) }; }
function generatedCatalog(count) { return Array.from({ length: count }, (_, index) => { const number = String(index + 1).padStart(2, "0"); return item(`word-${index + 1}`, `term-${number}`, `/term-${number}/`, "noun", `nghĩa ${number}`); }); }
