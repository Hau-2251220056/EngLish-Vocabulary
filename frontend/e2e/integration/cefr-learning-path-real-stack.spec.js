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
const created = { users: [], vocabularies: [], sets: [] };
let learner, administrator, one, ten, eleven, a2, b1;

test.describe.configure({ mode: "serial" });
test.beforeAll(async () => {
  await prisma.$connect();
  const password_hash = await hashPassword(password);
  learner = await user("learner", "USER", password_hash);
  administrator = await user("admin", "ADMIN", password_hash);
  one = await systemSet("01 one", "A1", 1);
  ten = await systemSet("02 ten", "A1", 10);
  eleven = await systemSet("03 eleven", "A1", 11);
  a2 = await systemSet("04 a2", "A2", 1);
  b1 = await systemSet("05 b1", "B1", 1);
});
test.afterAll(async () => { try { await cleanup(); } finally { await prisma.$disconnect(); } });

test("first USER receives A1 recommendation and Guest/ADMIN remain role-correct", async ({ page }) => {
  await page.goto("/dashboard"); await expect(page).toHaveURL(/\/login$/);
  await login(page, administrator);
  await expect(page.getByRole("region", { name: "Lộ trình CEFR" })).toHaveCount(0);
  await page.request.post("/api/auth/logout");
  await login(page, learner);
  const path = page.getByRole("region", { name: "Lộ trình CEFR" });
  await expect(path).toContainText("A1");
  await expect(path.getByRole("link", { name: "Bắt đầu học" })).toBeVisible();
});

test("1/10/>10 Sets require completed bounded sessions, resume after reload, and unlock A2", async ({ page }) => {
  await login(page, learner);
  const concurrent = await Promise.all([
    startPass(page, one.id), startPass(page, one.id),
  ]);
  expect(new Set(concurrent.map(({ pass }) => pass.id)).size).toBe(1);
  const started = concurrent[0];
  const batch = await nextBatch(page, started.pass.id);
  await revealBatch(page, batch.session);
  const revealedOnly = await api(page, "get", `/api/learning-path/passes/${started.pass.id}`);
  expect(revealedOnly.ready_to_complete).toBe(false);
  await completeSession(page, batch.session.id);
  const ready = await api(page, "get", `/api/learning-path/passes/${started.pass.id}`);
  expect(ready.ready_to_complete).toBe(true);
  await api(page, "post", `/api/learning-path/passes/${started.pass.id}/complete`, { operation_id: randomUUID() });

  await completeSet(page, ten.id);
  const elevenPass = await startPass(page, eleven.id);
  const first = await nextBatch(page, elevenPass.pass.id);
  expect(first.session.items).toHaveLength(10);
  await revealBatch(page, first.session); await completeSession(page, first.session.id);
  await page.goto(`/learn/vocabulary-sets/${eleven.id}`); await page.reload();
  await expect(page.getByText(/1.*còn lại|còn.*1/i)).toBeVisible();
  await finishPass(page, elevenPass.pass.id);
  const projection = await api(page, "get", "/api/learning-path");
  expect(projection.highest_unlocked_level).toBe("A2");
});

test("locked B1 blocks Learning, Quiz and Speaking while snapshot mutation requires restart", async ({ page }) => {
  await login(page, learner);
  for (const route of [
    `/learn/vocabulary-sets/${b1.id}`, `/quiz/vocabulary-sets/${b1.id}`,
    `/pronunciation/vocabulary-sets/${b1.id}`,
  ]) {
    await page.goto(route);
    await expect(page.getByRole("alert").or(page.getByText(/khóa|chưa mở/i))).toBeVisible();
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

async function completeSet(page, setId) { const pass = await startPass(page, setId); await finishPass(page, pass.pass.id); }
async function finishPass(page, passId) {
  while (true) {
    const pass = await api(page, "get", `/api/learning-path/passes/${passId}`);
    if (pass.ready_to_complete) break;
    const batch = await nextBatch(page, passId); await revealBatch(page, batch.session); await completeSession(page, batch.session.id);
  }
  return api(page, "post", `/api/learning-path/passes/${passId}/complete`, { operation_id: randomUUID() });
}
function startPass(page, setId) { return api(page, "post", `/api/learning-path/sets/${setId}/passes`, { operation_id: randomUUID() }); }
function nextBatch(page, passId) { return api(page, "post", `/api/learning-path/passes/${passId}/sessions`, { operation_id: randomUUID() }); }
async function revealBatch(page, session) { for (const item of session.items) await api(page, "put", `/api/learning-sessions/${session.id}/items/${item.vocabulary_id}/reveal`, { operation_id: randomUUID() }); }
function completeSession(page, id) { return api(page, "post", `/api/learning-sessions/${id}/complete`, { operation_id: randomUUID() }); }
async function api(page, method, url, data) { const response = await page.request[method](url, data ? { data } : undefined); expect(response.ok(), `${method.toUpperCase()} ${url}`).toBe(true); return (await response.json()).data; }
async function login(page, record) { await page.goto("/login"); await page.locator("#login-email").fill(record.email); await page.locator("#login-password").fill(password); await page.locator('form button[type="submit"]').click(); await expect(page).toHaveURL(/\/dashboard$/); }
async function user(name, role, password_hash) { const row = await prisma.uSER.create({ data: { email: `${name}@${domain}`, display_name: `CEFR ${name}`, role, password_hash } }); created.users.push(row.id); return row; }
async function systemSet(name, cefr_level, count) {
  const words = [];
  for (let index = 0; index < count; index += 1) {
    const row = await prisma.vOCABULARY.create({ data: { word: `${run}-${name}-${index}`, meanings: { create: [{ part_of_speech: "noun", meaning_vi: `nghĩa ${index}`, cefr_level }] } } });
    created.vocabularies.push(row.id); words.push(row);
  }
  const row = await prisma.vOCABULARY_SET.create({ data: { owner_id: administrator.id, name: `${run} ${name}`, is_public: true, cefr_level, items: { create: words.map(({ id }, index) => ({ vocabulary_id: id, position: index + 1 })) } } });
  created.sets.push(row.id); return row;
}
async function cleanup() {
  await prisma.lEARNING_SESSION.deleteMany({ where: { user_id: { in: created.users } } });
  await prisma.cEFR_LEARNING_PASS.deleteMany({ where: { user_id: { in: created.users } } });
  await prisma.cEFR_LEARNING_PATH_STATE.deleteMany({ where: { user_id: { in: created.users } } });
  await prisma.aUTH_SESSION.deleteMany({ where: { user_id: { in: created.users } } });
  await prisma.vOCABULARY_SET.deleteMany({ where: { id: { in: created.sets } } });
  await prisma.vOCABULARY.deleteMany({ where: { id: { in: created.vocabularies } } });
  await prisma.uSER.deleteMany({ where: { id: { in: created.users } } });
}
