import { expect, test } from "@playwright/test";
import { join } from "node:path";
import process from "node:process";
import { installAuthApiMock, publicUser, responses } from "./fixtures/auth-api.js";

const firstNames = ["Nguyễn Đỗ Ánh", "Lê Hoàng Nam", "Ánh"];
const row = (position, mePosition, tied) => ({
  position, rank: tied && position === 2 ? 1 : position,
  display_name: firstNames[position - 1] ?? (position === mePosition ? "Nguyễn Minh Anh" : `Học viên ${position}`),
  avatar_url: null, xp: position === 1 || (tied && position === 2) ? 1_710 : Math.max(1, 1_700 - position),
  current_streak: position === 4 ? 0 : 4, is_me: position === mePosition,
});

function leaderboard(period, page, { total = 24, mePosition = 14, minute = "15", tied = true } = {}) {
  const at = (position) => row(position, mePosition, tied);
  const top = Array.from({ length: Math.min(3, total) }, (_, index) => at(index + 1));
  const offset = (page - 1) * 10;
  const items = Array.from({ length: Math.max(0, Math.min(10, total - offset)) }, (_, index) => at(offset + index + 1));
  return { success: true, data: {
    period, timezone: "Asia/Ho_Chi_Minh", xp_basis: period === "all" ? "lifetime_total" : "period_rewards",
    as_of: `2026-11-27T06:${minute}:00.000Z`,
    window: period === "all" ? { start: null, end: null }
      : period === "weekly" ? { start: "2026-11-22T17:00:00.000Z", end: "2026-11-29T17:00:00.000Z" }
        : { start: "2026-10-31T17:00:00.000Z", end: "2026-11-30T17:00:00.000Z" },
    top, items,
    me: mePosition > total ? { ...at(mePosition), position: null, rank: null, page: null, xp: 0 } : { ...at(mePosition), page: Math.ceil(mePosition / 10) },
    pagination: { page, page_size: 10, total_items: total, total_pages: Math.ceil(total / 10) },
  } };
}

const podium = (page) => page.getByRole("region", { name: "Top 3 người học dẫn đầu" });
const pagination = (page) => page.getByRole("navigation", { name: "Phân trang bảng xếp hạng" });
const podiumWidths = [320, 390, 768, 1440];

async function installMocks(page, handler = (period, current) => ({ json: leaderboard(period, current) })) {
  await installAuthApiMock(page, { "/api/auth/me": responses.currentUser(publicUser) });
  await page.route("**/api/leaderboard?*", async (route) => {
    const params = new URL(route.request().url()).searchParams;
    await route.fulfill(await handler(params.get("period"), Number(params.get("page"))));
  });
}

for (const width of podiumWidths) {
  test(`learner navigation and tied leaderboard fit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const longName = "Lê Hoàng Nam Nguyễn Trần Đặng Phạm Minh Khánh";
    await installMocks(page, (period, current) => {
      const json = leaderboard(period, current);
      json.data.top[1].display_name = longName;
      json.data.items[1].display_name = longName;
      return { json };
    });
    await page.goto("/my/leaderboard");
    await expect(page.getByRole("heading", { name: "Bảng xếp hạng", exact: true })).toBeVisible();
    await expect(page.getByText("Nỗ lực mỗi ngày, chinh phục thứ hạng!")).toBeVisible();
    await expect(page.getByText("23/11/2026 – 29/11/2026")).toBeVisible();
    await expect(page.locator("time")).toHaveText("13:15:00");
    const cards = podium(page).getByRole("listitem");
    await expect(cards).toHaveCount(3);
    await expect(cards.nth(0)).toHaveClass(/border-amber-300/);
    await expect(cards.nth(1)).toHaveClass(/border-amber-300/);
    await expect(cards.nth(2)).toHaveClass(/border-orange-200/);
    await expect(podium(page).getByText("Dẫn đầu", { exact: true })).toHaveCount(2);
    await expect(cards.nth(0).getByText("1.710 XP")).toBeVisible();
    const longNameText = cards.nth(1).getByText(longName, { exact: true });
    await expect(longNameText).toBeVisible();
    await expect(cards.nth(1)).toMatchAriaSnapshot(`- paragraph: "${longName}"`);
    const [first, second, third] = await Promise.all([0, 1, 2].map((index) => cards.nth(index).boundingBox()));
    expect(second.x + second.width).toBeLessThan(first.x);
    expect(first.x + first.width).toBeLessThan(third.x);
    expect(Math.abs(first.width - second.width)).toBeLessThan(1);
    expect(Math.abs(first.width - third.width)).toBeLessThan(1);
    expect(Math.abs(first.y + first.height - second.y - second.height)).toBeLessThan(2);
    expect(Math.abs(first.y + first.height - third.y - third.height)).toBeLessThan(2);
    expect(first.y).toBeLessThan(third.y);
    const leadAvatar = await cards.nth(0).getByText("ĐÁ", { exact: true }).boundingBox();
    const sideAvatar = await cards.nth(2).getByText("ÁN", { exact: true }).boundingBox();
    if (width < 768) {
      expect(first.y).toBeLessThan(second.y);
      expect([leadAvatar.width, sideAvatar.width]).toEqual([44, 40]);
      const truncated = await longNameText.evaluate((item) => getComputedStyle(item).textOverflow === "ellipsis"
        && item.scrollWidth > item.clientWidth);
      expect(truncated).toBe(true);
    } else {
      expect([leadAvatar.width, sideAvatar.width]).toEqual([56, 48]);
    }
    await expect(page.getByRole("table").getByRole("row")).toHaveCount(11);
    await expect(page.getByRole("columnheader", { name: "Chuỗi học" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const weekly = page.getByRole("button", { name: "Tuần này", exact: true });
    await expect(weekly).toHaveAttribute("aria-pressed", "true");
    expect((await weekly.boundingBox()).height).toBeGreaterThanOrEqual(44);
    expect((await pagination(page).getByRole("button", { name: "Trang 1", exact: true }).boundingBox()).width).toBeGreaterThanOrEqual(44);
    const screenshots = process.env.ELVOCAB_LEADERBOARD_SCREENSHOT_DIR;
    if (screenshots && [390, 1440].includes(width)) {
      if (width === 1440) await page.setViewportSize({ width, height: 1520 });
      await page.screenshot({ path: join(screenshots, `leaderboard-${width}.png`), fullPage: true, animations: "disabled" });
      if (width === 1440) await page.setViewportSize({ width, height: 900 });
    }
    if (width < 1024) await page.getByRole("button", { name: "Mở điều hướng" }).click();
    const nav = page.getByRole("navigation", { name: "Điều hướng ứng dụng" });
    await expect(nav.getByRole("link", { name: "Bảng xếp hạng" })).toHaveAttribute("aria-current", "page");
    const labels = await nav.getByRole("link").allTextContents();
    expect(labels.indexOf("Bảng xếp hạng")).toBe(labels.indexOf("Tiến độ học tập") + 1);
  });
}

test("personal rank jumps to page two, period selection resets the page and empty pagination remains", async ({ page }) => {
  await installMocks(page, (period, current) => ({ json: leaderboard(period, current, { total: period === "monthly" ? 0 : 24 }) }));
  await page.goto("/my/leaderboard");
  const personal = page.getByRole("button", { name: "Xem vị trí của tôi" });
  await personal.focus();
  await page.keyboard.press("Enter");
  const mine = page.getByRole("row").filter({ hasText: "Nguyễn Minh Anh" });
  await expect(mine).toBeFocused();
  await expect(mine).toBeInViewport();
  await expect(mine.getByText("Bạn", { exact: true })).toBeVisible();
  await expect(mine.getByRole("cell").first()).toHaveClass(/border-l-sky-500/);
  await expect(page.getByText(/Hiển thị 11–20 trong tổng số 24 người học.*Trang 2 \/ 3/)).toBeVisible();
  await expect(pagination(page).getByRole("button", { name: "Trang 2", exact: true })).toHaveAttribute("aria-current", "page");
  await page.getByRole("button", { name: "Tháng này", exact: true }).click();
  await expect(page.getByText("Chưa xếp hạng")).toBeVisible();
  await expect(page.getByText("Chưa có dữ liệu xếp hạng trong kỳ này")).toBeVisible();
  await expect(page.getByText(/Hiển thị 0 trong tổng số 0 người học.*Trang 1 \/ 1/)).toBeVisible();
  await expect(podium(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Trang trước" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Trang sau" })).toBeDisabled();
});

test("initial and background errors show retry and retain the last successful snapshot", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.clock.install();
  let request = 0;
  let releaseFirst;
  const holdFirst = new Promise((resolve) => { releaseFirst = resolve; });
  let releaseBackground;
  const holdBackground = new Promise((resolve) => { releaseBackground = resolve; });
  await installMocks(page, async (period, current) => {
    request += 1;
    if (request === 1) await holdFirst;
    if (request === 3) await holdBackground;
    if (request === 1 || request === 3) return { status: 500, json: {} };
    return { json: leaderboard(period, current, { minute: request === 2 ? "15" : "16" }) };
  });
  await page.goto("/my/leaderboard");
  await expect(page.getByText("Đang tải bảng xếp hạng")).toBeAttached();
  releaseFirst();
  await expect(page.getByText("Không tải được bảng xếp hạng.")).toBeVisible();
  await page.getByRole("button", { name: "Thử lại" }).click();
  const updated = page.locator("time");
  await expect(updated).toHaveAttribute("datetime", "2026-11-27T06:15:00.000Z");
  const tableY = (await page.getByRole("table").boundingBox()).y;
  await page.clock.fastForward(65_000);
  await expect(page.getByText("Đang cập nhật…", { exact: true })).toBeVisible();
  expect((await page.getByRole("table").boundingBox()).y).toBe(tableY);
  releaseBackground();
  await expect(page.getByText("Chưa thể cập nhật", { exact: true })).toBeVisible();
  await expect(updated).toHaveAttribute("datetime", "2026-11-27T06:15:00.000Z");
  await expect(page.getByRole("table")).toBeVisible();
  await page.getByRole("button", { name: "Thử lại" }).click();
  await expect(updated).toHaveAttribute("datetime", "2026-11-27T06:16:00.000Z");
});

async function announceSessionChange(other) {
  await other.evaluate(() => {
    const channel = new BroadcastChannel("elvocab-auth-session");
    channel.postMessage("session-changed");
    channel.close();
  });
}

test("another tab's auth change discards the personal snapshot before revalidation completes", async ({ page, context }) => {
  let account = publicUser;
  let releaseRecheck;
  const recheck = new Promise((resolve) => { releaseRecheck = resolve; });
  await installAuthApiMock(page, { "/api/auth/me": async () => {
    if (account !== publicUser) await recheck;
    return responses.currentUser(account);
  } });
  await page.route("**/api/leaderboard?*", (route) => {
    return route.fulfill({ json: leaderboard("weekly", 1, { mePosition: account === publicUser ? 11 : 12 }) });
  });
  await page.goto("/my/leaderboard");
  const personal = page.getByRole("region", { name: "Thứ hạng của bạn" });
  await expect(personal.getByText("#11", { exact: true })).toBeVisible();
  const other = await context.newPage();
  await installAuthApiMock(other, { "/api/auth/me": responses.currentUser(publicUser) });
  await other.goto("/login");
  account = { ...publicUser, id: "learner-2" };
  await announceSessionChange(other);
  await expect(personal.getByText("#11", { exact: true })).toHaveCount(0);
  releaseRecheck();
  await page.bringToFront();
  await expect(personal.getByText("#12", { exact: true })).toBeVisible();
});

test("same USER Leaderboard recovers after transient cross-tab auth failure without a reload", async ({ page, context }) => {
  let authReads = 0;
  let leaderboardReads = 0;
  await installAuthApiMock(page, { "/api/auth/me": () => ++authReads === 2
    ? responses.error(503, "AUTH_UNAVAILABLE", "Temporarily unavailable")
    : responses.currentUser(publicUser) });
  await page.route("**/api/leaderboard?*", (route) => route.fulfill({
    json: leaderboard("weekly", 1, { mePosition: ++leaderboardReads === 1 ? 11 : 12 }),
  }));
  await page.goto("/my/leaderboard");
  const personal = page.getByRole("region", { name: "Thứ hạng của bạn" });
  await expect(personal.getByText("#11", { exact: true })).toBeVisible();
  await page.evaluate(() => { window.leaderboardRecoveryMarker = true; });

  const other = await context.newPage();
  await installAuthApiMock(other);
  await other.goto("/login");
  await announceSessionChange(other);
  await page.bringToFront();
  await expect(page.getByText("Không thể xác minh phiên đăng nhập lúc này.")).toBeVisible();
  await expect(personal).toHaveCount(0);
  expect(leaderboardReads).toBe(1);

  await page.getByRole("button", { name: "Thử lại" }).click();
  await expect(page.getByRole("heading", { name: "Bảng xếp hạng" })).toBeVisible();
  expect(authReads).toBe(3);
  await expect(personal.getByText("#12", { exact: true })).toBeVisible();
  expect(leaderboardReads).toBe(2);
  expect(await page.evaluate(() => window.leaderboardRecoveryMarker)).toBe(true);
});

for (const width of podiumWidths) {
  for (const total of [1, 2]) {
    test(`${total} podium cards are centered without placeholder learners at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await installMocks(page, (period, current) => ({ json: leaderboard(period, current, { total, mePosition: 1, tied: false }) }));
      await page.goto("/my/leaderboard");
      const section = podium(page);
      const cards = section.getByRole("listitem");
      await expect(cards).toHaveCount(total);
      const bounds = await section.boundingBox();
      const first = await cards.first().boundingBox();
      const last = await cards.last().boundingBox();
      expect(Math.abs((first.x + last.x + last.width) / 2 - (bounds.x + bounds.width / 2))).toBeLessThan(3);
      if (total === 2) {
        await expect(cards.last()).toHaveClass(/border-slate-300/);
        expect(first.x + first.width).toBeLessThan(last.x);
        expect(Math.abs(first.width - last.width)).toBeLessThan(1);
        expect(Math.abs(first.y + first.height - last.y - last.height)).toBeLessThan(2);
        expect(first.y).toBeLessThan(last.y);
      } else if (width < 768) {
        expect(first.width).toBeLessThanOrEqual(144);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await expect(pagination(page).getByRole("button", { name: "Trang 1", exact: true })).toHaveAttribute("aria-current", "page");
      await expect(pagination(page).getByRole("button", { name: "Trang sau" })).toBeDisabled();
    });
  }
}

test("safe initials are deterministic across cards and the table, including Vietnamese and privacy labels", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  const longName = "Nguyễn ".repeat(8) + "Đặng Ánh";
  await installMocks(page, (period, current) => {
    const json = leaderboard(period, current, { mePosition: 1 });
    for (const learner of [json.data.me, json.data.top[0], json.data.items[0]]) learner.display_name = longName;
    json.data.items[3].display_name = "Học viên 4";
    json.data.items[4].display_name = "ĐiệnBiên".repeat(10);
    return { json };
  });
  await page.goto("/my/leaderboard");
  const initials = page.locator('section[aria-labelledby="leaderboard-title"] [aria-hidden="true"]').filter({ hasText: /^ĐÁ$/ });
  await expect(initials).toHaveCount(3);
  const backgrounds = await initials.evaluateAll((items) => items.map((item) => getComputedStyle(item).backgroundColor));
  expect(new Set(backgrounds).size).toBe(1);
  await expect(podium(page).getByText("ÁN", { exact: true })).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "Học viên 4" }).getByText("HV", { exact: true })).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "Học viên 4" }).getByText("0 ngày")).toBeVisible();
  await expect(page.locator('section[aria-labelledby="leaderboard-title"] img')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test("large page counts use a bounded window and still fit at 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await installMocks(page, (period, current) => ({ json: leaderboard(period, current, { total: 2_500, mePosition: 491 }) }));
  await page.goto("/my/leaderboard");
  await page.getByRole("button", { name: "Xem vị trí của tôi" }).click();
  const controls = pagination(page);
  await expect(controls.getByRole("button", { name: "Trang 50", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(controls.getByRole("button")).toHaveCount(7);
  await expect(controls.getByText("…", { exact: true })).toHaveCount(2);
  await controls.getByRole("button", { name: "Trang 51", exact: true }).click();
  await expect(page.getByText(/Hiển thị 501–510 trong tổng số 2\.500 người học.*Trang 51 \/ 250/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test("rollover failure shows previous dates and keeps the non-dismissible warning", async ({ page }) => {
  await page.clock.install();
  let requests = 0;
  await installMocks(page, (period, current) => {
    if (++requests > 1) return { status: 500, json: {} };
    const json = leaderboard(period, current);
    json.data.as_of = "2026-11-29T16:59:55.000Z";
    return { json };
  });
  await page.goto("/my/leaderboard");
  await expect(page.locator("time")).toHaveText("23:59:55");
  await page.clock.fastForward(6_000);
  await expect(page.getByText("Dữ liệu kỳ trước:", { exact: true })).toBeVisible();
  await expect(page.getByText("23/11/2026 – 29/11/2026")).toBeVisible();
  await expect(page.getByText("Chưa thể cập nhật", { exact: true })).toBeVisible();
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByRole("button", { name: "Đã hiểu" })).toHaveCount(0);
});
