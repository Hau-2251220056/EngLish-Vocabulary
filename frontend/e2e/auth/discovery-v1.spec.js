import { expect, test } from "@playwright/test";
import { Buffer } from "node:buffer";
import { installAuthApiMock, publicAdmin, publicUser, responses } from "./fixtures/auth-api.js";

const topics = [
  { id: "topic-travel", name: "Du lịch", description: "Từ vựng du lịch" },
  { id: "topic-work", name: "Công việc", description: "Từ vựng công việc" },
];
const catalogFeaturedSets = [
  { id: "set-featured-1", name: "Everyday English", description: "Common vocabulary for daily life", cefr_level: "A1", cover_image_url: null, item_count: 15, topic_id: "topic-travel" },
  { id: "set-featured-2", name: "Essential Conversations", description: "Useful phrases for conversations", cefr_level: "A2", cover_image_url: null, item_count: 18, topic_id: "topic-travel" },
  { id: "set-featured-3", name: "Travel Essentials", description: "Vocabulary for confident travel", cefr_level: "B1", cover_image_url: null, item_count: 21, topic_id: "topic-travel" },
];
const manyTopics = [
  ...topics,
  ...Array.from({ length: 22 }, (_, index) => ({
    id: `topic-extra-${index + 1}`,
    name: index === 21 ? "Chủ đề cuối cùng với tên dài để xác nhận nhãn hiển thị an toàn" : `Chủ đề bổ sung ${index + 1}`,
    description: null,
  })),
];
const sets = {
  "topic-travel": [
    ...catalogFeaturedSets,
    { id: "set-airport", name: "Sân bay cơ bản", description: "Giao tiếp khi đi máy bay", cefr_level: "A1", cover_image_url: "https://covers.example.test/airport.webp", item_count: 12, topic_id: "topic-travel" },
    { id: "set-hotel", name: "Khách sạn", description: null, cefr_level: null, cover_image_url: null, item_count: 8, topic_id: "topic-travel" },
  ],
  "topic-work": [
    { id: "set-office", name: "Văn phòng", description: "Daily work phrases", cefr_level: "B1", cover_image_url: "https://covers.example.test/broken.webp", item_count: 10, topic_id: "topic-work" },
  ],
};

test("Guest gets a complete Set-first catalog with search, Topic filter and public actions", async ({ page }) => {
  const api = await installDiscoveryApi(page);
  await installAuthApiMock(page);
  await page.goto("/topics");

  await expect(page.locator("#topic-list-title")).toBeAttached();
  const normalList = page.getByRole("list", { name: "Danh sách bộ từ hệ thống" });
  await expect(page.getByRole("heading", { name: "Bộ từ nổi bật" })).toBeVisible();
  await expect(page.locator(".discovery-featured").getByRole("listitem")).toHaveCount(3);
  await expect(normalList.getByRole("listitem")).toHaveCount(3);
  await expect(page.getByRole("button", { name: "Xóa bộ lọc" })).toBeDisabled();
  await expect(page.getByText("Chưa có mô tả cho bộ từ này.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Đăng nhập để lưu" })).toHaveCount(6);
  await expect(page.getByRole("button", { name: "Lưu" })).toHaveCount(0);
  const initialCatalogRequests = api.catalogRequests();

  await page.getByRole("searchbox", { name: "Tìm kiếm bộ từ" }).fill("  DAILY WORK ");
  await expect(page.getByRole("heading", { name: "Văn phòng" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sân bay cơ bản" })).toHaveCount(0);
  expect(api.catalogRequests()).toBe(initialCatalogRequests);

  await page.getByRole("radio", { name: "Du lịch" }).check();
  await expect(page.getByRole("heading", { name: "Không tìm thấy bộ từ phù hợp" })).toBeVisible();
  await page.getByRole("button", { name: "Xóa bộ lọc" }).click();
  await expect(normalList.getByRole("listitem")).toHaveCount(3);

  await page.getByRole("link", { name: "Xem", exact: true }).first().focus();
  await expect(page.getByRole("link", { name: "Xem", exact: true }).first()).toBeFocused();
  await page.getByRole("link", { name: "Đăng nhập để lưu" }).first().click();
  await expect(page).toHaveURL(/\/login$/);
});

test("catalog paginates nine items client-side and resets after search, Topic, or CEFR filtering", async ({ page }) => {
  const featuredSets = [
    { id: "featured-1", name: "Travel Starter", description: "Ordinary catalog entry", cefr_level: "A2", cover_image_url: "https://covers.example.test/airport.webp", item_count: 20, topic_id: "topic-travel" },
    { id: "featured-2", name: "Useful Travel Phrases", description: "Ordinary catalog entry", cefr_level: "A1", cover_image_url: null, item_count: 18, topic_id: "topic-travel" },
    { id: "featured-3", name: "Travel Confidence", description: "Ordinary catalog entry", cefr_level: "B1", cover_image_url: null, item_count: 16, topic_id: "topic-travel" },
  ];
  const travelSets = Array.from({ length: 10 }, (_, index) => ({ id: `travel-${index + 1}`, name: `Travel Set ${index + 1}`, description: `Travel description ${index + 1}`, cefr_level: index === 9 ? "B1" : "A1", cover_image_url: null, item_count: index + 1, topic_id: "topic-travel" }));
  const workSets = Array.from({ length: 2 }, (_, index) => ({ id: `work-${index + 1}`, name: `Work Set ${index + 1}`, description: `Work description ${index + 1}`, item_count: index + 1, topic_id: "topic-work" }));
  const api = await installDiscoveryApi(page, { setHandler: (route, topicId) => route.fulfill(ok(topicId === "topic-travel" ? [...featuredSets, ...travelSets] : workSets)) });
  await installAuthApiMock(page);
  await page.goto("/topics");

  const list = page.getByRole("list", { name: "Danh sách bộ từ hệ thống" });
  await expect(page.getByRole("heading", { name: "Bộ từ nổi bật" })).toBeVisible();
  await expect(page.locator(".discovery-featured").getByRole("listitem")).toHaveCount(3);
  await expect(page.locator(".discovery-featured").getByRole("heading", { name: featuredSets[0].name })).toBeVisible();
  await expect(page.locator(".discovery-featured").locator('[data-cover-state="persisted"] img')).toHaveAttribute("src", featuredSets[0].cover_image_url);
  for (const featuredSet of featuredSets) {
    await expect(list.getByRole("heading", { name: featuredSet.name })).toHaveCount(0);
  }
  await expect(list.getByRole("listitem")).toHaveCount(9);
  await expect(page.getByText("1 / 2", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Trước" })).toBeDisabled();
  const initialRequests = api.catalogRequests();
  await page.getByRole("button", { name: "Sau" }).click();
  await expect(list.getByRole("listitem")).toHaveCount(3);
  await expect(page.getByText("2 / 2", { exact: true })).toBeVisible();
  expect(api.catalogRequests()).toBe(initialRequests);

  const reset = page.getByRole("button", { name: "Xóa bộ lọc" });
  await expect(reset).toBeDisabled();
  await page.getByRole("searchbox", { name: "Tìm kiếm bộ từ" }).fill("Travel Set 10");
  await expect(reset).toBeEnabled();
  await reset.click();
  await expect(page.getByRole("searchbox", { name: "Tìm kiếm bộ từ" })).toHaveValue("");
  await expect(reset).toBeDisabled();
  await page.getByRole("radio", { name: "Công việc" }).check();
  await expect(reset).toBeEnabled();
  await reset.click();
  await expect(page.getByRole("radio", { name: "Tất cả chủ đề" })).toBeChecked();
  await expect(reset).toBeDisabled();
  const cefrSelect = page.getByLabel("Trình độ CEFR");
  const cefrWrapper = cefrSelect.locator("..");
  await expect(cefrSelect).toHaveCSS("appearance", "none");
  await expect(cefrWrapper.locator("svg")).toHaveAttribute("aria-hidden", "true");
  await expect(cefrWrapper.locator("svg")).toHaveCSS("pointer-events", "none");
  const spacing = await cefrWrapper.evaluate((wrapper) => {
    const select = wrapper.querySelector("select");
    const icon = wrapper.querySelector("svg");
    return {
      iconRight: wrapper.getBoundingClientRect().right - icon.getBoundingClientRect().right,
      paddingRight: Number.parseFloat(getComputedStyle(select).paddingRight),
    };
  });
  expect(spacing.paddingRight).toBeGreaterThanOrEqual(spacing.iconRight + 16);
  await cefrSelect.focus();
  await cefrSelect.press("ArrowDown");
  await expect(cefrSelect).toHaveValue("A1");
  expect(api.catalogRequests()).toBe(initialRequests);
  await cefrSelect.selectOption("B1");
  await expect(reset).toBeEnabled();
  await expect(page.getByText("1 / 1", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Travel Set 10" })).toBeVisible();
  await reset.click();
  await expect(cefrSelect).toHaveValue("");
  await expect(page.getByText("1 / 2", { exact: true })).toBeVisible();
  await expect(reset).toBeDisabled();
  expect(api.catalogRequests()).toBe(initialRequests);
  await page.getByRole("button", { name: "Sau" }).click();

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

test("many Topics stay inside a keyboard-usable viewport-bounded scroll region", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const api = await installDiscoveryApi(page, { topicList: manyTopics });
  await installAuthApiMock(page);
  await page.goto("/topics");

  const options = page.locator(".discovery-topic-options");
  const sidebar = page.locator(".discovery-filter-sidebar");
  await expect(options).toHaveCSS("overflow-y", "auto");
  await expect.poll(() => options.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  const sidebarBox = await sidebar.boundingBox();
  expect(sidebarBox.height).toBeLessThan(736);

  const firstTopic = page.getByRole("radio", { name: "Du lịch" });
  const lastTopic = page.getByRole("radio", { name: "Chủ đề cuối cùng với tên dài để xác nhận nhãn hiển thị an toàn" });
  const readyRequests = api.catalogRequests();
  await firstTopic.focus();
  await expect(firstTopic).toBeFocused();
  await lastTopic.check();
  await expect(lastTopic).toBeChecked();
  await expect.poll(() => options.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await lastTopic.press("ArrowUp");
  await expect(page.getByRole("radio", { name: "Chủ đề bổ sung 21" })).toBeChecked();
  expect(api.catalogRequests()).toBe(readyRequests);
});

test("CEFR composes with Topic and search locally while persisted covers fall back once", async ({ page }) => {
  const api = await installDiscoveryApi(page);
  await installAuthApiMock(page);
  await page.goto("/topics");

  const airportCard = page.getByRole("article").filter({ hasText: "Sân bay cơ bản" });
  await expect(airportCard.locator('[data-cover-state="persisted"] img')).toHaveAttribute("src", "https://covers.example.test/airport.webp");
  const coverGeometry = await airportCard.locator('[data-cover-state="persisted"]').evaluate((cover) => ({
    height: cover.getBoundingClientRect().height,
    objectFit: getComputedStyle(cover.querySelector("img")).objectFit,
    overflow: getComputedStyle(cover).overflow,
  }));
  expect(coverGeometry.height).toBeGreaterThanOrEqual(112);
  expect(coverGeometry.objectFit).toBe("cover");
  expect(coverGeometry.overflow).toBe("hidden");
  const officeCard = page.getByRole("article").filter({ hasText: "Văn phòng" });
  await expect(officeCard.locator('[data-cover-state="fallback"]')).toBeVisible();
  await expect(airportCard.getByText("A1", { exact: true })).toBeVisible();
  await expect(officeCard.getByText("B1", { exact: true })).toBeVisible();
  const legacyCard = page.getByRole("article").filter({ hasText: "Khách sạn" });
  await expect(legacyCard.locator(".set-cefr-badge")).toHaveCount(0);
  await expect(legacyCard.locator('[data-cover-state="fallback"]')).toBeVisible();

  const initialRequests = api.catalogRequests();
  await page.getByLabel("Trình độ CEFR").selectOption("B1");
  await expect(page.getByRole("heading", { name: "Văn phòng" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Khách sạn" })).toHaveCount(0);
  await page.getByRole("searchbox", { name: "Tìm kiếm bộ từ" }).fill("daily work");
  await page.getByRole("radio", { name: "Công việc" }).check();
  await expect(page.getByRole("heading", { name: "Văn phòng" })).toBeVisible();
  expect(api.catalogRequests()).toBe(initialRequests);

  await page.getByRole("button", { name: "Xóa bộ lọc" }).click();
  await expect(page.getByLabel("Trình độ CEFR")).toHaveValue("");
  await expect(page.getByRole("heading", { name: "Khách sạn" })).toBeVisible();
  await page.getByRole("article").filter({ hasText: "Văn phòng" }).getByRole("link", { name: "Xem" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Văn phòng" })).toBeVisible();
  await expect(page.locator(".public-vocabulary-set-detail").locator('[data-cover-state]')).toHaveCount(0);
  await expect(page.locator(".public-vocabulary-set-detail").getByText("B1", { exact: true })).toBeVisible();
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
  expect(copyCalls).toBe(1);
  await expect(page.getByRole("alert")).toContainText("Không thể lưu bộ từ");
  await page.getByRole("button", { name: "Thử lưu lại" }).evaluate((button) => {
    button.click();
    button.click();
  });
  await expect(page.getByRole("button", { name: "Đang lưu…" })).toBeDisabled();
  expect(copyCalls).toBe(2);
  resolveCopy();
  await expect(page).toHaveURL(/\/my\/vocabulary-sets\/copied-set$/);
  await page.goto("/vocabulary-sets/set-airport");
  const detailSaved = page.getByRole("status").filter({ hasText: "Đã lưu" });
  await expect(detailSaved).toBeVisible();
  await expect(page.getByRole("button", { name: "Đã lưu" })).toHaveCount(0);
  await detailSaved.evaluate((status) => {
    status.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }));
    status.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: " " }));
    status.click();
  });
  expect(copyCalls).toBe(2);
  await page.reload();
  await expect(page.getByRole("status").filter({ hasText: "Đã lưu" })).toBeVisible();
  await page.goto("/topics");
  const savedCard = page.getByRole("article").filter({ hasText: "Sân bay cơ bản" });
  const saved = savedCard.getByRole("status").filter({ hasText: "Đã lưu" });
  await expect(saved).toBeVisible();
  await expect(savedCard.getByRole("button", { name: "Đã lưu" })).toHaveCount(0);
  await saved.evaluate((status) => {
    status.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }));
    status.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: " " }));
    status.click();
  });
  expect(copyCalls).toBe(2);
  await page.reload();
  await expect(page.getByRole("article").filter({ hasText: "Sân bay cơ bản" }).getByRole("status").filter({ hasText: "Đã lưu" })).toBeVisible();
  expect(copyCalls).toBe(2);
});

test("Public Detail copy shares the session saved state, locks rapid activation, and unlocks retry", async ({ page }) => {
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
  await page.goto("/vocabulary-sets/set-airport");

  await page.getByRole("button", { name: "Lưu vào Bộ từ của tôi" }).click();
  expect(copyCalls).toBe(1);
  await expect(page.getByRole("alert")).toContainText("Không thể sao chép bộ từ");
  await page.getByRole("button", { name: "Thử lưu lại" }).evaluate((button) => {
    button.click();
    button.click();
  });
  await expect(page.getByRole("button", { name: "Đang lưu…" })).toBeDisabled();
  expect(copyCalls).toBe(2);
  resolveCopy();
  await expect(page).toHaveURL(/\/my\/vocabulary-sets\/copied-set$/);

  await page.goto("/topics");
  const savedCard = page.getByRole("article").filter({ hasText: "Sân bay cơ bản" });
  await expect(savedCard.getByRole("status").filter({ hasText: "Đã lưu" })).toBeVisible();
  await expect(savedCard.getByRole("button", { name: /Lưu|Đã lưu/ })).toHaveCount(0);
  expect(copyCalls).toBe(2);
});

test("Public Detail same-topic links return to durable filtered Discovery without entering legacy routes", async ({ page }) => {
  const api = await installDiscoveryApi(page);
  await installAuthApiMock(page, { "/api/auth/me": responses.currentUser(publicUser) });
  await page.goto("/vocabulary-sets/set-airport");

  const topicLinks = page.getByRole("link", { name: /cùng chủ đề/i });
  await expect(topicLinks).toHaveCount(2);
  await expect(topicLinks.nth(0)).toHaveAttribute("href", "/topics?topic=topic-travel");
  await expect(topicLinks.nth(1)).toHaveAttribute("href", "/topics?topic=topic-travel");
  await topicLinks.nth(1).click();

  await expect(page).toHaveURL(/\/topics\?topic=topic-travel$/);
  await expect(page.getByRole("radio", { name: "Du lịch" })).toBeChecked();
  await expect(page.getByRole("heading", { name: "Sân bay cơ bản" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Khách sạn" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Văn phòng" })).toHaveCount(0);
  const filteredRequests = api.catalogRequests();
  await page.getByLabel("Trình độ CEFR").selectOption("A1");
  await page.getByRole("searchbox", { name: "Tìm kiếm bộ từ" }).fill("sân bay");
  await expect(page.getByRole("heading", { name: "Sân bay cơ bản" })).toBeVisible();
  expect(api.catalogRequests()).toBe(filteredRequests);

  await page.reload();
  await expect(page.getByRole("radio", { name: "Du lịch" })).toBeChecked();
  await page.goBack();
  await expect(page).toHaveURL(/\/vocabulary-sets\/set-airport$/);
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
    const usesOverflowFixture = [390, 768, 1366].includes(width);
    await installDiscoveryApi(page, { topicList: usesOverflowFixture ? manyTopics : topics });
    await installAuthApiMock(page);
    await page.goto("/topics");
    await expect(page.locator("#topic-list-title")).toBeAttached();
    await expect(page.getByRole("button", { name: "Xóa bộ lọc" })).toBeVisible();
    if (usesOverflowFixture) {
      await expect.poll(() => page.locator(".discovery-topic-options").evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
    }
    await expect.poll(() => page.evaluate(() => ({
      body: document.body.scrollWidth - document.body.clientWidth,
      document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }))).toEqual({ body: 0, document: 0 });
  });
}

async function installDiscoveryApi(page, { copyHandler, setHandler, topicList = topics } = {}) {
  let catalogRequestCount = 0;
  await page.route("https://covers.example.test/airport.webp", (route) => route.fulfill({ status: 200, contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64") }));
  await page.route("https://covers.example.test/broken.webp", (route) => route.fulfill({ status: 404, body: "" }));
  await page.route("**/api/topics", async (route) => {
    catalogRequestCount += 1;
    await route.fulfill(ok(topicList));
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
