import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const learning = await readFile(new URL("../src/learning/learning-foundation-page.jsx", import.meta.url), "utf8");
const globalReview = await readFile(new URL("../src/learning/global-review-page.jsx", import.meta.url), "utf8");
const speaking = await readFile(new URL("../src/pronunciation/speaking-practice-page.jsx", import.meta.url), "utf8");
const speakingPresentation = await readFile(new URL("../src/pronunciation/speaking-practice-presentation.js", import.meta.url), "utf8");

test("Learning startup and mode transitions use the shared loading language", () => {
  assert.match(learning, /import \{ LoadingIndicator \} from "\.\.\/components\/loading-indicator\.jsx"/);
  assert.match(learning, /mode === "SRS" \? "Đang chuẩn bị phiên ôn tập" : "Đang chuẩn bị phiên học"/);
  assert.match(learning, /<LoadingIndicator label=\{content\[1\]\} variant="centered" \/>/);
  assert.match(learning, /<LoadingIndicator label=\{pendingMode \? "Đang chuyển chế độ…" : "Đang chuẩn bị phiên học…"\} \/>/);
  assert.match(learning, /<SrsRatingControls/);
  assert.match(learning, /pendingRating=\{pendingRating\}/);
});

test("Global Review restores focus only for keyboard retry and card transitions", () => {
  assert.match(globalReview, /retryRequestedRef\.current = event\?\.detail === 0/);
  assert.match(globalReview, /loadingFocusRef\.current\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(globalReview, /retryButtonRef\.current\?\.focus\(\)/);
  assert.match(globalReview, /else if \(status === "ready"\) cardButtonRef\.current\?\.focus\(\)/);
  assert.match(globalReview, /cardTransitionVersion > 0 && status === "ready"/);
  assert.doesNotMatch(globalReview, /setStatus\(result\.session\.state === "COMPLETED" \? "complete" : "ready"\);\s*queueMicrotask/);
});

test("Speaking startup and cancellation use distinct shared loading messages", () => {
  assert.match(speaking, /<PageState loading presentation=\{presentation\} \/>/);
  assert.match(speaking, /loading \? <div className="mt-5"><LoadingIndicator label=\{presentation\.description\} variant="centered" \/><\/div>/);
  assert.match(speakingPresentation, /LOADING\]: copy\("Đang chuẩn bị luyện nói", "Đang tải nội dung luyện nói\."/);
  assert.match(speakingPresentation, /CANCELLING\]: copy\("Đang dừng hoạt động", "Đang dừng micro và âm thanh\."/);
});
