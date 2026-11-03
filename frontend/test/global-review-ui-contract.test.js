import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("USER route and Dashboard review source remain independently guarded", async () => {
  const router = await readFile(new URL("../src/app-router.jsx", import.meta.url), "utf8");
  const dashboard = await readFile(new URL("../src/dashboard/dashboard-page.jsx", import.meta.url), "utf8");
  assert.match(router, /<Route path="\/review" element=\{<GlobalReviewPage \/>\} \/>/);
  assert.match(router, /<Route element=\{<UserRoute \/>\}>[\s\S]*path="\/review"/);
  assert.match(dashboard, /useDashboardSource\(isUser, loadReviewSummary, "review"\)/);
  assert.match(dashboard, /Các khu vực khác vẫn dùng được/);
});

test("review UI exposes explicit continuation only after fixed-snapshot completion", async () => {
  const source = await readFile(new URL("../src/learning/global-review-page.jsx", import.meta.url), "utf8");
  assert.match(source, /const canContinue = status === "complete"/);
  assert.match(source, /Ôn tiếp/);
  assert.match(source, /role="group" aria-label="Đánh giá SRS"/);
  assert.match(source, /motion-reduce:animate-none/);
  assert.match(source, /setRequestToken\(\(value\) => value \+ 1\)/);
});
