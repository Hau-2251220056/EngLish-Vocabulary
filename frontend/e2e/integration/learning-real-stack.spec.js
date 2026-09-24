import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { PrismaClient } from "../../../backend/src/generated/prisma/client.ts";
import { hashPassword } from "../../../backend/src/utils/password-security.js";
import { configureTestEnvironment } from "../../../backend/test/helpers/test-environment.js";

configureTestEnvironment({ requireReset: true });

const prisma = new PrismaClient();
const runId = randomUUID();
const prefix = `E2E-Learning-${runId}`;
const domain = `${runId}.learning.integration.test`;
const password = `Safe-${randomUUID()}`;
const learner = {
  email: `learner@${domain}`,
  display_name: "Learning Browser User",
  role: "USER",
  is_active: true,
};
const administrator = {
  email: `admin@${domain}`,
  display_name: "Learning Browser Admin",
  role: "ADMIN",
  is_active: true,
};
const outsider = {
  email: `outsider@${domain}`,
  display_name: "Learning Browser Outsider",
  role: "USER",
  is_active: true,
};

let learnerRecord;
let adminRecord;
let outsiderRecord;
let topic;
let systemSet;
let ownedSet;
let inaccessibleSet;
let firstVocabulary;
let secondVocabulary;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await prisma.$connect();
  const passwordHash = await hashPassword(password);
  [learnerRecord, adminRecord, outsiderRecord] = await Promise.all([
    prisma.uSER.create({ data: { ...learner, password_hash: passwordHash } }),
    prisma.uSER.create({ data: { ...administrator, password_hash: passwordHash } }),
    prisma.uSER.create({ data: { ...outsider, password_hash: passwordHash } }),
  ]);
  topic = await prisma.tOPIC.create({ data: { name: `${prefix} Topic` } });
  firstVocabulary = await createVocabulary("alpha", {
    phonetic: "/ˈælfə/",
    meanings: [
      {
        part_of_speech: "verb",
        meaning_vi: "nghĩa B2 không được chọn",
        cefr_level: "B2",
        examples: [{ example_en: "Second meaning example." }],
      },
      {
        part_of_speech: "noun",
        meaning_vi: "nghĩa A1 chính",
        context: "Dùng trong ngữ cảnh kiểm thử.",
        cefr_level: "A1",
        examples: [
          {
            example_en: "First deterministic example.",
            example_vi: "Ví dụ xác định đầu tiên.",
          },
          { example_en: "Second hidden example." },
        ],
      },
    ],
  });
  secondVocabulary = await createVocabulary("beta", {
    meanings: [
      {
        part_of_speech: "adjective",
        meaning_vi: "nghĩa thẻ thứ hai",
        cefr_level: "A2",
        examples: [{ example_en: "The second card example." }],
      },
    ],
  });
  [systemSet, ownedSet, inaccessibleSet] = await Promise.all([
    createSet(adminRecord.id, true, "System"),
    createSet(learnerRecord.id, false, "Owned"),
    createSet(outsiderRecord.id, false, "Private"),
  ]);
});

test.afterEach(async () => {
  await prisma.lEARNING_PROGRESS.deleteMany({
    where: {
      user_id: { in: [learnerRecord.id, outsiderRecord.id] },
      vocabulary_id: { in: [firstVocabulary.id, secondVocabulary.id] },
    },
  });
});

test.afterAll(async () => {
  try {
    const accountIds = [learnerRecord?.id, adminRecord?.id, outsiderRecord?.id]
      .filter(Boolean);
    await prisma.lEARNING_PROGRESS.deleteMany({
      where: { user_id: { in: accountIds } },
    });
    await prisma.aUTH_SESSION.deleteMany({
      where: { user_id: { in: accountIds } },
    });
    await prisma.vOCABULARY_SET.deleteMany({
      where: { name: { startsWith: prefix } },
    });
    await prisma.vOCABULARY.deleteMany({
      where: { word: { startsWith: prefix } },
    });
    await prisma.tOPIC.deleteMany({
      where: { name: { startsWith: prefix } },
    });
    await prisma.uSER.deleteMany({
      where: { id: { in: accountIds } },
    });
  } finally {
    await prisma.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await installSpeechSynthesisProbe(page);
});

test("USER completes ordered cards with reveal, outcomes, resume and summary", async ({
  page,
}) => {
  await login(page, learner);
  await page.goto(`/learn/vocabulary-sets/${systemSet.id}`);

  await expect(page.getByRole("status")).toContainText("Đang chuẩn bị phiên học");
  await expect(page.getByRole("heading", { name: firstVocabulary.word })).toBeFocused();
  await expect(page.locator(".authenticated-header")).toHaveCount(0);
  await expect(page.locator(".authenticated-sidebar")).toHaveCount(0);
  await expect(page.locator(".authenticated-footer")).toHaveCount(0);
  await expect(page.getByText("Thẻ 1/2")).toBeVisible();

  await page.getByText("Nhấn hoặc Space để lật thẻ").click();
  await expect(page.getByRole("heading", { name: "nghĩa A1 chính" })).toBeFocused();
  await expect(page.getByText("nghĩa B2 không được chọn")).toHaveCount(0);
  await expect(page.getByText("First deterministic example.")).toBeVisible();
  await expect(page.getByText("Second hidden example.")).toHaveCount(0);
  await expect.poll(() => speechCount(page)).toBe(1);

  const studyAgain = page.getByRole("button", { name: "Học lại" });
  const remembered = page.getByRole("button", { name: "Nhớ rồi" });
  await studyAgain.click();
  await expect(studyAgain).toHaveAttribute("aria-busy", "true");
  await expect(remembered).not.toHaveAttribute("aria-busy", "true");
  await expect(page.getByRole("heading", { name: secondVocabulary.word })).toBeFocused();

  await page.reload();
  await expect(page.getByRole("heading", { name: secondVocabulary.word })).toBeFocused();
  await page.keyboard.press("Space");
  await expect(page.getByRole("heading", { name: "nghĩa thẻ thứ hai" })).toBeFocused();
  await expect.poll(() => speechCount(page)).toBe(1);
  await remembered.click();
  await expect(remembered).toHaveAttribute("aria-busy", "true");
  await expect(studyAgain).not.toHaveAttribute("aria-busy", "true");

  await expect(page.getByRole("heading", { name: systemSet.name })).toBeFocused();
  await expect(page.getByText("Nhớ rồi").last()).toBeVisible();
  await expect(page.getByText("Học lại").last()).toBeVisible();
  await expect(page.getByText("1", { exact: true })).toHaveCount(2);
});

test("Learning preserves retry context, prevents duplicate events and handles conflict", async ({
  page,
}) => {
  await login(page, learner);
  let eventCalls = 0;
  let firstEventId;
  await page.route("**/api/learning/events", async (route) => {
    eventCalls += 1;
    const body = route.request().postDataJSON();
    if (eventCalls === 1) {
      firstEventId = body.event_id;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          error: { code: "INTERNAL_SERVER_ERROR", message: "Safe failure." },
        }),
      });
      return;
    }
    if (eventCalls === 2) {
      expect(body.event_id).toBe(firstEventId);
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          error: {
            code: "LEARNING_PROGRESS_CHANGED",
            message: "Progress changed.",
          },
        }),
      });
      return;
    }
    await route.continue();
  });
  await page.goto(`/learn/vocabulary-sets/${ownedSet.id}`);
  await expect(page.getByRole("heading", { name: firstVocabulary.word })).toBeVisible();
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: "Nhớ rồi" }).click();

  const alert = page.getByRole("alert");
  await expect(alert).toContainText("Chưa thể ghi nhận lựa chọn");
  await expect(page.getByRole("heading", { name: "nghĩa A1 chính" })).toBeVisible();
  await page.getByRole("button", { name: "Thử ghi nhận lại" }).click();
  await expect(alert).toContainText("Tiến độ đã thay đổi");
  await expect(page.getByRole("button", { name: "Làm mới phiên học" })).toBeVisible();
  expect(eventCalls).toBe(2);
});

test("Focus Mode supports safe keyboard, reduced motion and mobile layout", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, learner);
  await page.goto(`/learn/vocabulary-sets/${systemSet.id}`);
  const word = page.getByRole("heading", { name: firstVocabulary.word });
  await expect(word).toBeFocused();

  const speaker = page.getByRole("button", {
    name: `Phát âm từ ${firstVocabulary.word}`,
  });
  await speaker.focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("heading", { name: "nghĩa A1 chính" })).toHaveCount(0);
  await expect.poll(() => speechCount(page)).toBe(1);
  await speaker.click();
  await expect(page.getByRole("heading", { name: firstVocabulary.word })).toBeVisible();
  await expect.poll(() => speechCount(page)).toBe(2);

  await word.focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("heading", { name: "nghĩa A1 chính" })).toBeFocused();
  await page.keyboard.press("Space");
  await expect(word).toBeFocused();
  await expect.poll(() => speechCount(page)).toBe(3);

  const metrics = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - window.innerWidth,
    transitionDuration: getComputedStyle(
      document.querySelector(".learning-card-flipper"),
    ).transitionDuration,
    minTouchHeight: Math.min(
      ...[...document.querySelectorAll(".learning-action-slot button")]
        .map((button) => button.getBoundingClientRect().height),
    ),
  }));
  expect(metrics.overflow).toBeLessThanOrEqual(1);
  expect(metrics.minTouchHeight).toBeGreaterThanOrEqual(44);
  expect(["0s", "0.001s", "0.01s"]).toContain(metrics.transitionDuration);
});

test("Guest, ADMIN and non-owner cannot enter an unauthorized learning run", async ({
  page,
}) => {
  await page.goto(`/learn/vocabulary-sets/${systemSet.id}`);
  await expect(page).toHaveURL(/\/login$/);

  await login(page, administrator);
  await page.goto(`/learn/vocabulary-sets/${systemSet.id}`);
  await expect(page).toHaveURL(/\/dashboard$/);

  await logoutThroughApi(page);
  await login(page, learner);
  await page.goto(`/learn/vocabulary-sets/${inaccessibleSet.id}`);
  await expect(
    page.getByRole("alert").getByRole("heading", {
      name: "Không tìm thấy bộ từ có thể học",
    }),
  ).toBeVisible();
});

async function createVocabulary(suffix, { phonetic = null, meanings }) {
  return prisma.vOCABULARY.create({
    data: {
      word: `${prefix} ${suffix}`,
      phonetic,
      meanings: {
        create: meanings.map((meaning, meaningIndex) => ({
          part_of_speech: meaning.part_of_speech,
          meaning_vi: meaning.meaning_vi,
          context: meaning.context,
          cefr_level: meaning.cefr_level,
          created_at: new Date(Date.UTC(2026, 0, meaningIndex + 1)),
          examples: {
            create: meaning.examples.map((example, exampleIndex) => ({
              ...example,
              created_at: new Date(Date.UTC(2026, 1, exampleIndex + 1)),
            })),
          },
        })),
      },
    },
  });
}

function createSet(ownerId, isPublic, suffix) {
  return prisma.vOCABULARY_SET.create({
    data: {
      owner_id: ownerId,
      topic_id: topic.id,
      name: `${prefix} ${suffix}`,
      is_public: isPublic,
      items: {
        create: [
          { vocabulary_id: firstVocabulary.id, position: 1 },
          { vocabulary_id: secondVocabulary.id, position: 2 },
        ],
      },
    },
  });
}

async function login(page, account) {
  await page.goto("/login");
  await page.locator("#login-email").fill(account.email);
  await page.locator("#login-password").fill(password);
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function logoutThroughApi(page) {
  await page.request.post("/api/auth/logout");
  await page.goto("/login");
}

async function installSpeechSynthesisProbe(page) {
  await page.addInitScript(() => {
    window.__learningSpeechCount = 0;
    window.SpeechSynthesisUtterance = class {
      constructor(text) {
        this.text = text;
        this.lang = "";
        this.voice = null;
      }
    };
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        cancel() {},
        getVoices() {
          return [{ name: "Test English", lang: "en-US", default: true }];
        },
        speak() {
          window.__learningSpeechCount += 1;
        },
      },
    });
  });
}

function speechCount(page) {
  return page.evaluate(() => window.__learningSpeechCount);
}
