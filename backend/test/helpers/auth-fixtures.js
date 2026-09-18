import { createHash, randomBytes, randomUUID } from "node:crypto";
import { hashPassword } from "../../src/utils/password-security.js";

export function uniqueEmail(label = "user") {
  return `${label}-${randomUUID()}@example.test`;
}

export async function createUserFixture(
  prisma,
  {
    email = uniqueEmail(),
    password = "password-123",
    display_name = "Test User",
    role = "USER",
    is_active = true,
    password_hash,
  } = {},
) {
  return prisma.uSER.create({
    data: {
      email: email.toLowerCase(),
      password_hash: password_hash ?? (await hashPassword(password)),
      display_name,
      role,
      is_active,
    },
  });
}

export async function createSessionFixture(
  prisma,
  userId,
  { rawToken = randomBytes(32).toString("base64url"), expires_at } = {},
) {
  const session_identifier_hash = hashSessionToken(rawToken);
  const session = await prisma.aUTH_SESSION.create({
    data: {
      user_id: userId,
      session_identifier_hash,
      expires_at: expires_at ?? new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  return { rawToken, session, session_identifier_hash };
}

export function hashSessionToken(rawToken) {
  return createHash("sha256").update(rawToken).digest("hex");
}
