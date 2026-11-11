export const publicUser = Object.freeze({
  id: "user-1",
  email: "learner@example.com",
  display_name: "Learner",
  role: "USER",
});

export const publicAdmin = Object.freeze({
  id: "admin-1",
  email: "admin@example.com",
  display_name: "Admin Learner",
  role: "ADMIN",
});

export const responses = Object.freeze({
  guest: () => ({ status: 401, json: authenticationError() }),
  currentUser: (user = publicUser) => ({
    status: 200,
    json: { success: true, data: user },
  }),
  login: (user = publicUser) => ({
    status: 200,
    json: {
      success: true,
      data: {
        user,
        session_id: "raw-session-fixture-must-be-ignored",
      },
    },
  }),
  registration: () => ({
    status: 201,
    json: { success: true, message: "Registration successful" },
  }),
  noContent: () => ({ status: 204, body: "" }),
  error: (status, code, message, rawDetail) => ({
    status,
    json: {
      success: false,
      error: { code, message, rawDetail },
    },
  }),
  abort: () => ({ abort: "failed" }),
});

export async function installAuthApiMock(page, handlers = {}) {
  const calls = [];

  await page.route("**/api/learning-path", (route) =>
    route.fulfill({
      status: 200,
      json: {
        success: true,
        data: {
          evaluated_at: "2026-11-03T00:00:00.000Z",
          highest_unlocked_level: "A1",
          path_completed_at: null,
          levels: ["A1", "A2", "B1", "B2", "C1"].map((level, index) => ({
            level,
            unlocked: index === 0,
            required_count: 0,
            completed_count: 0,
            configuration: "NO_REQUIRED_SETS",
            current_complete: false,
            incomplete_sets: [],
          })),
          recommendation: null,
          next_suggestion: null,
          next_suggestion_reason: "NO_ELIGIBLE_NEXT_SET",
          all_current_sets_complete: false,
        },
      },
    }),
  );
  await page.route("**/api/learning/review", (route) =>
    route.fulfill({
      status: 200,
      json: { success: true, data: { due_count: 0, has_due_items: false, evaluated_at: "2026-11-03T00:00:00.000Z", nearest_future_review_at: null } },
    }),
  );

  await page.route("**/api/learning/progress**", (route) =>
    route.fulfill({
      status: 200,
      json: {
        success: true,
        data: {
          evaluated_at: "2026-09-24T12:00:00.000Z",
          xp_level: { total_xp: 0, level: 1, level_min_xp: 0, next_level_xp: 50, is_max_level: false },
          summary: { total_started: 0, learning: 0, learned: 0, needs_review: 0 },
          streak_activity_7d: {
            timezone: "Asia/Ho_Chi_Minh",
            days: [
              "2026-09-18", "2026-09-19", "2026-09-20", "2026-09-21",
              "2026-09-22", "2026-09-23", "2026-09-24",
            ].map((date) => ({ date, status: "UNAVAILABLE" })),
          },
          items: [],
          pagination: { page: 1, page_size: 1, total_items: 0, total_pages: 0 },
          filter: { status: null },
        },
      },
    }),
  );
  await page.route("**/api/my/vocabulary-sets", (route) =>
    route.fulfill({ status: 200, json: { success: true, data: [] } }),
  );
  await page.route("**/api/users/me/streak", (route) =>
    route.fulfill({
      status: 200,
      json: {
        success: true,
        data: {
          current_streak: 0,
          completed_today: false,
          last_qualified_date: null,
          timezone: "Asia/Ho_Chi_Minh",
          evaluated_at: "2026-10-19T09:00:00.000Z",
        },
      },
    }),
  );
  await page.route("**/api/topics", (route) =>
    route.fulfill({ status: 200, json: { success: true, data: [] } }),
  );

  await page.route("**/api/auth/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    const call = {
      method: request.method(),
      pathname,
      body: request.postData() ? request.postDataJSON() : null,
    };
    calls.push(call);

    const handler = handlers[pathname] ?? defaultHandler(pathname);
    const response = typeof handler === "function"
      ? await handler(call)
      : await handler;

    if (response?.abort) {
      await route.abort(response.abort);
      return;
    }

    await route.fulfill(response);
  });

  return {
    calls,
    callsFor(pathname) {
      return calls.filter((call) => call.pathname === pathname);
    },
  };
}

export function deferredResponse() {
  let resolve;
  const response = new Promise((resolveResponse) => {
    resolve = resolveResponse;
  });

  return { response, resolve };
}

function defaultHandler(pathname) {
  if (pathname === "/api/auth/me") return responses.guest();
  if (pathname === "/api/auth/logout") return responses.noContent();
  throw new Error(`Unexpected Authentication request: ${pathname}`);
}

function authenticationError() {
  return {
    success: false,
    error: {
      code: "AUTHENTICATION_FAILED",
      message: "Authentication failed.",
    },
  };
}
