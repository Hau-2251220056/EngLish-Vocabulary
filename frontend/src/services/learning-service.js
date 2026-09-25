import { httpClient } from "./http-client.js";

const LEARNING_ENDPOINT = "/api/learning";
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
    async getLearningSet(setId) {
      try {
        const response = await client.get(
          `${LEARNING_ENDPOINT}/sets/${encodeURIComponent(setId)}`,
        );
        return requireLearningSet(response.data?.data);
      } catch (error) {
        throw mapLearningError(error);
      }
    },

    async recordMeaningfulEvent(input) {
      try {
        const response = await client.post(`${LEARNING_ENDPOINT}/events`, input);
        return requireProgress(response.data?.data);
      } catch (error) {
        throw mapLearningError(error);
      }
    },

    async getLearningProgress(query = {}) {
      try {
        const params = serializeProgressQuery(query);
        const response = await client.get(`${LEARNING_ENDPOINT}/progress`, {
          params,
        });
        return requireLearningProgress(response.data?.data);
      } catch (error) {
        throw mapLearningError(error);
      }
    },
  };
}

function serializeProgressQuery(query) {
  if (!query || typeof query !== "object" || Array.isArray(query)) {
    throw invalidProgressQueryError();
  }
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
    if (!PROGRESS_STATUSES.has(query.status)) {
      throw invalidProgressQueryError();
    }
    params.status = query.status;
  }
  return params;
}

function requireLearningSet(value) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    !Array.isArray(value.cards)
  ) {
    throw invalidResponseError();
  }
  return value;
}

function requireProgress(value) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    typeof value.status !== "string" ||
    !Number.isSafeInteger(value.review_count) ||
    !Number.isSafeInteger(value.revision)
  ) {
    throw invalidResponseError();
  }
  return value;
}

function requireLearningProgress(value) {
  if (
    !isRecord(value) ||
    !isSummary(value.summary) ||
    !Array.isArray(value.items) ||
    !value.items.every(isProgressItem) ||
    !isPagination(value.pagination) ||
    !isRecord(value.filter) ||
    !(value.filter.status === null || PROGRESS_STATUSES.has(value.filter.status))
  ) {
    throw invalidResponseError();
  }
  return value;
}

function isSummary(value) {
  if (!isRecord(value)) return false;
  const counts = [
    value.total_started,
    value.learning,
    value.learned,
    value.needs_review,
  ];
  return (
    counts.every(isNonNegativeInteger) &&
    value.total_started === value.learning + value.learned + value.needs_review
  );
}

function isProgressItem(value) {
  return (
    isRecord(value) &&
    isRecord(value.vocabulary) &&
    typeof value.vocabulary.id === "string" &&
    typeof value.vocabulary.word === "string" &&
    (value.vocabulary.phonetic === null ||
      typeof value.vocabulary.phonetic === "string") &&
    PROGRESS_STATUSES.has(value.status) &&
    isNonNegativeInteger(value.review_count) &&
    (value.last_reviewed_at === null ||
      typeof value.last_reviewed_at === "string")
  );
}

function isPagination(value) {
  return (
    isRecord(value) &&
    Number.isSafeInteger(value.page) &&
    value.page > 0 &&
    Number.isSafeInteger(value.page_size) &&
    value.page_size > 0 &&
    value.page_size <= 100 &&
    isNonNegativeInteger(value.total_items) &&
    isNonNegativeInteger(value.total_pages)
  );
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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
    kind:
      status === 404 && code === "LEARNING_SET_NOT_FOUND"
        ? "not-found"
        : status === 409
          ? "conflict"
          : status === null
            ? "operational"
            : "api",
    code,
    message:
      responseError?.message ??
      (status === null
        ? "Learning service is unavailable."
        : "Learning request failed."),
    status,
  });
}

function invalidResponseError() {
  return new LearningApiError({
    kind: "operational",
    code: "INVALID_LEARNING_RESPONSE",
    message: "Learning service returned an invalid response.",
    status: null,
  });
}

function invalidProgressQueryError() {
  return new LearningApiError({
    kind: "validation",
    code: "INVALID_LEARNING_PROGRESS_QUERY",
    message: "Learning progress query is invalid.",
    status: null,
  });
}

export const learningService = createLearningService();
