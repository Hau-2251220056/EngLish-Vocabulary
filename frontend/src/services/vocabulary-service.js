import { httpClient } from "./http-client.js";

const ADMIN_VOCABULARY_ENDPOINT = "/api/admin/vocabulary";
const PRIVATE_VOCABULARY_ENDPOINT = "/api/my/vocabulary";

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

    async getPrivateVocabulary(vocabularyId) {
      try {
        const response = await client.get(privateItemEndpoint(vocabularyId));
        return requirePrivateVocabulary(response.data?.data);
      } catch (error) {
        throw mapVocabularyError(error);
      }
    },

    async updatePrivateVocabulary(vocabularyId, input) {
      try {
        const response = await client.patch(
          privateItemEndpoint(vocabularyId),
          sanitizePrivatePatch(input),
        );
        return requirePrivateVocabulary(response.data?.data);
      } catch (error) {
        throw mapVocabularyError(error);
      }
    },
  };
}

function itemEndpoint(vocabularyId) {
  return `${ADMIN_VOCABULARY_ENDPOINT}/${encodeURIComponent(vocabularyId)}`;
}

function privateItemEndpoint(vocabularyId) {
  return `${PRIVATE_VOCABULARY_ENDPOINT}/${encodeURIComponent(vocabularyId)}`;
}

function sanitizePrivatePatch(value) {
  const patch = {};
  for (const field of ["word", "phonetic"]) {
    if (Object.hasOwn(value ?? {}, field)) patch[field] = value[field];
  }
  if (Object.hasOwn(value ?? {}, "meanings")) {
    patch.meanings = Array.isArray(value.meanings)
      ? value.meanings.map((meaning) => {
          const result = {
            part_of_speech: meaning?.part_of_speech,
            meaning_vi: meaning?.meaning_vi,
          };
          for (const field of ["id", "context", "cefr_level"]) {
            if (Object.hasOwn(meaning ?? {}, field)) result[field] = meaning[field];
          }
          if (Object.hasOwn(meaning ?? {}, "examples")) {
            result.examples = Array.isArray(meaning.examples)
              ? meaning.examples.map((example) => {
                  const normalized = { example_en: example?.example_en };
                  for (const field of ["id", "example_vi"]) {
                    if (Object.hasOwn(example ?? {}, field)) normalized[field] = example[field];
                  }
                  return normalized;
                })
              : meaning.examples;
          }
          return result;
        })
      : value.meanings;
  }
  return patch;
}

function mapVocabularyError(error) {
  if (error instanceof VocabularyApiError) return error;

  const status = error?.response?.status ?? null;
  const responseError = error?.response?.data?.error;

  return new VocabularyApiError({
    kind: status === 404
      ? "not-found"
      : status === 400
        ? "validation"
        : status === 401 || status === 403
          ? "authorization"
          : status === null ? "operational" : "api",
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

function requirePrivateVocabulary(vocabulary) {
  const result = requireVocabulary(vocabulary);
  if (typeof result.id !== "string" || !Array.isArray(result.meanings)) {
    throw invalidResponseError();
  }
  return result;
}

export const vocabularyService = createVocabularyService();
