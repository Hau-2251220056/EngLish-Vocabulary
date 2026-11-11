import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { PrismaClient } from "../../../backend/src/generated/prisma/client.ts";
import { configureTestEnvironment } from "../../../backend/test/helpers/test-environment.js";
import { hashPassword } from "../../../backend/src/utils/password-security.js";

configureTestEnvironment({ requireReset: true });
const prisma = new PrismaClient();
const run = randomUUID();
const password = `Safe-${randomUUID()}`;
const domain = `${run}.cefr-path.integration.test`;
const created = { users: [], vocabularies: [], sets: [], topics: [] };
const sentinel = {};
let learner, outsider, administrator, systemTopic, one, ten, eleven, a2, b1, reassigned;
let elevenPass, remainingBatch, remainingVocabulary;

test.describe.configure({ mode: "serial" });
test.beforeAll(async () => {
  await prisma.$connect();
  const password_hash = await hashPassword(password);
  learner = await user("learner", "USER", password_hash);
  outsider = await user("outsider", "USER", password_hash);
  administrator = await user("admin", "ADMIN", password_hash);
  systemTopic = await prisma.tOPIC.create({ data: { name: `${run} CEFR system topic` } });
  created.topics.push(systemTopic.id);
  one = await systemSet("01 one", "A1", 1);
  ten = await systemSet("02 ten", "A1", 10);
  eleven = await systemSet("03 eleven", "A1", 11);
  a2 = await systemSet("04 a2", "A2", 1);
  b1 = await systemSet("05 b1", "B1", 1);
  reassigned = await systemSet("06 reassigned", "A2", 1);
  await createSentinel(password_hash);
});
test.afterAll(async () => {
  try { await cleanup(); await assertAndCleanupSentinel(); } finally { await prisma.$disconnect(); }
});

test("first USER receives A1 recommendation and Guest/ADMIN remain role-correct", async ({ page }) => {
  await page.goto("/dashboard"); await expect(page).toHaveURL(/\/login$/);
  await login(page, administrator);
  await expect(page.getByRole("region", { name: "Lộ trình CEFR" })).toHaveCount(0);
  await page.request.post("/api/auth/logout");
  await login(page, learner);
  const path = page.getByRole("region", { name: "Lộ trình CEFR" });
  const a1Level = path.getByRole("list", { name: "Các cấp độ CEFR" })
    .getByRole("listitem").filter({ hasText: /^A1/ });
  await expect(a1Level).toContainText("đã mở");
  const suggestion = page.getByRole("region", { name: "Gợi ý tiếp theo" });
  await expect(suggestion).toContainText(one.name);
  await expect(suggestion.getByText("A1", { exact: true })).toBeVisible();
  await expect(suggestion.getByRole("link", { name: "Bắt đầu học" }))
    .toHaveAttribute("href", `/learn/vocabulary-sets/${one.id}`);
});

test("one-item A1 Set requires completed bounded evidence and explicit pass completion", async ({ page }) => {
  await login(page, learner);
  const concurrent = await Promise.all([
    startPass(page, one.id), startPass(page, one.id),
  ]);
  expect(new Set(concurrent.map(({ pass }) => pass.id)).size).toBe(1);
  const started = concurrent[0];
  const batch = await nextBatch(page, started.pass.id);
  await revealBatch(page, batch.session);
  const revealedOnly = await api(page, "get", `/api/learning-path/passes/${started.pass.id}`);
  expect(revealedOnly).toMatchObject({
    state: "ACTIVE", snapshot_size: 1, studied_items: 0, remaining_items: 1,
    can_continue: true,
  });
  await completeSession(page, batch.session.id);
  const ready = await api(page, "get", `/api/learning-path/passes/${started.pass.id}`);
  expect(ready).toMatchObject({
    state: "ACTIVE", snapshot_size: 1, studied_items: 1, remaining_items: 0,
    can_continue: true,
  });
  await api(page, "post", `/api/learning-path/passes/${started.pass.id}/complete`, { operation_id: randomUUID() });
});

test("ten-item A1 Set completes through authoritative bounded-session evidence", async ({ page }) => {
  test.setTimeout(120_000);

  await login(page, learner);
  await completeSet(page, ten.id);
});

test("eleven-item A1 Set preserves the final item after its first bounded batch", async ({ page }) => {
  await login(page, learner);
  elevenPass = await startPass(page, eleven.id);
  const first = await nextBatch(page, elevenPass.pass.id);
  expect(first.session.items).toHaveLength(10);
  await revealBatch(page, first.session); await completeSession(page, first.session.id);
  const resumable = await api(page, "get", `/api/learning-path/passes/${elevenPass.pass.id}`);
  expect(resumable).toMatchObject({
    state: "ACTIVE", snapshot_size: 11, studied_items: 10, remaining_items: 1,
    can_continue: true,
  });
  remainingBatch = await nextBatch(page, elevenPass.pass.id);
  expect(remainingBatch.session.items).toHaveLength(1);
  remainingVocabulary = await prisma.vOCABULARY.findUniqueOrThrow({
    where: { id: remainingBatch.session.items[0].vocabulary_id }, select: { word: true },
  });
});

test("eleven-item A1 Set resumes after reload, completes its final item, and unlocks A2", async ({ page }) => {
  await login(page, learner);
  await page.goto("/dashboard");
  const featured = page.getByRole("list", { name: "Bộ từ nổi bật" });
  const currentSet = featured.getByRole("listitem").filter({ hasText: eleven.name });
  await expect(currentSet).toContainText("A1");
  await currentSet.getByRole("link", { name: `Xem ${eleven.name}` }).click();
  await expect(page).toHaveURL(new RegExp(`/vocabulary-sets/${eleven.id}$`));
  await expect(page.getByRole("heading", { level: 1, name: eleven.name })).toBeVisible();
  await page.getByRole("link", { name: /Thẻ ghi nhớ/ }).click();
  await expect(page).toHaveURL(new RegExp(`/learn/vocabulary-sets/${eleven.id}$`));
  await page.getByRole("button", { name: "Ôn tập thường" }).click();
  await expect(page.getByRole("button", { name: "Ôn tập thường" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", { name: remainingVocabulary.word })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: `${eleven.name} — Ôn tập thường` })).toBeAttached();
  await expect(page.getByRole("heading", { name: remainingVocabulary.word })).toBeVisible();
  await expect(page.getByText("Thẻ 1 / 1")).toBeVisible();
  expect(await api(page, "get", `/api/learning-path/passes/${elevenPass.pass.id}`)).toMatchObject({
    state: "ACTIVE", studied_items: 10, remaining_items: 1, can_continue: true,
  });
  await finishPass(page, elevenPass.pass.id);
  const projection = await api(page, "get", "/api/learning-path");
  expect(projection.highest_unlocked_level).toBe("A2");
});

test("foreign USER cannot read or mutate another USER's pass or bounded session", async ({ page }) => {
  await login(page, learner);
  const pass = await startPass(page, a2.id);
  const batch = await nextBatch(page, pass.pass.id);
  const before = await mutationCounts(learner.id, pass.pass.id, batch.session.id);
  const exactBefore = await learningState(learner.id, pass.pass.id, batch.session.id);

  await page.request.post("/api/auth/logout");
  await login(page, outsider);
  for (const request of [
    () => requestError(page, "get", `/api/learning-path/passes/${pass.pass.id}`, undefined, 404, "CEFR_PASS_NOT_FOUND"),
    () => requestError(page, "post", `/api/learning-path/passes/${pass.pass.id}/sessions`, { operation_id: randomUUID() }, 404, "CEFR_PASS_NOT_FOUND"),
    () => requestError(page, "post", `/api/learning-path/passes/${pass.pass.id}/restart`, { operation_id: randomUUID() }, 404, "CEFR_PASS_NOT_FOUND"),
    () => requestError(page, "post", `/api/learning-path/passes/${pass.pass.id}/complete`, { operation_id: randomUUID() }, 404, "CEFR_PASS_NOT_FOUND"),
    () => requestError(page, "get", `/api/learning-sessions/${batch.session.id}`, undefined, 404, "LEARNING_SESSION_NOT_FOUND"),
    () => requestError(page, "put", `/api/learning-sessions/${batch.session.id}/items/${batch.session.items[0].vocabulary_id}/reveal`, { operation_id: randomUUID() }, 404, "LEARNING_SESSION_NOT_FOUND"),
    () => requestError(page, "post", `/api/learning-sessions/${batch.session.id}/complete`, { operation_id: randomUUID() }, 404, "LEARNING_SESSION_NOT_FOUND"),
  ]) await request();

  expect(await mutationCounts(learner.id, pass.pass.id, batch.session.id)).toEqual(before);
  expect(await learningState(learner.id, pass.pass.id, batch.session.id)).toEqual(exactBefore);
});

test("completed Set identity follows reassignment and survives removal from current counts", async ({ page }) => {
  await login(page, learner);
  const completion = await completeSet(page, reassigned.id);
  const before = await api(page, "get", "/api/learning-path");
  const beforeA2 = level(before, "A2"), beforeB1 = level(before, "B1");

  await prisma.vOCABULARY_SET.update({ where: { id: reassigned.id }, data: { cefr_level: "B1" } });
  const moved = await api(page, "get", "/api/learning-path");
  expect(level(moved, "A2").completed_count).toBe(beforeA2.completed_count - 1);
  expect(level(moved, "B1").required_count).toBe(beforeB1.required_count + 1);
  expect(level(moved, "B1").completed_count).toBe(beforeB1.completed_count + 1);

  await prisma.vOCABULARY_SET.delete({ where: { id: reassigned.id } });
  const removed = await api(page, "get", "/api/learning-path");
  expect(level(removed, "B1").required_count).toBe(beforeB1.required_count);
  expect(level(removed, "B1").completed_count).toBe(beforeB1.completed_count);
  expect(removed.highest_unlocked_level).toBe(moved.highest_unlocked_level);
  const history = await prisma.cEFR_LEARNING_PASS.findUniqueOrThrow({ where: { id: completion.pass.id } });
  expect(history.set_id_snapshot).toBe(reassigned.id);
  expect(history.vocabulary_set_id).toBeNull();
});

test("locked B1 blocks Learning, Quiz and Speaking while snapshot mutation requires restart", async ({ page }) => {
  await login(page, learner);
  const lockedItem = await prisma.vOCABULARY_SET_ITEM.findFirstOrThrow({ where: { vocabulary_set_id: b1.id } });
  const before = await mutationCounts(learner.id);
  await requestError(page, "get", `/api/learning/sets/${b1.id}?mode=NORMAL`, undefined, 403, "CEFR_LEVEL_LOCKED");
  await requestError(page, "get", `/api/learning/sets/${b1.id}?mode=SRS`, undefined, 403, "CEFR_LEVEL_LOCKED");
  for (const mode of ["NORMAL", "SRS", "QUIZ"]) {
    await requestError(page, "post", "/api/learning-sessions", {
      operation_id: randomUUID(), set_id: b1.id, mode,
      ...(mode === "SRS" ? {} : { vocabulary_ids: [lockedItem.vocabulary_id] }),
    }, 403, "CEFR_LEVEL_LOCKED");
  }
  const quizRun = randomUUID();
  await requestError(page, "get", `/api/quiz/sets/${b1.id}/questions?type=MULTIPLE_CHOICE&run_id=${quizRun}`, undefined, 403, "CEFR_LEVEL_LOCKED");
  await requestError(page, "post", "/api/quiz/answers", {
    event_id: randomUUID(), set_id: b1.id, vocabulary_id: lockedItem.vocabulary_id,
    run_id: quizRun, question_revision: "A".repeat(43), quiz_type: "MULTIPLE_CHOICE",
    expected_revision: 0, selected_choice_id: "B".repeat(43),
  }, 403, "CEFR_LEVEL_LOCKED");
  expect(await mutationCounts(learner.id)).toEqual(before);
  for (const route of [
    `/learn/vocabulary-sets/${b1.id}`, `/quiz/vocabulary-sets/${b1.id}`,
    `/pronunciation/vocabulary-sets/${b1.id}`,
  ]) {
    await page.goto(route);
    await expect(page.getByRole("alert")).toBeVisible();
  }
  const pass = await startPass(page, a2.id);
  const removed = await prisma.vOCABULARY_SET_ITEM.findFirstOrThrow({ where: { vocabulary_set_id: a2.id } });
  await prisma.vOCABULARY_SET_ITEM.delete({ where: { id: removed.id } });
  const replacement = await prisma.vOCABULARY.create({ data: { word: `${run}-replacement` } });
  created.vocabularies.push(replacement.id);
  await prisma.vOCABULARY_SET_ITEM.create({ data: { vocabulary_set_id: a2.id, vocabulary_id: replacement.id, position: 1 } });
  const changed = await api(page, "get", `/api/learning-path/passes/${pass.pass.id}`);
  expect(changed.restart_reason).toBe("SNAPSHOT_CHANGED");
  await expect(page.goto(`/learn/vocabulary-sets/${a2.id}`)).resolves.toBeTruthy();
  await expect(page.getByRole("button", { name: "Bắt đầu lại" })).toBeVisible();
});

test("owned private copy remains usable but earns no CEFR pass or path credit", async ({ page }) => {
  await login(page, learner);
  const pathBefore = await api(page, "get", "/api/learning-path");
  const copy = await api(page, "post", `/api/vocabulary-sets/${one.id}/copy`);
  created.sets.push(copy.id);
  const stored = await prisma.vOCABULARY_SET.findUniqueOrThrow({ where: { id: copy.id }, include: { items: true } });
  expect(stored.owner_id).toBe(learner.id); expect(stored.is_public).toBe(false);

  await api(page, "get", `/api/learning/sets/${copy.id}?mode=NORMAL`);
  await api(page, "get", `/api/learning/sets/${copy.id}?mode=SRS`);
  await api(page, "get", `/api/quiz/sets/${copy.id}/questions?type=MULTIPLE_CHOICE&run_id=${randomUUID()}`);
  const privateSession = await api(page, "post", "/api/learning-sessions", {
    operation_id: randomUUID(), set_id: copy.id, mode: "NORMAL",
    vocabulary_ids: stored.items.map(({ vocabulary_id }) => vocabulary_id),
  });
  await revealBatch(page, privateSession.session);
  await completeSession(page, privateSession.session.id);
  await requestError(page, "post", `/api/learning-path/sets/${copy.id}/passes`, { operation_id: randomUUID() }, 404, "CEFR_PASS_NOT_FOUND");

  const pathAfter = await api(page, "get", "/api/learning-path");
  expect(pathAfter.levels).toEqual(pathBefore.levels);
  expect(await prisma.cEFR_LEARNING_PASS.count({ where: { user_id: learner.id, set_id_snapshot: copy.id } })).toBe(0);
});

test("terminal entitlement survives a new current requirement and Dashboard sources fail independently", async ({ page }) => {
  await prisma.cEFR_LEARNING_PATH_STATE.upsert({
    where: { user_id: learner.id },
    create: { user_id: learner.id, highest_unlocked_level: "C1", path_completed_at: new Date() },
    update: { highest_unlocked_level: "C1", path_completed_at: new Date() },
  });
  await systemSet("99 later C1", "C1", 1);
  await login(page, learner);
  const path = await api(page, "get", "/api/learning-path");
  expect(path.highest_unlocked_level).toBe("C1"); expect(path.path_completed_at).toBeTruthy();
  expect(path.all_current_sets_complete).toBe(false);
  await page.route("**/api/learning/review", (route) => route.abort());
  await page.reload();
  await expect(page.getByRole("region", { name: "Lộ trình CEFR" })).toContainText("C1");
  await expect(page.getByRole("region", { name: "Từ cần ôn" }).getByRole("alert")).toBeVisible();
});

async function completeSet(page, setId) { const pass = await startPass(page, setId); return finishPass(page, pass.pass.id); }
async function finishPass(page, passId) {
  while (true) {
    const pass = await api(page, "get", `/api/learning-path/passes/${passId}`);
    expect(pass.state).toBe("ACTIVE");
    expect(pass.studied_items + pass.remaining_items).toBe(pass.snapshot_size);
    expect(pass.can_continue).toBe(true);
    if (pass.remaining_items === 0) {
      expect(pass.studied_items).toBe(pass.snapshot_size);
      break;
    }
    const batch = await nextBatch(page, passId); await revealBatch(page, batch.session); await completeSession(page, batch.session.id);
  }
  return api(page, "post", `/api/learning-path/passes/${passId}/complete`, { operation_id: randomUUID() });
}
function startPass(page, setId) { return api(page, "post", `/api/learning-path/sets/${setId}/passes`, { operation_id: randomUUID() }); }
function nextBatch(page, passId) { return api(page, "post", `/api/learning-path/passes/${passId}/sessions`, { operation_id: randomUUID() }); }
async function revealBatch(page, session) { for (const item of session.items) await api(page, "put", `/api/learning-sessions/${session.id}/items/${item.vocabulary_id}/reveal`, { operation_id: randomUUID() }); }
function completeSession(page, id) { return api(page, "post", `/api/learning-sessions/${id}/complete`, { operation_id: randomUUID() }); }
async function api(page, method, url, data) { const response = await page.request[method](url, data ? { data } : undefined); expect(response.ok(), `${method.toUpperCase()} ${url}`).toBe(true); return (await response.json()).data; }
async function requestError(page, method, url, data, status, code) {
  const response = await page.request[method](url, data ? { data } : undefined);
  expect(response.status(), `${method.toUpperCase()} ${url}`).toBe(status);
  expect((await response.json()).error.code).toBe(code);
}
async function login(page, record) { await page.goto("/login"); await page.locator("#login-email").fill(record.email); await page.locator("#login-password").fill(password); await page.locator('form button[type="submit"]').click(); await expect(page).toHaveURL(/\/dashboard$/); }
async function user(name, role, password_hash) { const row = await prisma.uSER.create({ data: { email: `${name}@${domain}`, display_name: `CEFR ${name}`, role, password_hash } }); created.users.push(row.id); return row; }
async function systemSet(name, cefr_level, count) {
  const words = [];
  for (let index = 0; index < count; index += 1) {
    const row = await prisma.vOCABULARY.create({ data: { word: `${run}-${name}-${index}`, meanings: { create: [{ part_of_speech: "noun", meaning_vi: `nghĩa ${index}`, cefr_level }] } } });
    created.vocabularies.push(row.id); words.push(row);
  }
  const row = await prisma.vOCABULARY_SET.create({ data: { topic_id: systemTopic.id, owner_id: administrator.id, name: `${run} ${name}`, is_public: true, cefr_level, items: { create: words.map(({ id }, index) => ({ vocabulary_id: id, position: index + 1 })) } } });
  created.sets.push(row.id); return row;
}
function level(path, value) { return path.levels.find(({ level: item }) => item === value); }
async function mutationCounts(userId, passId, sessionId) {
  const [passes, sessions, progress, rewards, streaks, evidence] = await Promise.all([
    prisma.cEFR_LEARNING_PASS.count({ where: { user_id: userId, ...(passId ? { id: passId } : {}) } }),
    prisma.lEARNING_SESSION.count({ where: { user_id: userId, ...(sessionId ? { id: sessionId } : {}) } }),
    prisma.lEARNING_PROGRESS.count({ where: { user_id: userId } }),
    prisma.xP_REWARD.count({ where: { user_id: userId } }),
    prisma.sTREAK_DAY.count({ where: { user_id: userId } }),
    prisma.lEARNING_SESSION_ITEM.count({ where: { session: { user_id: userId }, evidence: { not: null } } }),
  ]);
  return { passes, sessions, progress, rewards, streaks, evidence };
}
async function learningState(userId, passId, sessionId) {
  const [pass, session, path] = await Promise.all([
    prisma.cEFR_LEARNING_PASS.findUniqueOrThrow({ where: { id: passId }, select: {
      status: true, created_at: true, completed_at: true,
      completion_event_id: true, invalidated_at: true,
    } }),
    prisma.lEARNING_SESSION.findUniqueOrThrow({ where: { id: sessionId }, select: {
      status: true, created_at: true, expires_at: true, completed_at: true,
      completion_event_id: true,
      items: { orderBy: { position: "asc" }, select: {
        vocabulary_id: true, position: true, evidence: true,
        evidence_event_id: true, evidence_at: true,
      } },
    } }),
    prisma.cEFR_LEARNING_PATH_STATE.findUnique({ where: { user_id: userId }, select: {
      highest_unlocked_level: true, path_completed_at: true,
      created_at: true, updated_at: true,
    } }),
  ]);
  return { pass, session, path };
}
async function createSentinel(password_hash) {
  sentinel.user = await prisma.uSER.create({ data: { email: `sentinel@${domain}`, display_name: "Unrelated sentinel", role: "USER", password_hash } });
  sentinel.word = await prisma.vOCABULARY.create({ data: { word: `${run}-unrelated-sentinel` } });
  sentinel.set = await prisma.vOCABULARY_SET.create({ data: { owner_id: sentinel.user.id, name: `${run} sentinel`, is_public: false, items: { create: [{ vocabulary_id: sentinel.word.id, position: 1 }] } } });
  sentinel.progress = await prisma.lEARNING_PROGRESS.create({ data: { user_id: sentinel.user.id, vocabulary_id: sentinel.word.id, status: "LEARNING" } });
  sentinel.snapshot = await sentinelState();
}
async function assertAndCleanupSentinel() {
  expect(await sentinelState()).toEqual(sentinel.snapshot);
  await prisma.lEARNING_PROGRESS.delete({ where: { id: sentinel.progress.id } });
  await prisma.vOCABULARY_SET.delete({ where: { id: sentinel.set.id } });
  await prisma.vOCABULARY.delete({ where: { id: sentinel.word.id } });
  await prisma.uSER.delete({ where: { id: sentinel.user.id } });
}
async function sentinelState() {
  const [user, word, set, progress] = await Promise.all([
    prisma.uSER.findUnique({ where: { id: sentinel.user.id }, select: {
      id: true, email: true, display_name: true, avatar_url: true, role: true,
      is_active: true, total_xp: true, daily_xp_goal: true, created_at: true, updated_at: true,
    } }),
    prisma.vOCABULARY.findUnique({ where: { id: sentinel.word.id }, select: {
      id: true, owner_id: true, word: true, phonetic: true,
      pronunciation_url: true, created_at: true, updated_at: true,
    } }),
    prisma.vOCABULARY_SET.findUnique({ where: { id: sentinel.set.id }, select: {
      id: true, owner_id: true, name: true, description: true, cefr_level: true,
      is_public: true, created_at: true, updated_at: true,
      items: { orderBy: { position: "asc" }, select: { vocabulary_id: true, position: true } },
    } }),
    prisma.lEARNING_PROGRESS.findUnique({ where: { id: sentinel.progress.id }, select: {
      id: true, user_id: true, vocabulary_id: true, status: true, review_count: true,
      revision: true, last_reviewed_at: true, last_event_id: true, next_review_at: true,
      interval_days: true, ease_factor: true, created_at: true, updated_at: true,
    } }),
  ]);
  return { user, word, set, progress };
}
async function cleanup() {
  await prisma.sTREAK_DAY.deleteMany({ where: { user_id: { in: created.users } } });
  await prisma.lEARNING_SESSION.deleteMany({ where: { user_id: { in: created.users } } });
  await prisma.xP_REWARD.deleteMany({ where: { user_id: { in: created.users } } });
  await prisma.lEARNING_PROGRESS.deleteMany({ where: { user_id: { in: created.users } } });
  await prisma.cEFR_LEARNING_PASS.deleteMany({ where: { user_id: { in: created.users } } });
  await prisma.cEFR_LEARNING_PATH_STATE.deleteMany({ where: { user_id: { in: created.users } } });
  await prisma.aUTH_SESSION.deleteMany({ where: { user_id: { in: created.users } } });
  await prisma.vOCABULARY_SET.deleteMany({ where: { id: { in: created.sets } } });
  await prisma.tOPIC.deleteMany({ where: { id: { in: created.topics } } });
  await prisma.vOCABULARY.deleteMany({ where: { id: { in: created.vocabularies } } });
  await prisma.uSER.deleteMany({ where: { id: { in: created.users } } });
}
