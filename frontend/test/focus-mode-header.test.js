import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = async (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Quiz, Flashcard and Speaking reuse one bright focus-mode header contract", async () => {
  const [header, quiz, flashcard, speaking] = await Promise.all([
    source("src/components/focus-mode-header.jsx"),
    source("src/quiz/quiz-foundation-page.jsx"),
    source("src/learning/flashcard-presentation.jsx"),
    source("src/pronunciation/speaking-practice-page.jsx"),
  ]);
  assert.match(header, /focus-mode-header[^"]*border-b border-slate-200 bg-white\/95/);
  assert.match(header, /min-h-14/);
  assert.match(header, /maxWidthClassName = "max-w-\[72rem\]"/);
  assert.match(header, /focus-mode-header-inner mx-auto w-full/);
  assert.match(header, /backLabel[\s\S]*titleBadge[\s\S]*actions/);
  assert.match(header, /items-center gap-3/);
  assert.match(header, /focus-mode-title-badge[^"\n]*shrink-0[^"\n]*text-xs font-extrabold/);
  assert.doesNotMatch(header, /purple|indigo/);
  assert.doesNotMatch(quiz, /contextLabel="Quiz · Anh → Việt"/);
  assert.doesNotMatch(quiz, />Anh → Việt<\/span>/);
  assert.match(quiz, />Quiz · Trắc nghiệm<\/p>/);
  assert.match(quiz, /titleBadge="Quiz"/);
  assert.match(quiz, /aria-label="Học lại từ đầu"[\s\S]*<RotateCcw/);
  assert.match(flashcard, /<FocusModeHeader[\s\S]*className="learning-toolbar"/);
  assert.match(speaking, /<FocusModeHeader[\s\S]*titleBadge="Luyện nói"/);
});

test("Quiz and Flashcard restart controls use bare icon buttons without changing semantics", async () => {
  const [quiz, flashcard] = await Promise.all([
    source("src/quiz/quiz-foundation-page.jsx"),
    source("src/learning/flashcard-presentation.jsx"),
  ]);
  for (const component of [quiz, flashcard]) {
    assert.match(component, /<button[^>]*border-0 bg-transparent[^>]*shadow-none[^>]*>/);
    assert.match(component, /aria-label=(?:"Học lại từ đầu"|\{restartLabel\})/);
    assert.match(component, /focus-visible:ring-2/);
    assert.match(component, /role="tooltip"/);
  }
});

test("Flashcard headers keep compact mode-specific controls and a stable pending layout", async () => {
  const [learning, styles] = await Promise.all([
    source("src/learning/learning-foundation-page.jsx"),
    source("src/index.css"),
  ]);
  assert.match(learning, /className="learning-key-hints/);
  assert.match(learning, /className="learning-mode-selector/);
  assert.match(learning, /<LearningKeyHint keys="Space" label="Lật thẻ"/);
  assert.match(learning, /mode === "NORMAL" \? <LearningKeyHint keys="← →" label="Chuyển thẻ"/);
  assert.match(learning, /\['SRS', 'SRS', 'Ôn tập SRS'\], \['NORMAL', 'Thường', 'Ôn tập thường'\]/);
  assert.match(learning, /badge=\{reviewContext \? "Ôn tập" : pathPassStatus === "managed" \? "Lượt học CEFR" : null\}/);
  assert.match(learning, /className="sr-only"[^>]*ref=\{normalPendingStatusRef\}[^>]*>Đang ghi nhận bằng chứng học tập…<\/p>/);
  assert.match(learning, /mode === "SRS" \? <SrsRatingControls/);
  assert.match(styles, /@media \(max-width: 768px\)[\s\S]*\.learning-toolbar \.learning-key-hints \{ display: none; \}/);
  assert.match(styles, /@media \(min-width: 769px\) and \(hover: none\) and \(pointer: coarse\)/);
});

test("Speaking exposes only Previous and Next while forward navigation stays result-neutral", async () => {
  const [page, session] = await Promise.all([
    source("src/pronunciation/speaking-practice-page.jsx"),
    source("src/pronunciation/speaking-practice-page-session.js"),
  ]);
  assert.match(page, /previousTarget\(\)[\s\S]*nextTarget\(\)/);
  assert.doesNotMatch(page, /skipTarget\(\)|SkipForward|SKIP_BUTTON_CLASSES/);
  assert.match(session, /function nextTarget\(\) \{[\s\S]*moveToTarget\(1, \{ completeAtEnd: true \}\)/);
});
