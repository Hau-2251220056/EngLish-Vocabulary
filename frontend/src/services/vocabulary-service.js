import { httpClient } from "./http-client.js";

const ADMIN_VOCABULARY_ENDPOINT = "/api/admin/vocabulary";

export class VocabularyApiError extends Error {
  constructor({ kind, code, message, status }) {
    super(message);
    this.name = "VocabularyApiError";
    this.kind = kind;
    this.code = code;
    this.status = status;
  }
}

export function createVocabularyService(client = httpClient) {
  return {
    async listVocabulary() {
      try {
        const response = await client.get(ADMIN_VOCABULARY_ENDPOINT);
        const vocabulary = response.data?.data;
        if (!Array.isArray(vocabulary)) throw invalidResponseError();
        return vocabulary;
      } catch (error) {
        throw mapVocabularyError(error);
      }
    },

    async getVocabulary(vocabularyId) {
      try {
        const response = await client.get(itemEndpoint(vocabularyId));
        return requireVocabulary(response.data?.data);
      } catch (error) {
        throw mapVocabularyError(error);
      }
    },

    async createVocabulary(input) {
      try {
        const response = await client.post(ADMIN_VOCABULARY_ENDPOINT, input);
        return requireVocabulary(response.data?.data);
      } catch (error) {
        throw mapVocabularyError(error);
      }
    },

    async updateVocabulary(vocabularyId, input) {
      try {
        const response = await client.patch(itemEndpoint(vocabularyId), input);
        return requireVocabulary(response.data?.data);
      } catch (error) {
        throw mapVocabularyError(error);
      }
    },

    async deleteVocabulary(vocabularyId) {
      try {
        await client.delete(itemEndpoint(vocabularyId));
      } catch (error) {
        throw mapVocabularyError(error);
      }
    },
  };
}

function itemEndpoint(vocabularyId) {
  return `${ADMIN_VOCABULARY_ENDPOINT}/${encodeURIComponent(vocabularyId)}`;
}

function mapVocabularyError(error) {
  if (error instanceof VocabularyApiError) return error;

  const status = error?.response?.status ?? null;
  const responseError = error?.response?.data?.error;

  return new VocabularyApiError({
    kind: status === null ? "operational" : "api",
    code: responseError?.code ?? "VOCABULARY_REQUEST_FAILED",
    message:
      responseError?.message ??
      (status === null
        ? "Vocabulary service is unavailable."
        : "Vocabulary request failed."),
    status,
  });
}

function invalidResponseError() {
  return new VocabularyApiError({
    kind: "operational",
    code: "INVALID_VOCABULARY_RESPONSE",
    message: "Vocabulary service returned an invalid response.",
    status: null,
  });
}

function requireVocabulary(vocabulary) {
  if (!vocabulary || typeof vocabulary !== "object" || Array.isArray(vocabulary)) {
    throw invalidResponseError();
  }
  return vocabulary;
}

export const vocabularyService = createVocabularyService();
