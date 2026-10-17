import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { PrismaClient } from "../../../backend/src/generated/prisma/client.ts";
import { hashPassword } from "../../../backend/src/utils/password-security.js";
import { configureTestEnvironment } from "../../../backend/test/helpers/test-environment.js";

configureTestEnvironment({ requireReset: true });

const prisma = new PrismaClient();
const runId = randomUUID();
const prefix = `E2E-Dashboard-${runId}`;
const domain = `${runId}.dashboard.integration.test`;
const password = `Safe-${randomUUID()}`;
const accounts = {
  learner: account("Dashboard Real Learner", "USER"),
  outsider: account("Dashboard Private Outsider", "USER"),
  administrator: account("Dashboard Real Admin", "ADMIN"),
};

let records;
let vocabularies;
let ownedSets;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await prisma.$connect();
  const passwordHash = await hashPassword(password);
  const users = await Promise.all(
    Object.entries(accounts).map(async ([key, value]) => [
      key,
      await prisma.uSER.create({
        data: { ...value, password_hash: passwordHash, is_active: true },
      }),
    ]),
  );
  records = Object.fromEntries(users);
  vocabularies = await Promise.all([
    createVocabulary("alpha"),
    createVocabulary("beta"),
    createVocabulary("gamma"),
    createVocabulary("delta"),
  ]);

  ownedSets = [];
  ownedSets.push(await createSet(records.learner.id, "01 Empty", []));
  ownedSets.push(await createSet(records.learner.id, "02 Learn", [vocabularies[0].id, vocabularies[1].id]));
  ownedSets.push(await createSet(records.learner.id, "03 Learn", [vocabularies[2].id]));
  ownedSets.push(await createSet(records.learner.id, "04 Beyond preview", [vocabularies[0].id]));
  await createSet(records.outsider.id, "Outsider private", [vocabularies[1].id]);

  await prisma.lEARNING_PROGRESS.createMany({
    data: [
      progress(records.learner.id, vocabularies[0].id, "LEARNING", 1),
      progress(records.learner.id, vocabularies[1].id, "LEARNED", 2),
      progress(records.learner.id, vocabularies[2].id, "NEEDS_REVIEW", 3),
      progress(records.outsider.id, vocabularies[0].id, "LEARNED", 99),
    ],
  });
});

test.afterAll(async () => {
  try {
    const userIds = Object.values(records ?? {}).map(({ id }) => id);
    if (userIds.length > 0) {
      await prisma.xP_REWARD.deleteMany({ where: { user_id: { in: userIds } } });
      await prisma.lEARNING_PROGRESS.deleteMany({ where: { user_id: { in: userIds } } });
      await prisma.aUTH_SESSION.deleteMany({ where: { user_id: { in: userIds } } });
      await prisma.vOCABULARY_SET.deleteMany({ where: { owner_id: { in: userIds } } });
    }
    await prisma.vOCABULARY.deleteMany({ where: { word: { startsWith: prefix } } });
    await prisma.tOPIC.deleteMany({ where: { name: { startsWith: prefix } } });
    if (userIds.length > 0) await prisma.uSER.deleteMany({ where: { id: { in: userIds } } });
    expect(await controlledFixtureCount()).toBe(0);
  } finally {
    await prisma.$disconnect();
  }
});

test("USER Dashboard composes isolated persisted data, stays read-only and opens an accessible Set", async ({ page }) => {
  const before = await persistedSnapshot();
  await login(page, accounts.learner);

  await expect(page.getByRole("heading", {
    name: /^Chào buổi (sáng|trưa|chiều|tối), Dashboard Real Learner$/,
  })).toBeVisible();
  const summary = page.getByRole("group", { name: "Tóm tắt tiến độ" });
  await expect(summary).toContainText("Tổng đã bắt đầu3");
  await expect(summary).toContainText("Đang học1");
  await expect(summary).toContainText("Đã thuộc1");
  await expect(summary).not.toContainText("Cần ôn");

  await expect(page.getByText("Bạn đang có 4 bộ từ riêng.")).toBeVisible();
  await expect(page.getByRole("region", { name: "XP và cấp độ" })).toContainText("Level 1");
  await expect(page.getByRole("region", { name: "XP và cấp độ" })).toContainText("0 XP");
  await expect(page.getByRole("progressbar", { name: "Tiến độ XP Level 1" })).toHaveAttribute("aria-valuenow", "0");
  const preview = page.getByRole("list", { name: "Bộ từ riêng xem trước" });
  await expect(preview.getByRole("listitem")).toHaveCount(3);
  await expect(preview).toContainText(`${prefix} 01 Empty`);
  await expect(preview).toContainText(`${prefix} 02 Learn`);
  await expect(preview).toContainText(`${prefix} 03 Learn`);
  await expect(preview).not.toContainText(`${prefix} 04 Beyond preview`);
  await expect(preview).not.toContainText("Outsider private");
  await expect(preview.getByRole("link", { name: "Bắt đầu học" })).toHaveCount(2);
  await expect(preview.getByRole("listitem").first().getByRole("link", { name: "Bắt đầu học" })).toHaveCount(0);

  await preview.getByRole("listitem").nth(1).getByRole("link", { name: "Bắt đầu học" }).click();
  await expect(page).toHaveURL(new RegExp(`/learn/vocabulary-sets/${ownedSets[1].id}$`));
  await expect(page.getByRole("heading", { name: vocabularies[0].word })).toBeVisible();
  expect(await persistedSnapshot()).toEqual(before);
});

test("ADMIN Dashboard remains neutral and makes zero USER-only Dashboard requests", async ({ page }) => {
  const requestedUserEndpoints = [];
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (pathname === "/api/learning/progress" || pathname === "/api/my/vocabulary-sets") {
      requestedUserEndpoints.push(pathname);
    }
  });

  await login(page, accounts.administrator);
  await expect(page.getByRole("heading", { name: "Xin chào, Dashboard Real Admin." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Không gian quản trị" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Tóm tắt tiến độ" })).toHaveCount(0);
  await page.waitForTimeout(250);
  expect(requestedUserEndpoints).toEqual([]);
});

test("SRS to Quiz lifecycle refreshes authoritative Dashboard XP while NORMAL and Speaking remain read-only", async ({ page }) => {
  await prisma.uSER.update({ where: { id: records.learner.id }, data: { total_xp: 47 } });
  await login(page, accounts.learner);
  const xpSummary = page.getByRole("region", { name: "XP và cấp độ" });
  await expect(xpSummary).toContainText("47 XP");
  await expect(xpSummary).toContainText("Level 1");

  const beforeExcluded = await xpSnapshot(records.learner.id);
  await page.goto(`/learn/vocabulary-sets/${ownedSets[1].id}`);
  await page.getByRole("button", { name: "Ôn tập thường" }).click();
  await expect(page.getByRole("button", { name: "Ôn tập thường" })).toHaveAttribute("aria-pressed", "true");
  await page.goto(`/pronunciation/vocabulary-sets/${ownedSets[1].id}`);
  await expect(page.getByRole("heading", { name: vocabularies[0].word })).toBeVisible();
  expect(await xpSnapshot(records.learner.id)).toEqual(beforeExcluded);

  await page.goto(`/learn/vocabulary-sets/${ownedSets[1].id}`);
  await page.getByRole("button", { name: "Ôn tập SRS" }).click();
  await expect(page.getByRole("button", { name: "Ôn tập SRS" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Tiến độ SRS", { exact: true })).toBeVisible();
  const srsCard = page.getByRole("heading", { name: vocabularies[0].word });
  await expect(srsCard).toBeFocused();
  await srsCard.press("Space");
  await expect(page.getByRole("region", { name: "Đánh giá SRS" })).toBeVisible();
  await page.getByRole("button", { name: "Tốt" }).press("Enter");
  const srsStatus = page.locator('.sr-only[role="status"]');
  await expect(srsStatus).toHaveText("Tốt đã được ghi nhận.");
  await expect(srsStatus).toHaveAttribute("aria-live", "polite");
  await expect(srsStatus).toHaveAttribute("aria-atomic", "true");
  const srsXpToast = page.getByRole("alert").filter({ hasText: "Bạn vừa nhận +3 XP!" });
  await expect(srsXpToast).toHaveCount(1);
  const srsXpToastRoot = srsXpToast.locator("xpath=ancestor-or-self::div[contains(concat(' ', normalize-space(@class), ' '), ' Toastify__toast ')][1]");
  await srsXpToastRoot.locator(".Toastify__close-button").click();
  await expect(srsXpToast).toHaveCount(0);

  await page.goto(`/quiz/vocabulary-sets/${ownedSets[1].id}`);
  await expect(page.getByRole("heading", { name: vocabularies[0].word })).toBeVisible();
  await page.getByRole("radio", { name: `${prefix} meaning alpha` }).check();
  await page.getByRole("button", { name: "Kiểm tra đáp án" }).press("Enter");
  const quizResultHeading = page.getByRole("heading", { name: "Chính xác" });
  await expect(quizResultHeading).toBeFocused();
  const quizStatus = page.getByTestId("quiz-feedback").getByRole("status");
  await expect(quizStatus).toHaveText("Chính xác.");
  await expect(quizStatus).toHaveAttribute("aria-live", "polite");
  await expect(quizStatus).toHaveAttribute("aria-atomic", "true");
  await expect(page.getByRole("alert").filter({ hasText: "Bạn vừa nhận +3 XP!" })).toHaveCount(1);

  await page.goto("/dashboard");
  await expect(xpSummary).toContainText("53 XP");
  await expect(xpSummary).toContainText("Level 2");
  await page.reload();
  await expect(page.getByRole("region", { name: "XP và cấp độ" })).toContainText("53 XP");
  assertLifecycleRows(await xpSnapshot(records.learner.id));
});

function account(displayName, role) {
  return {
    email: `${role.toLowerCase()}-${displayName.toLowerCase().replaceAll(" ", "-")}@${domain}`,
    display_name: displayName,
    role,
  };
}

function createVocabulary(suffix) {
  return prisma.vOCABULARY.create({
    data: {
      word: `${prefix} ${suffix}`,
      phonetic: `/${suffix}/`,
      meanings: {
        create: [{
          part_of_speech: "noun",
          meaning_vi: `${prefix} meaning ${suffix}`,
          cefr_level: "A1",
          examples: { create: [{ example_en: `${prefix} example ${suffix}.` }] },
        }],
      },
    },
  });
}

function createSet(ownerId, suffix, vocabularyIds) {
  return prisma.vOCABULARY_SET.create({
    data: {
      topic_id: null,
      owner_id: ownerId,
      name: `${prefix} ${suffix}`,
      description: `${prefix} controlled private Set`,
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

function progress(userId, vocabularyId, status, reviewCount) {
  return {
    user_id: userId,
    vocabulary_id: vocabularyId,
    status,
    review_count: reviewCount,
    revision: reviewCount,
    last_reviewed_at: new Date(Date.UTC(2026, 8, 26, reviewCount)),
    last_event_id: randomUUID(),
  };
}

async function login(page, accountValue) {
  await page.goto("/login");
  await page.locator("#login-email").fill(accountValue.email);
  await page.locator("#login-password").fill(password);
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function persistedSnapshot() {
  const [progressRows, setRows] = await Promise.all([
    prisma.lEARNING_PROGRESS.findMany({
      where: { user_id: records.learner.id },
      orderBy: { id: "asc" },
      select: {
        id: true,
        status: true,
        review_count: true,
        revision: true,
        last_event_id: true,
        last_reviewed_at: true,
        updated_at: true,
      },
    }),
    prisma.vOCABULARY_SET.findMany({
      where: { owner_id: records.learner.id },
      orderBy: { id: "asc" },
      select: { id: true, name: true, updated_at: true, _count: { select: { items: true } } },
    }),
  ]);
  return { progressRows, setRows };
}

async function controlledFixtureCount() {
  const userIds = Object.values(records ?? {}).map(({ id }) => id);
  const [users, topics, vocabulary, sets, progressRows, rewards, sessions] = await Promise.all([
    prisma.uSER.count({ where: { email: { endsWith: `@${domain}` } } }),
    prisma.tOPIC.count({ where: { name: { startsWith: prefix } } }),
    prisma.vOCABULARY.count({ where: { word: { startsWith: prefix } } }),
    prisma.vOCABULARY_SET.count({ where: { owner_id: { in: userIds } } }),
    prisma.lEARNING_PROGRESS.count({ where: { user_id: { in: userIds } } }),
    prisma.xP_REWARD.count({ where: { user_id: { in: userIds } } }),
    prisma.aUTH_SESSION.count({ where: { user_id: { in: userIds } } }),
  ]);
  return users + topics + vocabulary + sets + progressRows + rewards + sessions;
}

async function xpSnapshot(userId) {
  const [user, rewards] = await Promise.all([
    prisma.uSER.findUniqueOrThrow({ where: { id: userId }, select: { total_xp: true } }),
    prisma.xP_REWARD.findMany({
      where: { user_id: userId },
      orderBy: { reward_type: "asc" },
      select: { reward_type: true, xp_amount: true },
    }),
  ]);
  return { total_xp: user.total_xp, rewards };
}

function assertLifecycleRows(snapshot) {
  expect(snapshot.total_xp).toBe(53);
  expect(new Set(snapshot.rewards.map(({ reward_type, xp_amount }) => `${reward_type}:${xp_amount}`)))
    .toEqual(new Set(["QUIZ_FIRST_CORRECT:3", "SRS_INITIAL:3"]));
}
