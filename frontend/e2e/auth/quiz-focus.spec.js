import { expect, test } from "@playwright/test";
import { installQuizApiMock } from "./fixtures/quiz-api.js";

test("keyboard selection and submission focus accepted feedback", async ({ page }) => {
  await installQuizApiMock(page); await page.goto("/quiz/vocabulary-sets/set-flow");
  const first = page.getByRole("radio").first(); await first.focus(); await page.keyboard.press("Space");
  await page.getByRole("button", { name: "Kiểm tra đáp án" }).press("Enter");
  await expect(page.getByRole("heading", { name: "Chính xác" })).toBeFocused();
  await expect(page.getByRole("status")).toHaveAttribute("aria-live", "polite");
  await expect(page.getByRole("status")).toHaveAttribute("aria-atomic", "true");
  await expect(page.getByRole("status")).toHaveText("Chính xác.");
  await expect(page.getByRole("alert").filter({ hasText: "Bạn vừa nhận +3 XP!" })).toHaveCount(1);
});

test("pointer submission announces result without stealing focus", async ({ page }) => {
  await installQuizApiMock(page); await page.goto("/quiz/vocabulary-sets/set-flow");
  await page.getByRole("radio").nth(1).check(); await page.getByRole("button", { name: "Kiểm tra đáp án" }).click();
  await expect(page.getByRole("heading", { name: "Chưa chính xác" })).not.toBeFocused();
  await expect(page.locator('[data-answer-state="incorrect-selected"]')).toHaveCount(1);
  await expect(page.locator('[data-answer-state="correct"]')).toHaveCount(1);
  await expect(page.getByTestId("quiz-feedback")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(page.getByText("Đáp án đúng", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Đáp án sai", { exact: true })).toHaveCount(0);
});

test("disabled submit uses non-interactive cursor and selection enables it", async ({ page }) => {
  await installQuizApiMock(page); await page.goto("/quiz/vocabulary-sets/set-flow");
  const submit = page.getByRole("button", { name: "Kiểm tra đáp án" });
  await expect(submit).toBeDisabled(); await expect(submit).toHaveCSS("cursor", "not-allowed");
  await page.getByRole("radio").first().check(); await expect(submit).toBeEnabled(); await expect(submit).toHaveCSS("cursor", "pointer");
});
