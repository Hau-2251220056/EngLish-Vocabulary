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

test("loading state is accessible and the whole Flashcard shell flips front-back-front", async ({ page }) => {
  await login(page, learner);
  let releaseLoad;
  const loadGate = new Promise((resolve) => { releaseLoad = resolve; });
  await page.route("**/api/learning/sets/*", async (route) => {
    await loadGate;
    await route.continue();
  });

  const learningRequest = page.waitForRequest("**/api/learning/sets/*");
  const navigation = page.goto(`/learn/vocabulary-sets/${systemSet.id}`);
  await learningRequest;
  const loadingHeading = page.getByRole("heading", { name: "Đang chuẩn bị phiên ôn tập" });
  await expect(loadingHeading).toBeVisible();
  const loadingState = loadingHeading.locator("..");
  await expect(loadingState.locator("svg")).toHaveCSS("animation-name", "none");
  releaseLoad();
  await navigation;

  const stage = page.locator(".learning-flip-stage");
  const shell = page.locator(".learning-card-flipper");
  const front = page.locator(".learning-card").first();
  const back = page.locator(".learning-card-back");
  const initialFrame = await shell.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      color: style.borderTopColor,
      width: style.borderTopWidth,
      radius: style.borderTopLeftRadius,
      shadow: style.boxShadow,
      transform: style.transform,
    };
  });
  expect(initialFrame.color).toBe("rgb(185, 220, 246)");
  expect(initialFrame.width).toBe("1px");
  expect(initialFrame.shadow).not.toBe("none");
  expect(initialFrame.radius).not.toBe("0px");
  expect(initialFrame.transform).toBe("none");
  await expect(shell).toHaveCSS("transform-style", "preserve-3d");
  await expect(shell).toHaveCSS("overflow", "visible");
  await expect(stage).toHaveCSS("border-top-width", "0px");
  await expect(stage).toHaveCSS("box-shadow", "none");
  await expect(front).toHaveCSS("border-top-width", "0px");
  await expect(back).toHaveCSS("border-top-width", "0px");
  await expect(front).toHaveCSS("backface-visibility", "hidden");
  await expect(back).toHaveCSS("backface-visibility", "hidden");
  await expect(front).toHaveCSS("position", "relative");
  await expect(back).toHaveCSS("position", "relative");

  await page.keyboard.press("Space");
  await expect(shell).toHaveClass(/is-revealed/);
  await expect.poll(() => shell.evaluate((element) => getComputedStyle(element).transform)).not.toBe(initialFrame.transform);
  await expect(page.getByRole("heading", { name: "nghĩa A1 chính" })).toBeFocused();
  await expect(shell).toHaveCSS("border-top-color", initialFrame.color);
  await expect(shell).toHaveCSS("border-top-width", initialFrame.width);
  await expect(shell).toHaveCSS("border-top-left-radius", initialFrame.radius);
  await expect(shell).toHaveCSS("box-shadow", initialFrame.shadow);
  await expect.poll(() => page.evaluate(() => {
    const flipper = new DOMMatrix(getComputedStyle(document.querySelector(".learning-card-flipper")).transform);
    const back = new DOMMatrix(getComputedStyle(document.querySelector(".learning-card-back")).transform);
    return flipper.multiply(back).m11;
  })).toBeGreaterThan(0.99);

  await page.keyboard.press("Space");
  await expect(shell).not.toHaveClass(/is-revealed/);
  await expect.poll(() => shell.evaluate((element) => getComputedStyle(element).transform)).toBe(initialFrame.transform);
  await expect(page.getByRole("heading", { name: firstVocabulary.word })).toBeFocused();
  await expect(shell).toHaveCSS("border-top-color", initialFrame.color);
  await expect(shell).toHaveCSS("border-top-width", initialFrame.width);
  await expect(shell).toHaveCSS("border-top-left-radius", initialFrame.radius);
  await expect(shell).toHaveCSS("box-shadow", initialFrame.shadow);
});

test("Flashcard keeps focus stable and pronunciation failures do not block NORMAL navigation", async ({ page }) => {
  await login(page, learner);
  await page.goto(`/learn/vocabulary-sets/${systemSet.id}`);
  await page.getByRole("button", { name: "Ôn tập thường" }).click();

  const stage = page.locator(".learning-flip-stage");
  const frontHeading = page.locator("#learning-card-word");
  const meaningHeading = page.locator(".learning-card-back h3");
  const audioError = page.getByText("Không thể phát âm từ này. Bạn vẫn có thể tiếp tục ôn tập.");

  await expect(frontHeading).toBeFocused();
  await expect(frontHeading).toHaveCSS("box-shadow", "none");

  await stage.click();
  await expect(meaningHeading).toBeFocused();
  await expect(meaningHeading).toHaveCSS("box-shadow", "none");
  await expect(page.locator(".learning-card-flipper")).not.toHaveCSS("box-shadow", "none");

  await stage.click();
  await expect(frontHeading).toBeFocused();
  await expect(frontHeading).toHaveCSS("box-shadow", "none");
  await stage.click();
  await expect(meaningHeading).toBeFocused();

  await page.keyboard.press("Space");
  await page.keyboard.press("Space");
  await page.keyboard.press("Space");
  await page.keyboard.press("Space");
  await expect(meaningHeading).toBeFocused();
  await expect(meaningHeading).toHaveCSS("box-shadow", "none");
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: /Thẻ sau/ }).click();
  await expect(page.getByRole("heading", { name: secondVocabulary.word })).toBeFocused();

  await page.locator('.learning-card:not([inert]) button[aria-label^="Phát âm từ"]').click();
  await page.evaluate(() => window.__failCurrentLearningSpeech("synthesis-failed"));
  await expect(audioError).toBeVisible();
});

test("SRS persists revised NEW intervals and AGAIN resumes after three other presentations", async ({
  page,
}) => {
  const extraVocabulary = await Promise.all([
    createVocabulary("gamma", { meanings: [{ part_of_speech: "noun", meaning_vi: "nghĩa thẻ ba", cefr_level: "A1", examples: [{ example_en: "Third card." }] }] }),
    createVocabulary("delta", { meanings: [{ part_of_speech: "noun", meaning_vi: "nghĩa thẻ bốn", cefr_level: "A1", examples: [{ example_en: "Fourth card." }] }] }),
    createVocabulary("epsilon", { meanings: [{ part_of_speech: "noun", meaning_vi: "nghĩa thẻ năm", cefr_level: "A1", examples: [{ example_en: "Fifth card." }] }] }),
  ]);
  const lifecycleSet = await createSetWithVocabularyIds(
    adminRecord.id,
    true,
    "SRS lifecycle",
    [firstVocabulary.id, secondVocabulary.id, ...extraVocabulary.map(({ id }) => id)],
  );
  await login(page, learner);
  await page.goto(`/learn/vocabulary-sets/${lifecycleSet.id}`);

  await expect(page.getByRole("heading", { name: firstVocabulary.word })).toBeFocused();
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: "Lại, Trong phiên này" }).click();
  await expect(page.getByRole("heading", { name: secondVocabulary.word })).toBeFocused();

  let firstProgress = await progressFor(learnerRecord.id, firstVocabulary.id);
  expect(firstProgress).toMatchObject({ status: "LEARNING", interval_days: null, review_count: 1, revision: 1 });
  expect(firstProgress.next_review_at.getTime()).toBe(firstProgress.last_reviewed_at.getTime());

  await page.getByRole("button", { name: "Ôn tập thường" }).click();
  await expect(page.getByText("Thẻ 1 / 5")).toBeVisible();
  await page.getByRole("button", { name: "Ôn tập SRS" }).click();
  expect(await progressFor(learnerRecord.id, firstVocabulary.id)).toEqual(firstProgress);

  await page.reload();
  await expect(page.getByRole("heading", { name: secondVocabulary.word })).toBeFocused();
  for (const vocabulary of [secondVocabulary, ...extraVocabulary.slice(0, 2)]) {
    await expect(page.getByRole("heading", { name: vocabulary.word })).toBeFocused();
    await page.keyboard.press("Space");
    await page.getByRole("button", { name: "Tốt, 1–3 ngày" }).click();
  }

  await expect(page.getByRole("heading", { name: firstVocabulary.word })).toBeFocused();
  const stored = await page.evaluate(() => JSON.parse(
    sessionStorage.getItem([...Object.keys(sessionStorage)].find((key) => key.startsWith("elvocab.learning.run.v1:"))),
  ));
  expect(stored.srs.queue.filter((id) => id === firstVocabulary.id)).toHaveLength(1);

  await page.keyboard.press("Space");
  await page.getByRole("button", { name: "Lại, Trong phiên này" }).click();
  await expect(page.getByRole("heading", { name: extraVocabulary[2].word })).toBeFocused();
  const repeatedAgainState = await page.evaluate(() => JSON.parse(
    sessionStorage.getItem([...Object.keys(sessionStorage)].find((key) => key.startsWith("elvocab.learning.run.v1:"))),
  ));
  expect(repeatedAgainState.srs.queue.filter((id) => id === firstVocabulary.id)).toHaveLength(1);

  await page.keyboard.press("Space");
  await page.getByRole("button", { name: "Dễ, 1 tuần+" }).click();
  await expect(page.getByRole("heading", { name: firstVocabulary.word })).toBeFocused();
  const easyProgress = await progressFor(learnerRecord.id, extraVocabulary[2].id);
  expect(easyProgress).toMatchObject({ status: "LEARNED", interval_days: 7, review_count: 1, revision: 1 });
  expect(easyProgress.next_review_at.getTime() - easyProgress.last_reviewed_at.getTime()).toBe(7 * 86_400_000);

  await page.keyboard.press("Space");
  await page.getByRole("button", { name: "Khó, Ngày mai" }).click();
  await expect(page.getByRole("heading", { name: "Hoàn thành phiên SRS" })).toBeVisible();
  firstProgress = await progressFor(learnerRecord.id, firstVocabulary.id);
  expect(firstProgress).toMatchObject({ status: "LEARNED", interval_days: 1, review_count: 3, revision: 3 });

  const secondProgress = await progressFor(learnerRecord.id, secondVocabulary.id);
  expect(secondProgress).toMatchObject({ status: "LEARNED", interval_days: 3, review_count: 1, revision: 1 });
  expect(secondProgress.next_review_at.getTime() - secondProgress.last_reviewed_at.getTime()).toBe(3 * 86_400_000);
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
  await page.getByRole("button", { name: "Tốt, 1–3 ngày" }).click();

  const alert = page.getByRole("alert");
  await expect(alert).toContainText("Chưa thể ghi nhận đánh giá");
  await expect(page.getByRole("heading", { name: "nghĩa A1 chính" })).toBeVisible();
  await page.getByRole("button", { name: "Thử lại" }).click();
  await expect(alert).toContainText("Phiên SRS đã thay đổi");
  await expect(page.getByRole("button", { name: "Làm mới phiên SRS" })).toBeVisible();
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

test("Flashcard stays centered at a narrower desktop width and preserves responsive front layout", async ({
  page,
}) => {
  await login(page, learner);

  for (const viewport of [
    { name: "desktop", width: 1366, height: 768 },
    { name: "tablet", width: 820, height: 1180 },
    { name: "mobile", width: 390, height: 844 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(`/learn/vocabulary-sets/${systemSet.id}`);
    await expect(page.locator(".learning-flip-stage")).toBeVisible();

    const geometry = await page.evaluate(() => {
      const stage = document.querySelector(".learning-flip-stage").getBoundingClientRect();
      const column = document.querySelector(".learning-flip-stage").parentElement.getBoundingClientRect();
      const content = document.querySelector(".learning-front-content").getBoundingClientRect();
      const stack = document.querySelector(".learning-front-content > div").getBoundingClientRect();
      const hint = [...document.querySelectorAll(".learning-card p")]
        .find((element) => element.textContent.includes("Nhấn hoặc Space"))
        .getBoundingClientRect();
      return {
        stage,
        columnCenterOffset: Math.abs((stage.left + stage.width / 2) - (column.left + column.width / 2)),
        stackCenterOffset: Math.abs((stack.top + stack.height / 2) - (content.top + content.height / 2)),
        hintBottomGap: stage.bottom - hint.bottom,
        overflow: document.documentElement.scrollWidth - window.innerWidth,
      };
    });

    expect(geometry.overflow, viewport.name).toBeLessThanOrEqual(1);
    expect(geometry.columnCenterOffset, viewport.name).toBeLessThanOrEqual(12);
    expect(geometry.stage.width, viewport.name).toBeLessThanOrEqual(viewport.name === "desktop" ? 640 : viewport.width - 24);
    if (viewport.name === "desktop") expect(geometry.stage.height).toBeGreaterThanOrEqual(384);
    else expect(geometry.stage.height).toBeGreaterThanOrEqual(224);
    expect(geometry.stackCenterOffset, viewport.name).toBeLessThanOrEqual(1);
    expect(geometry.hintBottomGap, viewport.name).toBeGreaterThanOrEqual(15);
    expect(geometry.hintBottomGap, viewport.name).toBeLessThanOrEqual(30);
  }
});

test("Flashcard navigation uses expressive actionable colors and neutral disabled states", async ({
  page,
}) => {
  await prisma.lEARNING_PROGRESS.create({
    data: {
      user_id: learnerRecord.id,
      vocabulary_id: firstVocabulary.id,
      status: "LEARNED",
      interval_days: 7,
      next_review_at: new Date(Date.now() + 7 * 86_400_000),
      review_count: 4,
      revision: 4,
      last_reviewed_at: new Date(Date.now() - 86_400_000),
    },
  });
  const before = await progressSnapshot(learnerRecord.id);
  await login(page, learner);
  await page.goto(`/learn/vocabulary-sets/${systemSet.id}`);
  await page.getByRole("button", { name: "Ôn tập thường" }).click();

  const previous = page.getByRole("button", { name: /Thẻ trước/ });
  const next = page.getByRole("button", { name: /Thẻ sau/ });
  await expect(previous).toBeDisabled();
  await expect(previous).toHaveClass(/disabled:bg-slate-100/);
  await expect(previous).toHaveClass(/disabled:!border-slate-200/);
  await expect(previous).toHaveClass(/disabled:text-slate-400/);
  await expect(previous).toHaveCSS("cursor", "not-allowed");
  await expect(next).toBeEnabled();
  await expect(next).toHaveClass(/bg-\[#7ed321\]/);
  await expect(next).toHaveClass(/!border-\[#7ed321\]/);
  await expect(next).toHaveClass(/text-white/);
  await expect(next).toHaveCSS("cursor", "pointer");

  await next.click();
  await expect(previous).toBeEnabled();
  await expect(previous).toHaveClass(/bg-white/);
  await expect(previous).toHaveClass(/!border-\[#f97316\]/);
  await expect(previous).toHaveClass(/text-\[#f97316\]/);
  await expect(previous).toHaveCSS("cursor", "pointer");
  await expect(next).toBeDisabled();
  await expect(next).toHaveClass(/disabled:bg-slate-100/);
  await expect(next).toHaveClass(/disabled:!border-slate-200/);
  await expect(next).toHaveClass(/disabled:text-slate-400/);
  await expect(next).toHaveCSS("cursor", "not-allowed");
  expect(await progressSnapshot(learnerRecord.id)).toEqual(before);
});

test("stable-stage rating, up-to-date and empty states use authoritative persistence", async ({ page }) => {
  const stableSet = await createSetWithVocabularyIds(
    learnerRecord.id,
    false,
    "Stable stage",
    [firstVocabulary.id],
  );
  await prisma.lEARNING_PROGRESS.createMany({
    data: [firstVocabulary, secondVocabulary].map((vocabulary, index) => ({
      user_id: learnerRecord.id,
      vocabulary_id: vocabulary.id,
      status: "LEARNED",
      interval_days: index === 0 ? 3 : 7,
      next_review_at: index === 0
        ? new Date(Date.now() - 60_000)
        : new Date(Date.now() + 7 * 86_400_000),
      review_count: 2,
      revision: 2,
      last_reviewed_at: new Date(Date.now() - 3 * 86_400_000),
    })),
  });
  await login(page, learner);
  await page.goto(`/learn/vocabulary-sets/${stableSet.id}`);
  await expect(page.getByRole("heading", { name: firstVocabulary.word })).toBeFocused();
  await page.keyboard.press("Space");
  await expect(page.getByRole("heading", { name: "nghĩa A1 chính" })).toBeFocused();
  await page.getByRole("button", { name: "Dễ, 2 tuần" }).click();
  await expect(page.getByRole("heading", { name: "Hoàn thành phiên SRS" })).toBeVisible();

  const stable = await progressFor(learnerRecord.id, firstVocabulary.id);
  expect(stable).toMatchObject({ status: "LEARNED", interval_days: 14, review_count: 3, revision: 3 });
  expect(stable.next_review_at.getTime() - stable.last_reviewed_at.getTime()).toBe(14 * 86_400_000);

  await page.goto(`/learn/vocabulary-sets/${stableSet.id}`);
  await expect(page.getByRole("heading", { name: "Bạn đã ôn tập đúng hạn" })).toBeVisible();

  const emptySet = await prisma.vOCABULARY_SET.create({
    data: { owner_id: learnerRecord.id, name: `${prefix} Empty`, is_public: false },
  });
  await page.goto(`/learn/vocabulary-sets/${emptySet.id}`);
  await expect(page.getByRole("heading", { name: "Bộ từ chưa có nội dung" })).toBeVisible();
});

test("exact vocabulary identity survives same spelling, Set reuse and membership removal", async ({ page }) => {
  const sameWord = `${prefix} identity`;
  const [canonical, privateVocabulary] = await Promise.all([
    createVocabulary("identity-canonical", { meanings: [{ part_of_speech: "noun", meaning_vi: "nghĩa chuẩn", cefr_level: "A1", examples: [{ example_en: "Canonical." }] }] }),
    prisma.vOCABULARY.create({
      data: {
        owner_id: learnerRecord.id,
        word: sameWord,
        meanings: { create: { part_of_speech: "noun", meaning_vi: "nghĩa riêng", cefr_level: "A1" } },
      },
    }),
  ]);
  await prisma.vOCABULARY.update({ where: { id: canonical.id }, data: { word: sameWord } });
  const firstSet = await createSetWithVocabularyIds(learnerRecord.id, false, "Identity A", [canonical.id, privateVocabulary.id]);
  const sharedSet = await createSetWithVocabularyIds(learnerRecord.id, false, "Identity B", [canonical.id]);

  await login(page, learner);
  await page.goto(`/learn/vocabulary-sets/${firstSet.id}`);
  await expect(page.getByRole("heading", { name: sameWord, exact: true })).toBeFocused();
  await page.keyboard.press("Space");
  await expect(page.getByRole("heading", { name: "nghĩa chuẩn" })).toBeFocused();
  await page.getByRole("button", { name: "Tốt, 1–3 ngày" }).click();
  await expect.poll(() => prisma.lEARNING_PROGRESS.count({ where: { user_id: learnerRecord.id, vocabulary_id: canonical.id } })).toBe(1);
  expect(await prisma.lEARNING_PROGRESS.count({ where: { user_id: learnerRecord.id, vocabulary_id: privateVocabulary.id } })).toBe(0);

  await page.goto(`/learn/vocabulary-sets/${sharedSet.id}?mode=NORMAL`);
  await page.getByRole("button", { name: "Ôn tập thường" }).click();
  await expect(page.getByText("Thẻ 1 / 1")).toBeVisible();
  await prisma.vOCABULARY_SET_ITEM.delete({
    where: { vocabulary_set_id_vocabulary_id: { vocabulary_set_id: firstSet.id, vocabulary_id: canonical.id } },
  });
  expect(await prisma.lEARNING_PROGRESS.count({ where: { user_id: learnerRecord.id, vocabulary_id: canonical.id } })).toBe(1);
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
      topic_id: isPublic ? topic.id : null,
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

function createSetWithVocabularyIds(ownerId, isPublic, suffix, vocabularyIds) {
  return prisma.vOCABULARY_SET.create({
    data: {
      owner_id: ownerId,
      topic_id: isPublic ? topic.id : null,
      name: `${prefix} ${suffix}`,
      is_public: isPublic,
      items: {
        create: vocabularyIds.map((vocabularyId, index) => ({
          vocabulary_id: vocabularyId,
          position: index + 1,
        })),
      },
    },
  });
}

function progressFor(userId, vocabularyId) {
  return prisma.lEARNING_PROGRESS.findUniqueOrThrow({
    where: { user_id_vocabulary_id: { user_id: userId, vocabulary_id: vocabularyId } },
  });
}

function progressSnapshot(userId) {
  return prisma.lEARNING_PROGRESS.findMany({
    where: { user_id: userId },
    orderBy: { id: "asc" },
    select: {
      id: true,
      vocabulary_id: true,
      status: true,
      interval_days: true,
      next_review_at: true,
      last_reviewed_at: true,
      last_event_id: true,
      review_count: true,
      revision: true,
      updated_at: true,
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
    window.__learningSpeechUtterances = [];
    window.__currentLearningSpeech = null;
    window.__failCurrentLearningSpeech = (error) => {
      window.__currentLearningSpeech?.onerror?.({ error });
    };
    window.__failLearningSpeechAt = (index, error) => {
      window.__learningSpeechUtterances[index]?.onerror?.({ error });
    };
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
        cancel() {
          const utterance = window.__currentLearningSpeech;
          window.__currentLearningSpeech = null;
          utterance?.onerror?.({ error: "canceled" });
        },
        getVoices() {
          return [{ name: "Test English", lang: "en-US", default: true }];
        },
        speak(utterance) {
          window.__learningSpeechCount += 1;
          window.__learningSpeechUtterances.push(utterance);
          window.__currentLearningSpeech = utterance;
        },
      },
    });
  });
}

function speechCount(page) {
  return page.evaluate(() => window.__learningSpeechCount);
}
