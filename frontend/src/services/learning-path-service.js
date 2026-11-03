import { httpClient } from "./http-client.js";
import { requireSessionProjection } from "./learning-session-service.js";

const PATH_ENDPOINT = "/api/learning-path";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LEVELS = ["A1", "A2", "B1", "B2", "C1"];
const PASS_STATES = new Set(["ACTIVE", "INVALIDATED", "COMPLETED"]);

export class LearningPathApiError extends Error {
  constructor({ kind, code, message, status }) {
    super(message);
    this.name = "LearningPathApiError";
    Object.assign(this, { kind, code, status });
  }
}

export function createLearningPathService(client = httpClient) {
  return Object.freeze({
    async getPath() {
      return request(() => client.get(PATH_ENDPOINT), requirePathProjection);
    },
    async startPass(setId, operationId) {
      requireUuid(setId); requireUuid(operationId);
      return request(
        () => client.post(`${PATH_ENDPOINT}/sets/${encodeURIComponent(setId)}/passes`, { operation_id: operationId }),
        requirePassMutation,
      );
    },
    async readPass(passId) {
      requireUuid(passId);
      return request(
        () => client.get(`${PATH_ENDPOINT}/passes/${encodeURIComponent(passId)}`),
        requirePassProjection,
      );
    },
    async createNextSession(passId, operationId) {
      requireUuid(passId); requireUuid(operationId);
      return request(
        () => client.post(`${PATH_ENDPOINT}/passes/${encodeURIComponent(passId)}/sessions`, { operation_id: operationId }),
        requirePassSessionMutation,
      );
    },
    async restartPass(passId, operationId) {
      requireUuid(passId); requireUuid(operationId);
      return request(
        () => client.post(`${PATH_ENDPOINT}/passes/${encodeURIComponent(passId)}/restart`, { operation_id: operationId }),
        requirePassMutation,
      );
    },
    async completePass(passId, operationId) {
      requireUuid(passId); requireUuid(operationId);
      return request(
        () => client.post(`${PATH_ENDPOINT}/passes/${encodeURIComponent(passId)}/complete`, { operation_id: operationId }),
        requireCompletionMutation,
      );
    },
  });
}

async function request(call, validate) {
  try {
    return validate((await call()).data?.data);
  } catch (error) {
    throw mapError(error);
  }
}

export function requirePathProjection(value) {
  if (!isRecord(value) || !isInstant(value.evaluated_at)
    || !LEVELS.includes(value.highest_unlocked_level)
    || !(value.path_completed_at === null || isInstant(value.path_completed_at))
    || typeof value.all_current_sets_complete !== "boolean"
    || !Array.isArray(value.levels) || value.levels.length !== LEVELS.length
    || !value.levels.every((entry, index) => isLevel(entry, LEVELS[index]))
    || !(value.recommendation === null || isRecommendation(value.recommendation))) {
    throw invalidResponse();
  }
  return value;
}

export function requirePassProjection(value) {
  if (!isRecord(value) || !isUuid(value.id) || !isUuid(value.set_id)
    || !PASS_STATES.has(value.state) || !isPositiveInteger(value.snapshot_size)
    || !isNonNegativeInteger(value.studied_items)
    || !isNonNegativeInteger(value.remaining_items)
    || value.studied_items + value.remaining_items !== value.snapshot_size
    || !isInstant(value.created_at)
    || !(value.completed_at === null || isInstant(value.completed_at))) throw invalidResponse();
  if (Object.hasOwn(value, "can_continue") && typeof value.can_continue !== "boolean") throw invalidResponse();
  if (Object.hasOwn(value, "restart_reason") && value.restart_reason !== "SNAPSHOT_CHANGED") throw invalidResponse();
  return value;
}

function requirePassMutation(value) {
  if (!isRecord(value) || typeof value.replayed !== "boolean") throw invalidResponse();
  if (Object.hasOwn(value, "resumed") && typeof value.resumed !== "boolean") throw invalidResponse();
  return { ...value, pass: requirePassProjection(value.pass) };
}

function requirePassSessionMutation(value) {
  if (!isRecord(value) || typeof value.replayed !== "boolean") throw invalidResponse();
  if (value.session === null) {
    if (value.reason !== "PASS_READY_TO_COMPLETE") throw invalidResponse();
    return value;
  }
  const session = requireSessionProjection(value.session);
  if (session.mode !== "NORMAL") throw invalidResponse();
  return { ...value, session };
}

function requireCompletionMutation(value) {
  if (!isRecord(value) || typeof value.replayed !== "boolean") throw invalidResponse();
  const pass = requirePassProjection(value.pass);
  if (pass.state !== "COMPLETED") throw invalidResponse();
  const path = requirePathProjection(value.path);
  return { ...value, pass, path };
}

function isLevel(value, level) {
  return isRecord(value) && value.level === level && typeof value.unlocked === "boolean"
    && isNonNegativeInteger(value.required_count) && isNonNegativeInteger(value.completed_count)
    && value.completed_count <= value.required_count && typeof value.current_complete === "boolean"
    && ["NO_REQUIRED_SETS", "EMPTY_REQUIRED_SET", "READY"].includes(value.configuration)
    && Array.isArray(value.incomplete_sets)
    && value.incomplete_sets.every((set) => isRecord(set) && isUuid(set.id)
      && typeof set.name === "string" && set.name.length > 0 && isInstant(set.created_at));
}

function isRecommendation(value) {
  return isRecord(value) && ["START", "RESUME"].includes(value.action)
    && isUuid(value.set_id)
    && (value.action === "START" ? value.pass_id === null : isUuid(value.pass_id));
}

function mapError(error) {
  if (error instanceof LearningPathApiError) return error;
  const status = error?.response?.status ?? null;
  const responseError = error?.response?.data?.error;
  return new LearningPathApiError({
    kind: status === 404 ? "not-found" : status === 409 ? "conflict"
      : status === 403 ? "forbidden" : status === null ? "operational" : "api",
    code: responseError?.code ?? "LEARNING_PATH_REQUEST_FAILED",
    message: responseError?.message ?? "Learning Path request failed.",
    status,
  });
}

function validationError() {
  return new LearningPathApiError({ kind: "validation", code: "INVALID_LEARNING_PATH_REQUEST", message: "Learning Path request is invalid.", status: null });
}
function invalidResponse() {
  return new LearningPathApiError({ kind: "operational", code: "INVALID_LEARNING_PATH_RESPONSE", message: "Learning Path service returned an invalid response.", status: null });
}
function requireUuid(value) { if (!isUuid(value)) throw validationError(); }
function isUuid(value) { return typeof value === "string" && UUID_PATTERN.test(value); }
function isRecord(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function isInstant(value) { return typeof value === "string" && /(?:Z|[+-]\d{2}:\d{2})$/i.test(value) && !Number.isNaN(Date.parse(value)); }
function isNonNegativeInteger(value) { return Number.isSafeInteger(value) && value >= 0; }
function isPositiveInteger(value) { return Number.isSafeInteger(value) && value > 0; }

export const learningPathService = createLearningPathService();
