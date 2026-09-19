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
