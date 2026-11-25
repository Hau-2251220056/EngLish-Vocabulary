import { expect, test } from "@playwright/test";
import { installAuthApiMock, publicAdmin, publicUser, responses } from "./fixtures/auth-api.js";

const users = [
  account("00000000-0000-4000-8000-000000000001", "An Nguyễn", "an@example.test", "USER", "2026-03-03T00:00:00.000Z", 4),
  account("00000000-0000-4000-8000-000000000002", "System Admin", "admin@example.test", "ADMIN", "2026-03-02T00:00:00.000Z", null),
  account("00000000-0000-4000-8000-000000000003", "Người dùng có tên hiển thị rất dài để kiểm tra giao diện", "long-address-for-responsive-testing@example.test", "USER", "2026-03-01T00:00:00.000Z", 0),
];

test("ADMIN views server list and read-only detail with keyboard focus restoration", async ({ page }) => {
  await installAuthApiMock(page, { "/api/auth/me": responses.currentUser(publicAdmin) });
  const calls = await mockUsersApi(page);
  await page.goto("/admin/users");

  await expect(page.getByRole("heading", { name: "Quản lý người dùng" })).toBeVisible();
  await expect(page.getByRole("table", { name: "Danh sách tài khoản người dùng" })).toBeVisible();
  await expect(page.getByText("An Nguyễn", { exact: true })).toBeVisible();
  await expect(page.getByText("System Admin", { exact: true })).toBeVisible();
  await expect(page.getByRole("columnheader")).toHaveText(["Người dùng", "Email", "Vai trò", "Chuỗi học", "Ngày tạo", "Chi tiết"]);
  await expect(page.getByLabel("Chuỗi học hiện tại 4 ngày")).toBeVisible();
  await expect(page.getByLabel("Chuỗi học hiện tại 0 ngày")).toBeVisible();
  await expect(page.getByLabel("Chuỗi học không áp dụng cho quản trị viên")).toHaveText("—");
  await expect(page.getByRole("navigation", { name: "Phân trang" })).toContainText("Hiển thị 1–3 / 3 kết quả");
  const detailTrigger = page.getByRole("button", { name: "Xem chi tiết An Nguyễn" });
  await detailTrigger.focus();
  await detailTrigger.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Thông tin tài khoản người dùng" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("an@example.test")).toBeVisible();
  await expect(dialog.getByText("Đang hoạt động")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Đóng hộp thoại" })).toBeFocused();
  await page.screenshot({ fullPage: true, path: "test-results/admin-users-detail.png" });
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(detailTrigger).toBeFocused();
  expect(calls.filter((call) => call.method !== "GET")).toEqual([]);
  expect(calls.filter((call) => call.pathname === "/api/admin/users")).toHaveLength(1);
});

test("missing or invalid USER streak is explicit unavailable rather than zero", async ({ page }) => {
  await installAuthApiMock(page, { "/api/auth/me": responses.currentUser(publicAdmin) });
  const missing = { ...users[0] };
  delete missing.current_streak;
  await page.route("**/api/admin/users**", (route) => {
    return route.fulfill(listResponse([missing, { ...users[2], current_streak: -1 }], 1, 2));
  });
  await page.goto("/admin/users");
  await expect(page.getByText("Không khả dụng", { exact: true })).toHaveCount(2);
  await expect(page.getByLabel(/Chuỗi học hiện tại 0 ngày/)).toHaveCount(0);
});

test("search debounce, role filter, pagination reset, and stale response protection use server metadata", async ({ page }) => {
  await installAuthApiMock(page, { "/api/auth/me": responses.currentUser(publicAdmin) });
  const calls = [];
  await page.route("**/api/admin/users**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname !== "/api/admin/users") return route.fallback();
    calls.push(url.search);
    const query = url.searchParams.get("query") ?? "";
    const role = url.searchParams.get("role") ?? "";
    const currentPage = Number(url.searchParams.get("page"));
    if (query === "slow") await new Promise((resolve) => setTimeout(resolve, 500));
    if (query === "Admin") return route.fulfill(listResponse([users[1]], 1, 1));
    if (query === "slow") return route.fulfill(listResponse([users[0]], 1, 1));
    const filtered = role ? users.filter((user) => user.role === role) : users;
    return route.fulfill(listResponse(filtered, currentPage, 41));
  });
  await page.goto("/admin/users");
  await expect(page.getByText("An Nguyễn", { exact: true })).toBeVisible();
  await expect.poll(() => calls.some((search) => search.includes("page_size=10"))).toBe(true);

  await page.getByRole("button", { name: "Sau" }).click();
  await expect.poll(() => calls.some((search) => search.includes("page=2"))).toBe(true);
  await page.getByLabel("Vai trò").selectOption("ADMIN");
  await expect.poll(() => calls.some((search) => search.includes("page=1") && search.includes("role=ADMIN"))).toBe(true);

  const search = page.getByLabel("Tìm kiếm người dùng");
  await search.fill("slow");
  await page.waitForTimeout(350);
  await search.fill("Admin");
  await expect(page.getByText("System Admin", { exact: true })).toBeVisible();
  await page.waitForTimeout(550);
  await expect(page.getByText("System Admin", { exact: true })).toBeVisible();
  await expect(page.getByText("An Nguyễn", { exact: true })).toHaveCount(0);
  expect(calls.filter((searchValue) => searchValue.includes("query=")).length).toBe(2);
});

test("out-of-range server metadata clamps once to the last valid page", async ({ page }) => {
  await installAuthApiMock(page, { "/api/auth/me": responses.currentUser(publicAdmin) });
  const requestedPages = [];
  await page.route("**/api/admin/users**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname !== "/api/admin/users") return route.fallback();
    const requestedPage = Number(url.searchParams.get("page"));
    requestedPages.push(requestedPage);
    if (requestedPage === 1 && requestedPages.length === 1) return route.fulfill(listResponse(users, 1, 11));
    if (requestedPage === 2) return route.fulfill(listResponse([], 2, 3));
    return route.fulfill(listResponse(users, 1, 3));
  });
  await page.goto("/admin/users");
  await page.getByRole("button", { name: "Sau" }).click();
  await expect.poll(() => requestedPages).toEqual([1, 2, 1]);
  await expect(page.getByRole("navigation", { name: "Phân trang" })).toContainText("Trang 1/1");
  await expect(page.getByRole("button", { name: "Trước" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Sau" })).toBeDisabled();
});

test("loading, error retry, empty state, and detail retry remain usable", async ({ page }) => {
  await installAuthApiMock(page, { "/api/auth/me": responses.currentUser(publicAdmin) });
  let listAttempts = 0;
  let detailAttempts = 0;
  await page.route("**/api/admin/users**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/admin/users") {
      listAttempts += 1;
      if (listAttempts === 1) return route.fulfill({ status: 500, json: { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "raw" } } });
      if (url.searchParams.get("query") === "none") return route.fulfill(listResponse([], 1, 0));
      return route.fulfill(listResponse([users[0]], 1, 1));
    }
    detailAttempts += 1;
    if (detailAttempts === 1) return route.fulfill({ status: 404, json: { success: false, error: { code: "USER_NOT_FOUND", message: "raw" } } });
    return route.fulfill(detailResponse(users[0]));
  });
  await page.goto("/admin/users");
  await expect(page.getByRole("heading", { name: "Không thể tải người dùng" })).toBeVisible();
  await page.getByRole("button", { name: "Thử lại" }).click();
  await expect(page.getByText("An Nguyễn", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Xem chi tiết An Nguyễn" }).click();
  const dialog = page.getByRole("dialog", { name: "Thông tin tài khoản người dùng" });
  await expect(dialog.getByRole("heading", { name: "Không thể tải chi tiết" })).toBeVisible();
  await dialog.getByRole("button", { name: "Thử lại" }).click();
  await expect(dialog.getByText("Đang hoạt động")).toBeVisible();
  await dialog.getByRole("button", { name: "Đóng", exact: true }).click();
  await page.getByLabel("Tìm kiếm người dùng").fill("none");
  await expect(page.getByRole("heading", { name: "Không tìm thấy tài khoản" })).toBeVisible();
});

test("route guards and responsive layouts protect private email data", async ({ page }) => {
  await installAuthApiMock(page, { "/api/auth/me": responses.currentUser(publicUser) });
  let userApiCalls = 0;
  await page.route("**/api/admin/users**", (route) => { userApiCalls += 1; return route.abort(); });
  await page.goto("/admin/users");
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(userApiCalls).toBe(0);

  await page.unrouteAll({ behavior: "wait" });
  await installAuthApiMock(page);
  await page.route("**/api/admin/users**", (route) => { userApiCalls += 1; return route.abort(); });
  await page.goto("/admin/users");
  await expect(page).toHaveURL(/\/login$/);
  expect(userApiCalls).toBe(0);
});

for (const width of [1440, 768, 390, 320]) {
  test(`User Management remains responsive at ${width}px`, async ({ page }) => {
    await installAuthApiMock(page, { "/api/auth/me": responses.currentUser(publicAdmin) });
    await mockUsersApi(page);
    await page.setViewportSize({ width, height: width <= 390 ? 760 : 900 });
    await page.goto("/admin/users");
    await expect(page.getByText(users[2].display_name, { exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ fullPage: true, path: `test-results/admin-users-${width}.png` });
  });
}

async function mockUsersApi(page) {
  const calls = [];
  await page.route("**/api/admin/users**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    calls.push({ method: request.method(), pathname: url.pathname });
    if (url.pathname === "/api/admin/users") return route.fulfill(listResponse(users, 1, users.length));
    const user = users.find((item) => url.pathname.endsWith(item.id));
    return user ? route.fulfill(detailResponse(user)) : route.fulfill({ status: 404, json: { success: false, error: { code: "USER_NOT_FOUND" } } });
  });
  return calls;
}

function listResponse(items, page, total) {
  return { status: 200, json: { success: true, data: { items, pagination: { page, page_size: 10, total_items: total, total_pages: total ? Math.ceil(total / 10) : 0 }, filters: { query: null, role: null } } } };
}

function detailResponse(user) {
  return { status: 200, json: { success: true, data: { ...user, updated_at: "2026-03-04T00:00:00.000Z" } } };
}

function account(id, display_name, email, role, created_at, current_streak) {
  return { id, display_name, email, avatar_url: null, role, is_active: true, created_at, current_streak };
}
