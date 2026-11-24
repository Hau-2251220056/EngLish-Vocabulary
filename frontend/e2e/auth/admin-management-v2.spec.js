import { expect, test } from "@playwright/test";
import { installAuthApiMock, publicAdmin, publicUser, responses } from "./fixtures/auth-api.js";

const topic = { id: "topic-1", name: "Giao tiếp", description: "Từ vựng giao tiếp hằng ngày", created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-02T00:00:00.000Z" };
const vocabulary = { id: "word-1", word: "communicate", phonetic: "/kəˈmjuːnɪkeɪt/", meaning_count: 1, meanings: [{ id: "meaning-1", part_of_speech: "phrasal verb", meaning_vi: "giao tiếp", cefr_level: "B1", examples: [{ example_en: "We communicate clearly with international partners." }] }] };
const vocabularyDetail = { ...vocabulary, pronunciation_url: null, meanings: [{ id: "meaning-1", part_of_speech: "phrasal verb", meaning_vi: "giao tiếp", context: "Trao đổi thông tin trong môi trường chuyên nghiệp", cefr_level: "B1", examples: [{ id: "example-1", example_en: "We communicate clearly with international partners.", example_vi: "Chúng tôi giao tiếp rõ ràng với các đối tác quốc tế." }, { id: "example-2", example_en: "The team communicates through a secure channel.", example_vi: "Nhóm trao đổi qua một kênh bảo mật." }] }] };
const systemSet = { id: "set-1", topic_id: topic.id, topic: { id: topic.id, name: topic.name }, name: "Giao tiếp nền tảng", description: "Bộ từ giao tiếp cơ bản", cefr_level: "A1", item_count: 1 };
const systemSetDetail = { ...systemSet, items: [{ id: "item-1", vocabulary_id: vocabulary.id, word: vocabulary.word, phonetic: vocabulary.phonetic, source: "CANONICAL", position: 1 }] };

async function installAdmin(page) {
  await installAuthApiMock(page, { "/api/auth/me": responses.currentUser(publicAdmin) }, { mockTopics: false });
  await page.route("**/api/topics", (route) => route.fulfill({ status: 200, json: { success: true, data: [topic] } }));
  await page.route("**/api/admin/vocabulary", (route) => route.fulfill({ status: 200, json: { success: true, data: [vocabulary] } }));
  await page.route("**/api/admin/vocabulary/word-1", (route) => route.fulfill({ status: 200, json: { success: true, data: vocabularyDetail } }));
  await page.route("**/api/admin/vocabulary-sets", (route) => route.fulfill({ status: 200, json: { success: true, data: [systemSet] } }));
  await page.route("**/api/admin/vocabulary-sets/set-1", (route) => route.fulfill({ status: 200, json: { success: true, data: systemSetDetail } }));
}

async function expectDeleteDialogFocusRestoration(page, { cancelName, dialogName, firstTrigger, secondTrigger }) {
  await firstTrigger.focus();
  await expect(firstTrigger).toBeFocused();
  await page.keyboard.press("Enter");
  const cancelDialog = page.getByRole("dialog", { name: dialogName });
  await expect(cancelDialog).toBeVisible();
  await expect(cancelDialog.getByRole("button", { name: cancelName })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(cancelDialog).toHaveCount(0);
  await expect(firstTrigger).toBeFocused();
  expect(await firstTrigger.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe("none");

  await secondTrigger.focus();
  await expect(secondTrigger).toBeFocused();
  await page.keyboard.press("Enter");
  const escapeDialog = page.getByRole("dialog", { name: dialogName });
  await expect(escapeDialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(escapeDialog).toHaveCount(0);
  await expect(secondTrigger).toBeFocused();
  expect(await secondTrigger.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe("none");
}

for (const width of [1440, 768, 390, 320]) {
test(`Admin delete dialogs restore the exact trigger after Cancel and Escape without mutations at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: width <= 390 ? 720 : 900 });
  await installAdmin(page);
  const secondTopic = { ...topic, id: "topic-2", name: "Học thuật" };
  const secondVocabulary = { ...vocabulary, id: "word-2", word: "clarify" };
  const secondSet = { ...systemSet, id: "set-2", name: "Giao tiếp nâng cao" };
  await page.route("**/api/topics", (route) => route.fulfill({ status: 200, json: { success: true, data: [topic, secondTopic] } }));
  await page.route("**/api/admin/vocabulary", (route) => route.fulfill({ status: 200, json: { success: true, data: [vocabulary, secondVocabulary] } }));
  await page.route("**/api/admin/vocabulary-sets", (route) => route.fulfill({ status: 200, json: { success: true, data: [systemSet, secondSet] } }));
  const deleteRequests = [];
  page.on("request", (request) => { if (request.method() === "DELETE") deleteRequests.push(request.url()); });

  await page.goto("/admin/topics");
  await expectDeleteDialogFocusRestoration(page, {
    cancelName: "Hủy",
    dialogName: "Xóa chủ đề?",
    firstTrigger: page.getByRole("button", { name: `Xóa ${topic.name}` }),
    secondTrigger: page.getByRole("button", { name: `Xóa ${secondTopic.name}` }),
  });

  await page.goto("/admin/vocabulary");
  await expectDeleteDialogFocusRestoration(page, {
    cancelName: "Hủy",
    dialogName: "Xóa từ vựng?",
    firstTrigger: page.getByRole("button", { name: `Xóa ${vocabulary.word}` }),
    secondTrigger: page.getByRole("button", { name: `Xóa ${secondVocabulary.word}` }),
  });

  await page.goto("/admin/vocabulary-sets");
  await expectDeleteDialogFocusRestoration(page, {
    cancelName: "Hủy",
    dialogName: "Xóa bộ từ hệ thống?",
    firstTrigger: page.getByRole("button", { name: `Xóa ${systemSet.name}` }),
    secondTrigger: page.getByRole("button", { name: `Xóa ${secondSet.name}` }),
  });
  expect(deleteRequests).toEqual([]);
});
}

test("Topic management lists content and protects create/delete interactions", async ({ page }) => {
  await installAdmin(page);
  await page.goto("/admin/topics");
  await expect(page.getByRole("heading", { name: "Quản lý chủ đề" })).toBeVisible();
  await expect(page.getByRole("row", { name: /Giao tiếp/ })).toBeVisible();
  const topicPagination = page.getByRole("navigation", { name: "Phân trang" });
  await expect(topicPagination).toContainText("Hiển thị 1–1 / 1 kết quả");
  await expect(topicPagination.getByRole("button", { name: "Trước" })).toBeDisabled();
  await expect(topicPagination.getByRole("button", { name: "Sau" })).toBeDisabled();
  const topicSearch = page.getByLabel("Tìm kiếm chủ đề");
  const topicSearchGeometry = await topicSearch.evaluate((input) => {
    const inputRect = input.getBoundingClientRect();
    const iconRect = input.parentElement.querySelector("svg").getBoundingClientRect();
    const toolbarRect = input.closest(".admin-toolbar").getBoundingClientRect();
    return { inputHeight: inputRect.height, iconCenter: iconRect.top + iconRect.height / 2, inputCenter: inputRect.top + inputRect.height / 2, iconLeft: iconRect.left, inputLeft: inputRect.left, toolbarHeight: toolbarRect.height, paddingLeft: Number.parseFloat(getComputedStyle(input).paddingLeft) };
  });
  expect(topicSearchGeometry.inputHeight).toBeGreaterThanOrEqual(44);
  expect(Math.abs(topicSearchGeometry.iconCenter - topicSearchGeometry.inputCenter)).toBeLessThanOrEqual(1);
  expect(topicSearchGeometry.iconLeft).toBeGreaterThan(topicSearchGeometry.inputLeft);
  expect(topicSearchGeometry.paddingLeft).toBeGreaterThanOrEqual(32);
  expect(topicSearchGeometry.toolbarHeight).toBeLessThanOrEqual(96);
  await topicSearch.fill("không khớp");
  await expect(page.getByRole("heading", { name: "Không có kết quả" })).toBeVisible();
  await topicSearch.fill("");
  await topicSearch.click();
  await expect(topicSearch).toBeFocused();
  expect(await topicSearch.evaluate((input) => ({ inputOutline: getComputedStyle(input).outlineStyle, wrapperShadow: getComputedStyle(input.parentElement).boxShadow }))).toEqual(expect.objectContaining({ inputOutline: "none" }));
  expect((await topicSearch.evaluate((input) => getComputedStyle(input.parentElement).boxShadow))).not.toBe("none");
  await page.screenshot({ fullPage: true, path: "test-results/admin-topic-search-focused.png" });

  await page.getByRole("button", { name: "Thêm chủ đề" }).click();
  const formDialog = page.getByRole("dialog", { name: "Thêm chủ đề" });
  await expect(formDialog).toBeVisible();
  await formDialog.getByRole("button", { name: "Lưu chủ đề" }).click();
  await expect(formDialog.getByText("Tên chủ đề là bắt buộc.")).toBeVisible();
  await expect(formDialog.getByLabel("Tên chủ đề")).toBeFocused();
  await formDialog.getByLabel("Đóng hộp thoại").click();

  await page.getByRole("button", { name: "Xóa Giao tiếp" }).click();
  const deleteDialog = page.getByRole("dialog", { name: "Xóa chủ đề?" });
  await expect(deleteDialog).toContainText("Giao tiếp");
  await deleteDialog.getByRole("button", { name: "Hủy" }).click();
  await expect(deleteDialog).toHaveCount(0);
});

test("Vocabulary management preserves nested editor behavior and confirmation", async ({ page }) => {
  await installAdmin(page);
  await page.goto("/admin/vocabulary");
  await expect(page.getByRole("heading", { name: "Kho từ vựng" })).toBeVisible();
  await expect(page.locator("main").getByLabel("Tổng cộng 1 từ vựng")).toHaveText("1 từ");
  await expect(page.getByRole("navigation", { name: "Điều hướng ứng dụng" }).getByLabel("Tổng cộng 1 từ vựng")).toHaveText("1");
  const vocabularyTable = page.getByRole("table", { name: "Danh sách từ vựng hệ thống" });
  await expect(vocabularyTable.getByRole("columnheader")).toHaveText(["Từ vựng", "Phiên âm", "Từ loại", "Nghĩa tiếng Việt", "CEFR", "Thao tác"]);
  const vocabularyRow = page.getByRole("row", { name: /communicate/ });
  await expect(vocabularyRow).toContainText("giao tiếp");
  await expect(vocabularyRow).not.toContainText("We communicate clearly with international partners.");
  await expect(page.getByRole("navigation", { name: "Phân trang" })).toContainText("Hiển thị 1–1 / 1 kết quả");
  const toolbarGeometry = await page.locator(".admin-management-toolbar").evaluate((toolbar) => {
    const controls = [toolbar.querySelector('input[type="search"]'), ...toolbar.querySelectorAll("select")];
    return controls.map((control) => { const rect = control.getBoundingClientRect(); return { top: rect.top, height: rect.height }; });
  });
  expect(Math.max(...toolbarGeometry.map(({ top }) => top)) - Math.min(...toolbarGeometry.map(({ top }) => top))).toBeLessThanOrEqual(1);
  expect(Math.max(...toolbarGeometry.map(({ height }) => height)) - Math.min(...toolbarGeometry.map(({ height }) => height))).toBeLessThanOrEqual(1);
  const vocabularySearch = page.getByLabel("Tìm kiếm từ vựng");
  await vocabularySearch.fill("không khớp");
  const resetButton = page.getByRole("button", { name: "Đặt lại" });
  const resetGeometry = await page.locator(".admin-management-toolbar").evaluate((toolbar) => [...toolbar.querySelectorAll('input[type="search"],select,.admin-reset-button')].map((control) => { const rect = control.getBoundingClientRect(); return { top: rect.top, bottom: rect.bottom, height: rect.height }; }));
  expect(Math.max(...resetGeometry.map(({ top }) => top)) - Math.min(...resetGeometry.map(({ top }) => top))).toBeLessThanOrEqual(2);
  expect(Math.max(...resetGeometry.map(({ bottom }) => bottom)) - Math.min(...resetGeometry.map(({ bottom }) => bottom))).toBeLessThanOrEqual(2);
  expect(Math.max(...resetGeometry.map(({ height }) => height)) - Math.min(...resetGeometry.map(({ height }) => height))).toBeLessThanOrEqual(2);
  await page.screenshot({ fullPage: true, path: "test-results/admin-vocabulary-reset-aligned.png" });
  await resetButton.click();
  await expect(vocabularySearch).toHaveValue("");
  await expect(page.getByRole("row", { name: /communicate/ })).toBeVisible();
  await vocabularySearch.focus();
  await expect(vocabularySearch).toBeFocused();
  expect(await vocabularySearch.evaluate((input) => getComputedStyle(input).outlineStyle)).toBe("none");
  expect(await vocabularySearch.evaluate((input) => getComputedStyle(input.parentElement).boxShadow)).not.toBe("none");
  await page.screenshot({ fullPage: true, path: "test-results/admin-vocabulary-search-focused.png" });

  await page.getByRole("button", { name: "Thêm từ vựng" }).click();
  const vocabularyDialog = page.getByRole("dialog", { name: "Thêm từ vựng" });
  await expect(vocabularyDialog).toBeVisible();
  await expect(vocabularyDialog.getByLabel("Từ tiếng Anh")).toBeFocused();
  await expect(vocabularyDialog.getByLabel("Từ tiếng Anh")).toHaveAttribute("placeholder", "Ví dụ: achieve…");
  await expect(vocabularyDialog.getByLabel("Phiên âm")).toHaveAttribute("placeholder", "Ví dụ: /əˈtʃiːv/…");
  await expect(vocabularyDialog.getByLabel("URL phát âm (không bắt buộc)")).toHaveAttribute("placeholder", "https://example.com/audio.mp3…");
  await page.getByRole("button", { name: "Thêm nghĩa" }).click();
  await expect(page.getByText("Nghĩa 2", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(vocabularyDialog).toBeVisible();
  const discardDialog = page.getByRole("dialog", { name: "Bỏ thay đổi chưa lưu?" });
  await expect(discardDialog).toBeVisible();
  await discardDialog.getByRole("button", { name: "Hủy" }).click();
  await page.getByRole("button", { name: "Thêm ví dụ" }).first().click();
  await expect(page.getByLabel("Ví dụ tiếng Anh 1")).toBeVisible();
  await page.screenshot({ fullPage: true, path: "test-results/admin-vocabulary-example-inputs.png" });
  await vocabularyDialog.getByRole("button", { name: "Tạo từ vựng" }).click();
  await expect(page.getByText("Từ tiếng Anh là bắt buộc.")).toBeVisible();
  await expect(vocabularyDialog.getByLabel("Từ tiếng Anh")).toBeFocused();

  await page.getByRole("button", { name: "Hủy" }).last().click();
  await page.getByRole("dialog", { name: "Bỏ thay đổi chưa lưu?" }).getByRole("button", { name: "Bỏ thay đổi" }).click();
  await page.getByRole("button", { name: "Sửa communicate" }).click();
  const editDialog = page.getByRole("dialog", { name: /Chỉnh sửa từ: communicate/ });
  await expect(editDialog.getByLabel("Từ tiếng Anh")).toHaveValue("communicate");
  await expect(editDialog.getByLabel("Từ loại")).toHaveValue("phrasal verb");
  await expect(editDialog.getByLabel("Từ loại").locator("option")).toHaveText(["Chọn từ loại", "phrasal verb (giá trị cũ)", "Noun", "Verb", "Adjective", "Adverb", "Pronoun", "Preposition", "Conjunction", "Interjection", "Determiner", "Phrase", "Other"]);
  await expect(editDialog.getByLabel("Cấp độ CEFR")).toHaveValue("B1");
  await expect(editDialog.getByLabel("Nghĩa tiếng Việt")).toHaveJSProperty("tagName", "INPUT");
  await expect(editDialog.getByLabel("Ngữ cảnh")).toHaveJSProperty("tagName", "INPUT");
  await expect(editDialog.getByLabel("Ví dụ tiếng Anh 1")).toHaveValue("We communicate clearly with international partners.");
  await editDialog.getByRole("button", { name: "Hủy" }).click();
  await page.getByRole("button", { name: "Xóa communicate" }).click();
  await expect(page.getByRole("dialog", { name: "Xóa từ vựng?" })).toContainText("communicate");
  await page.getByRole("dialog", { name: "Xóa từ vựng?" }).getByRole("button", { name: "Xác nhận xóa" }).click();
  await expect(page.locator(".admin-toast").filter({ hasText: "Xóa từ vựng thành công" })).toBeVisible();
  await expect(page.getByLabel("Tổng cộng 0 từ vựng")).toHaveCount(2);
});

test("Vocabulary create keeps the exact loaded-list count authoritative", async ({ page }) => {
  await installAdmin(page);
  const created = { id: "word-2", word: "clarify", phonetic: null, pronunciation_url: null, meanings: [{ id: "meaning-2", part_of_speech: "verb", meaning_vi: "làm rõ", context: null, cefr_level: "B1", examples: [] }] };
  await page.route("**/api/admin/vocabulary", (route) => route.request().method() === "POST"
    ? route.fulfill({ status: 201, json: { success: true, data: created } })
    : route.fulfill({ status: 200, json: { success: true, data: [vocabulary] } }));
  await page.goto("/admin/vocabulary");
  await expect(page.locator("main").getByLabel("Tổng cộng 1 từ vựng")).toBeVisible();
  await page.getByRole("button", { name: "Thêm từ vựng" }).click();
  const dialog = page.getByRole("dialog", { name: "Thêm từ vựng" });
  await dialog.getByLabel("Từ tiếng Anh").fill("clarify");
  await expect(dialog.getByLabel("Từ loại").locator("option")).toHaveText(["Chọn từ loại", "Noun", "Verb", "Adjective", "Adverb", "Pronoun", "Preposition", "Conjunction", "Interjection", "Determiner", "Phrase", "Other"]);
  await dialog.getByLabel("Từ loại").selectOption("verb");
  await dialog.getByLabel("Nghĩa tiếng Việt").fill("làm rõ");
  await dialog.getByLabel("Cấp độ CEFR").selectOption("B1");
  await dialog.getByRole("button", { name: "Tạo từ vựng" }).click();
  await expect(page.locator(".admin-toast").filter({ hasText: "Thêm từ vựng thành công" })).toBeVisible();
  await expect(page.locator("main").getByLabel("Tổng cộng 2 từ vựng")).toHaveText("2 từ");
  await expect(page.getByRole("navigation", { name: "Điều hướng ứng dụng" }).getByLabel("Tổng cộng 2 từ vựng")).toHaveText("2");
  await expect(page.getByRole("row", { name: /clarify/ })).toBeVisible();
  await expect(page.getByRole("row", { name: /clarify/ }).locator('[data-label="Phiên âm"]')).toHaveText("—");
});

test("Vocabulary summaries remain authoritative after a fresh page reload", async ({ page }) => {
  await installAdmin(page);
  await page.goto("/admin/vocabulary");
  const row = page.getByRole("row", { name: /communicate/ });
  await expect(row).toContainText("phrasal verb");
  await expect(row).toContainText("giao tiếp");
  await expect(row).toContainText("B1");
  await page.reload();
  await expect(row).toContainText("phrasal verb");
  await expect(row).toContainText("giao tiếp");
  await expect(row).toContainText("B1");
});

test("Admin collection pagination uses approved fixed page sizes and filtered ranges", async ({ page }) => {
  await installAuthApiMock(page, { "/api/auth/me": responses.currentUser(publicAdmin) }, { mockTopics: false });
  const topics = Array.from({ length: 11 }, (_, index) => ({ ...topic, id: `topic-${index + 1}`, name: `Chủ đề ${String(index + 1).padStart(2, "0")}` }));
  const vocabularies = Array.from({ length: 11 }, (_, index) => ({ ...vocabulary, id: `word-${index + 1}`, word: `word-${String(index + 1).padStart(2, "0")}` }));
  const sets = Array.from({ length: 7 }, (_, index) => ({ ...systemSet, id: `set-${index + 1}`, name: `Bộ từ ${String(index + 1).padStart(2, "0")}` }));
  await page.route("**/api/topics", (route) => route.fulfill({ status: 200, json: { success: true, data: topics } }));
  await page.route("**/api/admin/vocabulary", (route) => route.fulfill({ status: 200, json: { success: true, data: vocabularies } }));
  await page.route("**/api/admin/vocabulary-sets", (route) => route.fulfill({ status: 200, json: { success: true, data: sets } }));

  await page.goto("/admin/topics");
  await expect(page.locator(".admin-management-table tbody tr")).toHaveCount(10);
  await expect(page.getByRole("navigation", { name: "Phân trang" })).toContainText("Hiển thị 1–10 / 11 kết quả");
  await page.getByRole("button", { name: "Sau" }).click();
  await expect(page.getByRole("navigation", { name: "Phân trang" })).toContainText("Hiển thị 11–11 / 11 kết quả");
  await page.getByLabel("Tìm kiếm chủ đề").fill("Chủ đề 01");
  await expect(page.getByRole("navigation", { name: "Phân trang" })).toContainText("Trang 1/1");

  await page.goto("/admin/vocabulary");
  await expect(page.locator(".admin-vocabulary-table tbody tr")).toHaveCount(10);
  await expect(page.getByRole("navigation", { name: "Phân trang" })).toContainText("Hiển thị 1–10 / 11 kết quả");
  await page.getByRole("button", { name: "Sau" }).click();
  await expect(page.getByRole("navigation", { name: "Phân trang" })).toContainText("Hiển thị 11–11 / 11 kết quả");

  await page.goto("/admin/vocabulary-sets");
  await expect(page.locator(".admin-system-set-grid > li")).toHaveCount(6);
  await expect(page.getByRole("navigation", { name: "Phân trang" })).toContainText("Hiển thị 1–6 / 7 kết quả");
  await page.getByRole("button", { name: "Sau" }).click();
  await expect(page.getByRole("navigation", { name: "Phân trang" })).toContainText("Hiển thị 7–7 / 7 kết quả");
});

test("Admin vocabulary badges distinguish confirmed zero, failure, and USER isolation", async ({ page }) => {
  await installAuthApiMock(page, { "/api/auth/me": responses.currentUser(publicAdmin) }, { mockTopics: false });
  await page.route("**/api/admin/vocabulary", (route) => route.fulfill({ status: 200, json: { success: true, data: [] } }));
  await page.goto("/admin/vocabulary");
  await expect(page.getByLabel("Tổng cộng 0 từ vựng")).toHaveCount(2);

  await page.unrouteAll({ behavior: "wait" });
  await installAuthApiMock(page, { "/api/auth/me": responses.currentUser(publicUser) });
  let adminVocabularyCalls = 0;
  await page.route("**/api/admin/vocabulary", async (route) => { adminVocabularyCalls += 1; await route.abort("failed"); });
  await page.goto("/dashboard");
  await expect(page.getByLabel(/tổng số từ vựng/i)).toHaveCount(0);
  expect(adminVocabularyCalls).toBe(0);
});

test("Admin vocabulary badges never turn load failure into zero", async ({ page }) => {
  await installAuthApiMock(page, { "/api/auth/me": responses.currentUser(publicAdmin) }, { mockTopics: false });
  await page.route("**/api/admin/vocabulary", (route) => route.fulfill({ status: 500, json: { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "Safe error" } } }));
  await page.goto("/admin/vocabulary");
  await expect(page.getByLabel("Chưa thể tải tổng số từ vựng")).toHaveText("!");
  await expect(page.getByLabel("Chưa thể xác định tổng số từ vựng")).toContainText("Chưa có số liệu");
  await expect(page.getByLabel("Tổng cộng 0 từ vựng")).toHaveCount(0);
});

test("Topic view uses a compact modal and authoritative mutations preserve blocked deletion", async ({ page }) => {
  await installAdmin(page);
  let createdTopic = null;
  await page.route("**/api/admin/topics**", async (route) => {
    const request = route.request();
    if (request.method() === "POST") {
      createdTopic = { id: "topic-2", ...(await request.postDataJSON()), created_at: "2026-02-01T00:00:00.000Z", updated_at: "2026-02-01T00:00:00.000Z" };
      await route.fulfill({ status: 201, json: { success: true, data: createdTopic } });
      return;
    }
    if (request.method() === "PATCH") {
      createdTopic = { ...createdTopic, ...(await request.postDataJSON()), updated_at: "2026-02-02T00:00:00.000Z" };
      await route.fulfill({ status: 200, json: { success: true, data: createdTopic } });
      return;
    }
    await route.fulfill({ status: 409, json: { success: false, error: { code: "TOPIC_IN_USE", message: "Topic is referenced." } } });
  });
  await page.goto("/admin/topics");
  await page.getByRole("button", { name: "Xem Giao tiếp" }).click();
  const view = page.getByRole("dialog", { name: "Giao tiếp" });
  await expect(view).toContainText("Từ vựng giao tiếp hằng ngày");
  await expect(page.locator(".admin-topic-panel")).toHaveCount(0);
  await view.getByRole("button", { name: "Đóng", exact: true }).click();
  await expect(page.getByRole("button", { name: "Xem Giao tiếp" })).toBeFocused();

  await page.getByRole("button", { name: "Thêm chủ đề" }).click();
  const create = page.getByRole("dialog", { name: "Thêm chủ đề" });
  await create.getByLabel("Tên chủ đề").fill("Học thuật");
  await create.getByLabel("Mô tả (không bắt buộc)").fill("Từ dùng trong học tập");
  await create.getByRole("button", { name: "Lưu chủ đề" }).click();
  await expect(page.locator(".admin-toast").filter({ hasText: "Tạo chủ đề thành công" })).toBeVisible();
  await expect(page.getByRole("row", { name: /Học thuật/ })).toBeVisible();
  await page.getByRole("button", { name: "Sửa Học thuật" }).click();
  const edit = page.getByRole("dialog", { name: "Chỉnh sửa chủ đề" });
  await edit.getByLabel("Mô tả (không bắt buộc)").fill("Từ dùng trong môi trường học thuật");
  await edit.getByRole("button", { name: "Lưu chủ đề" }).click();
  await expect(page.locator(".admin-toast").filter({ hasText: "Cập nhật chủ đề thành công" })).toBeVisible();
  await expect(page.getByRole("row", { name: /môi trường học thuật/ })).toBeVisible();

  await page.getByRole("button", { name: "Xóa Giao tiếp" }).click();
  const blocked = page.getByRole("dialog", { name: "Xóa chủ đề?" });
  await blocked.getByRole("button", { name: "Xác nhận xóa" }).click();
  await expect(blocked.getByRole("alert")).toContainText("đang được sử dụng trong bộ từ hệ thống");
  await expect(page.getByRole("row", { name: /Giao tiếp/ })).toBeVisible();
});

test("Vocabulary view shows every example and edit round-trips legacy IDs, POS, and C2", async ({ page }) => {
  await installAdmin(page);
  const legacy = { ...vocabularyDetail, meanings: [{ ...vocabularyDetail.meanings[0], part_of_speech: "phrasal verb", cefr_level: "C2" }] };
  let patchBody = null;
  await page.route("**/api/admin/vocabulary/word-1", async (route) => {
    if (route.request().method() === "PATCH") {
      patchBody = await route.request().postDataJSON();
      await route.fulfill({ status: 200, json: { success: true, data: { ...legacy, ...patchBody } } });
      return;
    }
    await route.fulfill({ status: 200, json: { success: true, data: legacy } });
  });
  await page.goto("/admin/vocabulary");
  await page.getByRole("button", { name: "Xem communicate" }).click();
  const view = page.getByRole("dialog", { name: "communicate" });
  await expect(view).toContainText("We communicate clearly with international partners.");
  await expect(view).toContainText("The team communicates through a secure channel.");
  await expect(view).toContainText("C2");
  await view.getByRole("button", { name: "Đóng", exact: true }).click();
  await expect(page.getByRole("button", { name: "Xem communicate" })).toBeFocused();

  await page.getByRole("button", { name: "Sửa communicate" }).click();
  const edit = page.getByRole("dialog", { name: /Chỉnh sửa từ: communicate/ });
  await expect(edit.getByLabel("Từ loại")).toHaveValue("phrasal verb");
  await expect(edit.getByLabel("Cấp độ CEFR")).toHaveValue("C2");
  await edit.getByLabel("Phiên âm").fill("/updated/");
  await edit.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(edit).toHaveCount(0);
  await expect(page.locator(".admin-toast").filter({ hasText: "Cập nhật từ vựng thành công" })).toBeVisible();
  expect(patchBody.meanings[0].id).toBe("meaning-1");
  expect(patchBody.meanings[0].examples.map(({ id }) => id)).toEqual(["example-1", "example-2"]);
  expect(patchBody.meanings[0].part_of_speech).toBe("phrasal verb");
  expect(patchBody.meanings[0].cefr_level).toBe("C2");
});

test("Admin management pages and nested editor avoid page overflow at required widths", async ({ page }) => {
  await installAdmin(page);
  for (const width of [1440, 1280, 1024, 768, 390, 375, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/admin/topics");
    expect(await page.evaluate(() => document.documentElement.scrollWidth), `topics ${width}px`).toBe(width);
    await page.goto("/admin/vocabulary");
    expect(await page.evaluate(() => document.documentElement.scrollWidth), `vocabulary ${width}px`).toBe(width);
  }
  await page.getByRole("button", { name: "Thêm từ vựng" }).click();
  const dialog = page.getByRole("dialog", { name: "Thêm từ vựng" });
  await dialog.getByRole("button", { name: "Thêm nghĩa" }).click();
  await dialog.getByRole("button", { name: "Thêm ví dụ" }).first().click();
  const bounds = await dialog.boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.width).toBeLessThanOrEqual(320);
  await page.screenshot({ fullPage: true, path: "test-results/admin-vocabulary-mobile-editor.png" });
});

test("System Set management exposes metadata, editor, and native delete confirmation", async ({ page }) => {
  await installAdmin(page);
  let metadataPatch = null;
  await page.route("**/api/admin/vocabulary-sets/set-1", async (route) => {
    if (route.request().method() === "PATCH") {
      metadataPatch = route.request().postDataJSON();
      await route.fulfill({ status: 200, json: { success: true, data: systemSetDetail } });
      return;
    }
    await route.fulfill({ status: 200, json: { success: true, data: systemSetDetail } });
  });
  await page.goto("/admin/vocabulary-sets");
  await expect(page.getByRole("heading", { name: "Quản lý bộ từ" })).toBeVisible();
  await expect(page.getByLabel("Lọc theo chủ đề")).toContainText(topic.name);
  const setPageStyles = await page.evaluate(() => ({
    headingSize: Number.parseFloat(getComputedStyle(document.querySelector(".admin-management-heading h1")).fontSize),
    createBackground: getComputedStyle(document.querySelector(".admin-primary-action")).backgroundColor,
    searchHeight: document.querySelector(".admin-system-set-toolbar input").getBoundingClientRect().height,
    selectHeight: document.querySelector(".admin-system-set-toolbar select").getBoundingClientRect().height,
  }));
  expect(setPageStyles.headingSize).toBeGreaterThanOrEqual(23);
  expect(setPageStyles.createBackground).not.toBe("rgba(0, 0, 0, 0)");
  expect(Math.abs(setPageStyles.searchHeight - setPageStyles.selectHeight)).toBeLessThanOrEqual(1);
  const card = page.getByRole("article").filter({ hasText: "Giao tiếp nền tảng" });
  await expect(card).toContainText("A1");
  await expect(card.locator(".admin-system-set-cover .admin-badge")).toHaveCount(1);
  await expect(card.getByText("Chưa có chủ đề", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Phân trang" })).toContainText("Hiển thị 1–1 / 1 kết quả");

  await page.getByRole("button", { name: "Tạo bộ từ" }).click();
  const setDialog = page.getByRole("dialog", { name: "Tạo bộ từ hệ thống" });
  await expect(setDialog).toBeVisible();
  await expect(setDialog.getByLabel("Chủ đề")).toBeEnabled();
  await expect(setDialog.getByLabel("Tên bộ từ")).toHaveAttribute("required", "");
  await expect(setDialog.getByLabel("Chủ đề")).toHaveAttribute("required", "");
  await expect(setDialog.getByLabel(/CEFR/)).toHaveAttribute("required", "");
  await expect(setDialog.getByLabel("Mô tả (không bắt buộc)")).not.toHaveAttribute("required", "");
  await expect(setDialog.locator(".admin-system-set-field-label")).toHaveText(["Tên bộ từ *", "Chủ đề *", "Trình độ CEFR *", "Mô tả (không bắt buộc)"]);
  await expect(setDialog.getByText("Từ vựng trong bộ")).toBeVisible();
  await expect(setDialog.getByText("0 từ đã chọn")).toBeVisible();
  await setDialog.getByLabel("Tên bộ từ").fill("Bộ từ mới");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.keyboard.press("Escape");
  await expect(setDialog).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await setDialog.getByRole("button", { name: "Hủy" }).click();
  await page.getByRole("button", { name: "Sửa Giao tiếp nền tảng" }).click();
  const editSetDialog = page.getByRole("dialog", { name: "Chỉnh sửa Giao tiếp nền tảng" });
  await expect(editSetDialog.getByLabel("Chủ đề")).toHaveValue("topic-1");
  await expect(editSetDialog.getByLabel(/CEFR/)).toHaveValue("A1");
  await expect(editSetDialog.getByText("Danh sách từ vựng theo thứ tự")).toHaveCount(0);
  await expect(editSetDialog.getByRole("button", { name: "Thêm từ vựng" })).toHaveCount(0);
  await editSetDialog.getByLabel("Mô tả").fill("Mô tả chỉ cập nhật metadata");
  await editSetDialog.getByRole("button", { name: "Lưu bộ từ" }).click();
  await expect(page.locator(".admin-toast").filter({ hasText: "Cập nhật bộ từ thành công" })).toBeVisible();
  await expect.poll(() => metadataPatch).not.toBeNull();
  expect(metadataPatch).not.toHaveProperty("items");
  await page.getByRole("button", { name: "Xóa Giao tiếp nền tảng" }).click();
  const deleteSet = page.getByRole("dialog", { name: "Xóa bộ từ hệ thống?" });
  await expect(deleteSet).toContainText("Giao tiếp nền tảng");
  await deleteSet.getByRole("button", { name: "Xác nhận xóa" }).click();
  await expect(page.locator(".admin-toast").filter({ hasText: "Xóa bộ từ thành công" })).toBeVisible();
});

test("System Set Topic filter is authoritative even when there are no sets", async ({ page }) => {
  await installAdmin(page);
  const unusedTopic = { id: "topic-unused", name: "Chủ đề chưa có bộ từ" };
  await page.route("**/api/topics", (route) => route.fulfill({ status: 200, json: { success: true, data: [topic, unusedTopic] } }));
  await page.route("**/api/admin/vocabulary-sets", (route) => route.fulfill({ status: 200, json: { success: true, data: [] } }));
  await page.goto("/admin/vocabulary-sets");
  const topicFilter = page.getByLabel("Lọc theo chủ đề");
  await expect(topicFilter).toContainText(unusedTopic.name);
  await topicFilter.selectOption(unusedTopic.id);
  await expect(page.getByRole("heading", { name: "Chưa có bộ từ hệ thống" })).toBeVisible();
  const createButtons = page.getByRole("button", { name: "Tạo bộ từ" });
  const headerButton = createButtons.first(), emptyStateButton = createButtons.last();
  for (const button of [headerButton, emptyStateButton]) {
    const styles = await button.evaluate((element) => { const rect = element.getBoundingClientRect(), computed = getComputedStyle(element); return { height: rect.height, background: computed.backgroundColor, radius: Number.parseFloat(computed.borderRadius), paddingLeft: Number.parseFloat(computed.paddingLeft), cursor: computed.cursor }; });
    expect(styles.height).toBeGreaterThanOrEqual(44);
    expect(styles.background).not.toBe("rgba(0, 0, 0, 0)");
    expect(styles.radius).toBeGreaterThan(0);
    expect(styles.paddingLeft).toBeGreaterThan(0);
    expect(styles.cursor).toBe("pointer");
  }
  await emptyStateButton.focus();
  await expect(emptyStateButton).toBeFocused();
  expect(await emptyStateButton.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe("none");
  await page.screenshot({ fullPage: true, path: "test-results/admin-system-set-empty-state.png" });
  await emptyStateButton.click();
  await expect(page.getByRole("dialog", { name: "Tạo bộ từ hệ thống" }).getByLabel("Chủ đề")).toContainText(unusedTopic.name);
});

for (const width of [1440, 1280, 1024, 768, 390, 375, 320]) {
  test(`Admin management pages avoid page overflow at ${width}px`, async ({ page }) => {
    await installAdmin(page);
    await page.setViewportSize({ width, height: 900 });
    for (const route of ["/admin/topics", "/admin/vocabulary", "/admin/vocabulary-sets"]) {
      await page.goto(route);
      await expect(page.locator("h1")).toBeVisible();
      const layout = await page.evaluate(() => ({
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
        offenders: [...document.querySelectorAll("body *")].filter((element) => element.getBoundingClientRect().right > window.innerWidth + 1).slice(0, 5).map((element) => `${element.tagName}.${element.className}`),
      }));
      expect(layout.documentWidth, `${route}: ${JSON.stringify(layout)}`).toBeLessThanOrEqual(layout.viewportWidth);
      if ([1440, 390].includes(width)) {
        await page.screenshot({ fullPage: true, path: `test-results/admin-v2-${route.split("/").at(-1)}-${width}.png` });
      }
    }
  });
}

for (const width of [1440, 1280, 1024, 768, 390, 375, 320]) {
  test(`Admin form dialogs stay contained and accessible at ${width}px`, async ({ page }) => {
    await installAdmin(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/admin/vocabulary");
    await page.getByRole("button", { name: "Thêm từ vựng" }).click();
    const vocabularyDialog = page.getByRole("dialog", { name: "Thêm từ vựng" });
    await expect(vocabularyDialog.getByLabel("Từ tiếng Anh")).toBeFocused();
    expect(await vocabularyDialog.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return rect.left >= 0 && rect.right <= window.innerWidth && rect.bottom <= window.innerHeight;
    })).toBe(true);
    await page.screenshot({ fullPage: true, path: `test-results/admin-vocabulary-modal-${width}.png` });
    await vocabularyDialog.getByLabel("Đóng hộp thoại").click();
    await page.getByRole("button", { name: "Sửa communicate" }).click();
    const editVocabularyDialog = page.getByRole("dialog", { name: /Chỉnh sửa từ: communicate/ });
    await expect(editVocabularyDialog.getByLabel("Từ loại")).toHaveValue("phrasal verb");
    await page.screenshot({ fullPage: true, path: `test-results/admin-vocabulary-edit-modal-${width}.png` });
    await editVocabularyDialog.getByRole("button", { name: "Hủy" }).click();

    await page.goto("/admin/vocabulary-sets");
    await page.getByRole("button", { name: "Tạo bộ từ" }).click();
    const setDialog = page.getByRole("dialog", { name: "Tạo bộ từ hệ thống" });
    await expect(setDialog).toBeVisible();
    expect(await setDialog.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return rect.left >= 0 && rect.right <= window.innerWidth && rect.bottom <= window.innerHeight;
    })).toBe(true);
    await page.screenshot({ fullPage: true, path: `test-results/admin-system-set-modal-${width}.png` });
    await setDialog.getByRole("button", { name: "Hủy" }).click();
    await page.getByRole("button", { name: "Sửa Giao tiếp nền tảng" }).click();
    const editSetDialog = page.getByRole("dialog", { name: "Chỉnh sửa Giao tiếp nền tảng" });
    await expect(editSetDialog.getByText("Danh sách từ vựng theo thứ tự")).toHaveCount(0);
    await page.screenshot({ fullPage: true, path: `test-results/admin-system-set-edit-modal-${width}.png` });
  });
}
