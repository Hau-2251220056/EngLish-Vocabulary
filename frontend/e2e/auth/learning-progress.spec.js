import { expect, test } from "@playwright/test";
import {
  installAuthApiMock,
  publicUser,
  responses,
} from "./fixtures/auth-api.js";

test.beforeEach(async ({ page }) => {
  await installAuthApiMock(page, {
    "/api/auth/me": responses.currentUser(publicUser),
  });
});

test("renders loading then the server-authoritative populated view accessibly", async ({ page }) => {
  const pending = deferred();
  await installProgressMock(page, () => pending.promise);

  await page.goto("/my/learning-progress");
  await expect(page.getByRole("status")).toContainText("Đang tải tiến độ học tập");
  await expect(page.getByText("Bạn chưa có tiến độ học tập")).toHaveCount(0);

  pending.resolve(success(populatedPage()));
  await expect(page.getByRole("region", { name: "Tóm tắt tiến độ" })).toBeVisible();
  await expect(page.locator(".learning-progress-summary-card")).toHaveCount(4);
  await expect(page.getByText("Tổng đã bắt đầu").locator("..")).toContainText("25");
  await expect(page.getByText("Đang học", { exact: true }).first().locator("..")).toContainText("9");
  await expect(page.getByText("Đã thuộc", { exact: true }).first().locator("..")).toContainText("14");
  await expect(page.getByText("Cần ôn", { exact: true }).first().locator("..")).toContainText("2");

  const list = page.getByRole("list", { name: "Danh sách tiến độ từ vựng" });
  await expect(list.getByRole("listitem")).toHaveCount(2);
  await expect(list).toContainText("Đã ôn 5 lần");
  await expect(list).not.toContainText("Đã học 5 lần");
  await expect(list.getByRole("link")).toHaveCount(0);
  await expect(list.getByRole("button")).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "Trạng thái" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Phân trang tiến độ" })).toBeVisible();
});

test("renders first-use empty and reduced-motion loading without premature content", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 375, height: 812 });
  const pending = deferred();
  await installProgressMock(page, () => pending.promise);

  await page.goto("/my/learning-progress");
  await expect(page.locator(".learning-progress-loading-cards span").first()).toHaveCSS(
    "animation-name",
    "none",
  );
  pending.resolve(success(emptyPage()));

  await expect(page.getByRole("heading", { name: "Bạn chưa có tiến độ học tập" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Trạng thái" })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Phân trang tiến độ" })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test("renders a safe error and retries from the keyboard", async ({ page }) => {
  let fail = true;
  const retryResponse = deferred();
  await installProgressMock(page, () =>
    fail
      ? { status: 500, json: { success: false, error: { code: "INTERNAL_SERVER_ERROR" } } }
      : retryResponse.promise,
  );

  await page.goto("/my/learning-progress");
  const alert = page.getByRole("alert");
  await expect(alert).toContainText("Không thể tải tiến độ học tập");
  const retry = page.getByRole("button", { name: "Thử lại" });
  await retry.focus();
  await expect(retry).toBeFocused();
  fail = false;
  await page.keyboard.press("Enter");

  await expect(page.getByRole("status")).toContainText("Đang tải tiến độ học tập");
  retryResponse.resolve(success(populatedPage()));
  await expect(page.getByRole("list", { name: "Danh sách tiến độ từ vựng" })).toBeVisible();
  await expect(alert).toHaveCount(0);
});

test("filters, paginates, blocks duplicate pending actions and handles empty pages", async ({ page }) => {
  const pageTwo = deferred();
  const filtered = deferred();
  const calls = [];
  await installProgressMock(page, ({ page: requestedPage, status }) => {
    calls.push({ page: requestedPage, status });
    if (status === "NEEDS_REVIEW") return filtered.promise;
    if (requestedPage === "2") return pageTwo.promise;
    return success(populatedPage());
  });

  await page.goto("/my/learning-progress");
  const next = page.getByRole("button", { name: "Trang sau" });
  await next.focus();
  await page.keyboard.press("Enter");
  await expect(next).toBeDisabled();
  await expect(page.getByRole("combobox", { name: "Trạng thái" })).toBeDisabled();
  expect(calls.filter(({ page: requestedPage }) => requestedPage === "2")).toHaveLength(1);

  pageTwo.resolve(success(populatedPage({ page: 2, items: [progressItem("page-two", "LEARNING", 3)] })));
  await expect(page.getByText("page-two", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Trang trước" })).toBeFocused();

  const filter = page.getByRole("combobox", { name: "Trạng thái" });
  await filter.selectOption("NEEDS_REVIEW");
  await expect(filter).toBeDisabled();
  expect(calls.at(-1)).toEqual({ page: "1", status: "NEEDS_REVIEW" });
  filtered.resolve(success(filteredEmptyPage()));

  await expect(page.getByRole("heading", { name: "Không có từ vựng phù hợp" })).toBeVisible();
  const clear = page.getByRole("button", { name: "Xóa bộ lọc" });
  await clear.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("list", { name: "Danh sách tiến độ từ vựng" })).toBeVisible();
});

test("renders an out-of-range page truthfully with usable previous navigation", async ({ page }) => {
  await installProgressMock(page, ({ page: requestedPage }) =>
    success(
      requestedPage === "8"
        ? outOfRangePage()
        : populatedPage({ page: 7, totalPages: 8 }),
    ),
  );

  await page.goto("/my/learning-progress");
  await page.getByRole("button", { name: "Trang sau" }).click();

  await expect(page.getByRole("heading", { name: "Trang này chưa có từ vựng" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Trang trước" })).toBeEnabled();
  await expect(page.getByText("Trang 8 / 3")).toBeVisible();
});

test("ignores a stale response after route unmount", async ({ page }) => {
  const stale = deferred();
  let useStaleResponse = true;
  await installProgressMock(page, () =>
    useStaleResponse
      ? stale.promise
      : success(populatedPage({ items: [progressItem("fresh-word", "LEARNED", 4)] })),
  );

  await page.goto("/my/learning-progress");
  await expect(page.getByRole("status")).toBeVisible();
  await page.getByRole("link", { name: "Dashboard" }).click();
  useStaleResponse = false;
  stale.resolve(success(populatedPage({ items: [progressItem("stale-word", "LEARNING", 1)] })));
  await page.getByRole("link", { name: "Tiến độ học tập" }).click();

  await expect(page.getByText("fresh-word", { exact: true })).toBeVisible();
  await expect(page.getByText("stale-word", { exact: true })).toHaveCount(0);
});

async function installProgressMock(page, handler) {
  await page.route("**/api/learning/progress**", async (route) => {
    const url = new URL(route.request().url());
    const response = await handler({
      page: url.searchParams.get("page"),
      pageSize: url.searchParams.get("page_size"),
      status: url.searchParams.get("status"),
    });
    await route.fulfill(response);
  });
}

function success(data) {
  return { status: 200, json: { success: true, data } };
}

function populatedPage({ page = 1, totalPages = 2, items } = {}) {
  return {
    summary: { total_started: 25, learning: 9, learned: 14, needs_review: 2 },
    items: items ?? [
      progressItem("achieve", "LEARNED", 5),
      progressItem("abandon", "LEARNING", 2, null),
    ],
    pagination: { page, page_size: 20, total_items: 25, total_pages: totalPages },
    filter: { status: null },
  };
}

function emptyPage() {
  return {
    summary: { total_started: 0, learning: 0, learned: 0, needs_review: 0 },
    items: [],
    pagination: { page: 1, page_size: 20, total_items: 0, total_pages: 0 },
    filter: { status: null },
  };
}

function filteredEmptyPage() {
  return {
    summary: { total_started: 25, learning: 9, learned: 14, needs_review: 2 },
    items: [],
    pagination: { page: 1, page_size: 20, total_items: 0, total_pages: 0 },
    filter: { status: "NEEDS_REVIEW" },
  };
}

function outOfRangePage() {
  return {
    summary: { total_started: 25, learning: 9, learned: 14, needs_review: 2 },
    items: [],
    pagination: { page: 8, page_size: 20, total_items: 25, total_pages: 3 },
    filter: { status: null },
  };
}

function progressItem(word, status, reviewCount, lastReviewedAt = "2026-09-24T00:00:00.000Z") {
  return {
    vocabulary: { id: `vocabulary-${word}`, word, phonetic: `/${word}/` },
    status,
    review_count: reviewCount,
    last_reviewed_at: lastReviewedAt,
  };
}

function deferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

async function expectNoHorizontalOverflow(page) {
  await expect
    .poll(() =>
      page.evaluate(() => ({
        body: document.body.scrollWidth - document.body.clientWidth,
        document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      })),
    )
    .toEqual({ body: 0, document: 0 });
}
