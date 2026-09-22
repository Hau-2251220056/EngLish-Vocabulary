import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { PrismaClient } from "../../../backend/src/generated/prisma/client.ts";
import { hashPassword } from "../../../backend/src/utils/password-security.js";
import { configureTestEnvironment } from "../../../backend/test/helpers/test-environment.js";

configureTestEnvironment({ requireReset: true });
const prisma = new PrismaClient(); const run = randomUUID(); const domain = `${run}.vocabulary.test`; const password = `Safe-${run}`;
const admin = { email: `admin@${domain}`, display_name: "Vocabulary Admin", role: "ADMIN", is_active: true };
const user = { email: `user@${domain}`, display_name: "Vocabulary User", role: "USER", is_active: true };
let existing;
test.describe.configure({ mode: "serial" });
test.beforeAll(async () => { await prisma.$connect(); const password_hash = await hashPassword(password); await prisma.uSER.createMany({ data: [{ ...admin, password_hash }, { ...user, password_hash }] }); existing = await prisma.vOCABULARY.create({ data: { word: `E2E-${run}`, meanings: { create: [{ part_of_speech: "noun", meaning_vi: "nghĩa", examples: { create: [{ example_en: "Example." }] } }] } }, include: { meanings: { include: { examples: true } } } }); });
test.afterAll(async () => { const accounts = await prisma.uSER.findMany({ where: { email: { endsWith: `@${domain}` } }, select: { id: true } }); await prisma.vOCABULARY.deleteMany({ where: { word: { startsWith: "E2E-" } } }); await prisma.aUTH_SESSION.deleteMany({ where: { user_id: { in: accounts.map((x) => x.id) } } }); await prisma.uSER.deleteMany({ where: { id: { in: accounts.map((x) => x.id) } } }); await prisma.$disconnect(); });
async function login(page, account) { await page.goto("/login"); await page.getByLabel("Email").fill(account.email); await page.locator("#login-password").fill(password); await page.getByRole("button", { name: "Đăng nhập" }).click(); await expect(page).toHaveURL(/dashboard/); }
test("ADMIN navigates, searches, loads complete detail, and opens edit", async ({ page }) => { await login(page, admin); await page.getByRole("link", { name: "Quản lý từ vựng" }).click(); await expect(page.getByRole("heading", { name: "Quản lý từ vựng" })).toBeVisible(); await page.getByRole("searchbox").fill(existing.word); await expect(page.getByText(existing.word)).toBeVisible(); await page.getByRole("button", { name: "Xem" }).click(); const detail = page.locator(".admin-topic-panel").filter({ has: page.getByRole("heading", { name: existing.word }) }); await expect(detail.getByText("Example.")).toBeVisible(); await detail.getByRole("button", { name: "Sửa" }).click(); await expect(page.locator("form.admin-topic-form").locator("fieldset").first().getByRole("group", { name: "Ví dụ" })).toBeVisible(); });
test("USER cannot access ADMIN Vocabulary", async ({ page }) => { await login(page, user); await expect(page.getByRole("link", { name: "Quản lý từ vựng" })).toHaveCount(0); await page.goto("/admin/vocabulary"); await expect(page).toHaveURL(/dashboard/); });
test("ADMIN receives an accessible Vocabulary list error", async ({ page }) => { await login(page, admin); await page.route("**/api/admin/vocabulary", (route) => route.abort("failed")); await page.locator('a[href="/admin/vocabulary"]').click(); await expect(page.getByRole("alert")).toBeVisible(); });

test("ADMIN creates, replaces owned children, and confirms aggregate deletion", async ({ page }) => {
  const createdWord = `E2E-created-${run}`;
  await login(page, admin);
  await page.locator('a[href="/admin/vocabulary"]').click();
  await page.locator(".admin-topic-page-header > button").click();

  const form = page.locator("form.admin-topic-form");
  const meanings = form.locator(":scope > fieldset");
  const firstMeaning = meanings.first();
  await form.locator("input").first().fill(createdWord);
  await firstMeaning.locator("input").first().fill("noun");
  await firstMeaning.locator("textarea").first().fill("created meaning");
  const firstExamples = firstMeaning.getByRole("group", { name: "Ví dụ" });
  await firstExamples.getByRole("button", { name: "Thêm ví dụ" }).click();
  await firstExamples.locator(":scope > div").first().locator("textarea").first().fill("Initial example.");

  await form.locator(":scope > button").first().click();
  await expect(meanings).toHaveCount(2);
  const removedMeaning = meanings.nth(1);
  await removedMeaning.locator("input").first().fill("verb");
  await removedMeaning.locator("textarea").first().fill("removed meaning");
  await removedMeaning.getByRole("button", { name: "Xóa nghĩa" }).click();
  await expect(meanings).toHaveCount(1);

  await form.locator("button.admin-topic-primary-button").click();
  const detail = page.locator(".admin-topic-panel").filter({ has: page.getByRole("heading", { name: createdWord }) });
  await expect(detail).toBeVisible();

  const created = await prisma.vOCABULARY.findFirstOrThrow({ where: { word: createdWord }, include: { meanings: { include: { examples: true } } } });
  const retainedMeaningId = created.meanings[0].id;
  const removedExampleId = created.meanings[0].examples[0].id;

  await detail.locator("button").first().click();
  const editForm = page.locator("form.admin-topic-form");
  const retainedMeaning = editForm.locator(":scope > fieldset").first();
  const retainedExamples = retainedMeaning.getByRole("group", { name: "Ví dụ" });
  await retainedExamples.getByRole("button", { name: "Thêm ví dụ" }).click();
  await retainedExamples.locator(":scope > div").first().getByRole("button", { name: "Xóa ví dụ" }).click();
  await retainedExamples.locator(":scope > div").first().locator("textarea").first().fill("Replacement example.");
  await editForm.locator("button.admin-topic-primary-button").click();
  await expect(page.locator(".admin-topic-panel").filter({ has: page.getByRole("heading", { name: createdWord }) })).toBeVisible();

  const replaced = await prisma.vOCABULARY.findUniqueOrThrow({ where: { id: created.id }, include: { meanings: { include: { examples: true } } } });
  expect(replaced.meanings).toHaveLength(1);
  expect(replaced.meanings[0].id).toBe(retainedMeaningId);
  expect(replaced.meanings[0].examples).toHaveLength(1);
  expect(replaced.meanings[0].examples[0].id).not.toBe(removedExampleId);
  expect(replaced.meanings[0].examples[0].example_en).toBe("Replacement example.");

  await page.locator(".admin-topic-panel").filter({ has: page.getByRole("heading", { name: createdWord }) }).locator("button").last().click();
  const row = page.getByRole("row").filter({ hasText: createdWord });
  await row.locator("button").nth(2).click();
  const confirmation = page.locator("dialog[open]");
  await expect(confirmation).toBeVisible();
  await confirmation.locator("button").first().click();
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await row.locator("button").nth(2).click();
  await confirmation.locator("button").last().click();
  await expect(page.getByRole("row").filter({ hasText: createdWord })).toHaveCount(0);
  await expect(prisma.vOCABULARY.count({ where: { id: created.id } })).resolves.toBe(0);
});

test("Vocabulary form remains keyboard reachable and does not overflow on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await login(page, admin);
  await page.goto("/admin/vocabulary");
  const createButton = page.locator(".admin-topic-page-header > button");
  await createButton.focus();
  await expect(createButton).toBeFocused();
  await page.keyboard.press("Enter");
  const wordInput = page.locator("form.admin-topic-form").locator("input").first();
  await expect(wordInput).toBeVisible();
  await wordInput.focus();
  await expect(wordInput).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
