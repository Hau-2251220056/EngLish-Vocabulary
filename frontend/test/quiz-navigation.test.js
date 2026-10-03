import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { resolveQuizSetDetailPath } from "../src/quiz/quiz-navigation.js";

const setId = "set-1";

for (const quizType of ["VI_TO_ENGLISH", "UNSCRAMBLE_WORD"]) {
  test(`${quizType} Back returns to the owned Set Detail route`, () => {
    assert.equal(
      resolveQuizSetDetailPath(setId, { returnTo: `/my/vocabulary-sets/${setId}` }),
      `/my/vocabulary-sets/${setId}`,
    );
  });
}

test("public Quiz Back returns to the public Set Detail route", () => {
  assert.equal(
    resolveQuizSetDetailPath(setId, { returnTo: `/vocabulary-sets/${setId}` }),
    `/vocabulary-sets/${setId}`,
  );
});

test("direct and unrelated return targets fall back to the current public Set Detail", () => {
  assert.equal(resolveQuizSetDetailPath(setId, undefined), `/vocabulary-sets/${setId}`);
  assert.equal(resolveQuizSetDetailPath(setId, { returnTo: "/dashboard" }), `/vocabulary-sets/${setId}`);
  assert.equal(resolveQuizSetDetailPath(setId, { returnTo: "/my/vocabulary-sets" }), `/vocabulary-sets/${setId}`);
});

test("Quiz Back controls use neutral copy and never submit or mutate Progress", async () => {
  const source = await readFile(new URL("../src/quiz/quiz-foundation-page.jsx", import.meta.url), "utf8");
  assert.match(source, /function QuizTopBar[\s\S]*?<span>\{setName\}<\/span>/);
  assert.match(source, /navigate\(returnTo, \{ replace: true \}\)/);
  const topBar = source.slice(source.indexOf("function QuizTopBar"), source.indexOf("function Progress"));
  assert.equal(topBar.includes("submitAnswer"), false);
  assert.equal(topBar.includes("/api/learning/events"), false);
});
