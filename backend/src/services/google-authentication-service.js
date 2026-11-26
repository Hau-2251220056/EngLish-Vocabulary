// @ts-nocheck
import { createHash, randomBytes } from "node:crypto";
import { createSessionCredential } from "./authentication-service.js";

const CHALLENGE_LIFETIME_MS = 5 * 60 * 1000;
const CHALLENGE_RATE_WINDOW_MS = 60 * 1000;
const CHALLENGE_RATE_LIMIT = 10;

export class GoogleAuthenticationServiceError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "GoogleAuthenticationServiceError";
    this.code = code;
  }
}

export function createGoogleAuthenticationService({
  verifier,
  withGoogleTransaction,
  withChallengeTransaction,
  loginAbuseKeys,
  now = () => new Date(),
}) {
  return {
    get isConfigured() {
      return Boolean(verifier);
    },

    async createChallenge(browserBinding, source) {
      requireConfigured(verifier);
      const issuedAt = now();
      const binding = typeof browserBinding === "string" && browserBinding.length >= 32
        ? browserBinding
        : randomBytes(32).toString("base64url");
      const nonce = randomBytes(32).toString("base64url");
      const expiresAt = new Date(issuedAt.getTime() + CHALLENGE_LIFETIME_MS);
      const sourceKey = loginAbuseKeys.source(source);
      const identifierKey = loginAbuseKeys.identifier("google-auth-challenge");
      await withChallengeTransaction(async ({ challengeRepository: challenges, loginAbuseRepository }) => {
        await loginAbuseRepository.lock(identifierKey, sourceKey);
        const count = await challenges.countRecentForSource(
          sourceKey,
          new Date(issuedAt.getTime() - CHALLENGE_RATE_WINDOW_MS),
        );
        if (count >= CHALLENGE_RATE_LIMIT) {
          throw new GoogleAuthenticationServiceError("GOOGLE_AUTH_RATE_LIMITED", "Too many Google authentication attempts.");
        }
        await challenges.create({
          nonce_hash: hashValue(nonce),
          browser_binding_hash: hashValue(binding),
          source_key: sourceKey,
          expires_at: expiresAt,
          now: issuedAt,
        });
      });
      return { nonce, binding, expiresAt };
    },

    async authenticate({ credential, browserBinding }) {
      requireConfigured(verifier);
      if (typeof browserBinding !== "string" || browserBinding.length < 32) {
        throw failed();
      }
      let identity;
      try {
        identity = await verifier.verify(credential);
      } catch {
        throw failed();
      }
      const consumedAt = now();
      const resolveInTransaction = async ({
        challengeRepository: challenges,
        authIdentityRepository,
        userRepository,
        authSessionRepository,
      }) => {
        const consumed = await challenges.consume({
          nonce_hash: hashValue(identity.nonce),
          browser_binding_hash: hashValue(browserBinding),
          consumed_at: consumedAt,
        });
        if (consumed.count !== 1) return { error: "GOOGLE_AUTHENTICATION_FAILED" };

        const linked = await authIdentityRepository.findGoogleIdentity(identity.subject);
        if (linked) {
          if (!linked.user?.is_active || linked.user.role === "ADMIN") {
            return { error: "GOOGLE_AUTHENTICATION_FAILED" };
          }
          if (linked.provider_email !== identity.email) {
            await authIdentityRepository.updateGoogleEmail(linked.id, identity.email);
          }
          return issueSession(linked.user, authSessionRepository, consumedAt);
        }

        if (await userRepository.findByNormalizedEmail(identity.email)) {
          return { error: "GOOGLE_ACCOUNT_LINK_REQUIRED" };
        }

        const user = await userRepository.createGoogleUser({
          email: identity.email,
          display_name: identity.displayName,
        });
        await authIdentityRepository.createGoogleIdentity({
          user_id: user.id,
          provider_subject: identity.subject,
          provider_email: identity.email,
        });
        return issueSession(user, authSessionRepository, consumedAt);
      };
      let outcome;
      try {
        outcome = await withGoogleTransaction(resolveInTransaction);
      } catch (error) {
        if (error?.code !== "P2002") throw error;
        outcome = await withGoogleTransaction(resolveInTransaction);
      }

      if (outcome.error === "GOOGLE_ACCOUNT_LINK_REQUIRED") {
        throw new GoogleAuthenticationServiceError(
          outcome.error,
          "Use your ELVocab email and password to sign in.",
        );
      }
      if (outcome.error) throw failed();
      return outcome;
    },
  };
}

async function issueSession(user, repository, issuedAt) {
  const session = createSessionCredential(issuedAt);
  await repository.createSession({
    user_id: user.id,
    session_identifier_hash: session.sessionIdentifierHash,
    expires_at: session.expiresAt,
  });
  return { user, sessionToken: session.sessionToken };
}

function requireConfigured(verifier) {
  if (!verifier) throw new GoogleAuthenticationServiceError("GOOGLE_AUTH_UNAVAILABLE", "Google authentication is unavailable.");
}

function failed() {
  return new GoogleAuthenticationServiceError("GOOGLE_AUTHENTICATION_FAILED", "Google authentication failed.");
}

function hashValue(value) {
  return createHash("sha256").update(value).digest("hex");
}
