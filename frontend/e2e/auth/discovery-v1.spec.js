import { expect, test } from "@playwright/test";
import { Buffer } from "node:buffer";
import { installAuthApiMock, publicAdmin, publicUser, responses } from "./fixtures/auth-api.js";

const topics = [
  { id: "topic-travel", name: "Du lịch", description: "Từ vựng du lịch" },
  { id: "topic-work", name: "Công việc", description: "Từ vựng công việc" },
  { id: "topic-food", name: "Ẩm thực", description: "Từ vựng ẩm thực" },
  { id: "topic-daily", name: "Đời sống", description: "Từ vựng đời sống" },
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
  "topic-food": [
    { id: "set-food", name: "Đồ ăn và thức uống", description: "Từ vựng cho bữa ăn hằng ngày", cefr_level: "A1", cover_image_url: null, item_count: 10, topic_id: "topic-food" },
  ],
  "topic-daily": [
    { id: "set-home", name: "Đồ vật quen thuộc trong ngôi nhà và sinh hoạt gia đình", description: "Những đồ vật quen thuộc trong gia đình với phần mô tả dài để xác nhận nội dung được giới hạn chính xác ở hai dòng mà không làm lệch hàng thao tác.", cefr_level: "A1", cover_image_url: null, item_count: 10, topic_id: "topic-daily" },
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
  await expect(normalList.getByRole("listitem")).toHaveCount(8);
  await expect(page.getByText("8 bộ từ phù hợp", { exact: true })).toBeVisible();
  for (const featuredSet of catalogFeaturedSets) {
    await expect(normalList.getByRole("heading", { name: featuredSet.name })).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "Xóa bộ lọc" })).toBeDisabled();
  await expect(page.getByText("Chưa có mô tả cho bộ từ này.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Đăng nhập để lưu" })).toHaveCount(11);
  await expect(page.getByRole("button", { name: "Lưu" })).toHaveCount(0);
  const cardGeometry = await normalList.locator(".discovery-set-card").evaluateAll((cards) => cards.map((card) => ({
    height: Math.round(card.getBoundingClientRect().height),
    actionOffset: Math.round(card.querySelector(".discovery-card-actions").getBoundingClientRect().top - card.getBoundingClientRect().top),
  })));
  expect(new Set(cardGeometry.map(({ height }) => height)).size).toBe(1);
  expect(new Set(cardGeometry.map(({ actionOffset }) => actionOffset)).size).toBe(1);
  const regularPresentation = await normalList.getByRole("article").filter({ hasText: "Đồ vật quen thuộc" }).evaluate((card) => {
    const title = card.querySelector("h2");
    const description = card.querySelector(".discovery-card-body > p");
    return {
      cardMinHeight: getComputedStyle(card).minHeight,
      descriptionClamped: description.scrollHeight > description.clientHeight,
      descriptionLineClamp: getComputedStyle(description).webkitLineClamp,
      titleClamped: title.scrollHeight > title.clientHeight,
      titleLineClamp: getComputedStyle(title).webkitLineClamp,
    };
  });
  expect(regularPresentation).toEqual({ cardMinHeight: "216px", descriptionClamped: true, descriptionLineClamp: "2", titleClamped: true, titleLineClamp: "2" });
  const featuredPresentation = await page.locator(".discovery-featured .discovery-set-card").first().evaluate((card) => ({
    minHeight: getComputedStyle(card).minHeight,
    position: getComputedStyle(card).position,
  }));
  expect(featuredPresentation).toEqual({ minHeight: "184px", position: "relative" });
  const initialCatalogRequests = api.catalogRequests();

  await page.getByRole("searchbox", { name: "Tìm kiếm bộ từ" }).fill("  DAILY WORK ");
  await expect(page.getByRole("heading", { name: "Văn phòng" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sân bay cơ bản" })).toHaveCount(0);
  expect(api.catalogRequests()).toBe(initialCatalogRequests);

  await page.getByRole("radio", { name: "Du lịch" }).check();
  await expect(page.getByRole("heading", { name: "Không tìm thấy bộ từ phù hợp" })).toBeVisible();
  await page.getByRole("button", { name: "Xóa bộ lọc" }).click();
  await expect(normalList.getByRole("listitem")).toHaveCount(8);

  await page.getByRole("radio", { name: "Ẩm thực" }).check();
  await expect(page.getByText("1 bộ từ phù hợp", { exact: true })).toBeVisible();
  await expect(normalList.getByRole("heading", { name: "Đồ ăn và thức uống" })).toBeVisible();
  await page.getByRole("button", { name: "Xóa bộ lọc" }).click();

  await page.getByRole("searchbox", { name: "Tìm kiếm bộ từ" }).fill("Everyday English");
  await expect(page.getByText("1 bộ từ phù hợp", { exact: true })).toBeVisible();
  await expect(normalList.getByRole("heading", { name: "Everyday English" })).toBeVisible();
  await page.getByRole("button", { name: "Xóa bộ lọc" }).click();

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
  const workSets = [{ id: "work-1", name: "Work Set 1", description: "Work description 1", item_count: 1, topic_id: "topic-work" }];
  const api = await installDiscoveryApi(page, { setHandler: (route, topicId) => route.fulfill(ok(topicId === "topic-travel" ? [...featuredSets, ...travelSets] : topicId === "topic-work" ? workSets : [])) });
  await installAuthApiMock(page);
  await page.goto("/topics");

  const list = page.getByRole("list", { name: "Danh sách bộ từ hệ thống" });
  await expect(page.getByRole("heading", { name: "Bộ từ nổi bật" })).toBeVisible();
  await expect(page.locator(".discovery-featured").getByRole("listitem")).toHaveCount(3);
  await expect(page.locator(".discovery-featured").getByRole("heading", { name: featuredSets[0].name })).toBeVisible();
  await expect(page.locator(".discovery-featured").locator('[data-cover-state="persisted"] img')).toHaveAttribute("src", featuredSets[0].cover_image_url);
  for (const featuredSet of featuredSets) await expect(list.getByRole("heading", { name: featuredSet.name })).toBeVisible();
  await expect(list.getByRole("listitem")).toHaveCount(9);
  await expect(page.getByText("1 / 2", { exact: true })).toBeVisible();
  await expect(page.getByText("14 bộ từ phù hợp", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Trước" })).toBeDisabled();
  const initialRequests = api.catalogRequests();
  await page.getByRole("button", { name: "Sau" }).click();
  await expect(list.getByRole("listitem")).toHaveCount(5);
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
  await expect(page.getByText("2 bộ từ phù hợp", { exact: true })).toBeVisible();
  await expect(list.getByRole("heading", { name: "Travel Confidence" })).toBeVisible();
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
  await expect(page.getByText("1 bộ từ phù hợp", { exact: true })).toBeVisible();
  await expect(list.getByRole("listitem")).toHaveCount(1);
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
  expect(coverGeometry.height).toBeGreaterThanOrEqual(96);
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
  await expect(learningActions.getByRole("link", { name: /Luyện nói/ })).toHaveAttribute("href", "/pronunciation/vocabulary-sets/set-airport");
  await expect(page.getByRole("button", { name: "Lưu vào Bộ từ của tôi" })).toBeVisible();
  await expect(page.getByText("Học trực tiếp từ bộ từ công khai")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Chỉnh sửa|Xóa/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Thêm passport vào bộ từ cá nhân" })).toBeVisible();
});

test("Public Set learning cards match the compact Personal Set responsive grid", async ({ page }, testInfo) => {
  await installDiscoveryApi(page);
  await installAuthApiMock(page, { "/api/auth/me": responses.currentUser(publicUser) });
  const viewports = [
    { width: 375, height: 812 }, { width: 390, height: 844 },
    { width: 768, height: 1024 }, { width: 820, height: 1180 },
    { width: 1366, height: 768 }, { width: 1536, height: 864 },
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/vocabulary-sets/set-airport");
    const grid = page.locator(".set-detail-learning-grid");
    const cards = grid.locator(".set-detail-learning-card");
    await expect(cards).toHaveCount(3);
    const boxes = await cards.evaluateAll((elements) => elements.map((element) => {
      const box = element.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height };
    }));

    if (viewport.width <= 800) {
      expect(Math.abs(boxes[0].y - boxes[1].y)).toBeLessThan(1);
      expect(boxes[2].y).toBeGreaterThan(boxes[0].y);
      expect(Math.abs(boxes[2].x - boxes[0].x)).toBeLessThan(1);
    } else {
      expect(Math.abs(boxes[0].y - boxes[2].y)).toBeLessThan(1);
    }
    if (viewport.width <= 480) {
      for (const box of boxes) {
        expect(box.height).toBeGreaterThanOrEqual(100);
        expect(box.height).toBeLessThanOrEqual(115);
      }
      await expect(cards.first().locator("p")).toBeHidden();
    }
    expect(Math.max(...boxes.map((box) => box.height)) - Math.min(...boxes.map((box) => box.height))).toBeLessThan(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    for (const card of await cards.all()) {
      const box = await card.boundingBox();
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    const flashcard = page.getByRole("link", { name: /Thẻ ghi nhớ/ });
    await flashcard.focus();
    await expect(flashcard).toBeFocused();
    await expect(page.getByRole("button", { name: "Lưu vào Bộ từ của tôi" })).toBeVisible();
    await expect(page.getByRole("link", { name: /cùng chủ đề/i }).first()).toBeVisible();
    await expect(page.getByText("Bộ từ hệ thống", { exact: true })).toBeVisible();

    if (viewport.width === 390) {
      await grid.scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath("responsive-comparison-public-390.png") });
    }
  }
});

test("USER selects a personal destination, confirms once, and receives success feedback", async ({ page }) => {
  await installDiscoveryApi(page);
  await installAuthApiMock(page, { "/api/auth/me": responses.currentUser(publicUser) });
  const calls = [];
  await installPublicItemAddApi(page, { calls });
  await page.goto("/vocabulary-sets/set-airport");

  const trigger = page.getByRole("button", { name: "Thêm passport vào bộ từ cá nhân" });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Thêm vào bộ từ cá nhân" });
  await expect(dialog.getByText("passport", { exact: true })).toBeVisible();
  const confirm = dialog.getByRole("button", { name: "Thêm vào bộ từ" });
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel("Bộ từ đích").selectOption("personal-1");
  await confirm.click();
  await expect(dialog).toHaveCount(0);
  const successToast = page.getByRole("alert").filter({ hasText: "Đã thêm passport vào Du lịch cá nhân." });
  await expect(successToast).toBeVisible();
  await expect(successToast.locator(".Toastify__progress-bar")).toBeVisible();
  expect(calls).toEqual([{ setId: "personal-1", body: { source_set_id: "set-airport", vocabulary_id: "vocabulary-passport" } }]);
  await expect(trigger).toBeFocused();
});

test("destination dialog contains focus while personal Sets load and after loading fails", async ({ page }) => {
  await installDiscoveryApi(page);
  await installAuthApiMock(page, { "/api/auth/me": responses.currentUser(publicUser) });
  let rejectSets;
  const setsResponse = new Promise((resolve) => { rejectSets = resolve; });
  await installPublicItemAddApi(page, { personalSetsHandler: async (route) => {
    await setsResponse;
    await route.fulfill({ status: 500, json: { success: false, error: { code: "INTERNAL_SERVER_ERROR" } } });
  } });
  await page.goto("/vocabulary-sets/set-airport");

  const trigger = page.getByRole("button", { name: "Thêm passport vào bộ từ cá nhân" });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Thêm vào bộ từ cá nhân" });
  const close = dialog.getByRole("button", { name: "Đóng chọn bộ từ" });
  await expect(dialog).toBeFocused();
  await expect(dialog.getByRole("status")).toHaveText("Đang tải bộ từ…");

  await trigger.focus();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await trigger.focus();
  await page.keyboard.press("Shift+Tab");
  await expect(close).toBeFocused();

  rejectSets();
  await expect(dialog.getByRole("alert")).toContainText("Không thể tải danh sách bộ từ.");
  const retry = dialog.getByRole("button", { name: "Thử lại" });
  await trigger.focus();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(retry).toBeFocused();

  await close.click();
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("destination dialog stays compact and viewport-positioned across responsive widths", async ({ page }, testInfo) => {
  await installDiscoveryApi(page);
  await installAuthApiMock(page, { "/api/auth/me": responses.currentUser(publicUser) });
  const personalSets = Array.from({ length: 40 }, (_, index) => ({
    id: `personal-${index + 1}`,
    name: `Bộ từ cá nhân ${index + 1}`,
    item_count: index,
  }));
  await installPublicItemAddApi(page, { personalSets });

  for (const viewport of [
    { width: 375, height: 812 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/vocabulary-sets/set-airport");
    const trigger = page.getByRole("button", { name: "Thêm passport vào bộ từ cá nhân" });
    await expect(trigger).toHaveCSS("cursor", "pointer");
    await trigger.click();

    const dialog = page.getByRole("dialog", { name: "Thêm vào bộ từ cá nhân" });
    const overlay = page.getByTestId("add-public-vocabulary-overlay");
    const destination = dialog.getByLabel("Bộ từ đích");
    await expect.poll(() => overlay.evaluate((element) => element.parentElement === document.body)).toBe(true);
    await expect.poll(() => overlay.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return rect.left === 0 && rect.top === 0 && rect.width === window.innerWidth && rect.height === window.innerHeight;
    })).toBe(true);
    await expect(destination).toHaveValue("");
    await expect(destination).toHaveCSS("cursor", "pointer");
    await expect(destination.locator("option")).toHaveCount(41);
    await expect(destination.locator("option").first()).toHaveText("Chọn bộ từ cá nhân...");
    const initialConfirm = dialog.getByRole("button", { name: "Thêm vào bộ từ" });
    await expect(initialConfirm).toBeDisabled();
    await expect(initialConfirm).toHaveCSS("cursor", "not-allowed");
    await destination.selectOption("personal-40");
    await expect(destination).toHaveValue("personal-40");
    await expect(dialog.getByRole("button", { name: "Thêm vào bộ từ" })).toBeEnabled();
    await expect.poll(() => dialog.evaluate((element) => element.getBoundingClientRect().height)).toBeLessThan(450);
    await expect.poll(() => dialog.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      if (window.innerWidth < 641) return Math.abs(rect.bottom - window.innerHeight) < 2 && rect.left === 0 && rect.right === window.innerWidth;
      return Math.abs(rect.left + (rect.width / 2) - (window.innerWidth / 2)) < 2
        && Math.abs(rect.top + (rect.height / 2) - (window.innerHeight / 2)) < 2;
    })).toBe(true);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

    const close = dialog.getByRole("button", { name: "Đóng chọn bộ từ" });
    const confirm = dialog.getByRole("button", { name: "Thêm vào bộ từ" });
    const cancel = dialog.getByRole("button", { name: "Hủy" });
    await expect(destination).toHaveCSS("cursor", "pointer");
    await expect(close).toHaveCSS("cursor", "pointer");
    await expect(cancel).toHaveCSS("cursor", "pointer");
    await expect(confirm).toHaveCSS("cursor", "pointer");
    await expect(confirm).toHaveCSS("background-color", "rgb(76, 162, 230)");
    await close.focus();
    await page.keyboard.press("Shift+Tab");
    await expect(confirm).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(close).toBeFocused();
    await page.screenshot({ path: testInfo.outputPath(`public-word-dialog-${viewport.width}px.png`) });

    if (viewport.width === 375) await close.click();
    else if (viewport.width === 768) await overlay.click({ position: { x: 4, y: 4 } });
    else await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  }
});

test("duplicate add preserves selection for retry and pending prevents double submission", async ({ page }) => {
  await installDiscoveryApi(page);
  await installAuthApiMock(page, { "/api/auth/me": responses.currentUser(publicUser) });
  let attempts = 0;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  await installPublicItemAddApi(page, { itemHandler: async (route) => {
    attempts += 1;
    if (attempts === 1) return route.fulfill({ status: 409, json: { success: false, error: { code: "VOCABULARY_ALREADY_IN_SET", message: "duplicate" } } });
    await gate;
    return route.fulfill({ status: 201, json: { success: true, data: { id: "membership-1", vocabulary_id: "vocabulary-passport", position: 2 } } });
  } });
  await page.goto("/vocabulary-sets/set-airport");
  await page.getByRole("button", { name: "Thêm passport vào bộ từ cá nhân" }).click();
  const dialog = page.getByRole("dialog", { name: "Thêm vào bộ từ cá nhân" });
  const destination = dialog.getByLabel("Bộ từ đích");
  await destination.selectOption("personal-1");
  const confirm = dialog.getByRole("button", { name: "Thêm vào bộ từ" });
  await confirm.click();
  await expect(dialog.getByRole("alert")).toHaveText("Từ này đã có trong bộ");
  await expect(destination).toHaveValue("personal-1");
  await confirm.click();
  const pendingConfirm = dialog.getByRole("button", { name: "Đang thêm…" });
  await expect(pendingConfirm).toBeDisabled();
  await expect(pendingConfirm).toHaveCSS("cursor", "not-allowed");
  await expect(destination).toHaveCSS("cursor", "not-allowed");
  await expect(dialog.getByRole("button", { name: "Hủy" })).toHaveCSS("cursor", "not-allowed");
  await expect(dialog.getByRole("button", { name: "Đóng chọn bộ từ" })).toHaveCSS("cursor", "not-allowed");
  await pendingConfirm.click({ force: true });
  expect(attempts).toBe(2);
  release();
  await expect(dialog).toHaveCount(0);
});

test("destination picker handles empty state, Escape focus return, and mobile bounds", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await installDiscoveryApi(page);
  await installAuthApiMock(page, { "/api/auth/me": responses.currentUser(publicUser) });
  await installPublicItemAddApi(page, { personalSets: [] });
  await page.goto("/vocabulary-sets/set-airport");
  const trigger = page.getByRole("button", { name: "Thêm passport vào bộ từ cá nhân" });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Thêm vào bộ từ cá nhân" });
  const createSetLink = dialog.getByRole("link", { name: "Tạo bộ từ cá nhân" });
  await expect(createSetLink).toHaveAttribute("href", "/my/vocabulary-sets");
  await expect(createSetLink).toHaveCSS("cursor", "pointer");
  await expect.poll(() => dialog.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.left >= 0 && rect.right <= window.innerWidth && rect.bottom <= window.innerHeight;
  })).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("Guest public detail stays read-only and prompts login for authenticated actions", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await installDiscoveryApi(page);
  await installAuthApiMock(page);
  await page.goto("/vocabulary-sets/set-airport");
  await expect(page.getByRole("heading", { name: "Sân bay cơ bản" })).toBeVisible();
  const vocabularyTable = page.getByRole("table");
  await expect(vocabularyTable.getByRole("columnheader")).toHaveText(["Từ vựng", "Nghĩa"]);
  await expect(vocabularyTable).toContainText("hộ chiếu");
  await expect(vocabularyTable.getByText("Keep your passport safe.")).toBeHidden();
  await expect.poll(() => page.locator(".set-detail-table-wrap").evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await expect(page.getByRole("link", { name: "Đăng nhập để học và lưu" })).toHaveAttribute("href", "/login");
  await expect(page.getByRole("link", { name: /Thẻ ghi nhớ|Quiz|Luyện nói/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Sao chép|Chỉnh sửa|Xóa|Thêm từ/ })).toHaveCount(0);
});

test("Public Detail paginates ten ordered words, keeps controls outside mobile scrolling, and resets for another Set", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const detailItems = (count, prefix) => Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-item-${index + 1}`,
    position: index + 1,
    word: `${prefix} word ${index + 1} with readable wrapping`,
    phonetic: `/word-${index + 1}/`,
    primary_meaning: { meaning_vi: `nghĩa ${index + 1}`, example: { example_en: `Example sentence ${index + 1}.`, example_vi: `Câu ví dụ ${index + 1}.` } },
  }));
  await installDiscoveryApi(page, { detailHandler: async (route, setId, summary) => {
    await route.fulfill(ok({ ...summary, items: setId === "set-airport" ? detailItems(11, "airport") : detailItems(1, "hotel") }));
  } });
  await installAuthApiMock(page);
  await page.goto("/vocabulary-sets/set-airport");

  const table = page.getByRole("table");
  const pagination = page.getByRole("navigation", { name: "Phân trang từ vựng" });
  await expect(table.getByRole("row")).toHaveCount(11);
  await expect(page.getByText("1–10 / 11 từ", { exact: true })).toBeVisible();
  await expect(page.getByText("Trang 1 / 2", { exact: true })).toBeVisible();
  await expect(pagination.getByRole("button", { name: "Trang trước" })).toBeDisabled();
  await expect(page.locator(".set-detail-table-wrap").getByRole("navigation")).toHaveCount(0);
  await expect.poll(() => page.locator(".set-detail-table-wrap").evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);

  const next = pagination.getByRole("button", { name: "Trang sau" });
  await next.focus();
  await expect(next).toBeFocused();
  await next.click();
  await expect(table.getByRole("row")).toHaveCount(2);
  await expect(page.getByText("11–11 / 11 từ", { exact: true })).toBeVisible();
  await expect(page.getByText("Trang 2 / 2", { exact: true })).toBeVisible();

  await page.goto("/vocabulary-sets/set-hotel");
  await expect(page.getByText("1–1 / 1 từ", { exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Phân trang từ vựng" })).toHaveCount(0);
  await expect(table.getByRole("row")).toHaveCount(2);
});

test("ADMIN browses in App Shell without learner or management actions", async ({ page }) => {
  await installDiscoveryApi(page);
  await installAuthApiMock(page, { "/api/auth/me": responses.currentUser(publicAdmin) });
  await page.goto("/topics");
  await expect(page.locator(".authenticated-app")).toBeVisible();
  await expect(page.locator("#topic-list-title")).toBeAttached();
  await expect(page.getByRole("button", { name: /Lưu/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Đăng nhập để lưu" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Học|Quiz|Luyện nói/ })).toHaveCount(0);
  await page.goto("/vocabulary-sets/set-airport");
  await expect(page.getByRole("columnheader")).toHaveText(["Từ vựng", "Nghĩa", "Phiên âm", "Ví dụ"]);
  await expect(page.getByRole("button", { name: /Thêm .* vào bộ từ cá nhân/ })).toHaveCount(0);
});

test("Public Detail table responds to content width across supported viewports", async ({ page }, testInfo) => {
  const longItem = {
    id: "item-long",
    vocabulary_id: "vocabulary-long",
    position: 1,
    word: "pneumonoultramicroscopicsilicovolcanoconiosis-without-breaks",
    phonetic: "/ˌnjuːmənəʊltrəˌmaɪkrəˈskɒpɪk/",
    primary_meaning: {
      meaning_vi: "Một nghĩa tiếng Việt rất dài để xác nhận nội dung tự ngắt dòng mà không làm vỡ bảng",
      example: {
        example_en: "A deliberately long example sentence verifies that content wraps naturally in the expanded table layout.",
        example_vi: "Câu ví dụ dài xác nhận bảng vẫn đọc được.",
      },
    },
  };
  await installDiscoveryApi(page, { detailHandler: (route, _setId, summary) => route.fulfill(ok({ ...summary, items: [longItem] })) });
  await installAuthApiMock(page, { "/api/auth/me": responses.currentUser(publicUser) });

  const viewports = [
    [320, 568], [375, 812], [390, 844], [430, 932], [600, 900], [667, 375],
    [768, 1024], [783, 900], [784, 900], [820, 1180], [900, 430], [1023, 700],
    [1024, 768], [1280, 800], [1440, 900],
  ];
  for (const [width, height] of viewports) {
    await page.setViewportSize({ width, height });
    await page.goto("/vocabulary-sets/set-airport");
    await expectPublicTableLayout(page, { hasActions: true });
    if ([783, 784, 1023, 1024].includes(width)) {
      await page.screenshot({ path: testInfo.outputPath(`public-table-${width}x${height}.png`) });
    }
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/vocabulary-sets/set-airport");
  const wrapper = page.locator(".public-set-table-wrap");
  await wrapper.evaluate((element) => { element.style.width = "831px"; });
  await expectPublicTableLayout(page, { expanded: false, hasActions: true });
  await page.screenshot({ path: testInfo.outputPath("public-table-container-831px.png") });
  await wrapper.evaluate((element) => { element.style.width = "836px"; });
  await expectPublicTableLayout(page, { expanded: true, hasActions: true });
  await page.screenshot({ path: testInfo.outputPath("public-table-container-836px.png") });

  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/vocabulary-sets/set-airport");
  await page.evaluate(() => { document.body.style.zoom = "200%"; });
  await expectPublicTableLayout(page, { hasActions: true });
});

test("Guest responsive table never renders an empty action column", async ({ page }) => {
  await installDiscoveryApi(page);
  await installAuthApiMock(page);
  for (const width of [320, 820, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/vocabulary-sets/set-airport");
    await expectPublicTableLayout(page, { hasActions: false });
    await expect(page.getByRole("columnheader", { name: "Thao tác" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Thêm .* vào bộ từ cá nhân/ })).toHaveCount(0);
  }
});

test("ADMIN responsive table never renders an empty action column", async ({ page }) => {
  await installDiscoveryApi(page);
  await installAuthApiMock(page, { "/api/auth/me": responses.currentUser(publicAdmin) });
  for (const width of [320, 820, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/vocabulary-sets/set-airport");
    await expectPublicTableLayout(page, { hasActions: false });
    await expect(page.getByRole("columnheader").last()).not.toHaveText(/Thao/);
    await expect(page.locator(".public-set-action-column")).toHaveCount(0);
  }
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

async function installDiscoveryApi(page, { copyHandler, detailHandler, setHandler, topicList = topics } = {}) {
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
    if (detailHandler) {
      await detailHandler(route, setId, summary);
      return;
    }
    await route.fulfill(ok({
      ...summary,
      items: [
        { id: "item-1", vocabulary_id: "vocabulary-passport", position: 1, word: "passport", phonetic: "/ˈpɑːspɔːrt/", primary_meaning: { part_of_speech: "noun", meaning_vi: "hộ chiếu", example: { example_en: "Keep your passport safe.", example_vi: "Giữ hộ chiếu của bạn an toàn." } } },
        { id: "item-2", vocabulary_id: "vocabulary-luggage", position: 2, word: "luggage", phonetic: null, primary_meaning: null },
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

async function installPublicItemAddApi(page, { calls = [], itemHandler, personalSets = [{ id: "personal-1", name: "Du lịch cá nhân", item_count: 1 }], personalSetsHandler } = {}) {
  await page.route(/\/api\/my\/vocabulary-sets$/, (route) => personalSetsHandler ? personalSetsHandler(route) : route.fulfill(ok(personalSets)));
  await page.route(/\/api\/my\/vocabulary-sets\/[^/]+\/items$/, async (route) => {
    const setId = decodeURIComponent(new URL(route.request().url()).pathname.split("/").at(-2));
    const body = route.request().postDataJSON();
    calls.push({ setId, body });
    if (itemHandler) return itemHandler(route);
    return route.fulfill({ status: 201, json: { success: true, data: { id: "membership-1", vocabulary_id: body.vocabulary_id, position: 2 } } });
  });
}

function ok(data) {
  return { status: 200, json: { success: true, data } };
}

async function expectPublicTableLayout(page, { expanded, hasActions }) {
  const wrapper = page.locator(".public-set-table-wrap");
  const table = wrapper.getByRole("table");
  const contentWidth = await wrapper.evaluate((element) => element.clientWidth);
  const usesExpandedLayout = expanded ?? contentWidth >= 832;
  const expectedHeaders = usesExpandedLayout
    ? ["Từ vựng", "Nghĩa", "Phiên âm", "Ví dụ", ...(hasActions ? ["Thao tác"] : [])]
    : ["Từ vựng", "Nghĩa", ...(hasActions ? ["Thao tác"] : [])];
  await expect(table.getByRole("columnheader")).toHaveText(expectedHeaders);
  await expect.poll(() => wrapper.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await expect.poll(() => page.evaluate(() => ({
    body: document.body.scrollWidth - document.body.clientWidth,
    document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }))).toEqual({ body: 0, document: 0 });

  const firstWord = table.locator("tbody td").first();
  await expect.poll(() => firstWord.evaluate((element) => {
    const text = element.querySelector("strong");
    return text.getBoundingClientRect().right <= element.getBoundingClientRect().right + 1;
  })).toBe(true);
  if (!hasActions) return;

  const action = table.getByRole("button", { name: /Thêm .* vào bộ từ cá nhân/ });
  const label = action.locator(".public-set-add-label");
  if (usesExpandedLayout) await expect(label).toBeVisible();
  else await expect(label).toBeHidden();
  await expect(action).toHaveCSS("cursor", "pointer");
  await expect.poll(() => action.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.width >= 44 && rect.height >= 44;
  })).toBe(true);
}
