import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("USER route and Dashboard review source remain independently guarded", async () => {
  const router = await readFile(new URL("../src/app-router.jsx", import.meta.url), "utf8");
  const dashboard = await readFile(new URL("../src/dashboard/dashboard-page.jsx", import.meta.url), "utf8");
  assert.match(router, /<Route path="\/review" element=\{<ReviewCenterPage \/>\} \/>/);
  assert.match(router, /<Route path="\/review\/global" element=\{<GlobalReviewPage \/>\} \/>/);
  assert.match(router, /<Route path="\/review\/sets\/:setId" element=\{<SetReviewPage \/>\} \/>/);
  assert.match(router, /<Route element=\{<UserRoute \/>\}>[\s\S]*path="\/review"/);
  assert.match(dashboard, /useDashboardSource\(isUser, loadReviewSummary, "review"\)/);
  assert.match(dashboard, /Các khu vực khác vẫn dùng được/);
});

test("Review Center consumes only the authoritative due summary without creating a session", async () => {
  const source = await readFile(new URL("../src/learning/review-center-page.jsx", import.meta.url), "utf8");
  assert.match(source, /learningService\.getReviewCenterSummary\(\)/);
  assert.doesNotMatch(source, /to="\/review\/global"/);
  assert.match(source, /to=\{`\/review\/sets\/\$\{set\.set_id\}`\}/);
  assert.match(source, /summary\.due_count/);
  assert.doesNotMatch(source, /createGlobalReviewSession|review\/sessions|listMySets|loadDiscoveryCatalog/);
});

test("dedicated Set review context forces SRS without changing standard learning", async () => {
  const source = await readFile(new URL("../src/learning/learning-foundation-page.jsx", import.meta.url), "utf8");
  assert.match(source, /export function SetReviewPage\(\)/);
  assert.match(source, /<LearningFoundationPage reviewContext \/>/);
  assert.match(source, /reviewContext\s*\? "SRS"/);
  assert.match(source, /reviewContext \? "\/review"/);
  assert.match(source, /if \(reviewContext && nextMode !== "SRS"\) return/);
  assert.match(source, /const presentationStatus = mode === "SRS" && srsSessionStatus === "loading"[\s\S]*\? "loading"[\s\S]*: status/);
  assert.match(source, /<LearningPageState status=\{presentationStatus\}/);
  assert.match(source, /!reviewContext \? <div[\s\S]*aria-label="Chế độ ôn tập"/);
  assert.match(source, /badge=\{reviewContext \? "Ôn tập" : null\}/);
  assert.doesNotMatch(source, /badge=\{mode === "SRS"/);
});

test("review UI exposes explicit continuation only after fixed-snapshot completion", async () => {
  const source = await readFile(new URL("../src/learning/global-review-page.jsx", import.meta.url), "utf8");
  const presentation = await readFile(new URL("../src/learning/flashcard-presentation.jsx", import.meta.url), "utf8");
  assert.match(source, /const canContinue = status === "complete"/);
  assert.match(source, /Ôn tiếp/);
  assert.match(source, /<SrsRatingControls/);
  assert.match(presentation, /aria-label="Đánh giá SRS"/);
  assert.match(presentation, /motion-reduce:animate-none/);
  assert.match(source, /setRequestToken\(\(value\) => value \+ 1\)/);
  assert.match(source, /interactionRef=\{cardButtonRef\}/);
  assert.match(source, /cardButtonRef\.current\?\.focus\(\)/);
  assert.match(source, /setCardTransitionVersion\(\(value\) => value \+ 1\)/);
  assert.match(source, /\[cardTransitionVersion, currentId, status\]/);
  assert.doesNotMatch(source, /<h1[^>]+tabIndex=\{-1\}/);
});

test("shared Flashcard presentation remains controller-free", async () => {
  const source = await readFile(new URL("../src/learning/flashcard-presentation.jsx", import.meta.url), "utf8");
  const globalPage = await readFile(new URL("../src/learning/global-review-page.jsx", import.meta.url), "utf8");
  const setPage = await readFile(new URL("../src/learning/learning-foundation-page.jsx", import.meta.url), "utf8");
  assert.match(source, /export function FlashcardToolbar/);
  assert.match(source, /export function FlashcardProgress/);
  assert.match(source, /export function FlashcardCard/);
  assert.match(source, /export function SrsRatingControls/);
  assert.doesNotMatch(source, /learningService|learningSessionService|sessionStorage|localStorage|fetch\(/);
  for (const consumer of [globalPage, setPage]) {
    assert.match(consumer, /<FlashcardToolbar/);
    assert.match(consumer, /<FlashcardProgress/);
    assert.match(consumer, /<FlashcardCard/);
    assert.match(consumer, /<SrsRatingControls/);
  }
});
