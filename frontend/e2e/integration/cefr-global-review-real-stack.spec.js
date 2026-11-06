import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { PrismaClient } from "../../../backend/src/generated/prisma/client.ts";
import { configureTestEnvironment } from "../../../backend/test/helpers/test-environment.js";
import { hashPassword } from "../../../backend/src/utils/password-security.js";

configureTestEnvironment({ requireReset: true });
const prisma = new PrismaClient();
const run = randomUUID(), password = `Safe-${randomUUID()}`, created = { users: [], words: [], sets: [], topics: [] };
const sentinel = {};
let learner, emptyUser, reachabilityUser, ratingUser, administrator, publicTopic, dueWords, ratingWords;

test.describe.configure({ mode: "serial" });
test.beforeAll(async () => {
  await prisma.$connect(); const hash = await hashPassword(password);
  learner = await createUser("learner", "USER", hash); emptyUser = await createUser("empty", "USER", hash); reachabilityUser = await createUser("reachability", "USER", hash); ratingUser = await createUser("rating", "USER", hash); administrator = await createUser("admin", "ADMIN", hash);
  publicTopic = await prisma.tOPIC.create({ data: { name: `${run} Review public topic` } }); created.topics.push(publicTopic.id);
  dueWords = await createDuePrivateSet(learner.id, 11, "summary");
  ratingWords = await createDuePrivateSet(ratingUser.id, 4, "ratings");
  await createSentinel(hash);
});
test.afterAll(async () => { try { await cleanup(); await assertAndCleanupSentinel(); } finally { await prisma.$disconnect(); } });

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

test("global review filters reachability, deduplicates exact IDs, preserves equal spellings and rejects access loss", async ({ page }) => {
  const shared = await word("shared");
  const sameA = await word("same-a", `${run}-identical-spelling`);
  const sameB = await word("same-b", `${run}-identical-spelling`, reachabilityUser.id);
  const lockedOnly = await word("locked-only");
  const orphan = await word("orphan");
  const accessLoss = await word("access-loss");
  const publicSet = await setWithItems(administrator.id, "reachable A1", true, "A1", [shared.id, sameA.id]);
  const privateSet = await setWithItems(reachabilityUser.id, "owned private", false, null, [shared.id, sameB.id, accessLoss.id]);
  await setWithItems(administrator.id, "locked B1", true, "B1", [lockedOnly.id]);
  await dueProgress(reachabilityUser.id, [shared, sameA, sameB, lockedOnly, orphan, accessLoss]);

  await login(page, reachabilityUser);
  expect((await api(page, "get", "/api/learning/review")).due_count).toBe(4);
  const review = await api(page, "post", "/api/learning/review/sessions", { operation_id: randomUUID() });
  const ids = review.session.items.map(({ vocabulary_id }) => vocabulary_id);
  expect(new Set(ids)).toEqual(new Set([shared.id, sameA.id, sameB.id, accessLoss.id]));
  expect(ids.filter((id) => id === shared.id)).toHaveLength(1);
  expect(ids).not.toContain(lockedOnly.id); expect(ids).not.toContain(orphan.id);
  expect(sameA.word).toBe(sameB.word); expect(sameA.id).not.toBe(sameB.id);

  const before = await reviewMutationState(reachabilityUser.id, accessLoss.id, review.session.id);
  await prisma.vOCABULARY_SET.delete({ where: { id: privateSet.id } });
  await requestError(page, "post", "/api/learning/events", {
    event_id: randomUUID(), set_id: null, vocabulary_id: accessLoss.id,
    expected_revision: before.progress.revision, rating: "GOOD", session_id: review.session.id,
  }, 409, "LEARNING_SESSION_INACCESSIBLE");
  expect(await reviewMutationState(reachabilityUser.id, accessLoss.id, review.session.id)).toEqual(before);
  expect(await prisma.vOCABULARY_SET.findUnique({ where: { id: publicSet.id } })).toBeTruthy();
});

test("AGAIN requeues, HARD/GOOD/EASY resolve, and Ôn tiếp obtains a fresh snapshot", async ({ page }) => {
  await login(page, ratingUser);
  const createResponse = page.waitForResponse((response) => response.request().method() === "POST"
    && new URL(response.url()).pathname === "/api/learning/review/sessions" && response.ok());
  await page.goto("/review");
  const createdSession = (await (await createResponse).json()).data;
  const cardsById = new Map(createdSession.cards.map((card) => [card.id, card]));
  const orderedWords = [...createdSession.session.items]
    .sort((left, right) => left.position - right.position)
    .map(({ vocabulary_id }) => cardsById.get(vocabulary_id)?.word);
  expect(createdSession.session.scope).toBe("GLOBAL");
  expect(orderedWords).toHaveLength(ratingWords.length);
  expect(orderedWords.every(Boolean)).toBe(true);
  expect(await prisma.lEARNING_SESSION.count({ where: { user_id: ratingUser.id, scope: "GLOBAL" } })).toBe(1);

  const firstItem = createdSession.session.items.find(({ position }) => position === 0);
  expect(firstItem).toBeTruthy();
  const heading = page.getByRole("heading", { name: orderedWords[0] }); await expect(heading).toBeVisible(); await heading.press("Space");
  const ratingEnvelope = await submitRating(page, {
    buttonName: "Lại", rating: "AGAIN", sessionId: createdSession.session.id,
    vocabularyId: firstItem.vocabulary_id,
  });
  expect(ratingEnvelope).toMatchObject({
    success: true,
    data: {
      vocabulary_id: firstItem?.vocabulary_id,
      session: { id: createdSession.session.id, state: "ACTIVE" },
    },
  });
  const ratedItem = ratingEnvelope.data.session.items.find(({ vocabulary_id: id }) => id === firstItem?.vocabulary_id);
  expect(ratedItem).toMatchObject({ vocabulary_id: firstItem?.vocabulary_id, evidence: null });
  const replayOrder = [...orderedWords.slice(1, 4), orderedWords[0], ...orderedWords.slice(4)];
  await expect(page.getByRole("heading", { name: replayOrder[0] })).toBeVisible();
  for (const [index, rating] of ["Khó", "Tốt", "Dễ"].entries()) {
    const current = page.getByRole("heading", { name: replayOrder[index] });
    await expect(current).toBeVisible(); await current.press("Space");
    await submitRating(page, {
      buttonName: rating,
      rating: ["HARD", "GOOD", "EASY"][index],
      sessionId: createdSession.session.id,
      vocabularyId: createdSession.cards.find(({ word }) => word === replayOrder[index]).id,
    });
  }
  const requeued = page.getByRole("heading", { name: replayOrder[3] });
  await expect(requeued).toBeVisible(); await requeued.press("Space");
  await submitRating(page, {
    buttonName: "Tốt", rating: "GOOD", sessionId: createdSession.session.id,
    vocabularyId: firstItem.vocabulary_id,
  });
  await expect(page.getByRole("heading", { name: "Hoàn thành phiên ôn tập" })).toBeVisible();
  const freshResponsePromise = page.waitForResponse((response) => response.request().method() === "POST"
    && new URL(response.url()).pathname === "/api/learning/review/sessions");
  await page.getByRole("button", { name: "Ôn tiếp" }).click();
  const freshResponse = await freshResponsePromise;
  const freshEnvelope = await freshResponse.json();
  expect(freshResponse.ok(), `Fresh review failed with HTTP ${freshResponse.status()}`).toBe(true);
  expect(freshEnvelope).toMatchObject({
    success: true,
    data: { session: null, reason: "REVIEW_FUTURE_DUE" },
  });
  await expect(page.getByRole("heading", { name: "Hoàn thành phiên ôn tập" })).toHaveCount(0);
  const futureState = page.getByRole("status").filter({ hasText: "Chưa có từ đến hạn" });
  await expect(futureState).toBeVisible();
  await expect(futureState.getByRole("heading", { name: "Chưa có từ đến hạn" })).toBeVisible();
});

test("ADMIN and Guest cannot enter global review and review does not duplicate XP/Streak", async ({ page }) => {
  await page.goto("/review"); await expect(page).toHaveURL(/\/login$/);
  await login(page, administrator); await page.goto("/review"); await expect(page).toHaveURL(/\/dashboard$/);
  const rewards = await prisma.xP_REWARD.findMany({ where: { user_id: ratingUser.id }, select: { source_event_id: true } });
  expect(new Set(rewards.map(({ source_event_id }) => source_event_id)).size).toBe(rewards.length);
  const streaks = await prisma.sTREAK_DAY.findMany({ where: { user_id: ratingUser.id } });
  expect(new Set(streaks.map(({ activity_date }) => activity_date.toISOString().slice(0, 10))).size).toBe(streaks.length);
});

async function api(page, method, url, data) { const response = await page.request[method](url, data ? { data } : undefined); expect(response.ok()).toBe(true); return (await response.json()).data; }
async function requestError(page, method, url, data, status, code) { const response = await page.request[method](url, data ? { data } : undefined); expect(response.status()).toBe(status); expect((await response.json()).error.code).toBe(code); }
async function submitRating(page, { buttonName, rating, sessionId, vocabularyId }) {
  const responsePromise = page.waitForResponse((response) => {
    if (response.request().method() !== "POST" || new URL(response.url()).pathname !== "/api/learning/events") return false;
    const body = response.request().postDataJSON();
    return body?.session_id === sessionId && body?.vocabulary_id === vocabularyId && body?.rating === rating;
  });
  await page.getByRole("button", { name: buttonName, exact: true }).click();
  const response = await responsePromise;
  const envelope = await response.json();
  const diagnosticCode = envelope?.error?.code ?? "NO_ERROR_CODE";
  expect(response.status(), `${rating} rating failed with HTTP ${response.status()} (${diagnosticCode})`).toBe(200);
  expect(envelope).toMatchObject({ success: true, data: { vocabulary_id: vocabularyId, session: { id: sessionId } } });
  return envelope;
}
async function login(page, record) { await page.goto("/login"); await page.locator("#login-email").fill(record.email); await page.locator("#login-password").fill(password); await page.locator('form button[type="submit"]').click(); await expect(page).toHaveURL(/\/dashboard$/); }
async function createUser(name, role, password_hash) { const row = await prisma.uSER.create({ data: { email: `${name}-${run}@cefr-review.integration.test`, display_name: `Review ${name}`, role, password_hash } }); created.users.push(row.id); return row; }
async function createDuePrivateSet(owner_id, count, namespace) {
  const words = [];
  for (let index = 0; index < count; index += 1) { const row = await prisma.vOCABULARY.create({ data: { word: `${run}-review-${namespace}-${index}` } }); created.words.push(row.id); words.push(row); }
  const set = await prisma.vOCABULARY_SET.create({ data: { owner_id, name: `${run} Review ${namespace}`, is_public: false, items: { create: words.map(({ id }, index) => ({ vocabulary_id: id, position: index + 1 })) } } }); created.sets.push(set.id);
  await prisma.lEARNING_PROGRESS.createMany({ data: words.map(({ id }, index) => ({ user_id: owner_id, vocabulary_id: id, status: "LEARNED", review_count: 1, revision: 1, interval_days: 1, ease_factor: 2.5, last_event_id: randomUUID(), last_reviewed_at: new Date(Date.now() - (index + 1) * 60_000), next_review_at: new Date(Date.now() - 60_000) })) });
  return words;
}
async function word(label, spelling = `${run}-${label}`, owner_id = null) { const row = await prisma.vOCABULARY.create({ data: { word: spelling, owner_id } }); created.words.push(row.id); return row; }
async function setWithItems(owner_id, label, is_public, cefr_level, words) {
  const row = await prisma.vOCABULARY_SET.create({ data: { topic_id: is_public ? publicTopic.id : null, owner_id, name: `${run} ${label}`, is_public, cefr_level, items: { create: words.map((vocabulary_id, index) => ({ vocabulary_id, position: index + 1 })) } } });
  created.sets.push(row.id); return row;
}
async function dueProgress(user_id, words) {
  await prisma.lEARNING_PROGRESS.createMany({ data: words.map(({ id }, index) => ({ user_id, vocabulary_id: id, status: "LEARNED", review_count: 1, revision: 1, interval_days: 1, ease_factor: 2.5, last_event_id: randomUUID(), last_reviewed_at: new Date(Date.now() - (index + 20) * 60_000), next_review_at: new Date(Date.now() - 60_000) })) });
}
async function reviewMutationState(userId, vocabularyId, sessionId) {
  const [progress, rewards, streaks, receipts, evidence] = await Promise.all([
    prisma.lEARNING_PROGRESS.findUniqueOrThrow({ where: { user_id_vocabulary_id: { user_id: userId, vocabulary_id: vocabularyId } }, select: { revision: true, review_count: true, last_event_id: true, next_review_at: true } }),
    prisma.xP_REWARD.count({ where: { user_id: userId, vocabulary_id: vocabularyId } }),
    prisma.sTREAK_DAY.count({ where: { user_id: userId } }),
    prisma.lEARNING_SESSION_SRS_RECEIPT.count({ where: { session_item: { session_id: sessionId } } }),
    prisma.lEARNING_SESSION_ITEM.findFirstOrThrow({ where: { session_id: sessionId, vocabulary_id: vocabularyId }, select: { evidence: true, evidence_event_id: true } }),
  ]);
  return { progress, rewards, streaks, receipts, evidence };
}
async function createSentinel(password_hash) {
  sentinel.user = await prisma.uSER.create({ data: { email: `sentinel-${run}@cefr-review.integration.test`, display_name: "Unrelated review sentinel", role: "USER", password_hash } });
  sentinel.word = await prisma.vOCABULARY.create({ data: { word: `${run}-review-sentinel` } });
  sentinel.set = await prisma.vOCABULARY_SET.create({ data: { owner_id: sentinel.user.id, name: `${run} review sentinel`, is_public: false, items: { create: [{ vocabulary_id: sentinel.word.id, position: 1 }] } } });
  sentinel.progress = await prisma.lEARNING_PROGRESS.create({ data: { user_id: sentinel.user.id, vocabulary_id: sentinel.word.id, status: "LEARNING" } });
  sentinel.snapshot = await sentinelState();
}
async function assertAndCleanupSentinel() {
  expect(await sentinelState()).toEqual(sentinel.snapshot);
  await prisma.lEARNING_PROGRESS.delete({ where: { id: sentinel.progress.id } }); await prisma.vOCABULARY_SET.delete({ where: { id: sentinel.set.id } });
  await prisma.vOCABULARY.delete({ where: { id: sentinel.word.id } }); await prisma.uSER.delete({ where: { id: sentinel.user.id } });
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
  await prisma.lEARNING_SESSION.deleteMany({ where: { user_id: { in: created.users } } });
  await prisma.xP_REWARD.deleteMany({ where: { user_id: { in: created.users } } }); await prisma.lEARNING_PROGRESS.deleteMany({ where: { user_id: { in: created.users } } });
  await prisma.cEFR_LEARNING_PASS.deleteMany({ where: { user_id: { in: created.users } } }); await prisma.cEFR_LEARNING_PATH_STATE.deleteMany({ where: { user_id: { in: created.users } } });
  await prisma.aUTH_SESSION.deleteMany({ where: { user_id: { in: created.users } } }); await prisma.vOCABULARY_SET.deleteMany({ where: { id: { in: created.sets } } });
  await prisma.tOPIC.deleteMany({ where: { id: { in: created.topics } } });
  await prisma.vOCABULARY.deleteMany({ where: { id: { in: created.words } } });
  await prisma.sTREAK_DAY.deleteMany({ where: { user_id: { in: created.users } } });
  await prisma.uSER.deleteMany({ where: { id: { in: created.users } } });
}
