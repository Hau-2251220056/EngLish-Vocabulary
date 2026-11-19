// @ts-nocheck
import { createHmac } from "node:crypto";
import { isIP } from "node:net";

const MINIMUM_SECRET_LENGTH = 32;
const PROXY_MODES = new Set(["direct", "render", "vercel"]);

export function createLoginAbuseKeyFactory({ secret, proxyMode = "direct" }) {
  if (typeof secret !== "string" || secret.length < MINIMUM_SECRET_LENGTH) {
    throw new TypeError("LOGIN_ABUSE_HMAC_SECRET must contain at least 32 characters.");
  }
  if (!PROXY_MODES.has(proxyMode)) {
    throw new TypeError("LOGIN_ABUSE_PROXY_MODE must be direct, render or vercel.");
  }

  return Object.freeze({
    identifier(email) {
      return hmac(secret, `identifier:${normalizeIdentifier(email)}`);
    },
    source(req) {
      return hmac(secret, `source:${resolveClientAddress(req, proxyMode)}`);
    },
  });
}

export function normalizeIdentifier(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function resolveClientAddress(req, proxyMode) {
  const candidate = proxyMode === "render"
    ? firstForwardedAddress(req?.headers?.["x-forwarded-for"])
    : proxyMode === "vercel"
      ? singleAddress(req?.headers?.["x-vercel-forwarded-for"])
      : req?.socket?.remoteAddress;
  const normalized = normalizeAddress(candidate);
  if (!normalized) {
    throw new TypeError("A valid trusted client address is required for login protection.");
  }
  return normalized;
}

function singleAddress(value) {
  if (Array.isArray(value)) value = value.length === 1 ? value[0] : "";
  return typeof value === "string" && !value.includes(",") ? value.trim() : "";
}

function firstForwardedAddress(value) {
  if (Array.isArray(value)) value = value[0];
  return typeof value === "string" ? value.split(",", 1)[0].trim() : "";
}

function normalizeAddress(value) {
  if (typeof value !== "string") return null;
  const candidate = value.startsWith("::ffff:") ? value.slice(7) : value;
  return isIP(candidate) ? candidate.toLowerCase() : null;
}

function hmac(secret, value) {
  return createHmac("sha256", secret).update(value).digest("hex");
}
