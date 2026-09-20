import { createHash, randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { PrismaClient } from "../../../backend/src/generated/prisma/client.ts";
import { hashPassword } from "../../../backend/src/utils/password-security.js";
import { configureTestEnvironment } from "../../../backend/test/helpers/test-environment.js";

configureTestEnvironment({ requireReset: true });

const prisma = new PrismaClient();
const runId = randomUUID();
const fixtureDomain = `${runId}.integration.test`;
const userEmail = `user@${fixtureDomain}`;
const adminEmail = `admin@${fixtureDomain}`;
const password = `Safe-${randomUUID()}`;
const userDisplayName = "Real Stack Learner";
const adminDisplayName = "Real Stack Administrator";

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await prisma.$connect();
});

test.afterAll(async () => {
  try {
    const users = await prisma.uSER.findMany({
      where: { email: { endsWith: `@${fixtureDomain}` } },
      select: { id: true },
    });
    const userIds = users.map(({ id }) => id);

    if (userIds.length > 0) {
      await prisma.aUTH_SESSION.deleteMany({
        where: { user_id: { in: userIds } },
      });
      await prisma.uSER.deleteMany({ where: { id: { in: userIds } } });
    }
  } finally {
    await prisma.$disconnect();
  }
});

test("real USER flow traverses Vite, Express, Prisma and the test database", async ({
  context,
  page,
}) => {
  const authRequests = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/auth/")) authRequests.push(url);
  });

  await page.goto("/register");
  await page.locator("#register-display-name").fill(userDisplayName);
  await page.locator("#register-email").fill(userEmail.toUpperCase());
  await page.locator("#register-password").fill(password);
  await page.locator("#register-confirm-password").fill(password);
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/login$/);

  const registeredUser = await prisma.uSER.findUnique({ where: { email: userEmail } });
  expect(registeredUser).not.toBeNull();
  expect(registeredUser).toMatchObject({
    display_name: userDisplayName,
    role: "USER",
    is_active: true,
    total_xp: 0,
    daily_xp_goal: 50,
  });
  expect(await prisma.aUTH_SESSION.count({
    where: { user_id: registeredUser.id },
  })).toBe(0);
  expect(await context.cookies()).toHaveLength(0);

  await page.locator("#login-password").fill(password);
  const loginResponsePromise = page.waitForResponse(
    (response) => response.url().endsWith("/api/auth/login"),
  );
  await page.locator('form button[type="submit"]').click();
  const loginResponse = await loginResponsePromise;
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText(userDisplayName)).toBeVisible();

  const setCookie = (await loginResponse.headersArray()).find(
    ({ name }) => name.toLowerCase() === "set-cookie",
  )?.value;
  expect(typeof setCookie).toBe("string");
  expect(setCookie).toContain("HttpOnly");
  expect(setCookie).toContain("SameSite=Lax");
  expect(setCookie).toContain("Path=/");
  expect(setCookie).not.toContain("Domain=");
  expect(setCookie).not.toContain("Secure");

  const [sessionCookie] = await context.cookies();
  expect(sessionCookie).toMatchObject({
    name: "session_id",
    httpOnly: true,
    secure: false,
    sameSite: "Lax",
    path: "/",
  });
  const persistedSession = await prisma.aUTH_SESSION.findFirst({
    where: { user_id: registeredUser.id },
  });
  expect(persistedSession).not.toBeNull();
  expect(persistedSession.session_identifier_hash).toHaveLength(64);
  expect(
    createHash("sha256").update(sessionCookie.value).digest("hex") ===
      persistedSession.session_identifier_hash,
  ).toBe(true);

  const browserState = await page.evaluate(() => ({
    localStorage: { ...localStorage },
    sessionStorage: { ...sessionStorage },
    text: document.body.textContent,
  }));
  expect(browserState.localStorage).toEqual({});
  expect(browserState.sessionStorage).toEqual({});
  expect(browserState.text.includes(password)).toBe(false);
  expect(browserState.text.includes(sessionCookie.value)).toBe(false);
  expect(browserState.text.includes(persistedSession.session_identifier_hash)).toBe(false);

  const meResponsePromise = page.waitForResponse(
    (response) => response.url().endsWith("/api/auth/me"),
  );
  await page.reload();
  const meResponse = await meResponsePromise;
  expect(meResponse.status()).toBe(200);
  await expect(page.getByText(userDisplayName)).toBeVisible();

  await verifyCrossSitePostDoesNotRevoke(page, registeredUser.id);

  const logoutResponsePromise = page.waitForResponse(
    (response) => response.url().endsWith("/api/auth/logout"),
  );
  await page.locator(".authenticated-logout-button").click();
  expect((await logoutResponsePromise).status()).toBe(204);
  await expect(page).toHaveURL(/\/login$/);

  const rejectedMe = await page.evaluate(async () => {
    const response = await fetch("/api/auth/me");
    return response.status;
  });
  expect(rejectedMe).toBe(401);
  expect(await prisma.aUTH_SESSION.count({
    where: { user_id: registeredUser.id },
  })).toBe(0);

  expect(authRequests.length).toBeGreaterThanOrEqual(6);
  for (const url of authRequests) {
    expect(url.origin).toBe("http://127.0.0.1:4174");
  }
});

test("real ADMIN Login and me identity remain server-derived", async ({ page }) => {
  await prisma.uSER.create({
    data: {
      email: adminEmail,
      password_hash: await hashPassword(password),
      display_name: adminDisplayName,
      role: "ADMIN",
      is_active: true,
    },
  });

  await page.goto("/login");
  await page.locator("#login-email").fill(adminEmail);
  await page.locator("#login-password").fill(password);
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText(adminDisplayName)).toBeVisible();
  await expect(page.locator(".authenticated-admin-indicator")).toBeVisible();
  await expect(page.locator('a[href="/admin"]')).toHaveCount(0);

  const identity = await page.evaluate(async () => {
    const response = await fetch("/api/auth/me");
    return response.json();
  });
  expect(identity).toEqual({
    success: true,
    data: {
      id: expect.any(String),
      email: adminEmail,
      display_name: adminDisplayName,
      role: "ADMIN",
    },
  });
});

async function verifyCrossSitePostDoesNotRevoke(page, userId) {
  const logoutAttempt = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/auth/logout") &&
      response.request().method() === "POST",
  );

  await page.evaluate(() => {
    const frame = document.createElement("iframe");
    frame.name = "cross-site-csrf-frame";
    frame.sandbox = "allow-forms allow-scripts";
    frame.hidden = true;
    frame.srcdoc = `
      <form method="POST" action="/api/auth/logout">
        <button type="submit">submit</button>
      </form>
      <script>document.forms[0].submit()</script>
    `;
    document.body.append(frame);
  });

  expect((await logoutAttempt).status()).toBe(204);
  const status = await page.evaluate(async () => {
    const response = await fetch("/api/auth/me");
    return response.status;
  });
  expect(status).toBe(200);
  expect(await prisma.aUTH_SESSION.count({ where: { user_id: userId } })).toBe(1);
}
