// @ts-nocheck
import { randomUUID } from "node:crypto";

const CONTEXT = Symbol("requestDiagnostics");
const CORRELATION_ID_PATTERN = /^[a-z0-9._:-]{1,128}$/i;
const PRISMA_CODE_PATTERN = /^P\d{4}$/;
const UUID_SEGMENT_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE_ROUTE_SEGMENTS = new Set([
  "admin", "api", "auth", "complete", "items", "learning", "learning-path",
  "learning-sessions", "login", "logout", "me", "my", "passes", "progress",
  "quiz", "register", "restart", "review", "reveal", "sessions", "streak",
  "topics", "users", "vocabulary", "vocabulary-sets",
]);
const SAFE_ERROR_NAMES = new Set([
  "Error",
  "TypeError",
  "PrismaClientInitializationError",
  "PrismaClientKnownRequestError",
  "PrismaClientRustPanicError",
  "PrismaClientUnknownRequestError",
  "PrismaClientValidationError",
]);
const CONNECTION_CODES = new Set(["P1001", "P1002", "P1008", "P1017", "P2024"]);

let requestCount = 0;

export function createRequestDiagnosticsMiddleware({ now = () => performance.now(), uuid = randomUUID } = {}) {
  return function requestDiagnostics(req, _res, next) {
    requestCount += 1;
    req[CONTEXT] = Object.freeze({
      correlationId: correlationId(req.headers?.["x-vercel-id"], uuid),
      startedAt: now(),
      instanceRequest: requestCount === 1 ? "FIRST" : "SUBSEQUENT",
    });
    next();
  };
}

export function logUnexpectedRequestError({ error, req, logger = console, now = () => performance.now() }) {
  const context = req?.[CONTEXT];
  const code = safePrismaCode(error?.code);
  const event = {
    event: "unexpected_request_error",
    schema_version: 1,
    correlation_id: context?.correlationId ?? randomUUID(),
    method: safeMethod(req?.method),
    route: normalizedRoute(req?.originalUrl ?? req?.url),
    error_name: safeErrorName(error?.name),
    prisma_code: code,
    category: classifyError(error?.name, code),
    elapsed_ms: elapsedMilliseconds(context?.startedAt, now()),
    instance_request: context?.instanceRequest ?? "UNKNOWN",
  };
  logger.error(JSON.stringify(event));
  return event;
}

export function createUnexpectedErrorMiddleware({ logger = console } = {}) {
  return function unexpectedErrorMiddleware(error, req, res, _next) {
    if (error?.code === "CEFR_LEVEL_LOCKED") {
      res.status(403).json({
        success: false,
        error: { code: error.code, message: error.message },
      });
      return;
    }
    logUnexpectedRequestError({ error, req, logger });
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred.",
      },
    });
  };
}

function correlationId(value, uuid) {
  const candidate = Array.isArray(value) ? value[0] : value;
  return typeof candidate === "string" && CORRELATION_ID_PATTERN.test(candidate)
    ? candidate
    : uuid();
}

function normalizedRoute(value) {
  if (typeof value !== "string") return "UNKNOWN";
  const pathname = value.split("?", 1)[0];
  const segments = pathname.split("/").map((segment) => {
    if (segment === "" || SAFE_ROUTE_SEGMENTS.has(segment)) return segment;
    return UUID_SEGMENT_PATTERN.test(segment) ? ":id" : ":segment";
  });
  const normalized = segments.join("/");
  return normalized.startsWith("/") ? normalized : "UNKNOWN";
}

function safeMethod(value) {
  return typeof value === "string" && /^[A-Z]{3,10}$/.test(value) ? value : "UNKNOWN";
}

function safeErrorName(value) {
  return SAFE_ERROR_NAMES.has(value) ? value : "Error";
}

function safePrismaCode(value) {
  return typeof value === "string" && PRISMA_CODE_PATTERN.test(value) ? value : null;
}

function classifyError(name, code) {
  if (name === "PrismaClientInitializationError") return "prisma_initialization";
  if (CONNECTION_CODES.has(code)) return "prisma_connection";
  if (name === "PrismaClientKnownRequestError" || code !== null) return "prisma_known_request";
  if (name === "PrismaClientUnknownRequestError" || name === "PrismaClientRustPanicError") {
    return "prisma_runtime";
  }
  if (name === "PrismaClientValidationError") return "prisma_validation";
  return "application_unexpected";
}

function elapsedMilliseconds(startedAt, finishedAt) {
  if (!Number.isFinite(startedAt) || !Number.isFinite(finishedAt)) return null;
  return Math.max(0, Math.round(finishedAt - startedAt));
}
