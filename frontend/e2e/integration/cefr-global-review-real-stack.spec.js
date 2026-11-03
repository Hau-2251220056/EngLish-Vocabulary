import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { PrismaClient } from "../../../backend/src/generated/prisma/client.ts";
import { configureTestEnvironment } from "../../../backend/test/helpers/test-environment.js";
import { hashPassword } from "../../../backend/src/utils/password-security.js";

configureTestEnvironment({ requireReset: true });
const prisma = new PrismaClient();
const run = randomUUID(), password = `Safe-${randomUUID()}`, created = { users: [], words: [], sets: [] };
let learner, emptyUser, administrator, dueWords;

test.describe.configure({ mode: "serial" });
test.beforeAll(async () => {
  await prisma.$connect(); const hash = await hashPassword(password);
  learner = await createUser("learner", "USER", hash); emptyUser = await createUser("empty", "USER", hash); administrator = await createUser("admin", "ADMIN", hash);
  dueWords = await createDuePrivateSet(learner.id, 11);
});
test.afterAll(async () => { try { await cleanup(); } finally { await prisma.$disconnect(); } });

test("review summary distinguishes zero due and caps an 11-item queue at ten exact IDs", async ({ page }) => {
  await login(page, emptyUser);
  expect((await api(page, "get", "/api/learning/review")).due_count).toBe(0);
  await page.request.post("/api/auth/logout"); await login(page, learner);
  const future = new Date(Date.now() + 86_400_000), due = new Date(Date.now() - 60_000);
  await prisma.lEARNING_PROGRESS.updateMany({ where: { user_id: learner.id }, data: { next_review_at: future } });
  expect((await api(page, "get", "/api/learning/review")).due_count).toBe(0);
  for (const count of [5, 10, 11]) {
    await prisma.lEARNING_PROGRESS.updateMany({ where: { user_id: learner.id }, data: { next_review_at: future } });
    await prisma.lEARNING_PROGRESS.updateMany({ where: { user_id: learner.id, vocabulary_id: { in: dueWords.slice(0, count).map(({ id }) => id) } }, data: { next_review_at: due } });
    expect((await api(page, "get", "/api/learning/review")).due_count).toBe(count);
  }
  const createdSession = await api(page, "post", "/api/learning/review/sessions", { operation_id: randomUUID() });
  expect(createdSession.session.scope).toBe("GLOBAL"); expect(createdSession.session.items).toHaveLength(10);
  expect(new Set(createdSession.session.items.map(({ vocabulary_id }) => vocabulary_id)).size).toBe(10);
});

test("AGAIN requeues, HARD/GOOD/EASY resolve, and Ôn tiếp obtains a fresh snapshot", async ({ page }) => {
  await login(page, learner); await page.goto("/review");
  const heading = page.getByRole("heading", { name: dueWords[0].word }); await expect(heading).toBeVisible(); await heading.press("Space");
  await page.getByRole("button", { name: "Lại" }).click();
  await expect(page.getByRole("heading", { name: dueWords[1].word })).toBeVisible();
  for (const rating of ["Khó", "Tốt", "Dễ"]) {
    const current = page.locator("main h1").first(); await current.press("Space"); await page.getByRole("button", { name: rating }).click();
  }
  for (let index = 0; index < 7; index += 1) {
    await page.locator("main h1").first().press("Space"); await page.getByRole("button", { name: "Tốt" }).click();
  }
  await expect(page.getByRole("heading", { name: "Hoàn thành phiên ôn tập" })).toBeVisible();
  const request = page.waitForRequest((item) => item.method() === "POST" && new URL(item.url()).pathname === "/api/learning/review/sessions");
  await page.getByRole("button", { name: "Ôn tiếp" }).click(); await request;
  await expect(page.getByRole("heading", { name: "Hoàn thành phiên ôn tập" })).toHaveCount(0);
});

test("ADMIN and Guest cannot enter global review and review does not duplicate XP/Streak", async ({ page }) => {
  await page.goto("/review"); await expect(page).toHaveURL(/\/login$/);
  await login(page, administrator); await page.goto("/review"); await expect(page).toHaveURL(/\/dashboard$/);
  const rewards = await prisma.xP_REWARD.findMany({ where: { user_id: learner.id }, select: { source_event_id: true } });
  expect(new Set(rewards.map(({ source_event_id }) => source_event_id)).size).toBe(rewards.length);
  const streaks = await prisma.sTREAK_DAY.findMany({ where: { user_id: learner.id } });
  expect(new Set(streaks.map(({ activity_date }) => activity_date.toISOString().slice(0, 10))).size).toBe(streaks.length);
});

async function api(page, method, url, data) { const response = await page.request[method](url, data ? { data } : undefined); expect(response.ok()).toBe(true); return (await response.json()).data; }
async function login(page, record) { await page.goto("/login"); await page.locator("#login-email").fill(record.email); await page.locator("#login-password").fill(password); await page.locator('form button[type="submit"]').click(); await expect(page).toHaveURL(/\/dashboard$/); }
async function createUser(name, role, password_hash) { const row = await prisma.uSER.create({ data: { email: `${name}-${run}@cefr-review.integration.test`, display_name: `Review ${name}`, role, password_hash } }); created.users.push(row.id); return row; }
async function createDuePrivateSet(owner_id, count) {
  const words = [];
  for (let index = 0; index < count; index += 1) { const row = await prisma.vOCABULARY.create({ data: { word: `${run}-review-${index}` } }); created.words.push(row.id); words.push(row); }
  const set = await prisma.vOCABULARY_SET.create({ data: { owner_id, name: `${run} Review`, is_public: false, items: { create: words.map(({ id }, index) => ({ vocabulary_id: id, position: index + 1 })) } } }); created.sets.push(set.id);
  await prisma.lEARNING_PROGRESS.createMany({ data: words.map(({ id }, index) => ({ user_id: owner_id, vocabulary_id: id, status: "LEARNED", review_count: 1, revision: 1, interval_days: 1, ease_factor: 2.5, last_event_id: randomUUID(), last_reviewed_at: new Date(Date.now() - (index + 1) * 60_000), next_review_at: new Date(Date.now() - 60_000) })) });
  return words;
}
async function cleanup() {
  await prisma.sTREAK_DAY.deleteMany({ where: { user_id: { in: created.users } } }); await prisma.lEARNING_SESSION.deleteMany({ where: { user_id: { in: created.users } } });
  await prisma.xP_REWARD.deleteMany({ where: { user_id: { in: created.users } } }); await prisma.lEARNING_PROGRESS.deleteMany({ where: { user_id: { in: created.users } } });
  await prisma.aUTH_SESSION.deleteMany({ where: { user_id: { in: created.users } } }); await prisma.vOCABULARY_SET.deleteMany({ where: { id: { in: created.sets } } });
  await prisma.vOCABULARY.deleteMany({ where: { id: { in: created.words } } }); await prisma.uSER.deleteMany({ where: { id: { in: created.users } } });
}
