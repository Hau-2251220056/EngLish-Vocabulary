import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { QuizApiError } from "../src/services/quiz-service.js";
import { classifyQuizLoadError, classifyQuizSubmissionError, createSharedQuizQuestionLoader, readQuizSessionWithRecovery } from "../src/quiz/quiz-presentation.js";

test("Quiz presentation classifies choice and conflict errors", () => {
  assert.equal(classifyQuizLoadError(new QuizApiError({ code: "QUIZ_CHOICES_UNAVAILABLE", kind: "conflict", status: 409, message: "x" })), "stale");
  assert.equal(classifyQuizLoadError(new QuizApiError({ code: "QUIZ_ITEM_CHANGED", kind: "conflict", status: 409, message: "x" })), "stale");
  assert.equal(classifyQuizSubmissionError(new QuizApiError({ code: "QUIZ_CHOICE_CHANGED", kind: "conflict", status: 409, message: "x" })).kind, "question-changed");
});
test("stale question reads reconcile once without posting or looping", async () => {
  let reads = 0;
  const recovered = await readQuizSessionWithRecovery(async () => {
    reads += 1;
    if (reads === 1) throw new QuizApiError({ code: "QUIZ_ITEM_CHANGED", kind: "conflict", status: 409, message: "x" });
    return "recovered";
  }, { run_id: "run" });
  assert.equal(recovered, "recovered");
  assert.equal(reads, 2);

  reads = 0;
  await assert.rejects(() => readQuizSessionWithRecovery(async () => {
    reads += 1;
    throw new QuizApiError({ code: "QUIZ_CHOICES_UNAVAILABLE", kind: "conflict", status: 409, message: "x" });
  }, { run_id: "run" }), { code: "QUIZ_CHOICES_UNAVAILABLE" });
  assert.equal(reads, 2);
});
test("duplicate loads share one request", async () => {
  let count = 0; const load = createSharedQuizQuestionLoader(async () => { count += 1; return "ok"; });
  assert.deepEqual(await Promise.all([load("same"), load("same")]), ["ok", "ok"]); assert.equal(count, 1);
});
test("production page contains compact vertical Multiple Choice presentation and no legacy controls", async () => {
  const source = await readFile(new URL("../src/quiz/quiz-foundation-page.jsx", import.meta.url), "utf8");
  assert.match(source, /const TYPE = "MULTIPLE_CHOICE"/);
  assert.match(source, /type="radio"/);
  assert.match(source, /max-w-\[720px\]/); assert.match(source, /max-w-\[680px\]/);
  assert.match(source, /data-testid="quiz-choice-list"/); assert.match(source, /data-testid="quiz-feedback-list"/);
  assert.match(source, /flex-col gap-2\.5/); assert.match(source, /data-answer-state/);
  assert.match(source, /cursor-pointer/); assert.match(source, /disabled:cursor-not-allowed/); assert.match(source, /focus-visible/); assert.match(source, /min-h-12/); assert.match(source, /overflow-x-clip/);
  assert.doesNotMatch(source, /grid-cols-\[repeat\(auto-fit/);
  assert.doesNotMatch(source, /<small[^>]*>Đáp án đúng|<small[^>]*>Đáp án sai/);
  assert.doesNotMatch(source, /TypeSelection|UnscrambleAnswerForm|CharacterFeedback|VI_TO_ENGLISH|UNSCRAMBLE_WORD/);
  assert.match(source, /Học tiếp \{summary\.next_batch_size\} từ/);
  assert.match(source, /Làm lại nhóm này/);
  assert.match(source, /Học lại từ đầu/);
  assert.match(source, /submitLockRef/);
  assert.match(source, /readQuizSessionWithRecovery/);
  assert.match(source, /browserSessionStorage/);
});

test("Quiz feedback uses transient positive non-replay XP and keeps persistence whitelisted", async () => {
  const page = await readFile(new URL("../src/quiz/quiz-foundation-page.jsx", import.meta.url), "utf8");
  const state = await readFile(new URL("../src/quiz/quiz-run-state.js", import.meta.url), "utf8");
  assert.match(page, /formatNewXpFeedback\(result\.reward\)/);
  assert.match(page, /data-testid="quiz-xp-feedback"/);
  assert.match(state, /\{ question_revision: attempt\.question_revision,[\s\S]*is_correct: result\.is_correct, progress_revision: result\.progress\.revision \}/);
  assert.doesNotMatch(state, /accepted[^;]*reward/);
});
