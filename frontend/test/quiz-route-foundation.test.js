import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Quiz route is nested inside existing ProtectedRoute, shell and USER guard", async () => {
  const source = await readFile(new URL("../src/app-router.jsx", import.meta.url), "utf8");
  const protectedStart = source.indexOf('<Route element={<ProtectedRoute />}>');
  const shellStart = source.indexOf('<Route element={<AuthenticatedShell />}>', protectedStart);
  const userStart = source.indexOf('<Route element={<UserRoute />}>', shellStart);
  const quizRoute = source.indexOf('path="/quiz/vocabulary-sets/:setId"', userStart);
  const adminStart = source.indexOf('<Route element={<AdminRoute />}>', userStart);

  assert.ok(protectedStart >= 0);
  assert.ok(shellStart > protectedStart);
  assert.ok(userStart > shellStart);
  assert.ok(quizRoute > userStart);
  assert.ok(quizRoute < adminStart);
  assert.match(source, /<QuizSessionStorageObserver \/>/);
});

test("Set entry actions expose Quiz only for non-empty accessible Sets", async () => {
  const publicSource = await readFile(
    new URL("../src/vocabulary-sets/public-vocabulary-set-pages.jsx", import.meta.url),
    "utf8",
  );
  const ownedSource = await readFile(
    new URL("../src/vocabulary-sets/my-vocabulary-sets-page.jsx", import.meta.url),
    "utf8",
  );

  assert.match(publicSource, /items\.length > 0[\s\S]*\/quiz\/vocabulary-sets\/\$\{set\.id\}/);
  assert.match(ownedSource, /items\.length > 0[\s\S]*\/quiz\/vocabulary-sets\/\$\{detail\.id\}/);
  assert.equal(publicSource.includes("/api/learning/events"), false);
  assert.equal(ownedSource.includes("/api/learning/events"), false);
});
