import { expect, test } from "@playwright/test";
import { Buffer } from "node:buffer";
import { installAuthApiMock, publicUser, responses } from "./fixtures/auth-api.js";

const setId = "set-detail";
const populated = {
  id: setId, name: "Du lịch", description: "Từ vựng cần thiết cho chuyến đi",
  cefr_level: "A2", cover_image_url: "https://covers.example.test/personal.webp",
  items: [
    { id: "item-1", vocabulary_id: "canonical-1", position: 1, word: "airport", phonetic: "/ˈeəpɔːt/", source: "CANONICAL", primary_meaning: { part_of_speech: "noun", meaning_vi: "sân bay", example: { example_en: "We arrived at the international airport very early in the morning before our long connecting flight departed.", example_vi: "Chúng tôi đến sân bay quốc tế từ rất sớm trước chuyến bay nối chuyến dài." } } },
    { id: "item-2", vocabulary_id: "private-1", position: 2, word: "book", phonetic: null, source: "PRIVATE", primary_meaning: null },
  ],
};

function deferred() { let resolve; const promise = new Promise((next) => { resolve = next; }); return { promise, resolve }; }

async function install(page, initial = populated, options = {}) {
  await installAuthApiMock(page, { "/api/auth/me": responses.currentUser(publicUser) });
  await page.route("https://covers.example.test/personal.webp", (route) => route.fulfill({ status: 200, contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64") }));
  await page.route("https://covers.example.test/broken.webp", (route) => route.fulfill({ status: 404, body: "" }));
  let detail = structuredClone(initial);
  const calls = [];
  let detailFailures = options.detailFailures ?? 0;
  let createFailures = options.createFailures ?? 0;
  let editFailures = options.editFailures ?? 0;
  let removeFailures = options.removeFailures ?? 0;
  let deleteFailures = options.deleteFailures ?? 0;

  await page.route("**/api/my/vocabulary/private-1", async (route) => {
    const request = route.request();
    calls.push({ method: request.method(), pathname: new URL(request.url()).pathname, body: request.postDataJSON?.() });
    if (request.method() === "GET") { if (options.editLoadGate) await options.editLoadGate.promise; return route.fulfill({ status: 200, json: privateAggregate(detail.items.find((item) => item.vocabulary_id === "private-1")?.word ?? "book") }); }
    if (options.editGate) await options.editGate.promise;
    if (editFailures > 0) { editFailures -= 1; return apiError(route); }
    const body = request.postDataJSON();
    detail = { ...detail, items: detail.items.map((item) => item.vocabulary_id === "private-1" ? { ...item, word: body.word, primary_meaning: { part_of_speech: body.meanings[0].part_of_speech, meaning_vi: body.meanings[0].meaning_vi, example: null } } : item) };
    return route.fulfill({ status: 200, json: privateAggregate(body.word, body.meanings) });
  });

  await page.route("**/api/my/vocabulary-sets/**", async (route) => {
    const request = route.request(); const pathname = new URL(request.url()).pathname; const body = request.postDataJSON?.();
    calls.push({ method: request.method(), pathname, body });
    if (pathname.endsWith("/vocabulary") && request.method() === "POST") {
      if (options.createGate) await options.createGate.promise;
      if (createFailures > 0) { createFailures -= 1; return apiError(route); }
      const vocabulary = body.vocabulary;
      detail = { ...detail, items: [...detail.items, { id: "item-created", vocabulary_id: "private-created", position: detail.items.length + 1, word: vocabulary.word, phonetic: vocabulary.phonetic ?? null, source: "PRIVATE", primary_meaning: { part_of_speech: vocabulary.meanings[0].part_of_speech, meaning_vi: vocabulary.meanings[0].meaning_vi, example: null } }] };
      return route.fulfill({ status: 201, json: { success: true, data: { vocabulary: { id: "private-created" }, membership: { id: "membership-created", vocabulary_id: "private-created", position: detail.items.length } } } });
    }
    if (request.method() === "GET") {
      if (options.detailGate) await options.detailGate.promise;
      if (detailFailures > 0) { detailFailures -= 1; return apiError(route); }
      if (options.notFound) return route.fulfill({ status: 404, json: { success: false, error: { code: "VOCABULARY_SET_NOT_FOUND", message: "hidden" } } });
      return route.fulfill({ status: 200, json: { success: true, data: detail } });
    }
    if (request.method() === "PATCH") {
      const removing = body.items && body.items.length < detail.items.length;
      const adding = body.items && body.items.length > detail.items.length;
      if (adding && options.addGate) await options.addGate.promise;
      if (removing && options.removeGate) await options.removeGate.promise;
      if (removing && removeFailures > 0) { removeFailures -= 1; return apiError(route); }
      if (body.items) detail = { ...detail, items: body.items.map((entry, index) => detail.items.find((item) => item.vocabulary_id === entry.vocabulary_id) ?? { id: `new-${index}`, vocabulary_id: entry.vocabulary_id, position: index + 1, word: "ticket", phonetic: null, source: "CANONICAL", primary_meaning: null }) };
      else detail = { ...detail, ...body };
      return route.fulfill({ status: 200, json: { success: true, data: detail } });
    }
    if (request.method() === "DELETE") {
      if (options.deleteGate) await options.deleteGate.promise;
      if (deleteFailures > 0) { deleteFailures -= 1; return apiError(route); }
      return route.fulfill({ status: 204, body: "" });
    }
    return route.fulfill({ status: 405, body: "" });
  });
  await page.route("**/api/my/vocabulary-sets", (route) => route.fulfill({ status: 200, json: { success: true, data: [] } }));
  await page.route("**/api/vocabulary-set-picker**", (route) => { const url = new URL(route.request().url()); calls.push({ method: "GET", pathname: url.pathname, query: url.searchParams.get("query") }); return route.fulfill({ status: 200, json: { success: true, data: [
    { id: "canonical-1", word: "airport", phonetic: null, source: "CANONICAL", primary_meaning: null },
    { id: "canonical-2", word: "ticket", phonetic: null, source: "CANONICAL", primary_meaning: { part_of_speech: "noun", meaning_vi: "vé" } },
  ] } }); });
  return calls;
}

test("renders the owner learning hub, projection, and source-based actions", async ({ page }) => {
  await install(page); await page.goto(`/my/vocabulary-sets/${setId}`);
  await expect(page.getByRole("heading", { level: 1, name: "Du lịch" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Thẻ ghi nhớ/ })).toHaveAttribute("href", `/learn/vocabulary-sets/${setId}`);
  await expect(page.getByRole("link", { name: /Quiz/ })).toHaveAttribute("href", `/quiz/vocabulary-sets/${setId}`);
  await expect(page.getByRole("columnheader")).toHaveText(["Từ vựng", "Phiên âm", "Từ loại", "Nghĩa", "Ví dụ", "Thao tác"]);
  await expect(page.getByRole("heading", { level: 2, name: "Từ vựng trong bộ (2)" })).toBeVisible();
  await expect(page.getByText(populated.description, { exact: true })).toBeVisible();
  await expect(page.getByText("A2", { exact: true })).toBeVisible();
  await expect(page.locator(".set-detail-header").locator('[data-cover-state]')).toHaveCount(0);
  await expect(page.getByRole("cell", { name: "sân bay", exact: true })).toBeVisible();
  const canonicalRow = page.getByRole("row", { name: /airport/ });
  const canonicalEdit = canonicalRow.getByRole("button", { name: "Chỉ từ của bạn mới có thể chỉnh sửa" }); await expect(canonicalEdit).toBeVisible(); await expect(canonicalEdit).toBeDisabled(); await expect(canonicalRow.getByRole("button", { name: "Gỡ airport khỏi bộ" })).toBeEnabled();
  const privateRow = page.getByRole("row", { name: /book/ });
  await expect(privateRow.getByRole("button", { name: "Chỉnh sửa book" })).toBeEnabled(); await expect(privateRow.getByRole("button", { name: "Gỡ book khỏi bộ" })).toBeEnabled();
  await canonicalEdit.evaluate((button) => button.click()); await expect(page.getByRole("dialog", { name: "Chỉnh sửa từ vựng" })).toHaveCount(0);
  const tableGeometry = await page.locator(".set-detail-table").evaluate((table) => {
    const rows = [...table.tBodies[0].rows];
    const example = table.querySelector(".set-detail-example-cell > span");
    const heading = getComputedStyle(table.querySelector("th"));
    return {
      rowHeights: rows.map((row) => row.getBoundingClientRect().height),
      exampleClamp: getComputedStyle(example).webkitLineClamp,
      exampleTitle: example.getAttribute("title"),
      headingFontSize: heading.fontSize,
      headingFontWeight: heading.fontWeight,
    };
  });
  expect(Math.max(...tableGeometry.rowHeights) - Math.min(...tableGeometry.rowHeights)).toBeLessThanOrEqual(1);
  expect(tableGeometry.exampleClamp).toBe("2");
  expect(tableGeometry.exampleTitle).toBe(populated.items[0].primary_meaning.example.example_en);
  expect(Number.parseFloat(tableGeometry.headingFontSize)).toBeGreaterThanOrEqual(12);
  expect(Number.parseFloat(tableGeometry.headingFontSize)).toBeLessThanOrEqual(13);
  expect(Number(tableGeometry.headingFontWeight)).toBeGreaterThanOrEqual(600);
  await expect(page.getByRole("columnheader").first()).toHaveClass(/text-slate-600/);
  await expect(page.getByRole("button", { name: /phát|audio|speaker/i })).toHaveCount(0);
  await expect(page.getByText(/Luyện nói/)).toHaveCount(0);
});

test("empty Set keeps real activities disabled and vocabulary management available", async ({ page }) => {
  await install(page, { ...populated, items: [] }); await page.goto(`/my/vocabulary-sets/${setId}`);
  await expect(page.getByText("Thêm từ vựng để bắt đầu", { exact: true })).toHaveCount(2);
  await expect(page.getByRole("link", { name: /Thẻ ghi nhớ|Quiz/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Thêm từ vựng" }).click();
  await expect(page.getByRole("dialog", { name: "Thêm từ vựng" })).toBeVisible();
});

test("legacy and broken Personal detail metadata omits the cover while preserving detail behavior", async ({ page }) => {
  await install(page, { ...populated, cefr_level: null, cover_image_url: "https://covers.example.test/broken.webp" });
  await page.goto(`/my/vocabulary-sets/${setId}`);
  await expect(page.locator(".set-detail-header").locator('[data-cover-state]')).toHaveCount(0);
  await expect(page.locator(".set-detail-header .set-cefr-badge")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Thẻ ghi nhớ/ })).toHaveAttribute("href", `/learn/vocabulary-sets/${setId}`);
});

test("search modal normalizes phrases, validates meaningful input, and keeps inline actions accessible", async ({ page }) => {
  const calls = await install(page); await page.goto(`/my/vocabulary-sets/${setId}`);
  await page.getByRole("button", { name: "Thêm từ vựng" }).click();
  const dialog = page.getByRole("dialog", { name: "Thêm từ vựng" });
  const query = dialog.getByRole("searchbox", { name: "Tìm từ vựng" });
  const searchButton = dialog.getByRole("button", { name: "Tìm kiếm" });
  const bounds = await dialog.boundingBox(); expect(bounds.width).toBeLessThanOrEqual(512); expect(bounds.width).toBeLessThan(page.viewportSize().width - 64);
  await searchButton.click(); await expect(dialog.getByRole("alert")).toHaveText("Nhập từ khóa trước khi tìm kiếm.");
  await query.fill("     "); await expect(dialog.getByRole("alert")).toBeVisible();
  await query.press("Enter"); await expect(dialog.getByRole("alert")).toBeVisible();
  await query.fill("   look     after  "); await expect(dialog.getByRole("alert")).toHaveCount(0);
  await query.press("Enter"); await expect.poll(() => calls.filter((call) => call.pathname === "/api/vocabulary-set-picker").at(-1)?.query).toBe("look after");
  await query.fill("ice    cream"); const clear = dialog.getByRole("button", { name: "Xóa từ khóa" }); await expect(clear).toBeVisible(); await clear.click();
  await expect(query).toHaveValue(""); await expect(query).toBeFocused(); await expect(clear).toHaveCount(0);
  await query.fill("mother   in law"); await searchButton.focus(); await expect(searchButton).toBeFocused(); await searchButton.press("Enter");
  await expect.poll(() => calls.filter((call) => call.pathname === "/api/vocabulary-set-picker").at(-1)?.query).toBe("mother in law");
  await searchButton.hover(); await expect(searchButton).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("create step keeps one named dialog and restores focus within and outside the workflow", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 }); await install(page); await page.goto(`/my/vocabulary-sets/${setId}`);
  const trigger = page.getByRole("button", { name: "Thêm từ vựng" }); await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Thêm từ vựng" });
  await expect(dialog.getByRole("searchbox", { name: "Tìm từ vựng" })).toBeFocused();
  await dialog.getByRole("button", { name: "Tạo từ mới" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(dialog).toHaveAccessibleName("Thêm từ vựng");
  await expect(dialog.getByRole("button", { name: "Đóng" })).toHaveCount(1);
  await expect(dialog.getByRole("button", { name: "Đóng biểu mẫu từ vựng" })).toHaveCount(0);
  await expect(dialog.getByRole("textbox", { name: "Từ vựng", exact: true })).toBeFocused();
  const topActions = await dialog.evaluate((element) => {
    const back = [...element.querySelectorAll("button")].find((button) => button.textContent.includes("Quay lại tìm kiếm")).getBoundingClientRect();
    const close = element.querySelector('button[aria-label="Đóng"]').getBoundingClientRect();
    const word = element.querySelector("#private-vocabulary-word").getBoundingClientRect();
    const phonetic = element.querySelector("#private-vocabulary-phonetic").getBoundingClientRect();
    return { backCenter: back.top + back.height / 2, closeCenter: close.top + close.height / 2, wordTop: word.top, phoneticTop: phonetic.top };
  });
  expect(Math.abs(topActions.backCenter - topActions.closeCenter)).toBeLessThanOrEqual(1);
  expect(Math.abs(topActions.wordTop - topActions.phoneticTop)).toBeLessThanOrEqual(1);
  await expect(dialog.getByText("Phiên âm", { exact: false }).filter({ hasText: "(không bắt buộc)" })).toBeVisible();
  await expect(dialog.getByText("CEFR", { exact: true })).toHaveCount(0);
  await expect(dialog.locator("textarea").first()).toHaveCSS("resize", "none");
  const controlGeometry = await dialog.evaluate((element) => ({
    input: element.querySelector("#private-vocabulary-word").getBoundingClientRect(),
    select: element.querySelector("select").getBoundingClientRect(),
    textarea: element.querySelector("textarea").getBoundingClientRect(),
  }));
  expect(controlGeometry.textarea.height).toBe(controlGeometry.input.height);
  expect(controlGeometry.textarea.height).toBe(controlGeometry.select.height);
  expect(controlGeometry.textarea.width).toBe(controlGeometry.input.width);
  expect(controlGeometry.textarea.width).toBe(controlGeometry.select.width);
  await dialog.getByRole("button", { name: "Thêm ví dụ" }).click();
  const desktopGeometry = await dialog.evaluate((element) => {
    const panel = element.querySelector(".private-vocabulary-dialog");
    const footerButtons = [...panel.querySelectorAll("footer button")].map((button) => button.getBoundingClientRect());
    const bounds = panel.getBoundingClientRect();
    return {
      width: bounds.width,
      bottom: bounds.bottom,
      viewportHeight: window.innerHeight,
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight,
      footerGap: footerButtons[1].left - footerButtons[0].right,
    };
  });
  expect(desktopGeometry.width).toBeLessThanOrEqual(650);
  expect(desktopGeometry.bottom).toBeLessThan(desktopGeometry.viewportHeight);
  expect(desktopGeometry.scrollHeight).toBeLessThanOrEqual(desktopGeometry.clientHeight + 1);
  expect(desktopGeometry.footerGap).toBeGreaterThanOrEqual(0);
  expect(desktopGeometry.footerGap).toBeLessThanOrEqual(16);

  await page.setViewportSize({ width: 375, height: 812 });
  const mobileFields = await dialog.evaluate((element) => {
    const word = element.querySelector("#private-vocabulary-word").getBoundingClientRect();
    const phonetic = element.querySelector("#private-vocabulary-phonetic").getBoundingClientRect();
    return { wordLeft: word.left, wordBottom: word.bottom, phoneticLeft: phonetic.left, phoneticTop: phonetic.top };
  });
  expect(Math.abs(mobileFields.wordLeft - mobileFields.phoneticLeft)).toBeLessThanOrEqual(1);
  expect(mobileFields.phoneticTop).toBeGreaterThanOrEqual(mobileFields.wordBottom);
  await page.setViewportSize({ width: 1440, height: 900 });
  await dialog.getByRole("button", { name: "Quay lại tìm kiếm" }).click();
  await expect(dialog.getByRole("button", { name: "Tạo từ mới" })).toBeFocused();
  await dialog.getByRole("button", { name: "Tạo từ mới" }).click();
  await dialog.getByRole("button", { name: "Hủy" }).click();
  await expect(dialog.getByRole("button", { name: "Tạo từ mới" })).toBeFocused();
  await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
});

test("private create protects pending work, preserves values after failure, and retries", async ({ page }) => {
  const createGate = deferred(); const calls = await install(page, populated, { createFailures: 1, createGate });
  await page.goto(`/my/vocabulary-sets/${setId}`); await page.getByRole("button", { name: "Thêm từ vựng" }).click();
  const dialog = page.getByRole("dialog", { name: "Thêm từ vựng" }); await dialog.getByRole("button", { name: "Tạo từ mới" }).click();
  await fillPrivateForm(dialog, "journey"); const submit = dialog.getByRole("button", { name: "Tạo và thêm" }); await submit.click();
  const pendingSubmit = dialog.locator('button[type="submit"][aria-busy="true"]');
  await expect(pendingSubmit).toBeDisabled();
  await dialog.locator("form").evaluate((form) => form.requestSubmit());
  await page.keyboard.press("Escape"); await expect(dialog).toBeVisible();
  expect(calls.filter((call) => call.method === "POST" && call.pathname.endsWith("/vocabulary"))).toHaveLength(1);
  createGate.resolve();
  await expect(dialog.getByRole("alert")).toContainText("Chưa thể tạo từ mới");
  await expect(dialog.getByRole("textbox", { name: "Từ vựng", exact: true })).toHaveValue("journey");
  await submit.click(); await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("cell", { name: "journey", exact: true })).toBeVisible();
});

test("add existing appends exact IDs, restores focus, and mobile does not overflow", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 }); const addGate = deferred(); const calls = await install(page, populated, { addGate }); await page.goto(`/my/vocabulary-sets/${setId}`);
  const trigger = page.getByRole("button", { name: "Thêm từ vựng" }); await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Thêm từ vựng" });
  await dialog.getByRole("searchbox", { name: "Tìm từ vựng" }).fill("ticket"); await dialog.getByRole("button", { name: "Tìm kiếm" }).click();
  await expect(dialog.getByRole("button", { name: "Đã có trong bộ" })).toBeDisabled(); await dialog.getByRole("button", { name: "Thêm", exact: true }).click();
  await expect(dialog).toHaveAttribute("aria-busy", "true"); await expect(dialog.locator('button[aria-busy="true"]')).toBeDisabled();
  await dialog.click({ position: { x: 1, y: 1 } }); await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape"); await expect(dialog).toBeVisible(); addGate.resolve();
  const patch = calls.find((call) => call.method === "PATCH" && call.body?.items?.length === 3);
  expect(patch.body.items).toEqual([{ vocabulary_id: "canonical-1" }, { vocabulary_id: "private-1" }, { vocabulary_id: "canonical-2" }]);
  await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("private edit preserves values after failure and refreshes authoritative detail", async ({ page }) => {
  await install(page, populated, { editFailures: 1 }); await page.goto(`/my/vocabulary-sets/${setId}`);
  const row = page.getByRole("row", { name: /book/ }); const editTrigger = row.getByRole("button", { name: "Chỉnh sửa book" }); await editTrigger.click();
  await page.getByRole("dialog", { name: "Chỉnh sửa từ vựng" }).getByRole("button", { name: "Hủy" }).click();
  await expect(editTrigger).toBeFocused(); await editTrigger.click();
  const dialog = page.getByRole("dialog", { name: "Chỉnh sửa từ vựng" }); await dialog.getByRole("textbox", { name: "Từ vựng", exact: true }).fill("novel");
  await dialog.getByRole("button", { name: "Lưu thay đổi" }).click(); await expect(dialog.getByRole("alert")).toContainText("Không thể lưu từ vựng");
  await expect(dialog.getByRole("textbox", { name: "Từ vựng", exact: true })).toHaveValue("novel"); await dialog.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(dialog).toHaveCount(0); await expect(page.getByRole("cell", { name: "novel", exact: true })).toBeVisible();
  await expect(page.getByRole("row", { name: /novel/ }).getByRole("button", { name: "Chỉnh sửa novel" })).toBeFocused();
});

test("private edit opens immediate feedback while authoritative data loads", async ({ page }) => {
  const editLoadGate = deferred(); await install(page, populated, { editLoadGate }); await page.goto(`/my/vocabulary-sets/${setId}`);
  const editTrigger = page.getByRole("row", { name: /book/ }).getByRole("button", { name: "Chỉnh sửa book" });
  const visibleResponseMs = await editTrigger.evaluate((button) => new Promise((resolve) => {
    const startedAt = performance.now();
    const observer = new MutationObserver(() => {
      const dialog = document.querySelector('dialog[aria-labelledby="private-vocabulary-loading-title"]');
      if (!dialog?.open) return;
      observer.disconnect(); resolve(performance.now() - startedAt);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    button.click();
  }));
  const loadingDialog = page.getByRole("dialog", { name: "Chỉnh sửa từ vựng" });
  await expect(loadingDialog).toBeVisible();
  expect(visibleResponseMs).toBeLessThan(1_000);
  await expect(loadingDialog.getByRole("status")).toContainText("Đang tải dữ liệu cho book");
  await expect(loadingDialog.getByRole("button", { name: "Hủy" })).toBeFocused();
  editLoadGate.resolve();
  const editor = page.getByRole("dialog", { name: "Chỉnh sửa từ vựng" });
  await expect(editor.getByRole("textbox", { name: "Từ vựng", exact: true })).toHaveValue("book");
  await editor.getByRole("button", { name: "Hủy" }).click();
  await expect(editTrigger).toBeFocused();
});

test("membership removal keeps a failed row and retry removes only that membership", async ({ page }) => {
  const removeGate = deferred(); const calls = await install(page, populated, { removeFailures: 1, removeGate }); await page.goto(`/my/vocabulary-sets/${setId}`);
  const row = page.getByRole("row", { name: /airport/ }); const removeButton = row.getByRole("button", { name: "Gỡ airport khỏi bộ" }); await removeButton.click();
  let dialog = page.getByRole("dialog", { name: "Gỡ từ khỏi bộ?" });
  await expect(dialog).toBeVisible(); await expect(dialog.getByRole("button", { name: "Hủy" })).toBeFocused();
  await expect(dialog).toContainText("Tiến độ học và từ vựng gốc vẫn được giữ lại");
  await dialog.getByRole("button", { name: "Hủy" }).click(); await expect(dialog).toHaveCount(0); await expect(removeButton).toBeFocused();
  expect(calls.filter((call) => call.method === "PATCH")).toHaveLength(0);
  await removeButton.click(); dialog = page.getByRole("dialog", { name: "Gỡ từ khỏi bộ?" });
  const confirm = dialog.getByRole("button", { name: "Gỡ khỏi bộ" }); await confirm.click();
  await expect(dialog.locator('button[aria-busy="true"]')).toBeDisabled();
  expect(calls.filter((call) => call.method === "PATCH")).toHaveLength(1);
  await page.keyboard.press("Escape"); await expect(dialog).toBeVisible(); removeGate.resolve();
  await expect(page.getByRole("alert")).toContainText("Không thể gỡ từ vựng"); await expect(row).toBeVisible();
  await expect(removeButton).toBeFocused(); await removeButton.click(); dialog = page.getByRole("dialog", { name: "Gỡ từ khỏi bộ?" }); await dialog.getByRole("button", { name: "Gỡ khỏi bộ" }).click(); await expect(row).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 2, name: "Từ vựng trong bộ (1)" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Đã gỡ airport khỏi bộ");
  await expect(page.getByRole("row", { name: /book/ })).toBeVisible();
  const patches = calls.filter((call) => call.method === "PATCH");
  expect(patches).toHaveLength(2);
  expect(patches[1].body).toEqual({ items: [{ vocabulary_id: "private-1" }] });
  expect(calls.filter((call) => call.method === "DELETE")).toHaveLength(0);
  await expect(page.getByRole("button", { name: "Xóa từ vựng" })).toHaveCount(0);
});

test("shows loading, retries an operational error, and keeps not-found private", async ({ page }) => {
  const detailGate = deferred(); await install(page, populated, { detailFailures: 2, detailGate }); await page.goto(`/my/vocabulary-sets/${setId}`);
  await expect(page.getByRole("heading", { name: "Đang tải bộ từ…" })).toBeVisible(); detailGate.resolve();
  await expect(page.getByRole("heading", { name: "Không thể tải bộ từ" })).toBeVisible(); await page.getByRole("button", { name: "Thử lại" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Du lịch" })).toBeVisible();
  await page.unrouteAll({ behavior: "wait" }); await install(page, populated, { notFound: true }); await page.goto(`/my/vocabulary-sets/${setId}`);
  await expect(page.getByRole("heading", { name: "Không tìm thấy bộ từ" })).toBeVisible(); await expect(page.getByText(/không có quyền truy cập/)).toBeVisible();
});

test("Set management actions are not exposed on Set Detail", async ({ page }) => {
  await install(page); await page.goto(`/my/vocabulary-sets/${setId}`);
  await expect(page.getByRole("button", { name: "Xóa bộ từ" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Chỉnh sửa", exact: true })).toHaveCount(0);
});

test("backdrop dismissal and responsive columns remain usable", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 }); await install(page); await page.goto(`/my/vocabulary-sets/${setId}`);
  const trigger = page.getByRole("button", { name: "Thêm từ vựng" }); await trigger.click(); const dialog = page.getByRole("dialog", { name: "Thêm từ vựng" });
  await dialog.click({ position: { x: 1, y: 1 } }); await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.getByRole("columnheader", { name: "Phiên âm" })).toBeHidden(); await expect(page.getByRole("columnheader", { name: "Từ loại" })).toBeHidden(); await expect(page.getByRole("columnheader", { name: "Ví dụ" })).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1440, height: 900 }); await expect(page.getByRole("columnheader", { name: "Phiên âm" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.getByRole("button", { name: /sắp xếp|di chuyển|kéo|thả/i })).toHaveCount(0);
  await expect(page.locator('[draggable="true"]')).toHaveCount(0);
});

function privateAggregate(word, meanings = [{ id: "meaning-1", part_of_speech: "noun", meaning_vi: "sách", context: null, cefr_level: null, examples: [] }]) { return { success: true, data: { id: "private-1", word, phonetic: null, meanings } }; }
function apiError(route) { return route.fulfill({ status: 500, json: { success: false, error: { code: "INTERNAL_ERROR", message: "internal database detail must not leak" } } }); }
async function fillPrivateForm(dialog, word) { await dialog.getByRole("textbox", { name: "Từ vựng", exact: true }).fill(word); await dialog.getByRole("combobox", { name: "Loại từ", exact: true }).selectOption("noun"); await dialog.getByRole("textbox", { name: "Nghĩa tiếng Việt", exact: true }).fill("chuyến đi"); }
