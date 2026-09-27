import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createActiveQuizNavigationState, QUIZ_PARENT, resolveQuizBackNavigation } from "../src/quiz/quiz-navigation.js";

const selectionPath = "/quiz/vocabulary-sets/set-1";
const returnTo = "/my/vocabulary-sets/set-1";
const selectionState = { returnTo, setName: "Set 1" };

for (const quizType of ["VI_TO_ENGLISH", "UNSCRAMBLE_WORD"]) {
  test(`${quizType} active Back returns through Quiz Type Selection`, () => {
    const activeState = createActiveQuizNavigationState(selectionState);
    assert.equal(activeState.quizParent, QUIZ_PARENT.TYPE_SELECTION);
    assert.deepEqual(resolveQuizBackNavigation({ stage: "active", state: activeState, selectionPath, returnTo }), {
      kind: "history",
      delta: -1,
    });
  });
}

test("Quiz Type Selection Back returns through the Vocabulary Set history entry", () => {
  assert.deepEqual(resolveQuizBackNavigation({ stage: "selection", state: selectionState, selectionPath, returnTo }), {
    kind: "history",
    delta: -1,
  });
});

test("direct-link fallbacks replace rather than create Back-navigation loops", () => {
  assert.deepEqual(resolveQuizBackNavigation({ stage: "active", state: undefined, selectionPath, returnTo }), {
    kind: "replace",
    to: selectionPath,
    state: { quizParent: undefined },
  });
  assert.deepEqual(resolveQuizBackNavigation({ stage: "selection", state: undefined, selectionPath, returnTo }), {
    kind: "replace",
    to: returnTo,
    state: undefined,
  });
});

test("Quiz Back controls use neutral copy and never submit or mutate Progress", async () => {
  const source = await readFile(new URL("../src/quiz/quiz-foundation-page.jsx", import.meta.url), "utf8");
  assert.match(source, /function BackControl[\s\S]*?<span>Quay lại<\/span>/);
  assert.equal(source.includes("Quay lại bộ từ"), false);
  assert.match(source, /setParams\(\{ type: selected \}, \{ state: createActiveQuizNavigationState/);
  const backControl = source.slice(source.indexOf("function BackControl"), source.indexOf("function Progress"));
  assert.equal(backControl.includes("submitAnswer"), false);
  assert.equal(backControl.includes("/api/learning/events"), false);
});
