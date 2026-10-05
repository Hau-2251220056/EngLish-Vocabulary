import { httpClient } from "./http-client.js";

const LEARNING_ENDPOINT = "/api/learning";
const MODES = new Set(["SRS", "NORMAL"]);
const RATINGS = new Set(["AGAIN", "HARD", "GOOD", "EASY"]);
const SRS_INTERVALS = new Set([1, 3, 7, 14, 30]);
const PROGRESS_STATUSES = new Set(["LEARNING", "LEARNED", "NEEDS_REVIEW"]);

export class LearningApiError extends Error {
  constructor({ kind, code, message, status }) {
    super(message);
    this.name = "LearningApiError";
    this.kind = kind;
    this.code = code;
    this.status = status;
  }
}

export function createLearningService(client = httpClient) {
  return {
    async getLearningSet(setId, { mode = "SRS", omitMode = false } = {}) {
      if (!MODES.has(mode) || typeof omitMode !== "boolean") throw invalidModeError();
      try {
        const response = await client.get(
          `${LEARNING_ENDPOINT}/sets/${encodeURIComponent(setId)}`,
          omitMode ? undefined : { params: { mode } },
        );
        return requireLearningSet(response.data?.data, mode);
      } catch (error) {
        throw mapLearningError(error);
      }
    },

    async recordMeaningfulEvent(input) {
      if (!isRecord(input) || !RATINGS.has(input.rating)) throw invalidRatingError();
      try {
        const response = await client.post(`${LEARNING_ENDPOINT}/events`, input);
        return requireRatingProgress(response.data?.data);
      } catch (error) {
        throw mapLearningError(error);
      }
    },

    async getLearningProgress(query = {}) {
      try {
        const params = serializeProgressQuery(query);
        const response = await client.get(`${LEARNING_ENDPOINT}/progress`, { params });
        return requireLearningProgress(response.data?.data);
      } catch (error) {
        throw mapLearningError(error);
      }
    },
  };
}

function requireLearningSet(value, requestedMode) {
  if (
    !isRecord(value) || value.mode !== requestedMode || typeof value.id !== "string"
    || typeof value.name !== "string" || !isNonNegativeInteger(value.total_items)
    || !Array.isArray(value.cards) || !value.cards.every(isLearningCard)
  ) throw invalidResponseError();

  if (requestedMode === "SRS") {
    if (
      !isDateString(value.evaluated_at)
      || !isNonNegativeInteger(value.eligible_count)
      || value.eligible_count !== value.cards.length
      || !(value.next_review_at === null || isDateString(value.next_review_at))
      || !value.cards.every((card) => isRatingPreviews(card.rating_previews))
    ) throw invalidResponseError();
  } else if (value.cards.length !== value.total_items) {
    throw invalidResponseError();
  }
  return value;
}

function isRatingPreviews(value) {
  if (!isRecord(value) || Object.keys(value).length !== RATINGS.size) return false;
  if (!isRecord(value.AGAIN)
    || value.AGAIN.kind !== "SESSION_REQUEUE"
    || value.AGAIN.interval_days !== null) return false;
  return ["HARD", "GOOD", "EASY"].every((rating) => (
    isRecord(value[rating])
    && value[rating].kind === "SCHEDULED"
    && SRS_INTERVALS.has(value[rating].interval_days)
  ));
}

function isLearningCard(value) {
  return isRecord(value) && typeof value.id === "string" && typeof value.word === "string"
    && isNonNegativeInteger(value.position) && Array.isArray(value.meanings)
    && isRecord(value.progress) && typeof value.progress.effective_status === "string"
    && isNonNegativeInteger(value.progress.stage)
    && (value.progress.interval_days === null || isNonNegativeInteger(value.progress.interval_days))
    && (value.progress.next_review_at === null || isDateString(value.progress.next_review_at))
    && isNonNegativeInteger(value.progress.review_count)
    && isNonNegativeInteger(value.progress.revision);
}

function requireRatingProgress(value) {
  if (
    !isRecord(value) || typeof value.vocabulary_id !== "string"
    || typeof value.status !== "string" || typeof value.effective_status !== "string"
    || !isNonNegativeInteger(value.stage)
    || !(value.interval_days === null || isNonNegativeInteger(value.interval_days))
    || !isDateString(value.next_review_at) || !isDateString(value.last_reviewed_at)
    || !isNonNegativeInteger(value.review_count) || !isNonNegativeInteger(value.revision)
  ) throw invalidResponseError();
  return value;
}

function serializeProgressQuery(query) {
  if (!isRecord(query)) throw invalidProgressQueryError();
  const supportedFields = new Set(["page", "page_size", "status"]);
  if (Object.keys(query).some((field) => !supportedFields.has(field))) {
    throw invalidProgressQueryError();
  }
  const params = {};
  for (const field of ["page", "page_size"]) {
    if (query[field] === undefined) continue;
    if (!Number.isSafeInteger(query[field]) || query[field] < 1) {
      throw invalidProgressQueryError();
    }
    params[field] = query[field];
  }
  if (query.page_size > 100) throw invalidProgressQueryError();
  if (query.status !== undefined) {
    if (!PROGRESS_STATUSES.has(query.status)) throw invalidProgressQueryError();
    params.status = query.status;
  }
  return params;
}

function requireLearningProgress(value) {
  if (
    !isRecord(value) || !isDateString(value.evaluated_at) || !isSummary(value.summary)
    || !Array.isArray(value.items) || !value.items.every(isProgressItem)
    || !isPagination(value.pagination) || !isRecord(value.filter)
    || !(value.filter.status === null || PROGRESS_STATUSES.has(value.filter.status))
  ) throw invalidResponseError();
  return value;
}

function isSummary(value) {
  if (!isRecord(value)) return false;
  const counts = [value.total_started, value.learning, value.learned, value.needs_review];
  return counts.every(isNonNegativeInteger)
    && value.total_started === value.learning + value.learned + value.needs_review;
}

function isProgressItem(value) {
  return isRecord(value) && isRecord(value.vocabulary)
    && typeof value.vocabulary.id === "string" && typeof value.vocabulary.word === "string"
    && (value.vocabulary.phonetic === null || typeof value.vocabulary.phonetic === "string")
    && PROGRESS_STATUSES.has(value.status) && isNonNegativeInteger(value.review_count)
    && (value.last_reviewed_at === null || isDateString(value.last_reviewed_at))
    && (value.interval_days === null || isNonNegativeInteger(value.interval_days))
    && (value.next_review_at === null || isDateString(value.next_review_at));
}

function isPagination(value) {
  return isRecord(value) && Number.isSafeInteger(value.page) && value.page > 0
    && Number.isSafeInteger(value.page_size) && value.page_size > 0 && value.page_size <= 100
    && isNonNegativeInteger(value.total_items) && isNonNegativeInteger(value.total_pages);
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isDateString(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function isNonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function mapLearningError(error) {
  if (error instanceof LearningApiError) return error;
  const status = error?.response?.status ?? null;
  const responseError = error?.response?.data?.error;
  const code = responseError?.code ?? "LEARNING_REQUEST_FAILED";
  return new LearningApiError({
    kind: status === 404 && code === "LEARNING_SET_NOT_FOUND"
      ? "not-found"
      : status === 409 ? "conflict" : status === null ? "operational" : "api",
    code,
    message: responseError?.message ?? (status === null
      ? "Learning service is unavailable." : "Learning request failed."),
    status,
  });
}

function invalidResponseError() {
  return new LearningApiError({ kind: "operational", code: "INVALID_LEARNING_RESPONSE", message: "Learning service returned an invalid response.", status: null });
}

function invalidProgressQueryError() {
  return new LearningApiError({ kind: "validation", code: "INVALID_LEARNING_PROGRESS_QUERY", message: "Learning progress query is invalid.", status: null });
}

function invalidModeError() {
  return new LearningApiError({ kind: "validation", code: "INVALID_LEARNING_MODE", message: "Learning mode is invalid.", status: null });
}

function invalidRatingError() {
  return new LearningApiError({ kind: "validation", code: "INVALID_LEARNING_RATING", message: "Learning rating is invalid.", status: null });
}

export const learningService = createLearningService();
