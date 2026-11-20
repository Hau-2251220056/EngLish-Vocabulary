import assert from "node:assert/strict";
import test from "node:test";
import { resolveQuizSetDetailPath } from "../src/quiz/quiz-navigation.js";

test("Quiz returns only to exact public or owned Set detail", () => {
  assert.equal(resolveQuizSetDetailPath("set", { returnTo: "/vocabulary-sets/set" }), "/vocabulary-sets/set");
  assert.equal(resolveQuizSetDetailPath("set", { returnTo: "/my/vocabulary-sets/set" }), "/my/vocabulary-sets/set");
  assert.equal(resolveQuizSetDetailPath("set", { returnTo: "/dashboard" }), "/vocabulary-sets/set");
});
