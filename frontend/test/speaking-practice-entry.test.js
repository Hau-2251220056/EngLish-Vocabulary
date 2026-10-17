import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("public and owned-private Set Detail reuse the USER learning actions boundary", async () => {
  const [publicPage, privatePage] = await Promise.all([
    source("../src/vocabulary-sets/public-vocabulary-set-pages.jsx"),
    source("../src/vocabulary-sets/my-vocabulary-set-detail-page.jsx"),
  ]);

  assert.match(
    publicPage,
    /user\?\.role === "USER"[\s\S]*<SetLearningActions compactMobile enabled=\{items\.length > 0\} returnTo=\{`\/vocabulary-sets\/\$\{set\.id\}`\} setId=\{set\.id\} setName=\{set\.name\}/,
  );
  assert.match(
    privatePage,
    /<SetLearningActions compactMobile enabled=\{items\.length > 0\} returnTo=\{detailPath\} setId=\{setId\} setName=\{detail\.name\}/,
  );
  assert.match(publicPage, /Flashcard, Quiz và Luyện nói/);
  assert.match(privatePage, /Flashcard, Quiz và Luyện nói/);
});

test("third activity preserves existing cards and exact Speaking Practice identity navigation", async () => {
  const actions = await source("../src/vocabulary-sets/set-detail-primitives.jsx");

  assert.match(actions, /title="Thẻ ghi nhớ"[\s\S]*to=\{`\/learn\/vocabulary-sets\/\$\{setId\}`\}/);
  assert.match(actions, /title="Quiz"[\s\S]*to=\{`\/quiz\/vocabulary-sets\/\$\{setId\}`\}/);
  assert.match(
    actions,
    /icon=\{Mic\} title="Luyện nói" description="Nghe từ mẫu và luyện nói\." mobileClasses=\{mobileCard\} to=\{`\/pronunciation\/vocabulary-sets\/\$\{setId\}`\} state=\{\{ returnTo \}\}/,
  );
  assert.match(actions, /enabled \? <Link[\s\S]*aria-disabled="true"/);
  assert.doesNotMatch(actions, /3B5BDB/i);
});

test("activity grid is responsive, keyboard-focusable and uses the approved Speaking accent", async () => {
  const actions = await source("../src/vocabulary-sets/set-detail-primitives.jsx");

  assert.match(actions, /grid-cols-\[repeat\(3,minmax\(10\.5rem,13rem\)\)\]/);
  assert.match(actions, /max-\[800px\]:grid-cols-2/);
  assert.match(actions, /max-\[480px\]:grid-cols-1/);
  assert.match(actions, /max-\[480px\]:grid-cols-2/);
  assert.match(actions, /rounded-2xl border-2 bg-white/);
  assert.match(actions, /first:border-\[#93BFF0\]/);
  assert.match(actions, /\[&:nth-child\(2\)\]:border-\[#BCA8EA\]/);
  assert.match(actions, /grid-rows-\[2\.75rem_auto_minmax\(2\.25rem,auto\)_auto\]/);
  assert.match(actions, /max-\[480px\]:grid-rows-\[2\.5rem_auto_0_auto\]/);
  assert.match(actions, /max-\[480px\]:min-h-\[6\.75rem\]/);
  assert.match(actions, /set-detail-learning-icon row-start-1/);
  assert.match(actions, /<h3 className="row-start-2/);
  assert.match(actions, /<p className="row-start-3/);
  assert.match(actions, /<small className="row-start-4/);
  assert.match(actions, /focus-visible:ring-2 focus-visible:ring-\[var\(--accent-primary-focus\)\]/);
  assert.match(actions, /\[&:nth-child\(3\)\]:border-\[#5DDCCB\]/);
  assert.match(actions, /\[&:nth-child\(3\)_\.set-detail-learning-icon\]:bg-\[#F0FDFA\]/);
  assert.match(actions, /\[&:nth-child\(3\)_\.set-detail-learning-icon\]:text-\[#0D9488\]/);
  assert.match(actions, /motion-reduce:transform-none motion-reduce:transition-none/);
});

test("Speaking Practice route remains inside the protected USER Focus Mode branch", async () => {
  const [router, shell] = await Promise.all([
    source("../src/app-router.jsx"),
    source("../src/auth/ui/authenticated-shell.jsx"),
  ]);
  const userStart = router.indexOf('<Route element={<UserRoute />}>');
  const speakingRoute = router.indexOf('path="/pronunciation/vocabulary-sets/:setId"', userStart);
  const adminStart = router.indexOf('<Route element={<AdminRoute />}>', userStart);

  assert.ok(userStart >= 0);
  assert.ok(speakingRoute > userStart);
  assert.ok(speakingRoute < adminStart);
  assert.match(shell, /location\.pathname\.startsWith\("\/pronunciation\/vocabulary-sets\/"\)/);
  assert.match(shell, /isFocusLearning[\s\S]*<Outlet \/>/);
});
