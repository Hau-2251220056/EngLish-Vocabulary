// @ts-nocheck
import { createHash, randomBytes } from "node:crypto";

const SESSION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
const LOCKOUT_MS = 5 * 60 * 1000;
const WARNING_THRESHOLD = 3;
const LOCKOUT_THRESHOLD = 5;
const DUMMY_PASSWORD_HASH = `$scrypt$N=32768,r=8,p=1$${Buffer.alloc(16).toString("base64url")}$${Buffer.alloc(64).toString("base64url")}`;

export class AuthenticationServiceError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "AuthenticationServiceError";
    this.code = code;
    this.details = details;
  }
}

export function createAuthenticationService({
  userRepository,
  authSessionRepository,
  passwordSecurity,
  loginAbuseKeys,
  withLoginTransaction,
  now = () => new Date(),
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

    async login({ email, password, source }) {
      if (typeof email !== "string" || typeof password !== "string") {
        throw invalidCredentialsError();
      }
      if (!loginAbuseKeys || typeof withLoginTransaction !== "function") {
        throw new TypeError("Shared login abuse protection is required.");
      }

      const normalizedEmail = normalizeEmail(email.trim());
      const identifierKey = loginAbuseKeys.identifier(normalizedEmail);
      const sourceKey = loginAbuseKeys.source(source);

      const outcome = await withLoginTransaction(async ({
        userRepository: transactionalUsers,
        authSessionRepository: transactionalSessions,
        loginAbuseRepository,
      }) => {
        await loginAbuseRepository.lock(identifierKey, sourceKey);
        const attemptedAt = requireDate(now());
        let state = await loginAbuseRepository.find(identifierKey, sourceKey);
        if (state?.blocked_until && state.blocked_until.getTime() <= attemptedAt.getTime()) {
          await loginAbuseRepository.delete(identifierKey, sourceKey);
          state = null;
        }
        if (state?.blocked_until) {
          return {
            authenticationFailure: {
              kind: "locked",
              blockedUntil: state.blocked_until,
              attemptedAt,
            },
          };
        }

        const user = await transactionalUsers.findByNormalizedEmail(normalizedEmail);
        const isPasswordValid = await passwordSecurity.verifyPassword(
          password,
          user?.password_hash ?? DUMMY_PASSWORD_HASH,
        );
        if (!user || !user.is_active || !isPasswordValid) {
          const failureCount = Math.min((state?.failure_count ?? 0) + 1, LOCKOUT_THRESHOLD);
          const blockedUntil = failureCount === LOCKOUT_THRESHOLD
            ? new Date(attemptedAt.getTime() + LOCKOUT_MS)
            : null;
          await loginAbuseRepository.save({
            identifierKey,
            sourceKey,
            failureCount,
            lastFailedAt: attemptedAt,
            blockedUntil,
          });
          if (blockedUntil) {
            return {
              authenticationFailure: { kind: "locked", blockedUntil, attemptedAt },
            };
          }
          if (failureCount >= WARNING_THRESHOLD) {
            return { authenticationFailure: { kind: "warning", failureCount } };
          }
          return { authenticationFailure: { kind: "invalid" } };
        }

        const sessionToken = randomBytes(32).toString("base64url");
        const expires_at = new Date(attemptedAt.getTime() + SESSION_LIFETIME_MS);
        await transactionalSessions.createSession({
          user_id: user.id,
          session_identifier_hash: hashSessionToken(sessionToken),
          expires_at,
        });
        await loginAbuseRepository.deleteForIdentifier(identifierKey);
        return { user: toPublicUserIdentity(user), sessionToken };
      });

      if (outcome.authenticationFailure) {
        throw authenticationFailureError(outcome.authenticationFailure);
      }
      return outcome;
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

      const session = await authSessionRepository.findWithUserBySessionIdentifierHash(
        hashSessionToken(sessionToken),
      );
      if (!session || isExpired(session)) {
        throw invalidCredentialsError();
      }

      const user = session.user;
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

function warningError(failureCount) {
  return new AuthenticationServiceError(
    "AUTHENTICATION_WARNING",
    "Authentication failed. Additional failures will temporarily block login attempts.",
    { attempts_remaining: LOCKOUT_THRESHOLD - failureCount },
  );
}

function authenticationFailureError(outcome) {
  if (outcome.kind === "locked") {
    return lockedError(outcome.blockedUntil, outcome.attemptedAt);
  }
  if (outcome.kind === "warning") {
    return warningError(outcome.failureCount);
  }
  return invalidCredentialsError();
}

function lockedError(blockedUntil, attemptedAt) {
  const retryAfterSeconds = Math.max(
    1,
    Math.min(LOCKOUT_MS / 1000, Math.ceil((blockedUntil.getTime() - attemptedAt.getTime()) / 1000)),
  );
  return new AuthenticationServiceError(
    "AUTHENTICATION_LOCKED",
    "Login attempts are temporarily blocked. Try again later.",
    { retry_after_seconds: retryAfterSeconds },
  );
}

function requireDate(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new TypeError("Authentication clock must return a valid Date.");
  }
  return value;
}
