import { expect, test } from "@playwright/test";
import { installAuthApiMock, publicAdmin, publicUser, responses } from "./fixtures/auth-api.js";

const root = "/api/users/me/notifications";
const bell = (page) => page.getByRole("button", { name: /^Thông báo,/ });
const panel = (page) => page.getByRole("region", { name: "Thông báo" });
const readAll = (page) => panel(page).getByRole("button", { name: "Đánh dấu tất cả đã đọc" });
const occurred_at = "2026-11-26T00:00:00Z";
const entries = Array.from({ length: 12 }, (_, index) => {
  const type = ["STREAK_INTERRUPTED", "STREAK_MILESTONE", "VOCABULARY_MILESTONE"][index % 3];
  const milestones = type === "STREAK_MILESTONE" ? [3, 7, 14, 30] : [25, 50, 100, 250];
  const threshold = milestones[Math.floor(index / 3)];
  const payload = type === "STREAK_INTERRUPTED" ? {} : type === "STREAK_MILESTONE" ? { days: threshold } : { started: threshold };
  return { id: String(index), type, payload, occurred_at, read_at: null };
});

async function installInbox(page, { role = publicUser, rows = entries, initialCount = null } = {}) {
  await installAuthApiMock(page, { "/api/auth/me": responses.currentUser(role) });
  const items = rows.map((item) => ({ ...item }));
  const calls = [];
  const faults = { refresh: false, list: false, read: false, gate: null };
  const count = () => initialCount ?? items.filter((item) => !item.read_at).length;
  await page.route((url) => url.pathname.startsWith(root), async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const suffix = url.pathname.slice(root.length);
    calls.push({ method, suffix, limit: url.searchParams.get("limit") });
    if (suffix === "/refresh" && faults.gate) await faults.gate;
    if ((suffix === "/refresh" && faults.refresh) || (method === "GET" && faults.list)
      || ((method === "PATCH" || suffix === "/read-all") && faults.read)) {
      return route.fulfill({ status: 503, json: { success: false } });
    }
    let data;
    if (method === "PATCH") {
      const item = items.find((row) => row.id === suffix.split("/")[1]);
      item.read_at ??= occurred_at;
      data = { id: item.id, read_at: item.read_at, unread_count: count() };
    } else if (suffix === "/read-all") {
      for (const item of items) item.read_at ??= occurred_at;
      data = { read_at: occurred_at, unread_count: count() };
    } else {
      const offset = Number(url.searchParams.get("cursor") ?? 0);
      const end = offset + Number(url.searchParams.get("limit") ?? 3);
      const has_more = items.length > end;
      data = { items: items.slice(offset, end), unread_count: count(), has_more, next_cursor: has_more ? String(end) : null };
    }
    await route.fulfill({ json: { success: true, data } });
  });
  return { calls, faults };
}

for (const width of [320, 390, 768, 1440]) {
  test(`learner inbox placement and viewport constraints at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 720 });
    await installInbox(page);
    await page.goto("/dashboard");
    const avatar = page.getByRole("button", { name: /^Mở menu tài khoản/ });
    if (width < 1024) {
      await expect(avatar).toBeHidden();
      await expect(page.getByRole("button", { name: "Mở điều hướng" })).toBeVisible();
    } else {
      await expect(avatar).toBeVisible();
      expect((await bell(page).boundingBox()).x < (await avatar.boundingBox()).x).toBe(true);
    }
    expect((await bell(page).boundingBox()).width).toBeGreaterThanOrEqual(44);
    await bell(page).click();
    await expect(panel(page)).toBeVisible();
    await expect(panel(page).getByRole("listitem")).toHaveCount(3);
    const list = panel(page).locator(".learner-notification-list");
    expect(await list.evaluate((element) => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(1);
    const box = await panel(page).boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(box.y + box.height).toBeLessThanOrEqual(720);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    if (width === 320 || width === 1440) {
      await page.screenshot({ path: testInfo.outputPath(`inbox-${width}.png`) });
    }
    const close = panel(page).getByRole("button", { name: "Đóng thông báo" });
    await expect(close).toBeFocused();
    await expect(close).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(close).toHaveCSS("border-top-width", "0px");
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(close).toBeFocused();
    await expect(close).toHaveCSS("outline-style", "solid");
    const closeBox = await close.boundingBox();
    expect(closeBox.width).toBeGreaterThanOrEqual(44);
    expect(closeBox.height).toBeGreaterThanOrEqual(44);
    for (const count of [6, 9, 12]) {
      await panel(page).getByRole("button", { name: "Xem thêm" }).click();
      await expect(panel(page).getByRole("listitem")).toHaveCount(count);
    }
    const expanded = await panel(page).boundingBox();
    expect(expanded.height).toBeGreaterThan(box.height);
    expect(expanded.y + expanded.height).toBeLessThanOrEqual(720);
    expect(await list.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
    await expect(close).toBeInViewport();
    await page.keyboard.press("Escape");
    await expect(panel(page)).toBeHidden();
    await expect(bell(page)).toBeFocused();
  });
}

test("read one, preserve cached pages, append three and mark unloaded items read", async ({ page }) => {
  const { calls } = await installInbox(page);
  await page.goto("/dashboard");
  await expect(bell(page)).toHaveAccessibleName("Thông báo, 12 chưa đọc");
  await bell(page).click();
  await expect(panel(page).getByRole("listitem")).toHaveCount(3);
  expect(calls.filter((call) => call.method === "PATCH")).toHaveLength(0);
  const first = panel(page).getByRole("listitem").first().getByRole("button");
  await first.click();
  await expect(first).toHaveAccessibleName(/đã đọc/);
  await expect(bell(page)).toHaveAccessibleName("Thông báo, 11 chưa đọc");
  await panel(page).getByRole("button", { name: "Xem thêm" }).click();
  await expect(panel(page).getByRole("listitem")).toHaveCount(6);
  await panel(page).getByRole("button", { name: "Đóng thông báo" }).press("Enter");
  await expect(bell(page)).toBeFocused();
  await bell(page).click();
  await expect(panel(page).getByRole("listitem")).toHaveCount(6);
  await readAll(page).click();
  await expect(readAll(page)).toBeDisabled();
  await expect(bell(page)).toHaveAccessibleName("Thông báo, 0 chưa đọc");
  await expect(page.locator(".learner-notification-badge")).toHaveCount(0);
  await panel(page).getByRole("button", { name: "Xem thêm" }).click();
  await expect(panel(page).getByRole("listitem")).toHaveCount(9);
  await panel(page).getByRole("button", { name: "Xem thêm" }).click();
  await expect(panel(page).getByRole("listitem")).toHaveCount(12);
  await expect(panel(page).getByRole("button", { name: "Xem thêm" })).toHaveCount(0);
  await expect(panel(page).getByRole("button", { name: /chưa đọc/ })).toHaveCount(0);
  expect(calls.filter((call) => call.method === "PATCH")).toHaveLength(1);
  expect(calls.filter((call) => ["/refresh", ""].includes(call.suffix)).every((call) => call.limit === "3")).toBe(true);
  await page.locator("header").getByRole("link", { name: "Về trang chủ ELVocab" }).dispatchEvent("pointerdown");
  await expect(panel(page)).toBeHidden();
});

test("loading, unknown, empty, failure and retry states are content safe", async ({ page }) => {
  const { faults } = await installInbox(page, { rows: [] });
  let release;
  faults.gate = new Promise((resolve) => { release = resolve; });
  faults.refresh = true;
  await page.goto("/dashboard");
  try {
    await bell(page).click();
    await expect(bell(page)).toHaveAccessibleName(/chưa có dữ liệu/);
    await expect(panel(page).getByRole("status", { name: "Đang tải thông báo" })).toBeVisible();
    await expect(panel(page).locator(".learner-notification-skeleton > div")).toHaveCount(3);
  } finally { release(); }
  await expect(panel(page).getByText("Không thể tải thông báo.")).toBeVisible();
  faults.refresh = false;
  await panel(page).getByRole("button", { name: "Thử lại" }).click();
  await expect(panel(page).getByText("Chưa có thông báo.")).toBeVisible();
  await expect(panel(page).getByRole("button", { name: "Xem thêm" })).toHaveCount(0);
});

test("badge caps at 99+ and background, pagination and read failures preserve content", async ({ page }) => {
  const { faults } = await installInbox(page, { initialCount: 104 });
  await page.goto("/dashboard");
  await expect(bell(page)).toHaveAccessibleName("Thông báo, 104 chưa đọc");
  await expect(page.locator(".learner-notification-badge")).toHaveText("99+");
  await bell(page).click();
  await expect(panel(page).getByRole("listitem")).toHaveCount(3);
  faults.read = true;
  await panel(page).getByRole("listitem").first().getByRole("button").click();
  await expect(panel(page).getByText(/Không thể đánh dấu/)).toBeVisible();
  faults.list = true;
  await panel(page).getByRole("button", { name: "Xem thêm" }).click();
  await expect(panel(page).getByText(/Không thể tải thêm/)).toBeVisible();
  await expect(panel(page).getByRole("listitem")).toHaveCount(3);
  faults.refresh = true;
  await panel(page).getByRole("button", { name: "Đóng thông báo" }).click();
  await page.evaluate(() => window.dispatchEvent(new Event("elvocab:learner-notifications-stale")));
  await bell(page).click();
  await expect(panel(page).getByText("Không thể làm mới.")).toBeVisible();
  await expect(panel(page).getByRole("listitem")).toHaveCount(3);
  await expect(bell(page)).toHaveAccessibleName("Thông báo, 104 chưa đọc");
  faults.list = false;
  await panel(page).getByRole("button", { name: "Xem thêm" }).click();
  await expect(panel(page).getByRole("listitem")).toHaveCount(6);
});

test("ADMIN does not mount the learner inbox", async ({ page }) => {
  const { calls } = await installInbox(page, { role: publicAdmin });
  await page.goto("/admin/topics");
  await expect(bell(page)).toHaveCount(0);
  expect(calls).toHaveLength(0);
});

test("active learning focus routes do not mount the learner inbox", async ({ page }) => {
  const { calls } = await installInbox(page);
  await page.route("**/api/learning/sets/**", (route) => route.fulfill({
    status: 503, json: { success: false, error: { message: "Offline fixture." } },
  }));
  await page.goto("/learn/vocabulary-sets/demo-set");
  await expect(page.locator(".learning-focus-shell")).toBeVisible();
  await expect(bell(page)).toHaveCount(0);
  expect(calls).toHaveLength(0);
});
