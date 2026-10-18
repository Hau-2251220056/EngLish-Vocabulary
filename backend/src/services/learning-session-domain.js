// @ts-nocheck
export const LEARNING_SESSION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

const EXPLICIT_INSTANT_PATTERN = /(?:Z|[+-]\d{2}:\d{2})$/i;

export function captureOperationTime(now = systemClock) {
  if (typeof now !== "function") {
    throw new TypeError("now must be a function.");
  }

  const instant = requireInstant(now(), "Server clock");
  return Object.freeze({
    instant: new Date(instant),
  });
}

export function deriveSessionExpiry(createdAt) {
  const createdInstant = requireInstant(createdAt, "createdAt");
  return new Date(createdInstant.getTime() + LEARNING_SESSION_LIFETIME_MS);
}

export function isSessionAcceptingAt(expiresAt, acceptedAt) {
  const expiryInstant = requireInstant(expiresAt, "expiresAt");
  const acceptedInstant = requireInstant(acceptedAt, "acceptedAt");
  return acceptedInstant.getTime() < expiryInstant.getTime();
}

export function projectSessionLifecycle(session, evaluatedAt) {
  if (!session || typeof session !== "object" || Array.isArray(session)) {
    throw new TypeError("session must be an object.");
  }
  if (session.status === "COMPLETED") return "COMPLETED";
  if (session.status !== "ACTIVE") {
    throw new TypeError("Unsupported Learning Session status.");
  }

  return isSessionAcceptingAt(session.expires_at, evaluatedAt)
    ? "ACTIVE"
    : "EXPIRED";
}

function systemClock() {
  return new Date();
}

function requireInstant(value, name) {
  if (
    !(value instanceof Date)
    && !(typeof value === "number" && Number.isFinite(value))
    && !(typeof value === "string" && EXPLICIT_INSTANT_PATTERN.test(value))
  ) {
    throw new TypeError(`${name} must be a valid instant.`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError(`${name} must be a valid instant.`);
  }
  return date;
}
