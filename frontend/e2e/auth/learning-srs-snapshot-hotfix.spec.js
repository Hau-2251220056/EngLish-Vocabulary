import { expect, test as base } from "@playwright/test";
import { installAuthApiMock, publicUser, responses } from "./fixtures/auth-api.js";
import { createLearningRunState } from "../../src/learning/learning-run-state.js";

const DEFAULT_TIME_ZONE = "Asia/Ho_Chi_Minh";
const test = base.extend({
  timezoneId: async ({ timezoneId }, applyTimezone) => {
    await applyTimezone(timezoneId ?? DEFAULT_TIME_ZONE);
  },
});

const SET_ID = "0fe7e89b-26fa-409e-8fa5-f9e74480e4a1";
const SESSION_ID = "923277a3-c26a-495b-a6c8-c8c9322777ff";
const REPLACEMENT_ID = "20000000-0000-4000-8000-000000000001";
const NORMAL_SESSION_ID = "20000000-0000-4000-8000-000000000002";
const SNAPSHOT_WORD = "e100dd0a-b9a6-4e4d-b5df-9fe2dc02e6bb";
const OTHER_WORD = "30000000-0000-4000-8000-000000000002";
const DUE_WORD = "30000000-0000-4000-8000-000000000003";
const CREATED = "2026-11-27T13:52:52.661Z";
const EXPIRES = "2026-12-04T13:52:52.661Z";
const EVALUATED = "2026-11-27T14:15:42.249Z";
const NEXT_REVIEW = "2026-11-29T05:34:59.699Z";
const SET_DETAIL = "/my/vocabulary-sets";
const SESSION_KEY = ["elvocab.backend-learning-session.ordinary", "v3", publicUser.id, SET_ID, "SRS_FLASHCARD"].join(":");
const PAGE = "/learn/vocabulary-sets/" + SET_ID;
const RESULT = "Hoàn thành ôn tập";
const RECOVERY = "Tiến độ ôn tập đã thay đổi";
const RECOVER = "Tiếp tục ôn tập";
const JOURNAL = `elvocab.learning.srs-recovery.v1:${publicUser.id}:${SET_ID}:SRS:STANDARD`;

function makeSnapshot({ id = SESSION_ID, state = "ACTIVE", items = [{ vocabulary_id: SNAPSHOT_WORD, position: 0, evidence: null }] } = {}) {
  return {
    id, set_id: SET_ID, scope: "SET", session_intent: "STANDARD", mode: "SRS", state,
    created_at: CREATED, expires_at: EXPIRES, completed_at: state === "COMPLETED" ? EVALUATED : null,
    snapshot_size: items.length, completed_items: items.filter(({ evidence }) => evidence !== null).length,
    can_continue: state === "ACTIVE", items,
  };
}

function makeCards(ids) {
  return ids.map((id, position) => ({
    id, position, word: id === SNAPSHOT_WORD ? "routine" : id === OTHER_WORD ? "other" : "daily",
    phonetic: null, pronunciation_url: null, meanings: [],
    progress: { status: "NEEDS_REVIEW", stored_status: "NEEDS_REVIEW", effective_status: "NEEDS_REVIEW", stage: 1, interval_days: 1, next_review_at: EVALUATED, review_count: 1, revision: 1 },
    rating_previews: {
      AGAIN: { kind: "SESSION_REQUEUE", interval_days: null }, HARD: { kind: "SCHEDULED", interval_days: 1 },
      GOOD: { kind: "SCHEDULED", interval_days: 3 }, EASY: { kind: "SCHEDULED", interval_days: 7 },
    },
  }));
}

async function installFixture(page, {
  due = () => [], snapshot = makeSnapshot(), readOriginal = () => snapshot,
  replacement = makeSnapshot({ id: REPLACEMENT_ID, items: itemsFor([OTHER_WORD]) }),
  conflict = "CEFR_SET_ALREADY_COMPLETED", createRecovery, rate, projectCards = makeCards,
} = {}) {
  const writes = [];
  const passAttempts = [];
  const sessionReads = [];
  const respond = (route, data, status = 200) => route.fulfill({ status, json: { success: true, data } });
  await page.route("**/api/**", (route) => {
    if (route.request().method() !== "GET") writes.push({ unexpected: route.request().method(), path: new URL(route.request().url()).pathname });
    return route.fulfill(responses.error(404, "UNMOCKED", "Offline fixture"));
  });
  await installAuthApiMock(page, { "/api/auth/me": responses.currentUser(publicUser) });
  await page.addInitScript(({ key, setId, stored }) => {
    if (!location.pathname.startsWith("/learn/")) return;
    history.replaceState({ ...history.state, usr: { learningIntent: "OPEN_SRS", returnTo: "/my/vocabulary-sets" } }, "");
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, JSON.stringify({
        version: 3, user_id: "user-1", set_id: setId, mode: "SRS", pass_id: null,
        session_id: stored.id, creation_operation_id: null, expires_at: stored.expires_at,
        cursor_vocabulary_id: stored.items.find(({ evidence }) => evidence === null)?.vocabulary_id ?? stored.items[0].vocabulary_id,
        view_state: stored.state,
      }));
    }
  }, { key: SESSION_KEY, setId: SET_ID, stored: snapshot });
  await page.route("**/api/learning/sets/**", (route) => {
    const mode = new URL(route.request().url()).searchParams.get("mode");
    const ids = mode === "NORMAL" ? [SNAPSHOT_WORD] : due();
    return respond(route, {
      id: SET_ID, name: "Daily Routines", topic: null, mode, evaluated_at: EVALUATED,
      total_items: mode === "NORMAL" ? ids.length : 60, eligible_count: ids.length, cards: projectCards(ids), next_review_at: NEXT_REVIEW,
    });
  });
  await page.route("**/api/learning-path/sets/*/passes", (route) => {
    passAttempts.push(route.request().postDataJSON());
    return route.fulfill(responses.error(409, conflict, conflict === "CEFR_SET_ALREADY_COMPLETED"
      ? "The required Set already has accepted completion." : "Operation identity was reused with a different request."));
  });
  await page.route("**/api/learning-sessions**", (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === "GET") {
      sessionReads.push(path);
      return respond(route, path.endsWith(REPLACEMENT_ID) ? replacement : readOriginal());
    }
    const body = request.postDataJSON();
    writes.push({ method: request.method(), path, body });
    if (body.mode === "SRS" && createRecovery) {
      const projected = { ...replacement };
      delete projected.can_continue;
      return createRecovery(route, body, (replayed = false) => respond(route, {
        session: projected, replayed,
      }, replayed ? 200 : 201));
    }
    if (request.method() !== "POST" || path !== "/api/learning-sessions" || body.mode !== "NORMAL") {
      return route.fulfill(responses.error(500, "UNEXPECTED_MUTATION", "Only explicit NORMAL may create a session here."));
    }
    const normal = makeSnapshot();
    delete normal.can_continue;
    return respond(route, { session: { ...normal, id: NORMAL_SESSION_ID, mode: "NORMAL" }, replayed: false }, 201);
  });
  await page.route("**/api/learning/events", (route) => {
    const body = route.request().postDataJSON();
    writes.push({ method: "POST", path: "/api/learning/events", body });
    if (rate) return rate(route, body, (result) => respond(route, result));
    return route.fulfill(responses.error(503, "MOCK_RATING_STOP", "The mock captured the explicit rating request."));
  });
  return { writes, passAttempts, sessionReads };
}

function itemsFor(ids) {
  return ids.map((vocabulary_id, position) => ({ vocabulary_id, position, evidence: null }));
}

async function expectEmpty(page) {
  await expect(page.getByRole("heading", { name: RESULT, exact: true })).toBeVisible();
  await expect(page.getByText(/Hiện chưa có từ nào đến hạn/)).toBeVisible();
  const timeZone = test.info().project.use.timezoneId ?? DEFAULT_TIME_ZONE;
  // Chromium and Node may ship different locale data. Format the fixture instant in the browser.
  const { nextReview, browserZone, expectedZone } = await page.evaluate(({ instant, timeZone }) => {
    const formatter = new Intl.DateTimeFormat("vi-VN", {
      dateStyle: "medium", timeStyle: "short", timeZone,
    });
    return {
      nextReview: formatter.format(new Date(instant)),
      browserZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      expectedZone: formatter.resolvedOptions().timeZone,
    };
  }, { instant: NEXT_REVIEW, timeZone });
  expect(browserZone).toBe(expectedZone);
  await expect(page.getByText("Lần ôn tập tiếp theo: " + nextReview, { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Học thường", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Quay lại bộ từ", exact: true })).toHaveAttribute("href", SET_DETAIL);
  await expect(page.getByText(/Đã hoàn thành .* trong phiên này/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Học tiếp", exact: true })).toHaveCount(0);
}

test("HF-B Production empty due fixture preserves the ACTIVE snapshot on re-entry", async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 700 });
  const { writes, passAttempts, sessionReads } = await installFixture(page);
  await page.goto(PAGE);
  await expectEmpty(page);
  const stored = await page.evaluate((key) => sessionStorage.getItem(key), SESSION_KEY);
  expect(JSON.parse(stored)).toMatchObject({ session_id: SESSION_ID, cursor_vocabulary_id: SNAPSHOT_WORD, view_state: "ACTIVE" });
  await page.screenshot({ path: info.outputPath("empty-due.png") });
  await page.getByRole("link", { name: "Quay lại bộ từ" }).click();
  await expect(page).toHaveURL(/\/my\/vocabulary-sets$/);
  await page.goto(PAGE);
  await expectEmpty(page);
  expect(await page.evaluate((key) => sessionStorage.getItem(key), SESSION_KEY)).toBe(stored);
  expect(sessionReads).toEqual(Array(2).fill("/api/learning-sessions/" + SESSION_ID));
  expect(passAttempts).toHaveLength(2);
  expect(passAttempts.every(({ operation_id }) => operation_id === passAttempts[0].operation_id)).toBe(true);
  expect(writes).toEqual([]);
});

test("HF-B explicit Học thường opens an ordinary NORMAL session after accepted CEFR completion", async ({ page }) => {
  const { writes } = await installFixture(page);
  await page.goto(PAGE);
  await expectEmpty(page);
  expect(writes).toEqual([]);
  await page.getByRole("button", { name: "Học thường", exact: true }).click();
  await expect(page.getByRole("heading", { name: "routine", exact: true })).toBeVisible();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0]).toEqual({
    method: "POST", path: "/api/learning-sessions",
    body: { set_id: SET_ID, mode: "NORMAL", vocabulary_ids: [SNAPSHOT_WORD], operation_id: expect.any(String) },
  });
});

test("HF-B incompatible nonempty snapshot uses the updated empty due data before creating", async ({ page }, info) => {
  let eligible = [OTHER_WORD];
  const { writes, sessionReads } = await installFixture(page, { due: () => eligible });
  await page.goto(PAGE);
  await expect(page.getByRole("heading", { name: RECOVERY })).toBeFocused();
  await expect(page.getByRole("link", { name: "Quay lại bộ từ" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Không thể tải phiên ôn tập" })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath("snapshot-recovery.png") });
  const stored = await page.evaluate((key) => sessionStorage.getItem(key), SESSION_KEY);
  const retry = page.getByRole("button", { name: RECOVER });
  eligible = [];
  await retry.click();
  await expectEmpty(page);
  expect(sessionReads).toEqual(Array(2).fill("/api/learning-sessions/" + SESSION_ID));
  expect(await page.evaluate((key) => sessionStorage.getItem(key), SESSION_KEY)).toBe(stored);
  expect(writes).toEqual([]);
});

test("HF-B a valid ACTIVE snapshot resumes exact order and evidence with its original ID", async ({ page }) => {
  const snapshot = makeSnapshot({ items: [
    { vocabulary_id: OTHER_WORD, position: 0, evidence: "SRS_GOOD" },
    { vocabulary_id: SNAPSHOT_WORD, position: 1, evidence: null },
    { vocabulary_id: DUE_WORD, position: 2, evidence: null },
  ] });
  const storedRun = createLearningRunState(publicUser.id, SET_ID, {
    cards: makeCards([OTHER_WORD, SNAPSHOT_WORD, DUE_WORD]), evaluated_at: EVALUATED,
  });
  storedRun.srs.queue = [SNAPSHOT_WORD, DUE_WORD];
  storedRun.srs.passed_ids = [OTHER_WORD];
  await page.addInitScript(({ id, state }) => {
    sessionStorage.setItem("elvocab.learning.run.v1:user-1:" + id, JSON.stringify(state));
  }, { id: SET_ID, state: storedRun });
  const { sessionReads, writes } = await installFixture(page, { snapshot, due: () => [DUE_WORD, SNAPSHOT_WORD] });
  await page.goto(PAGE);
  await expect(page.getByRole("heading", { name: "routine", exact: true })).toBeVisible();
  await expect(page.getByText("Đã hoàn thành 1 / 3", { exact: true })).toBeVisible();
  const run = await page.evaluate((id) => JSON.parse(sessionStorage.getItem("elvocab.learning.run.v1:user-1:" + id)), SET_ID);
  expect(run.srs.queue).toEqual([SNAPSHOT_WORD, DUE_WORD]);
  expect(run.srs.passed_ids).toEqual([OTHER_WORD]);
  expect(sessionReads).toEqual(["/api/learning-sessions/" + SESSION_ID]);
  expect(writes).toEqual([]);
  await page.getByRole("heading", { name: "routine", exact: true }).press("Space");
  await page.getByRole("button", { name: "Tốt" }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0]).toMatchObject({ path: "/api/learning/events", body: {
    set_id: SET_ID, session_id: SESSION_ID, vocabulary_id: SNAPSHOT_WORD, rating: "GOOD", expected_revision: 1,
  } });
});

test("HF-B overlapping scheduling can remove a due card without completing its ACTIVE snapshot", async ({ page }) => {
  let eligible = [SNAPSHOT_WORD];
  const { writes, sessionReads } = await installFixture(page, { due: () => eligible });
  await page.goto(PAGE);
  await expect(page.getByRole("heading", { name: "routine", exact: true })).toBeVisible();
  eligible = [];
  await page.reload();
  await expectEmpty(page);
  expect(sessionReads).toEqual(Array(2).fill("/api/learning-sessions/" + SESSION_ID));
  expect(writes).toEqual([]);
});

test("HF-B a genuine COMPLETED snapshot keeps its summary", async ({ page }) => {
  const snapshot = makeSnapshot({ state: "COMPLETED", items: [{ vocabulary_id: SNAPSHOT_WORD, position: 0, evidence: "SRS_GOOD" }] });
  const { writes } = await installFixture(page, { snapshot });
  await page.goto(PAGE);
  await expect(page.getByText("Đã hoàn thành 1 / 1 từ trong phiên này.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Học tiếp" })).toBeVisible();
  expect(writes).toEqual([]);
});

test("HF-B operation conflict still fails without the accepted completion fallback", async ({ page }) => {
  const { sessionReads, writes } = await installFixture(page, { conflict: "CEFR_PASS_OPERATION_CONFLICT" });
  await page.goto(PAGE);
  await expect(page.getByRole("heading", { name: "Không thể tải phiên ôn tập" })).toBeVisible();
  expect(sessionReads).toEqual([]);
  expect(writes).toEqual([]);
});

test("recovery opens the backend-ordered STANDARD batch from current eligible cards", async ({ page }, info) => {
  const freshIds = Array.from({ length: 9 }, (_, index) => `40000000-0000-4000-8000-0000000000${10 + index}`);
  const due = [DUE_WORD, OTHER_WORD, ...freshIds];
  const snapshot = makeSnapshot({ items: [
    ...itemsFor([OTHER_WORD, DUE_WORD, SNAPSHOT_WORD]).map((item, index) => ({
      ...item, evidence: index === 0 ? "SRS_GOOD" : null,
    })),
  ] });
  const backendOrder = [freshIds[0], DUE_WORD, ...freshIds.slice(1)];
  let revision = 1;
  let finishCreate;
  const createGate = new Promise((resolve) => { finishCreate = resolve; });
  const { writes } = await installFixture(page, {
    snapshot, due: () => due,
    replacement: makeSnapshot({ id: REPLACEMENT_ID, items: itemsFor(backendOrder) }),
    projectCards(ids) {
      return makeCards(ids).map((card) => freshIds.includes(card.id) ? {
        ...card, word: `new ${freshIds.indexOf(card.id)}`, progress: {
          ...card.progress,
          status: card.id === freshIds[0] && revision === 8 ? "LEARNING" : "NEW",
          stored_status: card.id === freshIds[0] && revision === 8 ? "LEARNING" : null,
          effective_status: card.id === freshIds[0] && revision === 8 ? "LEARNING" : "NEW",
          stage: 0, interval_days: null, next_review_at: null,
          review_count: revision === 1 ? 0 : 1, revision: revision === 1 ? 0 : revision,
        },
      } : card);
    },
    async createRecovery(_route, _body, respond) {
      await createGate;
      revision = 8;
      return respond();
    },
  });
  await page.goto(PAGE);
  await expect(page.getByRole("heading", { name: RECOVERY })).toBeFocused();
  await expect(page.getByText("Tiến độ từ vựng của bạn đã được cập nhật. Bạn có thể tiếp tục ôn tập theo danh sách từ đến hạn mới nhất.")).toBeVisible();
  const action = page.getByRole("button", { name: RECOVER });
  for (const [width, height] of [[320, 740], [375, 700], [768, 900], [1024, 768], [1440, 900], [667, 375]]) {
    await page.setViewportSize({ width, height });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    expect((await action.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await expect(page.getByRole("link", { name: "Quay lại bộ từ" })).toBeVisible();
  }
  await page.setViewportSize({ width: 320, height: 740 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.screenshot({ path: info.outputPath("recovery-mobile.png") });
  await page.keyboard.press("Tab");
  await expect(action).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(action).toBeDisabled();
  await expect(page.getByRole("status").filter({ hasText: "Đang tải danh sách ôn tập" })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0].body).toEqual({ operation_id: expect.any(String), set_id: SET_ID, mode: "SRS" });
  expect(await page.evaluate((key) => JSON.parse(sessionStorage.getItem(key)).session_id, SESSION_KEY)).toBe(SESSION_ID);
  finishCreate();
  await expect(page.getByRole("heading", { name: "new 0", exact: true })).toBeFocused();
  await expect(page.getByText("Đã hoàn thành 0 / 10", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem(`elvocab.learning.run.v1:user-1:${location.pathname.split("/").at(-1)}`)).srs.queue)).toEqual(backendOrder);
  expect(writes).toHaveLength(1);
  await page.getByRole("heading", { name: "new 0", exact: true }).press("Space");
  await page.getByRole("button", { name: "Tốt" }).click();
  await expect.poll(() => writes.length).toBe(2);
  expect(writes[1].body).toMatchObject({ session_id: REPLACEMENT_ID, vocabulary_id: freshIds[0], expected_revision: 8 });
});

test("recovery resumes the original order and accepted evidence if the queue becomes compatible", async ({ page }) => {
  let due = [DUE_WORD];
  const snapshot = makeSnapshot({ items: [
    ...itemsFor([SNAPSHOT_WORD, DUE_WORD]),
    { ...itemsFor([OTHER_WORD])[0], position: 2, evidence: "SRS_GOOD" },
  ] });
  const run = createLearningRunState(publicUser.id, SET_ID, { cards: makeCards([SNAPSHOT_WORD, DUE_WORD]), evaluated_at: EVALUATED });
  run.srs.queue = [DUE_WORD, SNAPSHOT_WORD];
  await page.addInitScript(({ id, state }) => {
    sessionStorage.setItem("elvocab.learning.run.v1:user-1:" + id, JSON.stringify(state));
  }, { id: SET_ID, state: run });
  const { writes } = await installFixture(page, { due: () => due, snapshot });
  await page.goto(PAGE);
  await expect(page.getByRole("heading", { name: RECOVERY })).toBeFocused();
  due = [SNAPSHOT_WORD, DUE_WORD];
  await page.getByRole("button", { name: RECOVER }).click();
  await expect(page.getByRole("heading", { name: "daily", exact: true })).toBeFocused();
  await expect(page.getByText("Đã hoàn thành 1 / 3", { exact: true })).toBeVisible();
  expect(writes).toEqual([]);
});

for (const scenario of [
  { name: "completed elsewhere", projection: makeSnapshot({ state: "COMPLETED", items: [
    { ...itemsFor([SNAPSHOT_WORD])[0], evidence: "SRS_GOOD" },
  ] }), heading: RESULT },
  { name: "expired", projection: makeSnapshot({ state: "EXPIRED" }), heading: "Phiên SRS đã hết hạn" },
  { name: "membership changed or access was revoked", projection: {
    ...makeSnapshot(), can_continue: false, restart_reason: "SESSION_INACCESSIBLE",
  }, heading: "Không tìm thấy bộ từ có thể học" },
]) {
  test(`recovery rereads original when it ${scenario.name} and creates no session`, async ({ page }) => {
    let original = makeSnapshot();
    const { writes } = await installFixture(page, { due: () => [OTHER_WORD], readOriginal: () => original });
    await page.goto(PAGE);
    await expect(page.getByRole("heading", { name: RECOVERY })).toBeVisible();
    original = scenario.projection;
    await page.getByRole("button", { name: RECOVER }).click();
    await expect(page.getByRole("heading", { name: scenario.heading })).toBeFocused();
    expect(writes).toEqual([]);
  });
}

test("recovery keeps the same UUID across failure before commit, refresh during commit, and replay", async ({ page }) => {
  let sends = 0;
  let finishCommit;
  const commitGate = new Promise((resolve) => { finishCommit = resolve; });
  const { writes } = await installFixture(page, {
    due: () => [OTHER_WORD],
    async createRecovery(route, _body, respond) {
      sends += 1;
      if (sends === 1) return route.abort("timedout");
      if (sends === 2) {
        await commitGate;
        return route.abort("timedout").catch(() => {});
      }
      return respond(true);
    },
  });
  await page.goto(PAGE);
  const action = page.getByRole("button", { name: RECOVER });
  await action.click();
  await expect(page.getByText("Chưa thể tiếp tục ôn tập. Vui lòng thử lại.")).toBeVisible();
  const operationId = writes[0].body.operation_id;
  expect(await page.evaluate((key) => sessionStorage.getItem(key), `${JOURNAL}:create:${SESSION_ID}`)).toBe(operationId);
  await action.click();
  await expect.poll(() => writes.length).toBe(2);
  await page.reload();
  finishCommit();
  await expect(action).toBeEnabled();
  expect(writes).toHaveLength(2);
  await action.click();
  await expect(page.getByRole("heading", { name: "other", exact: true })).toBeFocused();
  expect(writes.map(({ body }) => body.operation_id)).toEqual(Array(3).fill(operationId));
});

test("post-create eligibility changes leave the selected snapshot in recovery without a creation loop", async ({ page }) => {
  let due = [OTHER_WORD];
  const { writes } = await installFixture(page, {
    due: () => due,
    createRecovery(_route, _body, respond) { due = [DUE_WORD]; return respond(); },
  });
  await page.goto(PAGE);
  const action = page.getByRole("button", { name: RECOVER });
  await action.click();
  await expect(action).toBeEnabled();
  expect(await page.evaluate((key) => JSON.parse(sessionStorage.getItem(key)).session_id, SESSION_KEY)).toBe(REPLACEMENT_ID);
  expect(writes).toHaveLength(1);
  await page.reload();
  await expect(action).toBeEnabled();
  expect(writes).toHaveLength(1);
});

test("recovery shows a storage error and never sends create before saving the UUID", async ({ page }) => {
  const { writes } = await installFixture(page, {
    due: () => [OTHER_WORD], createRecovery: (_route, _body, respond) => respond(),
  });
  await page.goto(PAGE);
  const action = page.getByRole("button", { name: RECOVER });
  await expect(action).toBeVisible();
  await page.evaluate((journal) => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith(journal)) throw new DOMException("Storage unavailable", "QuotaExceededError");
      setItem.call(this, key, value);
    };
  }, `${JOURNAL}:create:`);
  await action.click();
  await expect(page.getByText("Chưa thể tiếp tục ôn tập. Vui lòng thử lại.")).toBeVisible();
  await expect(action).toBeEnabled();
  expect(writes).toEqual([]);
  expect(await page.evaluate((key) => JSON.parse(sessionStorage.getItem(key)).session_id, SESSION_KEY)).toBe(SESSION_ID);
  await page.reload();
  await expect(action).toBeEnabled();
  expect(writes).toEqual([]);
  await action.click();
  await expect(page.getByRole("heading", { name: "other", exact: true })).toBeFocused();
  expect(writes).toHaveLength(1);
});

for (const scenario of [
  { source: "Global Review", replayed: true },
  { source: "an overlapping Set", replayed: false },
  { source: "a newer rating in another Set", stale: true },
]) {
  test(`an unresolved AGAIN retries against its original session after ${scenario.source} affects eligibility`, async ({ page }) => {
    let due = [SNAPSHOT_WORD, DUE_WORD];
    const snapshot = makeSnapshot({ items: [
      ...itemsFor([SNAPSHOT_WORD, DUE_WORD]),
      { ...itemsFor([OTHER_WORD])[0], position: 2, evidence: "SRS_GOOD" },
    ] });
    let attempts = 0;
    const { writes } = await installFixture(page, {
      snapshot, due: () => due,
      replacement: makeSnapshot({ id: REPLACEMENT_ID, items: itemsFor([SNAPSHOT_WORD]) }),
      createRecovery: (_route, _body, respond) => respond(),
      rate(route, body, respond) {
        if (++attempts === 1) return route.abort("timedout");
        expect(body.session_id).toBe(SESSION_ID);
        if (scenario.stale) {
          return route.fulfill(responses.error(409, "LEARNING_PROGRESS_CHANGED", "Newer Progress revision"));
        }
        return respond({
          ...makeCards([SNAPSHOT_WORD])[0].progress, status: "LEARNING", stored_status: "LEARNING",
          effective_status: "LEARNING", stage: 0, interval_days: null,
          vocabulary_id: SNAPSHOT_WORD, last_reviewed_at: EVALUATED, revision: 2,
          session: snapshot,
          reward: { source_event_id: body.event_id, xp_earned: 0, replayed: scenario.replayed,
            total_xp: 0, level: 1, level_min_xp: 0, next_level_xp: 50, is_max_level: false },
        });
      },
    });
    await page.goto(PAGE);
    await page.getByRole("heading", { name: "routine", exact: true }).press("Space");
    await page.getByRole("button", { name: "Lại, Trong phiên này", exact: true }).click();
    await expect(page.getByText("Chưa thể ghi nhận đánh giá. Thẻ vẫn được giữ để bạn thử lại.")).toBeVisible();
    // Simulate the response after the other entry point scheduled the shared second word.
    due = [SNAPSHOT_WORD];
    await page.reload();
    await page.getByRole("button", { name: RECOVER }).click();
    await expect(page.getByRole("heading", { name: "routine", exact: true })).toBeFocused();
    await expect(page.getByText("Đã hoàn thành 0 / 1", { exact: true })).toBeVisible();
    expect(writes).toHaveLength(2);
    await page.reload();
    const retry = page.getByRole("button", { name: "Thử lại đánh giá trước đó (Lại)" });
    await expect(retry).toBeVisible();
    await retry.click();
    await expect.poll(() => writes.length).toBe(3);
    expect(writes[2].body).toEqual(writes[0].body);
    await expect(retry).toHaveCount(0);
    if (scenario.stale) {
      await expect(page.getByText("Tiến độ đã thay đổi. Không thể xác nhận lại đánh giá trước đó.")).toBeVisible();
      expect(await page.evaluate((key) => JSON.parse(sessionStorage.getItem(key)), JOURNAL)).toEqual([
        { request: writes[0].body, superseded: true },
      ]);
    }
    expect(await page.evaluate((key) => JSON.parse(sessionStorage.getItem(key)).session_id, SESSION_KEY)).toBe(REPLACEMENT_ID);
  });
}
