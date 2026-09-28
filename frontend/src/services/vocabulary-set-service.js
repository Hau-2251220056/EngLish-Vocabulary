import { httpClient } from "./http-client.js";

const PUBLIC_ENDPOINT = "/api/vocabulary-sets";
const MY_SETS_ENDPOINT = "/api/my/vocabulary-sets";
const ADMIN_ENDPOINT = "/api/admin/vocabulary-sets";
const PICKER_ENDPOINT = "/api/vocabulary-set-picker";

export class VocabularySetApiError extends Error {
  constructor({ kind, code, message, status }) {
    super(message);
    this.name = "VocabularySetApiError";
    this.kind = kind;
    this.code = code;
    this.status = status;
  }
}

export function createVocabularySetService(client = httpClient) {
  return {
    async listPublicSystemSets(topicId) {
      return getList(client, `/api/topics/${encodeURIComponent(topicId)}/vocabulary-sets`);
    },
    async getPublicSystemSet(setId) {
      return getAggregate(client, itemEndpoint(PUBLIC_ENDPOINT, setId));
    },
    async listMySets() { return getList(client, MY_SETS_ENDPOINT); },
    async getMySet(setId) { return getAggregate(client, itemEndpoint(MY_SETS_ENDPOINT, setId)); },
    async createMySet(input) { return mutateAggregate(client, "post", MY_SETS_ENDPOINT, input); },
    async updateMySet(setId, input) { return mutateAggregate(client, "patch", itemEndpoint(MY_SETS_ENDPOINT, setId), input); },
    async deleteMySet(setId) { return deleteSet(client, itemEndpoint(MY_SETS_ENDPOINT, setId)); },
    async copySystemSet(setId) {
      return mutateAggregate(client, "post", `${itemEndpoint(PUBLIC_ENDPOINT, setId)}/copy`);
    },
    async searchVocabularyPicker(query) {
      try {
        const response = await client.get(PICKER_ENDPOINT, { params: { query } });
        if (!Array.isArray(response.data?.data)) throw invalidResponseError();
        return response.data.data.map(requirePickerResult);
      } catch (error) { throw mapVocabularySetError(error); }
    },
    async createPrivateVocabularyAndAdd(setId, operationId, vocabulary) {
      try {
        const response = await client.post(
          `${itemEndpoint(MY_SETS_ENDPOINT, setId)}/vocabulary`,
          { operation_id: operationId, vocabulary: sanitizePrivateCreate(vocabulary) },
        );
        return requirePrivateCreateResult(response.data?.data);
      } catch (error) { throw mapVocabularySetError(error); }
    },
    async listAdminSystemSets() { return getList(client, ADMIN_ENDPOINT); },
    async getAdminSystemSet(setId) { return getAggregate(client, itemEndpoint(ADMIN_ENDPOINT, setId)); },
    async createAdminSystemSet(input) { return mutateAggregate(client, "post", ADMIN_ENDPOINT, input); },
    async updateAdminSystemSet(setId, input) { return mutateAggregate(client, "patch", itemEndpoint(ADMIN_ENDPOINT, setId), input); },
    async deleteAdminSystemSet(setId) { return deleteSet(client, itemEndpoint(ADMIN_ENDPOINT, setId)); },
  };
}

async function getList(client, url, options) {
  try {
    const response = await client.get(url, options);
    if (!Array.isArray(response.data?.data)) throw invalidResponseError();
    return response.data.data;
  } catch (error) { throw mapVocabularySetError(error); }
}

async function getAggregate(client, url) {
  try { return requireAggregate((await client.get(url)).data?.data); }
  catch (error) { throw mapVocabularySetError(error); }
}

async function mutateAggregate(client, method, url, input) {
  try { return requireAggregate((await client[method](url, input)).data?.data); }
  catch (error) { throw mapVocabularySetError(error); }
}

async function deleteSet(client, url) {
  try { await client.delete(url); }
  catch (error) { throw mapVocabularySetError(error); }
}

function itemEndpoint(base, setId) { return `${base}/${encodeURIComponent(setId)}`; }

function requireAggregate(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalidResponseError();
  return value;
}

function requirePickerResult(value) {
  if (
    !value || typeof value !== "object" || Array.isArray(value) ||
    typeof value.id !== "string" || typeof value.word !== "string" ||
    !["CANONICAL", "PRIVATE"].includes(value.source)
  ) throw invalidResponseError();
  const primaryMeaning = value.primary_meaning;
  if (
    primaryMeaning !== null &&
    (!primaryMeaning || typeof primaryMeaning !== "object" ||
      typeof primaryMeaning.part_of_speech !== "string" ||
      typeof primaryMeaning.meaning_vi !== "string")
  ) throw invalidResponseError();
  return {
    id: value.id,
    word: value.word,
    phonetic: value.phonetic ?? null,
    source: value.source,
    primary_meaning: primaryMeaning,
    editable: value.source === "PRIVATE",
  };
}

function sanitizePrivateCreate(value) {
  return sanitizePrivateVocabulary(value, { preserveIds: false });
}

function sanitizePrivateVocabulary(value, { preserveIds }) {
  const vocabulary = {
    word: value?.word,
    meanings: Array.isArray(value?.meanings)
      ? value.meanings.map((meaning) => sanitizeMeaning(meaning, { preserveIds }))
      : value?.meanings,
  };
  if (Object.hasOwn(value ?? {}, "phonetic")) vocabulary.phonetic = value.phonetic;
  return vocabulary;
}

function sanitizeMeaning(value, { preserveIds }) {
  const meaning = {
    part_of_speech: value?.part_of_speech,
    meaning_vi: value?.meaning_vi,
  };
  if (preserveIds && Object.hasOwn(value ?? {}, "id")) meaning.id = value.id;
  for (const field of ["context", "cefr_level"]) {
    if (Object.hasOwn(value ?? {}, field)) meaning[field] = value[field];
  }
  if (Object.hasOwn(value ?? {}, "examples")) {
    meaning.examples = Array.isArray(value.examples)
      ? value.examples.map((example) => {
          const result = { example_en: example?.example_en };
          if (preserveIds && Object.hasOwn(example ?? {}, "id")) result.id = example.id;
          if (Object.hasOwn(example ?? {}, "example_vi")) result.example_vi = example.example_vi;
          return result;
        })
      : value.examples;
  }
  return meaning;
}

function requirePrivateCreateResult(value) {
  if (
    !value || typeof value !== "object" || Array.isArray(value) ||
    !value.vocabulary || typeof value.vocabulary !== "object" ||
    typeof value.vocabulary.id !== "string" ||
    !value.membership || typeof value.membership !== "object" ||
    value.membership.vocabulary_id !== value.vocabulary.id
  ) throw invalidResponseError();
  return value;
}

function mapVocabularySetError(error) {
  if (error instanceof VocabularySetApiError) return error;
  const status = error?.response?.status ?? null;
  const responseError = error?.response?.data?.error;
  return new VocabularySetApiError({
    kind: status === 409 && responseError?.code === "PRIVATE_VOCABULARY_OPERATION_CONFLICT"
      ? "conflict"
      : status === 404
        ? "not-found"
        : status === 400
          ? "validation"
          : status === 401 || status === 403
            ? "authorization"
            : status === null ? "operational" : "api",
    code: responseError?.code ?? "VOCABULARY_SET_REQUEST_FAILED",
    message: responseError?.message ?? (status === null ? "Vocabulary Set service is unavailable." : "Vocabulary Set request failed."),
    status,
  });
}

function invalidResponseError() {
  return new VocabularySetApiError({ kind: "operational", code: "INVALID_VOCABULARY_SET_RESPONSE", message: "Vocabulary Set service returned an invalid response.", status: null });
}

export const vocabularySetService = createVocabularySetService();
