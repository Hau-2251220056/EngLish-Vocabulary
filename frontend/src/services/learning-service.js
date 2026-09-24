import { httpClient } from "./http-client.js";

const LEARNING_ENDPOINT = "/api/learning";

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
  };
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

export const learningService = createLearningService();
