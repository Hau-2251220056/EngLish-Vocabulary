import { httpClient } from "./http-client.js";

const SESSION_ENDPOINT = "/api/learning-sessions";
const STREAK_ENDPOINT = "/api/users/me/streak";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MODES = new Set(["NORMAL", "SRS", "QUIZ"]);
const STATES = new Set(["ACTIVE", "EXPIRED", "COMPLETED"]);
const EVIDENCE = new Set([
  "NORMAL_REVEALED",
  "SRS_HARD",
  "SRS_GOOD",
  "SRS_EASY",
  "QUIZ_CORRECT",
  "QUIZ_INCORRECT",
]);

export class LearningSessionApiError extends Error {
  constructor({ kind, code, message, status }) {
    super(message);
    this.name = "LearningSessionApiError";
    Object.assign(this, { kind, code, status });
  }
}

export function createLearningSessionService(client = httpClient) {
  return Object.freeze({
    async createSession(input) {
      const body = serializeCreate(input);
      try {
        const value = (await client.post(SESSION_ENDPOINT, body)).data?.data;
        if (!isRecord(value) || typeof value.replayed !== "boolean") throw invalidResponse();
        if (value.session === null) {
          const expectedReason = body.mode === "SRS" ? "SRS_UP_TO_DATE" : "EMPTY_SET";
          if (value.reason !== expectedReason) throw invalidResponse();
          return { session: null, reason: value.reason, replayed: value.replayed };
        }
        const session = requireSessionProjection(value.session);
        requireCreateResponseIdentity(session, body);
        return { session, replayed: value.replayed };
      } catch (error) { throw mapError(error); }
    },

    async readSession(sessionId) {
      requireUuid(sessionId);
      try {
        const session = requireSessionProjection((await client.get(
          `${SESSION_ENDPOINT}/${encodeURIComponent(sessionId)}`,
        )).data?.data, { allowAccessState: true });
        if (session.id !== sessionId) throw invalidResponse();
        return session;
      } catch (error) { throw mapError(error); }
    },

    async acknowledgeNormalReveal(sessionId, vocabularyId, operationId) {
      [sessionId, vocabularyId, operationId].forEach(requireUuid);
      try {
        const value = (await client.put(
          `${SESSION_ENDPOINT}/${encodeURIComponent(sessionId)}/items/${encodeURIComponent(vocabularyId)}/reveal`,
          { operation_id: operationId },
        )).data?.data;
        if (!isRecord(value) || !isRecord(value.item)
          || value.item.vocabulary_id !== vocabularyId
          || value.item.evidence !== "NORMAL_REVEALED"
          || !isInstant(value.item.evidence_at)
          || typeof value.replayed !== "boolean"
          || typeof value.already_acknowledged !== "boolean") throw invalidResponse();
        const session = requireSessionProjection(value.session);
        if (session.id !== sessionId || session.mode !== "NORMAL"
          || !session.items.some((item) => item.vocabulary_id === vocabularyId
            && item.evidence === "NORMAL_REVEALED")) throw invalidResponse();
        return { ...value, session };
      } catch (error) { throw mapError(error); }
    },

    async completeNormalSession(sessionId, operationId) {
      [sessionId, operationId].forEach(requireUuid);
      try {
        const value = (await client.post(
          `${SESSION_ENDPOINT}/${encodeURIComponent(sessionId)}/complete`,
          { operation_id: operationId },
        )).data?.data;
        if (!isRecord(value) || typeof value.replayed !== "boolean") throw invalidResponse();
        const session = requireSessionProjection(value.session);
        if (session.id !== sessionId || session.mode !== "NORMAL"
          || session.state !== "COMPLETED") throw invalidResponse();
        return { session, streak: requireStreakProjection(value.streak), replayed: value.replayed };
      } catch (error) { throw mapError(error); }
    },

    async getCurrentStreak() {
      try {
        return requireStreakProjection((await client.get(STREAK_ENDPOINT)).data?.data);
      } catch (error) { throw mapError(error); }
    },
  });
}

export function requireSessionProjection(value, { allowAccessState = false } = {}) {
  if (!isRecord(value) || !isUuid(value.id) || !isUuid(value.set_id)
    || !MODES.has(value.mode) || !STATES.has(value.state)
    || !isInstant(value.created_at) || !isInstant(value.expires_at)
    || !(value.completed_at === null || isInstant(value.completed_at))
    || !isPositiveInteger(value.snapshot_size) || value.snapshot_size > 10
    || !isNonNegativeInteger(value.completed_items)
    || value.completed_items > value.snapshot_size
    || !Array.isArray(value.items) || value.items.length !== value.snapshot_size
    || !value.items.every((item) => isSessionItem(item, value.mode))) throw invalidResponse();
  const ids = new Set(value.items.map(({ vocabulary_id: id }) => id));
  const positions = value.items.map(({ position }) => position);
  const evidenceCount = value.items.filter(({ evidence }) => evidence !== null).length;
  const createdAt = Date.parse(value.created_at);
  const expiresAt = Date.parse(value.expires_at);
  const completedAt = value.completed_at === null ? null : Date.parse(value.completed_at);
  if (ids.size !== value.items.length || positions.some((position, index) => position !== index)
    || evidenceCount !== value.completed_items
    || (value.state === "COMPLETED") !== (value.completed_at !== null)
    || (value.state === "COMPLETED" && value.completed_items !== value.snapshot_size)
    || expiresAt - createdAt !== 7 * 24 * 60 * 60 * 1000
    || (completedAt !== null && (completedAt < createdAt || completedAt >= expiresAt))) {
    throw invalidResponse();
  }
  if (allowAccessState) {
    if (typeof value.can_continue !== "boolean") throw invalidResponse();
    if (value.restart_reason !== undefined && value.restart_reason !== "SESSION_INACCESSIBLE") {
      throw invalidResponse();
    }
    if (value.restart_reason === "SESSION_INACCESSIBLE" && value.can_continue) throw invalidResponse();
    if (value.restart_reason === undefined && value.can_continue !== (value.state === "ACTIVE")) {
      throw invalidResponse();
    }
  }
  return value;
}

export function requireStreakProjection(value) {
  if (!isRecord(value) || !isNonNegativeInteger(value.current_streak)
    || typeof value.completed_today !== "boolean"
    || !(value.last_qualified_date === null || isIsoDate(value.last_qualified_date))
    || value.timezone !== "Asia/Ho_Chi_Minh" || !isInstant(value.evaluated_at)) throw invalidResponse();
  return value;
}

function serializeCreate(input) {
  if (!isRecord(input)) throw validationError();
  const allowed = new Set(["operation_id", "set_id", "mode", "vocabulary_ids"]);
  if (Object.keys(input).some((field) => !allowed.has(field))) throw validationError();
  requireUuid(input.operation_id); requireUuid(input.set_id);
  if (!MODES.has(input.mode)) throw validationError();
  const hasIds = Object.hasOwn(input, "vocabulary_ids");
  if ((input.mode === "SRS" && hasIds) || (input.mode !== "SRS" && !hasIds)) throw validationError();
  if (hasIds && (!Array.isArray(input.vocabulary_ids)
    || input.vocabulary_ids.length > 10 || !input.vocabulary_ids.every(isUuid)
    || new Set(input.vocabulary_ids).size !== input.vocabulary_ids.length)) throw validationError();
  return hasIds ? { ...input, vocabulary_ids: [...input.vocabulary_ids] } : { ...input };
}

function requireCreateResponseIdentity(session, request) {
  if (session.set_id !== request.set_id || session.mode !== request.mode) throw invalidResponse();
  if (request.mode !== "SRS") {
    const responseIds = session.items.map(({ vocabulary_id: vocabularyId }) => vocabularyId);
    if (responseIds.length !== request.vocabulary_ids.length
      || responseIds.some((vocabularyId, index) => vocabularyId !== request.vocabulary_ids[index])) {
      throw invalidResponse();
    }
  }
}

function isSessionItem(value, mode) {
  const modeEvidence = mode === "NORMAL"
    ? new Set(["NORMAL_REVEALED"])
    : mode === "SRS"
      ? new Set(["SRS_HARD", "SRS_GOOD", "SRS_EASY"])
      : new Set(["QUIZ_CORRECT", "QUIZ_INCORRECT"]);
  return isRecord(value) && isUuid(value.vocabulary_id) && isNonNegativeInteger(value.position)
    && (value.evidence === null || (EVIDENCE.has(value.evidence) && modeEvidence.has(value.evidence)));
}

function mapError(error) {
  if (error instanceof LearningSessionApiError) return error;
  const status = error?.response?.status ?? null;
  const responseError = error?.response?.data?.error;
  return new LearningSessionApiError({
    kind: status === 404 ? "not-found" : status === 409 ? "conflict"
      : status === null ? "operational" : "api",
    code: responseError?.code ?? "LEARNING_SESSION_REQUEST_FAILED",
    message: responseError?.message ?? (status === null
      ? "Learning Session service is unavailable." : "Learning Session request failed."),
    status,
  });
}

function validationError() {
  return new LearningSessionApiError({ kind: "validation", code: "INVALID_LEARNING_SESSION_REQUEST", message: "Learning Session request is invalid.", status: null });
}
function invalidResponse() {
  return new LearningSessionApiError({ kind: "operational", code: "INVALID_LEARNING_SESSION_RESPONSE", message: "Learning Session service returned an invalid response.", status: null });
}
function requireUuid(value) { if (!isUuid(value)) throw validationError(); }
function isUuid(value) { return typeof value === "string" && UUID_PATTERN.test(value); }
function isRecord(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function isInstant(value) { return typeof value === "string" && /(?:Z|[+-]\d{2}:\d{2})$/i.test(value) && !Number.isNaN(Date.parse(value)); }
function isIsoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed) && new Date(parsed).toISOString().slice(0, 10) === value;
}
function isNonNegativeInteger(value) { return Number.isSafeInteger(value) && value >= 0; }
function isPositiveInteger(value) { return Number.isSafeInteger(value) && value > 0; }

export const learningSessionService = createLearningSessionService();
