import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { PrismaClient } from "../../../backend/src/generated/prisma/client.ts";
import { hashPassword } from "../../../backend/src/utils/password-security.js";
import { configureTestEnvironment } from "../../../backend/test/helpers/test-environment.js";

configureTestEnvironment({ requireReset: true });
const prisma = new PrismaClient(); const run = randomUUID(); const domain = `${run}.vocabulary.test`; const password = `Safe-${run}`;
const admin = { email: `admin@${domain}`, display_name: "Vocabulary Admin", role: "ADMIN", is_active: true };
const user = { email: `user@${domain}`, display_name: "Vocabulary User", role: "USER", is_active: true };
let existing; const createdVocabularyIds = [];
test.describe.configure({ mode: "serial" });
test.beforeAll(async () => { await prisma.$connect(); const password_hash = await hashPassword(password); await prisma.uSER.createMany({ data: [{ ...admin, password_hash }, { ...user, password_hash }] }); existing = await prisma.vOCABULARY.create({ data: { word: `E2E-${run}`, meanings: { create: [{ part_of_speech: "noun", meaning_vi: "nghĩa", examples: { create: [{ example_en: "Example." }] } }] } }, include: { meanings: { include: { examples: true } } } }); createdVocabularyIds.push(existing.id); });
test.afterAll(async () => { const accounts = await prisma.uSER.findMany({ where: { email: { endsWith: `@${domain}` } }, select: { id: true } }); await prisma.vOCABULARY.deleteMany({ where: { id: { in: createdVocabularyIds } } }); await prisma.aUTH_SESSION.deleteMany({ where: { user_id: { in: accounts.map((x) => x.id) } } }); await prisma.uSER.deleteMany({ where: { id: { in: accounts.map((x) => x.id) } } }); await prisma.$disconnect(); });
async function login(page, account) { await page.goto("/login"); await page.getByLabel("Email").fill(account.email); await page.locator("#login-password").fill(password); await page.getByRole("button", { name: "Đăng nhập" }).click(); await expect(page).toHaveURL(/dashboard/); }
test("ADMIN navigates, searches, loads complete detail, and opens edit", async ({ page }) => { await login(page, admin); await page.getByRole("navigation", { name: "Điều hướng ứng dụng" }).getByRole("link", { name: "Kho từ vựng" }).click(); await expect(page.getByRole("heading", { name: "Kho từ vựng" })).toBeVisible(); await page.getByLabel("Tìm kiếm từ vựng").fill(existing.word); await expect(page.getByRole("row", { name: new RegExp(existing.word) })).toBeVisible(); await page.getByRole("button", { name: `Xem ${existing.word}` }).click(); const detail = page.getByRole("dialog", { name: existing.word }); await expect(detail.getByText("Example.")).toBeVisible(); await detail.getByRole("button", { name: "Chỉnh sửa" }).click(); const editor = page.getByRole("dialog", { name: `Chỉnh sửa từ: ${existing.word}` }); await expect(editor.locator(".admin-example-group")).toContainText("Ví dụ (1)"); });
test("USER cannot access ADMIN Vocabulary", async ({ page }) => { await login(page, user); await expect(page.getByRole("link", { name: "Kho từ vựng" })).toHaveCount(0); await page.goto("/admin/vocabulary"); await expect(page).toHaveURL(/dashboard/); });
test("ADMIN receives an accessible Vocabulary list error", async ({ page }) => { await page.route("**/api/admin/vocabulary", (route) => route.abort("failed")); await login(page, admin); await page.getByRole("navigation", { name: "Điều hướng ứng dụng" }).getByRole("link", { name: "Kho từ vựng" }).click(); await expect(page.getByRole("alert")).toBeVisible(); });

test("ADMIN creates, replaces owned children, and confirms aggregate deletion", async ({ page }) => {
  const createdWord = `E2E-created-${run}`;
  await login(page, admin);
  await page.getByRole("navigation", { name: "Điều hướng ứng dụng" }).getByRole("link", { name: "Kho từ vựng" }).click();
  await page.getByRole("button", { name: "Thêm từ vựng" }).click();

  const dialog = page.getByRole("dialog", { name: "Thêm từ vựng" });
  const form = dialog.locator("#admin-vocabulary-form");
  const meanings = form.locator(".admin-meaning-card");
  const firstMeaning = meanings.first();
  await form.getByLabel("Từ tiếng Anh").fill(createdWord);
  await firstMeaning.getByLabel("Từ loại").selectOption("noun");
  await firstMeaning.getByLabel("Nghĩa tiếng Việt").fill("created meaning");
  const firstExamples = firstMeaning.locator(".admin-example-group");
  await firstExamples.getByRole("button", { name: "Thêm ví dụ" }).click();
  await firstExamples.getByLabel("Ví dụ tiếng Anh 1").fill("Initial example.");

  await dialog.getByRole("button", { name: "Thêm nghĩa" }).click();
  await expect(meanings).toHaveCount(2);
  const removedMeaning = meanings.nth(1);
  await removedMeaning.getByLabel("Từ loại").selectOption("verb");
  await removedMeaning.getByLabel("Nghĩa tiếng Việt").fill("removed meaning");
  await removedMeaning.getByRole("button", { name: "Xóa nghĩa 2" }).click();
  await expect(meanings).toHaveCount(1);

  await dialog.getByRole("button", { name: "Tạo từ vựng" }).click();
  await expect(page.getByRole("row", { name: new RegExp(createdWord) })).toBeVisible();

  const created = await prisma.vOCABULARY.findFirstOrThrow({ where: { word: createdWord }, include: { meanings: { include: { examples: true } } } });
  createdVocabularyIds.push(created.id);
  const retainedMeaningId = created.meanings[0].id;
  const removedExampleId = created.meanings[0].examples[0].id;

  await page.getByRole("button", { name: `Sửa ${createdWord}` }).click();
  const editDialog = page.getByRole("dialog", { name: `Chỉnh sửa từ: ${createdWord}` });
  const editForm = editDialog.locator("#admin-vocabulary-form");
  const retainedMeaning = editForm.locator(".admin-meaning-card").first();
  const retainedExamples = retainedMeaning.locator(".admin-example-group");
  await retainedExamples.getByRole("button", { name: "Thêm ví dụ" }).click();
  await expect(retainedExamples.locator(".admin-example-row")).toHaveCount(2);
  await retainedExamples.getByLabel("Ví dụ tiếng Anh 2").fill("Replacement example.");
  await retainedExamples.getByRole("button", { name: "Xóa ví dụ 1 của nghĩa 1" }).click();
  await expect(retainedExamples.locator(".admin-example-row")).toHaveCount(1);
  await expect(retainedExamples.getByLabel("Ví dụ tiếng Anh 1")).toHaveValue("Replacement example.");
  await editDialog.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(editDialog).toHaveCount(0);
  await expect(page.getByRole("row", { name: new RegExp(createdWord) })).toBeVisible();

  const replaced = await prisma.vOCABULARY.findUniqueOrThrow({ where: { id: created.id }, include: { meanings: { include: { examples: true } } } });
  expect(replaced.meanings).toHaveLength(1);
  expect(replaced.meanings[0].id).toBe(retainedMeaningId);
  expect(replaced.meanings[0].examples).toHaveLength(1);
  expect(replaced.meanings[0].examples[0].id).not.toBe(removedExampleId);
  expect(replaced.meanings[0].examples[0].example_en).toBe("Replacement example.");

  const row = page.getByRole("row").filter({ hasText: createdWord });
  await row.getByRole("button", { name: `Xóa ${createdWord}` }).click();
  const confirmation = page.getByRole("dialog", { name: "Xóa từ vựng?" });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole("button", { name: "Hủy" }).click();
  await expect(confirmation).toHaveCount(0);

  let releaseDeleteFailure;
  let deleteAttempts = 0;
  await page.route(`**/api/admin/vocabulary/${created.id}`, async (route) => {
    if (route.request().method() !== "DELETE") return route.fallback();
    deleteAttempts += 1;
    if (deleteAttempts === 1) await new Promise((resolve) => { releaseDeleteFailure = resolve; });
    await route.fulfill({
      status: 500,
      json: { success: false, error: { code: "INTERNAL_ERROR", message: "raw database detail must stay hidden" } },
    });
  });

  await row.getByRole("button", { name: `Xóa ${createdWord}` }).click();
  const failedConfirmation = page.getByRole("dialog", { name: "Xóa từ vựng?" });
  const confirmDelete = failedConfirmation.getByRole("button", { name: "Xác nhận xóa" });
  await confirmDelete.click();
  await expect(failedConfirmation.getByRole("button", { name: "Đang xóa…" })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(failedConfirmation).toBeVisible();
  await expect.poll(() => deleteAttempts).toBe(1);
  await expect.poll(() => typeof releaseDeleteFailure).toBe("function");
  releaseDeleteFailure();
  const safeDeleteError = failedConfirmation.getByRole("alert");
  await expect(safeDeleteError).toHaveText("Không thể xóa từ vựng. Vui lòng thử lại.");
  await expect(failedConfirmation.getByText("raw database detail must stay hidden")).toHaveCount(0);
  await failedConfirmation.getByRole("button", { name: "Hủy" }).click();
  await expect(failedConfirmation).toHaveCount(0);

  await row.getByRole("button", { name: `Xóa ${createdWord}` }).click();
  const retryConfirmation = page.getByRole("dialog", { name: "Xóa từ vựng?" });
  await expect(retryConfirmation.getByRole("alert")).toHaveCount(0);
  await retryConfirmation.getByRole("button", { name: "Xác nhận xóa" }).click();
  await expect(retryConfirmation.getByRole("alert")).toHaveText("Không thể xóa từ vựng. Vui lòng thử lại.");
  await page.unroute(`**/api/admin/vocabulary/${created.id}`);
  await retryConfirmation.getByRole("button", { name: "Xác nhận xóa" }).click();
  await expect(page.getByRole("row").filter({ hasText: createdWord })).toHaveCount(0);
  await expect(prisma.vOCABULARY.count({ where: { id: created.id } })).resolves.toBe(0);
});

test("Vocabulary form remains keyboard reachable and does not overflow on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await login(page, admin);
  await page.goto("/admin/vocabulary");
  const createButton = page.getByRole("button", { name: "Thêm từ vựng" });
  await createButton.focus();
  await expect(createButton).toBeFocused();
  await page.keyboard.press("Enter");
  const wordInput = page.getByRole("dialog", { name: "Thêm từ vựng" }).getByLabel("Từ tiếng Anh");
  await expect(wordInput).toBeVisible();
  await wordInput.focus();
  await expect(wordInput).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
