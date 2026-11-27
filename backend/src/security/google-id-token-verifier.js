// @ts-nocheck
import { OAuth2Client } from "google-auth-library";

const GOOGLE_ISSUERS = new Set(["accounts.google.com", "https://accounts.google.com"]);

export function createGoogleIdTokenVerifier({ clientId, oauthClient = new OAuth2Client() }) {
  if (typeof clientId !== "string" || clientId.trim() === "") return null;

  return Object.freeze({
    async verify(credential) {
      if (typeof credential !== "string" || credential.length === 0 || credential.length > 16_384) {
        throw new GoogleCredentialError();
      }
      let payload;
      try {
        const ticket = await oauthClient.verifyIdToken({ idToken: credential, audience: clientId });
        payload = ticket.getPayload();
      } catch {
        throw new GoogleCredentialError();
      }
      if (
        !payload || !GOOGLE_ISSUERS.has(payload.iss) || payload.aud !== clientId ||
        typeof payload.exp !== "number" || payload.exp * 1000 <= Date.now() ||
        typeof payload.sub !== "string" || payload.sub.length === 0 || payload.sub.length > 255 ||
        typeof payload.email !== "string" || payload.email.length === 0 || payload.email.length > 255 ||
        payload.email_verified !== true || typeof payload.nonce !== "string" || payload.nonce.length === 0
      ) {
        throw new GoogleCredentialError();
      }
      return {
        subject: payload.sub,
        email: payload.email.toLowerCase(),
        displayName: normalizeDisplayName(payload.name, payload.email),
        nonce: payload.nonce,
      };
    },
  });
}

export class GoogleCredentialError extends Error {
  constructor() {
    super("Google authentication failed.");
    this.name = "GoogleCredentialError";
    this.code = "GOOGLE_AUTHENTICATION_FAILED";
  }
}

function normalizeDisplayName(name, email) {
  const candidate = typeof name === "string" ? name.trim() : "";
  return (candidate || email.split("@")[0] || "ELVocab learner").slice(0, 100);
}
