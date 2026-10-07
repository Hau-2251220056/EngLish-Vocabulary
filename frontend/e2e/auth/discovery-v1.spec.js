import { expect, test } from "@playwright/test";
import { installAuthApiMock, publicAdmin, publicUser, responses } from "./fixtures/auth-api.js";

const topics = [
  { id: "topic-travel", name: "Du lịch", description: "Từ vựng du lịch" },
  { id: "topic-work", name: "Công việc", description: "Từ vựng công việc" },
];
const sets = {
  "topic-travel": [
    { id: "set-airport", name: "Sân bay cơ bản", description: "Giao tiếp khi đi máy bay", item_count: 12, topic_id: "topic-travel" },
    { id: "set-hotel", name: "Khách sạn", description: null, item_count: 8, topic_id: "topic-travel" },
  ],
  "topic-work": [
    { id: "set-office", name: "Văn phòng", description: "Daily work phrases", item_count: 10, topic_id: "topic-work" },
  ],
};

test("Guest gets a complete Set-first catalog with search, Topic filter and public actions", async ({ page }) => {
  const api = await installDiscoveryApi(page);
  await installAuthApiMock(page);
  await page.goto("/topics");

  await expect(page.locator("#topic-list-title")).toBeAttached();
  await expect(page.getByRole("list", { name: "Danh sách bộ từ hệ thống" }).getByRole("listitem")).toHaveCount(3);
  await expect(page.getByText("Chưa có mô tả cho bộ từ này.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Đăng nhập để lưu" })).toHaveCount(3);
  await expect(page.getByRole("button", { name: "Lưu" })).toHaveCount(0);
  const initialCatalogRequests = api.catalogRequests();

  await page.getByRole("searchbox", { name: "Tìm kiếm bộ từ" }).fill("  DAILY WORK ");
  await expect(page.getByRole("heading", { name: "Văn phòng" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sân bay cơ bản" })).toHaveCount(0);
  expect(api.catalogRequests()).toBe(initialCatalogRequests);

  await page.getByRole("radio", { name: "Du lịch" }).check();
  await expect(page.getByRole("heading", { name: "Không tìm thấy bộ từ phù hợp" })).toBeVisible();
  await page.getByRole("button", { name: "Xóa bộ lọc" }).click();
  await expect(page.getByRole("listitem")).toHaveCount(3);

  await page.getByRole("link", { name: "Xem", exact: true }).first().focus();
  await expect(page.getByRole("link", { name: "Xem", exact: true }).first()).toBeFocused();
  await page.getByRole("link", { name: "Đăng nhập để lưu" }).first().click();
  await expect(page).toHaveURL(/\/login$/);
});

test("catalog paginates nine items client-side and resets after search or Topic filtering", async ({ page }) => {
  const featuredSet = { id: "featured-manual", name: "E2E-DISCOVERY-MANUAL- Featured", description: "E2E-DISCOVERY-MANUAL- preview", item_count: 20, topic_id: "topic-travel" };
  const travelSets = Array.from({ length: 10 }, (_, index) => ({ id: `travel-${index + 1}`, name: `Travel Set ${index + 1}`, description: `Travel description ${index + 1}`, item_count: index + 1, topic_id: "topic-travel" }));
  const workSets = Array.from({ length: 2 }, (_, index) => ({ id: `work-${index + 1}`, name: `Work Set ${index + 1}`, description: `Work description ${index + 1}`, item_count: index + 1, topic_id: "topic-work" }));
  const api = await installDiscoveryApi(page, { setHandler: (route, topicId) => route.fulfill(ok(topicId === "topic-travel" ? [featuredSet, ...travelSets] : workSets)) });
  await installAuthApiMock(page);
  await page.goto("/topics");

  const list = page.getByRole("list", { name: "Danh sách bộ từ hệ thống" });
  await expect(page.getByRole("heading", { name: "Bộ từ nổi bật" })).toBeVisible();
  await expect(page.locator(".discovery-featured").getByRole("heading", { name: featuredSet.name })).toBeVisible();
  await expect(list.getByRole("heading", { name: featuredSet.name })).toHaveCount(0);
  await expect(list.getByRole("listitem")).toHaveCount(9);
  await expect(page.getByText("1 / 2", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Trước" })).toBeDisabled();
  const initialRequests = api.catalogRequests();
  await page.getByRole("button", { name: "Sau" }).click();
  await expect(list.getByRole("listitem")).toHaveCount(3);
  await expect(page.getByText("2 / 2", { exact: true })).toBeVisible();
  expect(api.catalogRequests()).toBe(initialRequests);

  await page.getByRole("searchbox", { name: "Tìm kiếm bộ từ" }).fill("Travel Set 10");
  await expect(page.getByText("1 / 1", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Travel Set 10" })).toBeVisible();
  await page.getByRole("button", { name: "Xóa bộ lọc" }).click();
  await page.getByRole("button", { name: "Sau" }).click();
  await page.getByRole("radio", { name: "Công việc" }).check();
  await expect(page.getByText("1 / 1", { exact: true })).toBeVisible();
  await expect(list.getByRole("listitem")).toHaveCount(2);
  expect(api.catalogRequests()).toBe(initialRequests);
});

test("catalog withholds partial data, retries atomically, and distinguishes global empty", async ({ page }) => {
  let failWork = true;
  await installAuthApiMock(page);
  await installDiscoveryApi(page, {
    setHandler: async (route, topicId) => {
      if (topicId === "topic-work" && failWork) {
        await route.fulfill({ status: 500, json: { success: false } });
        return;
      }
      await route.fulfill(ok(sets[topicId]));
    },
  });
  await page.goto("/topics");
  await expect(page.getByRole("alert")).toContainText("Danh mục chưa đầy đủ");
  await expect(page.getByText("Sân bay cơ bản")).toHaveCount(0);
  failWork = false;
  await page.getByRole("button", { name: "Thử lại" }).click();
  await expect(page.getByRole("heading", { name: "Sân bay cơ bản" })).toBeVisible();

  await page.route("**/api/topics", (route) => route.fulfill(ok([])));
  await page.reload();
  await expect(page.getByRole("heading", { name: "Chưa có bộ từ để khám phá" })).toBeVisible();
});

test("authenticated USER stays in App Shell and copy is single-pending, retryable, and navigates to the private Set", async ({ page }) => {
  let copyCalls = 0;
  let resolveCopy;
  await installDiscoveryApi(page, {
    copyHandler: async (route) => {
      copyCalls += 1;
      if (copyCalls === 1) {
        await route.fulfill({ status: 500, json: { success: false } });
        return;
      }
      await new Promise((resolve) => { resolveCopy = resolve; });
      await route.fulfill(ok({ id: "copied-set", name: "Bản sao", description: null, items: [] }));
    },
  });
  await installAuthApiMock(page, { "/api/auth/me": responses.currentUser(publicUser) });
  await page.goto("/topics");

  await expect(page.locator(".authenticated-app")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Điều hướng ứng dụng" }).getByRole("link", { name: "Khám phá bộ từ" })).toHaveClass(/is-active/);
  const save = page.getByRole("article").filter({ hasText: "Sân bay cơ bản" }).getByRole("button", { name: "Lưu" });
  await save.click();
  await expect(page.getByRole("alert")).toContainText("Không thể lưu bộ từ");
  await page.getByRole("button", { name: "Thử lưu lại" }).click();
  await expect(page.getByRole("button", { name: "Đang lưu…" })).toBeDisabled();
  expect(copyCalls).toBe(2);
  resolveCopy();
  await expect(page).toHaveURL(/\/my\/vocabulary-sets\/copied-set$/);
  await page.goto("/topics");
  const saved = page.getByRole("article").filter({ hasText: "Sân bay cơ bản" }).getByRole("button", { name: "Đã lưu" });
  await expect(saved).toBeEnabled();
  await page.reload();
  await expect(page.getByRole("article").filter({ hasText: "Sân bay cơ bản" }).getByRole("button", { name: "Đã lưu" })).toBeEnabled();
});

test("authenticated USER can learn or quiz a public Set without copying and retains an independent Save action", async ({ page }) => {
  await installDiscoveryApi(page);
  await installAuthApiMock(page, { "/api/auth/me": responses.currentUser(publicUser) });
  await page.goto("/topics");
  await page.getByRole("article").filter({ hasText: "Sân bay cơ bản" }).getByRole("link", { name: "Xem" }).click();

  await expect(page).toHaveURL(/\/vocabulary-sets\/set-airport$/);
  await expect(page.locator(".authenticated-app")).toBeVisible();
  const learningActions = page.getByRole("region", { name: "Bắt đầu học" });
  await expect(learningActions.getByRole("link", { name: /Thẻ ghi nhớ/ })).toHaveAttribute("href", "/learn/vocabulary-sets/set-airport");
  await expect(learningActions.getByRole("link", { name: /Quiz/ })).toHaveAttribute("href", "/quiz/vocabulary-sets/set-airport");
  await expect(page.getByRole("button", { name: "Lưu vào Bộ từ của tôi" })).toBeVisible();
  await expect(page.getByText("Học trực tiếp từ bộ từ công khai")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Chỉnh sửa|Xóa|Thêm từ/ })).toHaveCount(0);
});

test("Guest public detail stays read-only and prompts login for authenticated actions", async ({ page }) => {
  await installDiscoveryApi(page);
  await installAuthApiMock(page);
  await page.goto("/vocabulary-sets/set-airport");
  await expect(page.getByRole("heading", { name: "Sân bay cơ bản" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Đăng nhập để học và lưu" })).toHaveAttribute("href", "/login");
  await expect(page.getByRole("link", { name: /Thẻ ghi nhớ|Quiz/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Sao chép|Chỉnh sửa|Xóa|Thêm từ/ })).toHaveCount(0);
});

test("ADMIN browses in App Shell without learner or management actions", async ({ page }) => {
  await installDiscoveryApi(page);
  await installAuthApiMock(page, { "/api/auth/me": responses.currentUser(publicAdmin) });
  await page.goto("/topics");
  await expect(page.locator(".authenticated-app")).toBeVisible();
  await expect(page.locator("#topic-list-title")).toBeAttached();
  await expect(page.getByRole("button", { name: /Lưu/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Đăng nhập để lưu" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Học|Quiz/ })).toHaveCount(0);
});

for (const width of [375, 390, 768, 820, 1366, 1536]) {
  test(`Discovery remains usable without horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 600 ? 812 : 900 });
    await installDiscoveryApi(page);
    await installAuthApiMock(page);
    await page.goto("/topics");
    await expect(page.locator("#topic-list-title")).toBeAttached();
    await expect.poll(() => page.evaluate(() => ({
      body: document.body.scrollWidth - document.body.clientWidth,
      document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }))).toEqual({ body: 0, document: 0 });
  });
}

async function installDiscoveryApi(page, { copyHandler, setHandler } = {}) {
  let catalogRequestCount = 0;
  await page.route("**/api/topics", async (route) => {
    catalogRequestCount += 1;
    await route.fulfill(ok(topics));
  });
  await page.route(/\/api\/topics\/[^/]+\/vocabulary-sets$/, async (route) => {
    catalogRequestCount += 1;
    const topicId = decodeURIComponent(new URL(route.request().url()).pathname.split("/")[3]);
    if (setHandler) await setHandler(route, topicId);
    else await route.fulfill(ok(sets[topicId] ?? []));
  });
  await page.route(/\/api\/vocabulary-sets\/[^/]+$/, async (route) => {
    const setId = decodeURIComponent(new URL(route.request().url()).pathname.split("/").at(-1));
    const summary = Object.values(sets).flat().find((set) => set.id === setId);
    if (!summary) {
      await route.fulfill({ status: 404, json: { success: false, error: { code: "VOCABULARY_SET_NOT_FOUND" } } });
      return;
    }
    await route.fulfill(ok({
      ...summary,
      items: [
        { id: "item-1", position: 1, word: "passport", phonetic: "/ˈpɑːspɔːrt/" },
        { id: "item-2", position: 2, word: "luggage", phonetic: null },
      ],
    }));
  });
  await page.route("**/api/vocabulary-sets/*/copy", async (route) => {
    if (copyHandler) await copyHandler(route);
    else await route.fulfill(ok({ id: "copied-set", name: "Bản sao", items: [] }));
  });
  await page.route("**/api/my/vocabulary-sets/copied-set", (route) => route.fulfill(ok({ id: "copied-set", name: "Bản sao", description: null, items: [] })));
  return { catalogRequests: () => catalogRequestCount };
}

function ok(data) {
  return { status: 200, json: { success: true, data } };
}
