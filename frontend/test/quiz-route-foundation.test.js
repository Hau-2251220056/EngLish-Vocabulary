import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Quiz route keeps auth guards and reuses the shell Focus Mode branch", async () => {
  const source = await readFile(new URL("../src/app-router.jsx", import.meta.url), "utf8");
  const shellSource = await readFile(new URL("../src/auth/ui/authenticated-shell.jsx", import.meta.url), "utf8");
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
  assert.match(shellSource, /"\/quiz\/vocabulary-sets\/"/);
  assert.match(shellSource, /return <div className="learning-focus-shell"><Outlet \/><\/div>/);
});

test("Set entry actions expose Quiz only for non-empty accessible Sets", async () => {
  const publicSource = await readFile(
    new URL("../src/vocabulary-sets/public-vocabulary-set-pages.jsx", import.meta.url),
    "utf8",
  );
  const ownedDetailSource = await readFile(
    new URL("../src/vocabulary-sets/my-vocabulary-set-detail-page.jsx", import.meta.url),
    "utf8",
  );
  const learningActionsSource = await readFile(
    new URL("../src/vocabulary-sets/set-detail-primitives.jsx", import.meta.url),
    "utf8",
  );

  assert.match(
    publicSource,
    /user\?\.role === "USER"[\s\S]*<SetLearningActions enabled=\{items\.length > 0\} returnTo=\{`\/vocabulary-sets\/\$\{set\.id\}`\} setId=\{set\.id\} setName=\{set\.name\}/,
  );
  assert.match(
    ownedDetailSource,
    /<SetLearningActions enabled=\{items\.length > 0\} returnTo=\{detailPath\} setId=\{setId\} setName=\{detail\.name\}/,
  );
  assert.match(learningActionsSource, /to=\{`\/quiz\/vocabulary-sets\/\$\{setId\}`\} state=\{\{ returnTo, setName \}\}/);
  assert.match(learningActionsSource, /enabled \? <Link[\s\S]*aria-disabled="true"/);
  assert.equal(publicSource.includes("/api/learning/events"), false);
  assert.equal(ownedDetailSource.includes("/api/learning/events"), false);
});
