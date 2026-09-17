// @ts-nocheck
import { createHash, randomBytes } from "node:crypto";

const SESSION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

export class AuthenticationServiceError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "AuthenticationServiceError";
    this.code = code;
  }
}

export function createAuthenticationService({
  userRepository,
  authSessionRepository,
  passwordSecurity,
}) {
  return {
    async register({ display_name, email, password }) {
      validateRegistrationInput({
        display_name,
        email,
        password,
        passwordSecurity,
      });

      const normalizedEmail = normalizeEmail(email);
      const existingUser =
        await userRepository.findByNormalizedEmail(normalizedEmail);
      if (existingUser) {
        throw new AuthenticationServiceError(
          "EMAIL_ALREADY_EXISTS",
          "Email is already registered.",
        );
      }

      const password_hash = await passwordSecurity.hashPassword(password);

      try {
        const user = await userRepository.createUser({
          email: normalizedEmail,
          password_hash,
          display_name,
        });

        return toPublicUserIdentity(user);
      } catch (error) {
        if (error?.code === "P2002") {
          throw new AuthenticationServiceError(
            "EMAIL_ALREADY_EXISTS",
            "Email is already registered.",
          );
        }

        throw error;
      }
    },

    async login({ email, password }) {
      if (typeof email !== "string" || typeof password !== "string") {
        throw invalidCredentialsError();
      }

      const user = await userRepository.findByNormalizedEmail(
        normalizeEmail(email),
      );
      if (!user || !user.is_active) {
        throw invalidCredentialsError();
      }

      const isPasswordValid = await passwordSecurity.verifyPassword(
        password,
        user.password_hash,
      );
      if (!isPasswordValid) {
        throw invalidCredentialsError();
      }

      const sessionToken = randomBytes(32).toString("base64url");
      const expires_at = new Date(Date.now() + SESSION_LIFETIME_MS);

      await authSessionRepository.createSession({
        user_id: user.id,
        session_identifier_hash: hashSessionToken(sessionToken),
        expires_at,
      });

      return {
        user: toPublicUserIdentity(user),
        sessionToken,
      };
    },

    async logout(sessionToken) {
      if (typeof sessionToken !== "string" || sessionToken.length === 0) {
        return;
      }

      const sessionHash = hashSessionToken(sessionToken);
      const session =
        await authSessionRepository.findBySessionIdentifierHash(sessionHash);
      if (!session || isExpired(session)) {
        return;
      }

      try {
        await authSessionRepository.deleteBySessionIdentifierHash(sessionHash);
      } catch (error) {
        if (error?.code !== "P2025") {
          throw error;
        }
      }
    },

    async getCurrentUser(sessionToken) {
      if (typeof sessionToken !== "string" || sessionToken.length === 0) {
        throw invalidCredentialsError();
      }

      const session = await authSessionRepository.findBySessionIdentifierHash(
        hashSessionToken(sessionToken),
      );
      if (!session || isExpired(session)) {
        throw invalidCredentialsError();
      }

      const user = await userRepository.findById(session.user_id);
      if (!user || !user.is_active) {
        throw invalidCredentialsError();
      }

      return toPublicUserIdentity(user);
    },
  };
}

function validateRegistrationInput({
  display_name,
  email,
  password,
  passwordSecurity,
}) {
  if (
    typeof display_name !== "string" ||
    display_name.length === 0 ||
    typeof email !== "string" ||
    email.length === 0 ||
    !passwordSecurity.validatePasswordPolicy(password)
  ) {
    throw new AuthenticationServiceError(
      "VALIDATION_ERROR",
      "Registration input is invalid.",
    );
  }
}

function normalizeEmail(email) {
  return email.toLowerCase();
}

function hashSessionToken(sessionToken) {
  return createHash("sha256").update(sessionToken).digest("hex");
}

function isExpired(session) {
  return session.expires_at.getTime() <= Date.now();
}

function toPublicUserIdentity(user) {
  return {
    id: user.id,
    email: user.email,
    display_name: user.display_name,
    role: user.role,
  };
}

function invalidCredentialsError() {
  return new AuthenticationServiceError(
    "AUTHENTICATION_FAILED",
    "Authentication failed.",
  );
}
