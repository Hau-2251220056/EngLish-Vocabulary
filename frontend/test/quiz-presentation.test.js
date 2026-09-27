import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { QuizApiError } from "../src/services/quiz-service.js";
import { availableUnscrambleTiles, buildUnscrambleAnswer, classifyQuizLoadError, classifyQuizSubmissionError, createSharedQuizQuestionLoader, describeCharacterFeedback, isUnscrambleAnswerComplete, presentCharacterFeedback, quizAnswerHasContent, removeUnscrambleTile, selectUnscrambleTile, unscrambleAnswerSlots, visibleCharacterFeedbackValue } from "../src/quiz/quiz-presentation.js";

test("StrictMode-style duplicate loads share one in-flight question request", async () => {
  let calls = 0;
  let resolveRequest;
  const loader = createSharedQuizQuestionLoader(() => {
    calls += 1;
    return new Promise((resolve) => { resolveRequest = resolve; });
  });
  const first = loader("user:set:type:run:0");
  const strictModeReplay = loader("user:set:type:run:0");
  assert.equal(first, strictModeReplay);
  assert.equal(calls, 0);
  await Promise.resolve();
  assert.equal(calls, 1);
  resolveRequest({ questions: [] });
  await first;
  await Promise.resolve();
  const nextRun = loader("user:set:type:run:0");
  await Promise.resolve();
  assert.equal(calls, 2);
  resolveRequest({ questions: [] });
  await nextRun;
});

test("Quiz presentation classifies safe load and answer states", () => {
  assert.equal(classifyQuizLoadError(apiError("QUIZ_SET_EMPTY", "conflict", 409)), "empty");
  assert.equal(classifyQuizLoadError(apiError("QUIZ_SET_NOT_FOUND", "not-found", 404)), "not-found");
  assert.equal(classifyQuizLoadError(new Error("network")), "error");
  assert.deepEqual(classifyQuizSubmissionError(apiError("QUIZ_QUESTION_CHANGED", "conflict", 409)), { kind: "question-changed", code: "QUIZ_QUESTION_CHANGED", conclusive: true });
  assert.deepEqual(classifyQuizSubmissionError(apiError("QUIZ_PROGRESS_CONFLICT", "conflict", 409)), { kind: "progress-conflict", code: "QUIZ_PROGRESS_CONFLICT", conclusive: true });
  assert.deepEqual(classifyQuizSubmissionError(new Error("network")), { kind: "operational", code: "QUIZ_REQUEST_FAILED", conclusive: false });
});

test("answer validation and Unicode feedback descriptions remain presentation-only", () => {
  assert.equal(quizAnswerHasContent("  từ  "), true);
  assert.equal(quizAnswerHasContent("\u2003\n"), false);
  assert.equal(describeCharacterFeedback({ position: 0, submitted: "a", expected: "a", state: "correct" }).shortLabel, "Đúng");
  assert.equal(describeCharacterFeedback({ position: 1, submitted: null, expected: "é", state: "missing" }).shortLabel, "Thiếu");
  assert.equal(describeCharacterFeedback({ position: 2, submitted: "x", expected: null, state: "extra" }).shortLabel, "Thừa");
  assert.match(describeCharacterFeedback({ position: 3, submitted: "x", expected: "y", state: "incorrect" }).accessibleLabel, /đáp án là y/);
  for (const item of [
    { position: 0, submitted: "a", expected: "a", state: "correct" },
    { position: 1, submitted: "x", expected: "y", state: "incorrect" },
    { position: 2, submitted: null, expected: "z", state: "missing" },
    { position: 3, submitted: "z", expected: null, state: "extra" },
  ]) assert.match(describeCharacterFeedback(item).accessibleLabel, /^Ký tự \d+:/);
});

test("visible character feedback never presents a missing canonical character as submitted input", () => {
  assert.equal(visibleCharacterFeedbackValue({ submitted: "b", expected: "b", state: "correct" }), "b");
  assert.equal(visibleCharacterFeedbackValue({ submitted: "a", expected: "o", state: "incorrect" }), "a");
  assert.equal(visibleCharacterFeedbackValue({ submitted: "s", expected: null, state: "extra" }), "s");
  assert.equal(visibleCharacterFeedbackValue({ submitted: null, expected: "k", state: "missing" }), "_");
  assert.match(describeCharacterFeedback({ position: 3, submitted: null, expected: "k", state: "missing" }).accessibleLabel, /thiếu k/);
});

test("accepted spaces for canonical hyphens retain the submitted value and accessible equivalence", () => {
  const item = {
    position: 6,
    submitted: " ",
    expected: "-",
    state: "correct",
  };
  assert.equal(visibleCharacterFeedbackValue(item), " ");
  assert.match(describeCharacterFeedback(item).accessibleLabel, /dấu cách được chấp nhận thay cho dấu gạch nối/);
});

test("book versus bok renders the submitted k once and a separate missing placeholder", () => {
  const presentation = presentCharacterFeedback([
    { position: 0, submitted: "b", expected: "b", state: "correct" },
    { position: 1, submitted: "o", expected: "o", state: "correct" },
    { position: 2, submitted: "k", expected: "o", state: "incorrect" },
    { position: 3, submitted: null, expected: "k", state: "missing" },
  ]);
  assert.deepEqual(presentation.map(({ visibleValue }) => visibleValue), ["b", "o", "k", "_"]);
  assert.equal(presentation.filter(({ visibleValue }) => visibleValue === "k").length, 1);
  assert.match(presentation[3].accessibleLabel, /thiếu k/);
  assert.equal(presentation[3].state, "missing");
});

test("Unscramble tiles preserve identity, fixed separators, and authoritative pool order", () => {
  const prompt = {
    shuffle_mode: "SHUFFLED",
    tiles: [
      { tile_id: "tile-b", character: "b" },
      { tile_id: "tile-o-2", character: "o" },
      { tile_id: "tile-k", character: "k" },
      { tile_id: "tile-o-1", character: "o" },
      { tile_id: "tile-c", character: "c" },
      { tile_id: "tile-a", character: "a" },
      { tile_id: "tile-s", character: "s" },
      { tile_id: "tile-e", character: "e" },
    ],
    slots: [
      { kind: "tile" }, { kind: "tile" }, { kind: "tile" }, { kind: "tile" },
      { kind: "separator", value: "-" },
      { kind: "tile" }, { kind: "tile" }, { kind: "tile" }, { kind: "tile" },
    ],
  };
  let selected = [];
  for (const tileId of ["tile-b", "tile-o-1", "tile-o-2", "tile-k", "tile-c", "tile-a", "tile-s", "tile-e"]) {
    selected = selectUnscrambleTile(prompt, selected, tileId);
  }
  assert.equal(buildUnscrambleAnswer(prompt, selected), "book-case");
  assert.equal(isUnscrambleAnswerComplete(prompt, selected), true);
  assert.deepEqual(unscrambleAnswerSlots(prompt, selected)[4], { kind: "separator", value: "-", position: 4 });

  selected = removeUnscrambleTile(selected, "tile-o-1");
  assert.equal(isUnscrambleAnswerComplete(prompt, selected), false);
  assert.deepEqual(availableUnscrambleTiles(prompt, selected), [{ tile_id: "tile-o-1", character: "o" }]);
  assert.equal(selected.includes("tile-o-2"), true);
});

test("IDENTITY_FALLBACK uses the same complete tile-selection interaction", () => {
  const prompt = {
    shuffle_mode: "IDENTITY_FALLBACK",
    tiles: [{ tile_id: "only", character: "a" }],
    slots: [{ kind: "tile" }],
  };
  const selected = selectUnscrambleTile(prompt, [], "only");
  assert.equal(buildUnscrambleAnswer(prompt, selected), "a");
  assert.equal(isUnscrambleAnswerComplete(prompt, selected), true);
});

test("production Quiz page contains both prompts, protected flow and approved completion", async () => {
  const source = await readFile(new URL("../src/quiz/quiz-foundation-page.jsx", import.meta.url), "utf8");
  for (const text of ["VI_TO_ENGLISH", "UNSCRAMBLE_WORD", "Đang kiểm tra…", "Thử gửi lại", "Câu tiếp theo", "Xem kết quả", "Tổng số câu", "Chính xác", "Chưa chính xác"]) assert.ok(source.includes(text), text);
  assert.match(source, /quizService\.submitAnswer\(attempt\)/);
  assert.match(source, /run\.pending_attempt/);
  assert.match(source, /quiz-unscramble-pool/);
  assert.match(source, /Bỏ ký tự/);
  assert.match(source, /aria-label=\{item\.accessibleLabel\}/);
  assert.equal(source.includes("<small>{text.shortLabel}</small>"), false);
  assert.equal(source.includes("draggable"), false);
  assert.match(source, /pending_attempt\?\.answer/);
  assert.equal(source.includes("/api/learning/events"), false);
  assert.equal(source.includes("pronunciation"), false);
  assert.equal(source.includes("MISSING_LETTER"), false);
});

test("Quiz CSS provides responsive touch targets and reduced motion", async () => {
  const css = await readFile(new URL("../src/quiz/quiz-page.css", import.meta.url), "utf8");
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /@media \(max-width:\s*640px\)/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /width:\s*min\(100%,\s*860px\)/);
  assert.match(css, /quiz-feedback-underline/);
  assert.match(css, /border-bottom:\s*4px solid currentColor/);
  assert.match(css, /li\.is-missing \.quiz-feedback-character/);
  assert.match(css, /flex-wrap:\s*wrap/);
});

function apiError(code, kind, status) {
  return new QuizApiError({ code, kind, status, message: "Safe." });
}
