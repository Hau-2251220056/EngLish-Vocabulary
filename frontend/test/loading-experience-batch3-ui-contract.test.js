import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readSource = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [myDetail, publicDetail, skeleton, router, topicDetail, shell, mySets] = await Promise.all([
  readSource("../src/vocabulary-sets/my-vocabulary-set-detail-page.jsx"),
  readSource("../src/vocabulary-sets/public-vocabulary-set-pages.jsx"),
  readSource("../src/vocabulary-sets/set-detail-loading-skeleton.jsx"),
  readSource("../src/app-router.jsx"),
  readSource("../src/topics/topic-detail-page.jsx"),
  readSource("../src/auth/ui/authenticated-shell.jsx"),
  readSource("../src/vocabulary-sets/my-vocabulary-sets-page.jsx"),
]);

test("Set detail pages share a content-shaped reduced-motion loading skeleton", () => {
  assert.match(myDetail, /<SetDetailLoadingSkeleton focusRef=\{loadingFocusRef\} \/>/);
  assert.match(publicDetail, /<SetDetailLoadingSkeleton focusRef=\{loadingFocusRef\} \/>/);
  assert.match(skeleton, /<LoadingIndicator focusRef=\{focusRef\} label="Đang tải bộ từ…" variant="centered" \/>/);
  assert.match(skeleton, /aria-hidden="true"/);
  assert.match(skeleton, /motion-reduce:animate-none/);
});

test("Set detail retry focus moves through loading, success, and repeated failure", () => {
  for (const source of [myDetail, publicDetail]) {
    assert.match(source, /retryRequestedRef\.current = event\.detail === 0/);
    assert.match(source, /loadingFocusRef\.current\?\.focus\(\)/);
    assert.match(source, /retryButtonRef\.current\?\.focus\(\)/);
    assert.match(source, /detailHeadingRef\.current\?\.focus\(\)/);
  }
});

test("Lazy routes and Topic Detail use the compact shared loading language", () => {
  assert.match(router, /<LoadingIndicator label="Đang tải trang…" variant="centered" \/>/);
  assert.match(router, /className="grid min-h-40 place-items-center/);
  assert.doesNotMatch(router, /<main className="grid min-h-\[40vh\]/);
  assert.match(topicDetail, /<LoadingIndicator label="Đang tải chủ đề…" variant="centered" \/>/);
});

test("Logout and My Sets loading respect motion and keyboard retry focus", () => {
  assert.equal(shell.match(/animate-spin motion-reduce:animate-none/g)?.length, 2);
  assert.match(mySets, /listRetryRequestedRef\.current = event\.detail === 0/);
  assert.match(mySets, /listLoadingFocusRef\.current\?\.focus\(\)/);
  assert.match(mySets, /listRetryButtonRef\.current\?\.focus\(\)/);
  assert.match(mySets, /listHeadingRef\.current\?\.focus\(\)/);
});
