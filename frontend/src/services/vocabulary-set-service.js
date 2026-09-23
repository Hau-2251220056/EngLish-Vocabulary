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
      return getList(client, PICKER_ENDPOINT, { params: { query } });
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

function mapVocabularySetError(error) {
  if (error instanceof VocabularySetApiError) return error;
  const status = error?.response?.status ?? null;
  const responseError = error?.response?.data?.error;
  return new VocabularySetApiError({
    kind: status === 404 && responseError?.code === "VOCABULARY_SET_NOT_FOUND" ? "not-found" : status === null ? "operational" : "api",
    code: responseError?.code ?? "VOCABULARY_SET_REQUEST_FAILED",
    message: responseError?.message ?? (status === null ? "Vocabulary Set service is unavailable." : "Vocabulary Set request failed."),
    status,
  });
}

function invalidResponseError() {
  return new VocabularySetApiError({ kind: "operational", code: "INVALID_VOCABULARY_SET_RESPONSE", message: "Vocabulary Set service returned an invalid response.", status: null });
}

export const vocabularySetService = createVocabularySetService();
