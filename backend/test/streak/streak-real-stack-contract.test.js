import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const specUrl = new URL(
  "../../../frontend/e2e/integration/streak-real-stack.spec.js",
  import.meta.url,
);
const approvedCleanupCalls = Object.freeze([
  ["lEARNING_SESSION", "{where:{user_id:user.id}}"],
  ["sTREAK_DAY", "{where:{user_id:user.id}}"],
  ["xP_REWARD", "{where:{user_id:user.id}}"],
  ["lEARNING_PROGRESS", "{where:{user_id:user.id}}"],
  ["aUTH_SESSION", "{where:{user_id:user.id}}"],
  ["vOCABULARY_SET", "{where:{owner_id:user.id}}"],
  ["vOCABULARY", "{where:{word:{startsWith:prefix}}}"],
]);

test("TASK-249 real-stack scenario retains its scoped budget and semantic assertions", async () => {
  const source = await readFile(specUrl, "utf8");
  const scenario = extractBlock(
    source,
    'test("NORMAL, SRS and zero-correct Quiz qualify once while Speaking remains non-qualifying"',
    "async function createVocabulary",
  );

  const timeout = Number(scenario.match(/test\.setTimeout\(([\d_]+)\)/)?.[1].replaceAll("_", ""));
  assert.ok(timeout > 60_000);
  assert.match(
    scenario,
    /getByTestId\("quiz-feedback"\)\.getByRole\("status"\)[\s\S]*?toHaveText\("Chưa chính xác\. Đáp án đúng đã được đánh dấu\."\)/,
  );
  assert.doesNotMatch(scenario, /getByText\("Chính xác"\)\.locator\("\.\."\)/);
  assert.match(
    scenario,
    /locator\("dt"\)\.filter\(\{ hasText: \/\^Chính xác\$\/ \}\)\.locator\("xpath=following-sibling::dd\[1\]"\)[\s\S]*?toHaveText\("0"\)/,
  );
  assert.match(
    scenario,
    /locator\("dt"\)\.filter\(\{ hasText: \/\^Chưa chính xác\$\/ \}\)\.locator\("xpath=following-sibling::dd\[1\]"\)[\s\S]*?toHaveText\("4"\)/,
  );
  for (const assertion of [
    "Hoàn thành bộ từ",
    "Chuỗi hiện tại 1 ngày",
    "Hoàn thành ôn tập",
    "Hoàn thành Quiz",
    "Chuỗi học tập",
    "/pronunciation/vocabulary-sets/",
  ]) assert.match(scenario, new RegExp(assertion));
});

test("TASK-249 fixture cleanup waits on owned sessions before deleting owned Streak days", async () => {
  const source = await readFile(specUrl, "utf8");
  const cleanup = extractBlock(source, "test.afterAll(async () => {", "test(\"");

  const sessionDelete = cleanup.indexOf("prisma.lEARNING_SESSION.deleteMany");
  const streakDelete = cleanup.indexOf("prisma.sTREAK_DAY.deleteMany");
  const userDelete = cleanup.indexOf("prisma.uSER.delete");
  assert.ok(sessionDelete >= 0 && streakDelete > sessionDelete && userDelete > streakDelete);
  assertApprovedCleanupCalls(cleanup);
  assert.match(cleanup, /expect\(await controlledFixtureCount\(\)\)\.toBe\(0\)/);
  assert.doesNotMatch(cleanup, /CASCADE|TRUNCATE|DROP\s+SCHEMA|database\.reset/i);
});

const unsafeCleanupCases = [
  ["omitted arguments", "prisma.sTREAK_DAY.deleteMany()"],
  ["empty arguments object", "prisma.sTREAK_DAY.deleteMany({})"],
  ["empty where object", "prisma.sTREAK_DAY.deleteMany({ where: {} })"],
  ["additional unscoped deletion", "prisma.uSER.deleteMany({})"],
  ["unknown model", "prisma.uNRELATED.deleteMany({ where: { user_id: user.id } })"],
  ["missing user ownership", "prisma.sTREAK_DAY.deleteMany({ where: { id: user.id } })"],
  ["missing prefix ownership", "prisma.vOCABULARY.deleteMany({ where: { word: {} } })"],
  ["duplicate broader deletion", "prisma.sTREAK_DAY.deleteMany({ where: { user_id: { not: null } } })"],
];

for (const [label, unsafeCall] of unsafeCleanupCases) {
  test(`TASK-249 fixture cleanup rejects ${label}`, () => {
    assert.throws(() => assertApprovedCleanupCalls(`${approvedCleanupSource()}\n${unsafeCall};`));
  });
}

function assertApprovedCleanupCalls(source) {
  assert.deepEqual(enumerateDeleteManyCalls(source), approvedCleanupCalls);
}

function enumerateDeleteManyCalls(source) {
  const calls = [];
  const pattern = /prisma\.([A-Za-z_$][\w$]*)\.deleteMany\s*\(/g;
  for (const match of source.matchAll(pattern)) {
    const open = match.index + match[0].lastIndexOf("(");
    const close = findClosingParenthesis(source, open);
    calls.push([match[1], source.slice(open + 1, close).replaceAll(/\s/g, "")]);
    pattern.lastIndex = close + 1;
  }
  return calls;
}

function findClosingParenthesis(source, open) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = open; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'" || character === "`") quote = character;
    else if (character === "(") depth += 1;
    else if (character === ")" && --depth === 0) return index;
  }
  assert.fail("deleteMany call has no closing parenthesis");
}

function approvedCleanupSource() {
  return approvedCleanupCalls
    .map(([model, argument]) => `prisma.${model}.deleteMany(${argument});`)
    .join("\n");
}

function extractBlock(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0 && end > start);
  return source.slice(start, end);
}
