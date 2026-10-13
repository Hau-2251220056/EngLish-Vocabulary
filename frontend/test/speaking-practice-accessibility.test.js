import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = source("src/pronunciation/speaking-practice-page.jsx");
const shell = source("src/auth/ui/authenticated-shell.jsx");

test("long target content and compact states cannot force horizontal page overflow", () => {
  assert.match(page, /speaking-practice-page[^"]*min-w-0[^"]*overflow-x-clip/);
  assert.match(page, /min-h-\[25rem\][^"]*min-w-0/);
  assert.match(page, /speaking-practice-title[^\n]*\[overflow-wrap:anywhere\]/);
  assert.match(page, /\[overflow-wrap:anywhere\][^\n]*snapshot\.target\.phonetic/);
  assert.match(page, /p-\[clamp\(1\.25rem,5vw,2rem\)\]/);
  assert.match(shell, /speaking-practice-focus-shell !overflow-y-auto/);
});

test("target, terminal feedback and completion expose deliberate focus destinations", () => {
  assert.match(page, /focusStateRef = useRef\(\{ initialized: false, setId: null, targetId: null, completed: false, generation: null, phase: null \}\)/);
  assert.match(page, /if \(!targetId && !completed\) return/);
  assert.match(page, /if \(!previous\.initialized\) return/);
  assert.match(page, /completed && !previous\.completed[\s\S]*completionHeadingRef\.current\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(page, /previous\.completed \|\| setId !== previous\.setId \|\| targetId !== previous\.targetId[\s\S]*targetHeadingRef\.current\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(page, /enteredTerminal[\s\S]*terminalFocusIntent && focusIsAvailable[\s\S]*feedbackHeadingRef\.current\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(page, /ref=\{completionHeadingRef\} tabIndex=\{-1\}/);
  assert.match(page, /ref=\{targetHeadingRef\} tabIndex=\{-1\}/);
  assert.match(page, /ref=\{headingRef\} tabIndex=\{-1\} id="speaking-feedback-title"/);
});

test("dynamic status and errors use concise atomic live regions", () => {
  assert.match(page, /terminalFocusPending = TERMINAL_PHASES\.has\(phase\) && terminalFocusIntent/);
  assert.match(page, /presentation\.announcement \? <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">\{presentation\.announcement\}<\/p>/);
  assert.match(page, /showFeedback \? <FeedbackPanel announce=\{!terminalFocusPending\}/);
  assert.match(page, /className="sr-only" role=\{presentation\.liveRegion\} aria-live=\{presentation\.liveRegion === "status" \? "polite" : undefined\} aria-atomic="true"/);
  assert.match(page, /aria-labelledby="speaking-feedback-title"/);
  assert.match(page, /role=\{presentation\.liveRegion \?\? "alert"\} aria-atomic="true"/);
  assert.doesNotMatch(page, /aria-live[^\n]*presentation\.transcript/);
});

test("focused browser coverage asserts actual active elements", () => {
  const browser = source("e2e/auth/speaking-practice-focus.spec.js");
  assert.match(browser, /toBeFocused\(\)/);
  assert.match(browser, /initial authorized load preserves user-owned focus/);
  assert.match(browser, /keyboard Retry restores target focus/);
  assert.match(browser, /terminal updates do not steal focus/);
});

test("native controls preserve keyboard, disabled and reduced-motion behavior", () => {
  assert.match(page, /NAVIGATION_BUTTON_CLASSES = "[^"]*focus-visible:ring-2[^"]*disabled:cursor-not-allowed[^"]*motion-reduce:transform-none/);
  assert.match(page, /disabled=\{!snapshot\.controls\.canChangeTarget \|\| snapshot\.targetIndex === 0\}/);
  assert.match(page, /disabled=\{!snapshot\.controls\.canListen\}/);
  assert.match(page, /disabled=\{!snapshot\.controls\.canSpeak\}/);
  assert.match(page, /<details[\s\S]*<summary[^>]*focus-visible:ring-2/);
  assert.match(page, /aria-hidden="true" data-testid="listening-waveform"/);
  assert.match(page, /animate-\[pulse_[^\]]+\][\s\S]*motion-reduce:animate-none/);
  assert.match(page, /aria-label=\{presentation\.actions\.listen\.label\}/);
  assert.match(page, /aria-label=\{presentation\.actions\.speak\.label\}/);
  assert.match(page, /aria-label=\{presentation\.actions\.stop\.label\}/);
});

test("progress and navigation expose accessible names without color-only meaning", () => {
  assert.match(page, /role="progressbar" aria-label="Tiến độ luyện nói" aria-valuemin=\{0\} aria-valuemax=\{totalTargets\} aria-valuenow=\{currentPosition\}/);
  assert.match(page, /<nav[^>]*aria-label="Điều hướng luyện nói"/);
  assert.match(page, /<ChevronLeft aria-hidden="true" \/><span>\{presentation\.actions\.previous\.label\}/);
  assert.match(page, /<SkipForward aria-hidden="true" \/><span>\{presentation\.actions\.skip\.label\}/);
  assert.match(page, /<ChevronRight aria-hidden="true" \/><span>\{presentation\.actions\.next\.label\}/);
});

test("accessibility hardening does not add media, persistence or scoring behavior", () => {
  assert.doesNotMatch(page, /AudioContext|new Audio\(|SpeechRecognition|recordMeaningfulEvent|\/api\/learning\/events|confidence|pronunciation score|dangerouslySetInnerHTML/);
});

function source(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}
