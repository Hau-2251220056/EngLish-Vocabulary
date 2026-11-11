import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../src/learning/review-center-page.jsx", import.meta.url), "utf8");

test("Review Center prioritizes Set review without a visible large page heading or global action", () => {
  assert.match(source, /<h1 className="sr-only">Ôn tập từ vựng<\/h1>/);
  assert.doesNotMatch(source, /Ôn tất cả/);
  assert.doesNotMatch(source, /to="\/review\/global"/);
  assert.match(source, /Cần ôn hôm nay/);
  assert.match(source, /Ôn theo bộ từ/);
  assert.match(source, /to=\{`\/review\/sets\/\$\{set\.set_id\}`\}/);
  assert.match(source, /\{set\.name\}/);
  assert.match(source, /\{set\.due_count\} từ đến hạn/);
  assert.match(source, /Bộ từ công khai/);
  assert.match(source, /Bộ từ cá nhân/);
  assert.match(source, /set\.set_scope === "PUBLIC"/);
});

test("Review Center uses one authoritative summary and never discovers or creates review data", () => {
  assert.match(source, /learningService\.getReviewCenterSummary\(\)/);
  assert.match(source, /summary\.due_count/);
  assert.match(source, /summary\.sets\.filter\(\(\{ due_count: dueCount \}\) => dueCount > 0\)/);
  assert.doesNotMatch(source, /reduce\(|listMySets|listPublicSystemSets|loadDiscoveryCatalog/);
  assert.doesNotMatch(source, /createGlobalReviewSession|review\/sessions|recordMeaningfulEvent/);
  assert.doesNotMatch(source, /Bộ từ của bạn|publicCandidates/);
  assert.doesNotMatch(source, /Mỗi từ chỉ được tính một lần/);
  assert.doesNotMatch(source, /Phiên SRS theo bộ có thể thêm từ mới/);
  assert.doesNotMatch(source, /tổng của từng bộ không nhất thiết bằng số tổng quan/);
  assert.doesNotMatch(source, /indigo-/);
  assert.match(source, /bg-\[var\(--accent-primary-soft\)\]/);
  assert.match(source, /text-\[var\(--accent-primary-pressed\)\]/);
});

test("Review Center has truthful loading, recoverable error and zero-due states", () => {
  assert.match(source, /Đang tải dữ liệu ôn tập…/);
  assert.match(source, /Không thể tải dữ liệu ôn tập/);
  assert.match(source, /Thử lại/);
  assert.match(source, /Bạn đã ôn xong các từ đến hạn!/);
  assert.match(source, /to="\/topics"/);
  assert.match(source, /state\.status === "loading"/);
  assert.match(source, /state\.status === "error"/);
  assert.match(source, /summary\.has_due_items/);
});

test("Review Center keeps accessible interaction and responsive conventions", () => {
  assert.match(source, /aria-label="Trung tâm ôn tập"/);
  assert.match(source, /<LoadingIndicator focusRef=\{focusRef\} label="Đang tải dữ liệu ôn tập…" variant="centered" \/>/);
  assert.match(source, /role="alert"/);
  assert.match(source, /min-h-11/);
  assert.match(source, /focus-visible:ring-2/);
  assert.match(source, /motion-reduce:transform-none/);
  assert.match(source, /sm:max-w-\[17rem\]/);
  assert.match(source, /md:grid-cols-2/);
  assert.match(source, /\[overflow-wrap:anywhere\]/);
});

test("Review Center restores focus only after keyboard-initiated retry", () => {
  assert.match(source, /retryRequestedRef\.current = event\.detail === 0/);
  assert.match(source, /loadingFocusRef\.current\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(source, /retryButtonRef\.current\?\.focus\(\)/);
  assert.match(source, /successFocusRef\.current\?\.focus\(\)/);
  assert.match(source, /tabIndex=\{-1\}/);
  assert.match(source, /focusTargetRef/);
});
