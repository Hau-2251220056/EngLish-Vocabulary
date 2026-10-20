import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { PrismaClient } from "../../../backend/src/generated/prisma/client.ts";
import { hashPassword } from "../../../backend/src/utils/password-security.js";
import { configureTestEnvironment } from "../../../backend/test/helpers/test-environment.js";

configureTestEnvironment({ requireReset: true });

const prisma = new PrismaClient();
const runId = randomUUID();
const prefix = `E2E-Streak-${runId}`;
const password = `Safe-${randomUUID()}`;
const account = {
  email: `learner@${runId}.streak.integration.test`,
  display_name: "Streak Integrated Learner",
  role: "USER",
  is_active: true,
};

let user;
let normalSet;
let srsSet;
let quizSet;
let normalVocabulary;
let srsVocabulary;
let quizVocabulary;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await prisma.$connect();
  user = await prisma.uSER.create({
    data: { ...account, password_hash: await hashPassword(password) },
  });
  normalVocabulary = await createVocabulary("normal", "nghĩa normal");
  srsVocabulary = await createVocabulary("srs", "nghĩa srs");
  quizVocabulary = await Promise.all([
    createVocabulary("quiz-one", "nghĩa quiz một"),
    createVocabulary("quiz-two", "nghĩa quiz hai"),
    createVocabulary("quiz-three", "nghĩa quiz ba"),
    createVocabulary("quiz-four", "nghĩa quiz bốn"),
  ]);
  normalSet = await createSet("NORMAL", [normalVocabulary.id]);
  srsSet = await createSet("SRS", [srsVocabulary.id]);
  quizSet = await createSet("Quiz", quizVocabulary.map(({ id }) => id));
});

test.afterAll(async () => {
  try {
    if (user?.id) {
      await prisma.lEARNING_SESSION.deleteMany({ where: { user_id: user.id } });
      await prisma.sTREAK_DAY.deleteMany({ where: { user_id: user.id } });
      await prisma.xP_REWARD.deleteMany({ where: { user_id: user.id } });
      await prisma.lEARNING_PROGRESS.deleteMany({ where: { user_id: user.id } });
      await prisma.aUTH_SESSION.deleteMany({ where: { user_id: user.id } });
      await prisma.vOCABULARY_SET.deleteMany({ where: { owner_id: user.id } });
    }
    await prisma.vOCABULARY.deleteMany({ where: { word: { startsWith: prefix } } });
    if (user?.id) await prisma.uSER.delete({ where: { id: user.id } });
    expect(await controlledFixtureCount()).toBe(0);
  } finally {
    await prisma.$disconnect();
  }
});

test("NORMAL, SRS and zero-correct Quiz qualify once while Speaking remains non-qualifying", async ({ page }) => {
  test.setTimeout(120_000);
  await login(page);
  await expectStreak(page, { current: 0, days: 0, sessions: 0 });

  await page.goto(`/pronunciation/vocabulary-sets/${normalSet.id}`);
  await expect(page.getByRole("heading", { name: normalVocabulary.word })).toBeVisible();
  await expectStreak(page, { current: 0, days: 0, sessions: 0 });

  await page.goto(`/learn/vocabulary-sets/${normalSet.id}`);
  await page.getByRole("button", { name: "Ôn tập thường" }).click();
  const normalNavigation = page.getByRole("navigation", { name: "Điều hướng thẻ" });
  await expect(normalNavigation).toBeVisible();
  await expect(page.getByRole("status").filter({
    hasText: /Đang (?:chuyển chế độ|chuẩn bị phiên học)…/,
  })).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
  const finishNormal = normalNavigation.getByRole("button", { name: "Hoàn thành phiên" });
  await expect(finishNormal).toBeVisible();
  await expect(finishNormal).toBeDisabled();
  await page.getByRole("heading", { name: normalVocabulary.word }).press("Space");
  await expect(page.locator('.sr-only[role="status"]')).toContainText("Đã ghi nhận thẻ được lật");
  await expect(finishNormal).toBeEnabled();
  await finishNormal.click();
  const normalSummaryHeading = page.getByRole("heading", { name: "Hoàn thành bộ từ" });
  const normalSummary = page.getByRole("status").filter({ has: normalSummaryHeading });
  await expect(normalSummaryHeading).toBeVisible();
  await expect(normalSummaryHeading).toBeFocused();
  await expect(normalSummary).toContainText("Chuỗi hiện tại 1 ngày");
  await expectStreak(page, { current: 1, days: 1, sessions: 1 });
  expect(await progressFor(normalVocabulary.id)).toBeNull();
  expect(await xpSnapshot()).toEqual({ totalXp: 0, rewards: [] });

  await page.goto(`/learn/vocabulary-sets/${srsSet.id}`);
  const srsHeading = page.getByRole("heading", { name: srsVocabulary.word });
  await expect(srsHeading).toBeFocused();
  await srsHeading.press("Space");
  await page.getByRole("button", { name: "Lại, Trong phiên này" }).click();
  await expect(srsHeading).toBeFocused();
  expect(await progressFor(srsVocabulary.id)).toMatchObject({
    status: "LEARNING",
    review_count: 1,
    revision: 1,
  });
  expect(await xpSnapshot()).toEqual({ totalXp: 0, rewards: [] });

  await srsHeading.press("Space");
  await page.getByRole("button", { name: "Tốt, 1–3 ngày" }).click();
  await expect(page.getByRole("heading", { name: "Hoàn thành ôn tập" })).toBeVisible();
  expect(await progressFor(srsVocabulary.id)).toMatchObject({
    status: "LEARNED",
    review_count: 2,
    revision: 2,
  });
  expect(await xpSnapshot()).toEqual({
    totalXp: 3,
    rewards: [{ reward_type: "SRS_INITIAL", xp_amount: 3 }],
  });
  await expectStreak(page, { current: 1, days: 1, sessions: 2 });

  await page.goto(`/quiz/vocabulary-sets/${quizSet.id}`);
  for (let index = 0; index < quizVocabulary.length; index += 1) {
    const vocabulary = quizVocabulary[index];
    await expect(page.getByRole("heading", { name: vocabulary.word })).toBeVisible();
    await selectIncorrectChoice(page, vocabulary.meaning);
    await page.getByRole("button", { name: "Kiểm tra đáp án" }).click();
    await expect(
      page.getByTestId("quiz-feedback").getByRole("status"),
    ).toHaveText("Chưa chính xác. Đáp án đúng đã được đánh dấu.");
    await page.getByRole("button", { name: index === quizVocabulary.length - 1 ? "Xem kết quả" : "Câu tiếp theo" }).click();
  }
  await expect(page.getByRole("heading", { name: "Hoàn thành Quiz" })).toBeVisible();
  await expect(page.getByText("Chính xác").locator("..")).toContainText("0");
  expect(await xpSnapshot()).toEqual({
    totalXp: 3,
    rewards: [{ reward_type: "SRS_INITIAL", xp_amount: 3 }],
  });
  await expectStreak(page, { current: 1, days: 1, sessions: 3 });

  await page.goto("/dashboard");
  const streakCard = page.getByRole("region", { name: "Chuỗi học tập" });
  await expect(streakCard.getByLabel("Chuỗi hiện tại 1 ngày")).toBeVisible();
  await expect(streakCard).toContainText("Bạn đã duy trì chuỗi hôm nay.");
});

async function createVocabulary(suffix, meaning) {
  const vocabulary = await prisma.vOCABULARY.create({
    data: {
      word: `${prefix}-${suffix}`,
      meanings: { create: [{ part_of_speech: "noun", meaning_vi: meaning, cefr_level: "A1" }] },
    },
  });
  return { ...vocabulary, meaning };
}

function createSet(suffix, vocabularyIds) {
  return prisma.vOCABULARY_SET.create({
    data: {
      owner_id: user.id,
      name: `${prefix} ${suffix}`,
      is_public: false,
      items: {
        create: vocabularyIds.map((vocabularyId, index) => ({
          vocabulary_id: vocabularyId,
          position: index + 1,
        })),
      },
    },
  });
}

async function login(page) {
  await page.goto("/login");
  await page.locator("#login-email").fill(account.email);
  await page.locator("#login-password").fill(password);
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function selectIncorrectChoice(page, correctMeaning) {
  const radios = page.getByRole("radio");
  for (let index = 0; index < await radios.count(); index += 1) {
    const radio = radios.nth(index);
    const label = await radio.locator("xpath=ancestor::label[1]").innerText();
    if (!label.includes(correctMeaning)) {
      await radio.check();
      return;
    }
  }
  throw new Error("Quiz did not expose an incorrect opaque choice.");
}

async function expectStreak(page, { current, days, sessions }) {
  const [storedDays, storedSessions, response] = await Promise.all([
    prisma.sTREAK_DAY.count({ where: { user_id: user.id } }),
    prisma.lEARNING_SESSION.count({ where: { user_id: user.id, status: "COMPLETED" } }),
    page.request.get("/api/users/me/streak"),
  ]);
  expect(storedDays).toBe(days);
  expect(storedSessions).toBe(sessions);
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.data.current_streak).toBe(current);
  expect(body.data.completed_today).toBe(current > 0);
  expect(body.data.timezone).toBe("Asia/Ho_Chi_Minh");
}

function progressFor(vocabularyId) {
  return prisma.lEARNING_PROGRESS.findUnique({
    where: { user_id_vocabulary_id: { user_id: user.id, vocabulary_id: vocabularyId } },
  });
}

async function xpSnapshot() {
  const [record, rewards] = await Promise.all([
    prisma.uSER.findUniqueOrThrow({ where: { id: user.id }, select: { total_xp: true } }),
    prisma.xP_REWARD.findMany({
      where: { user_id: user.id },
      orderBy: { reward_type: "asc" },
      select: { reward_type: true, xp_amount: true },
    }),
  ]);
  return { totalXp: record.total_xp, rewards };
}

async function controlledFixtureCount() {
  const [users, vocabularies, sets, sessions, days] = await Promise.all([
    prisma.uSER.count({ where: { email: account.email } }),
    prisma.vOCABULARY.count({ where: { word: { startsWith: prefix } } }),
    prisma.vOCABULARY_SET.count({ where: { name: { startsWith: prefix } } }),
    prisma.lEARNING_SESSION.count({ where: { user_id: user?.id } }),
    prisma.sTREAK_DAY.count({ where: { user_id: user?.id } }),
  ]);
  return users + vocabularies + sets + sessions + days;
}
