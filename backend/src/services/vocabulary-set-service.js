// @ts-nocheck
import { createHash, randomUUID } from "node:crypto";
import { normalizePrivateVocabularyCreateInput } from "./vocabulary-service.js";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SYSTEM_CREATE_FIELDS = new Set([
  "topic_id", "name", "description", "cefr_level", "cover_image_url", "items",
]);
const SYSTEM_PATCH_FIELDS = SYSTEM_CREATE_FIELDS;
const PRIVATE_CREATE_FIELDS = new Set([
  "name", "description", "cefr_level", "cover_image_url", "items",
]);
const PRIVATE_PATCH_FIELDS = PRIVATE_CREATE_FIELDS;
const ITEM_FIELDS = new Set(["vocabulary_id"]);
const PICKER_RESULT_LIMIT = 20;
const PRIVATE_CREATE_REQUEST_FIELDS = new Set(["operation_id", "vocabulary"]);

export class VocabularySetServiceError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "VocabularySetServiceError";
    this.code = code;
    this.details = details;
  }
}

export function createVocabularySetService({ vocabularySetRepository, coverStorage, coverImageProcessor }) {
  return {
    async listPublicSystemSets(topicId) {
      validateUuid(topicId);
      await requireTopic(vocabularySetRepository, topicId);
      const sets = await vocabularySetRepository.listPublicByTopic(topicId);
      return sets.map(toSummary);
    },

    async getPublicSystemSet(vocabularySetId) {
      validateUuid(vocabularySetId);
      return toDetail(await requireSystemSet(vocabularySetRepository, vocabularySetId));
    },

    async listSystemSets() {
      const sets = await vocabularySetRepository.listSystem();
      return sets.map(toSummary);
    },

    async getSystemSet(vocabularySetId) {
      validateUuid(vocabularySetId);
      return toDetail(await requireSystemSet(vocabularySetRepository, vocabularySetId));
    },

    async createSystemSet(ownerId, input) {
      validateUuid(ownerId);
      validateBody(input);
      rejectUnsupportedFields(input, SYSTEM_CREATE_FIELDS);
      const aggregate = normalizeCreateInput(input);

      try {
        return await vocabularySetRepository.withTransaction(async (repository) => {
          await validateSystemReferences(repository, aggregate);
          const created = await repository.createSystem({
            topic_id: aggregate.topic_id,
            owner_id: ownerId,
            name: aggregate.name,
            description: aggregate.description,
            cefr_level: aggregate.cefr_level,
            cover_image_url: aggregate.cover_image_url,
            cover_storage_key: null,
            is_public: true,
            items: {
              create: aggregate.vocabularyIds.map((vocabularyId, index) => ({
                vocabulary_id: vocabularyId,
                position: index + 1,
              })),
            },
          });
          return toDetail(created);
        });
      } catch (error) {
        throwKnownPersistenceError(error);
      }
    },

    async updateSystemSet(vocabularySetId, input) {
      validateUuid(vocabularySetId);
      validateBody(input);
      rejectUnsupportedFields(input, SYSTEM_PATCH_FIELDS);
      const patch = normalizeSystemPatchInput(input);

      let previousCoverKey = null;
      try {
        const data = await vocabularySetRepository.withTransaction(async (repository) => {
          const existing = await requireSystemSet(repository, vocabularySetId);
          previousCoverKey = existing.cover_storage_key;
          if ((patch.cefr_level ?? existing.cefr_level) === null) {
            throw validationError();
          }
          if (patch.topic_id !== undefined) {
            await requireTopic(repository, patch.topic_id);
          }
          if (patch.vocabularyIds !== undefined) {
            await requireCanonicalVocabularyIds(repository, patch.vocabularyIds);
          }

          const data = {};
          for (const field of ["topic_id", "name", "description", "cefr_level", "cover_image_url", "cover_storage_key"]) {
            if (patch[field] !== undefined) {
              data[field] = patch[field];
            }
          }
          if (Object.keys(data).length > 0) {
            await repository.updateSystem(vocabularySetId, data);
          }
          if (patch.vocabularyIds !== undefined) {
            await repository.replaceItems(vocabularySetId, patch.vocabularyIds);
          }

          return toDetail(await requireSystemSet(repository, vocabularySetId));
        });
        return mutationResult(data, await cleanupReplacedExternalCover(
          coverStorage, vocabularySetId, patch, previousCoverKey,
        ));
      } catch (error) {
        throwKnownPersistenceError(error);
      }
    },

    async deleteSystemSet(vocabularySetId) {
      validateUuid(vocabularySetId);
      try {
        const existing = await requireSystemSet(vocabularySetRepository, vocabularySetId);
        await removeManagedObjectsBeforeDelete(coverStorage, vocabularySetId, existing.cover_storage_key);
        return await vocabularySetRepository.withTransaction(async (repository) => {
          await requireSystemSet(repository, vocabularySetId);
          await repository.deleteSystem(vocabularySetId);
        });
      } catch (error) {
        throwKnownPersistenceError(error);
      }
    },

    async listPrivateSets(ownerId) {
      validateUuid(ownerId);
      const sets = await vocabularySetRepository.listPrivateByOwner(ownerId);
      return sets.map(toSummary);
    },

    async getPrivateSet(ownerId, vocabularySetId) {
      validateUuid(ownerId);
      validateUuid(vocabularySetId);
      return toDetail(await requirePrivateSet(vocabularySetRepository, vocabularySetId, ownerId));
    },

    async createPrivateSet(ownerId, input) {
      validateUuid(ownerId);
      validateBody(input);
      rejectUnsupportedFields(input, PRIVATE_CREATE_FIELDS);
      const aggregate = normalizePrivateCreateInput(input);

      try {
        return await vocabularySetRepository.withTransaction(async (repository) => {
          await validatePrivateReferences(repository, ownerId, aggregate);
          return toDetail(await repository.createPrivate({
            topic_id: null,
            owner_id: ownerId,
            name: aggregate.name,
            description: aggregate.description,
            cefr_level: aggregate.cefr_level,
            cover_image_url: aggregate.cover_image_url,
            cover_storage_key: null,
            is_public: false,
            items: { create: toItemCreates(aggregate.vocabularyIds) },
          }));
        });
      } catch (error) {
        throwKnownPersistenceError(error);
      }
    },

    async updatePrivateSet(ownerId, vocabularySetId, input) {
      validateUuid(ownerId);
      validateUuid(vocabularySetId);
      validateBody(input);
      rejectUnsupportedFields(input, PRIVATE_PATCH_FIELDS);
      const patch = normalizePrivatePatchInput(input);

      let previousCoverKey = null;
      try {
        const data = await vocabularySetRepository.withTransaction(async (repository) => {
          const existing = await requirePrivateSet(repository, vocabularySetId, ownerId);
          previousCoverKey = existing.cover_storage_key;
          if (patch.vocabularyIds !== undefined) {
            await requireReusableVocabularyIds(repository, ownerId, patch.vocabularyIds);
          }
          await applyPatch(repository, vocabularySetId, patch);
          return toDetail(await requirePrivateSet(repository, vocabularySetId, ownerId));
        });
        return mutationResult(data, await cleanupReplacedExternalCover(
          coverStorage, vocabularySetId, patch, previousCoverKey,
        ));
      } catch (error) {
        throwKnownPersistenceError(error);
      }
    },

    async deletePrivateSet(ownerId, vocabularySetId) {
      validateUuid(ownerId);
      validateUuid(vocabularySetId);
      try {
        const existing = await requirePrivateSet(vocabularySetRepository, vocabularySetId, ownerId);
        await removeManagedObjectsBeforeDelete(coverStorage, vocabularySetId, existing.cover_storage_key);
        return await vocabularySetRepository.withTransaction(async (repository) => {
          await requirePrivateSet(repository, vocabularySetId, ownerId);
          await repository.deleteSystem(vocabularySetId);
        });
      } catch (error) {
        throwKnownPersistenceError(error);
      }
    },

    async copySystemSet(ownerId, vocabularySetId) {
      validateUuid(ownerId);
      validateUuid(vocabularySetId);
      const source = await requireSystemSet(vocabularySetRepository, vocabularySetId);
      const destinationSetId = randomUUID();
      let copiedCover = null;
      try {
        if (source.cover_storage_key) {
          if (!coverStorage) throw storageUnavailableError();
          copiedCover = await coverStorage.copy({
            sourceSetId: source.id,
            sourceKey: source.cover_storage_key,
            destinationSetId,
          });
        }
        return await vocabularySetRepository.withTransaction(async (repository) => {
          await requireCanonicalVocabularyIds(
            repository,
            source.items.map(({ vocabulary_id }) => vocabulary_id),
          );
          return toDetail(await repository.createPrivate({
            id: destinationSetId,
            topic_id: null,
            owner_id: ownerId,
            name: source.name,
            description: source.description,
            cefr_level: source.cefr_level,
            cover_image_url: copiedCover?.url ?? source.cover_image_url,
            cover_storage_key: copiedCover?.key ?? null,
            is_public: false,
            items: { create: source.items.map(({ vocabulary_id, position }) => ({ vocabulary_id, position })) },
          }));
        });
      } catch (error) {
        if (copiedCover) {
          try {
            await coverStorage.removeObject({ setId: destinationSetId, key: copiedCover.key });
          } catch {
            throw new VocabularySetServiceError(
              "COVER_STORAGE_CLEANUP_FAILED",
              "Copied cover cleanup requires retry.",
              { orphan_set_id: destinationSetId },
            );
          }
        }
        throwKnownPersistenceError(error);
      }
    },

    async uploadSystemCover(vocabularySetId, file) {
      validateUuid(vocabularySetId);
      return replaceManagedCover({
        repository: vocabularySetRepository,
        coverStorage,
        coverImageProcessor,
        vocabularySetId,
        file,
        loadSet: (repository) => requireSystemSet(repository, vocabularySetId),
      });
    },

    async uploadPrivateCover(ownerId, vocabularySetId, file) {
      validateUuid(ownerId);
      validateUuid(vocabularySetId);
      return replaceManagedCover({
        repository: vocabularySetRepository,
        coverStorage,
        coverImageProcessor,
        vocabularySetId,
        file,
        loadSet: (repository) => requirePrivateSet(repository, vocabularySetId, ownerId),
      });
    },

    async removeSystemCover(vocabularySetId) {
      validateUuid(vocabularySetId);
      return removeCover({
        repository: vocabularySetRepository,
        coverStorage,
        vocabularySetId,
        loadSet: (repository) => requireSystemSet(repository, vocabularySetId),
      });
    },

    async removePrivateCover(ownerId, vocabularySetId) {
      validateUuid(ownerId);
      validateUuid(vocabularySetId);
      return removeCover({
        repository: vocabularySetRepository,
        coverStorage,
        vocabularySetId,
        loadSet: (repository) => requirePrivateSet(repository, vocabularySetId, ownerId),
      });
    },

    async cleanupSystemCover(vocabularySetId) {
      validateUuid(vocabularySetId);
      return cleanupCover({
        repository: vocabularySetRepository,
        coverStorage,
        vocabularySetId,
        loadSet: (repository) => requireSystemSet(repository, vocabularySetId),
      });
    },

    async cleanupPrivateCover(ownerId, vocabularySetId) {
      validateUuid(ownerId);
      validateUuid(vocabularySetId);
      return cleanupCover({
        repository: vocabularySetRepository,
        coverStorage,
        vocabularySetId,
        loadSet: (repository) => requirePrivateSet(repository, vocabularySetId, ownerId),
      });
    },

    async searchVocabularyPicker(userId, role, query) {
      validateUuid(userId);
      const normalizedQuery = validatePickerQuery(query);
      const vocabulary = await vocabularySetRepository.searchVocabularyPicker(
        normalizedQuery,
        PICKER_RESULT_LIMIT,
        { ownerId: userId, canonicalOnly: role === "ADMIN" },
      );
      return vocabulary.map(({ owner_id, meanings, ...item }) => ({
        ...item,
        source: owner_id === null ? "CANONICAL" : "PRIVATE",
        primary_meaning: meanings[0] ?? null,
      }));
    },

    async createPrivateVocabularyAndAdd(ownerId, vocabularySetId, input) {
      validateUuid(ownerId);
      validateUuid(vocabularySetId);
      validateBody(input);
      rejectUnsupportedFields(input, PRIVATE_CREATE_REQUEST_FIELDS);
      if (!Object.hasOwn(input, "operation_id") || !Object.hasOwn(input, "vocabulary")) {
        throw validationError();
      }
      const operationId = validateUuid(input.operation_id);
      let vocabulary;
      try {
        vocabulary = normalizePrivateVocabularyCreateInput(input.vocabulary);
      } catch (error) {
        if (error?.code === "VALIDATION_ERROR") throw validationError();
        throw error;
      }
      const requestFingerprint = fingerprintPrivateCreateRequest({
        ownerId,
        vocabularySetId,
        vocabulary,
      });

      try {
        return await vocabularySetRepository.withTransaction(async (repository) => {
          if (!await repository.lockPrivateSetForOwner(vocabularySetId, ownerId)) {
            throw vocabularySetNotFoundError();
          }
          const existing = await repository.findPrivateCreateResult(operationId);
          if (existing) {
            return resolvePrivateCreateRetry(existing, ownerId, vocabularySetId, requestFingerprint);
          }
          const createdVocabulary = await repository.createPrivateVocabularyAggregate(ownerId, vocabulary);
          const membership = await repository.appendVocabularyToLockedSet(
            vocabularySetId,
            createdVocabulary.id,
          );
          await repository.createPrivateCreateOperation({
            operation_id: operationId,
            owner_id: ownerId,
            vocabulary_set_id: vocabularySetId,
            vocabulary_id: createdVocabulary.id,
            request_fingerprint: requestFingerprint,
          });
          return { created: true, data: { vocabulary: createdVocabulary, membership } };
        });
      } catch (error) {
        if (error?.code === "P2002") {
          const existing = await vocabularySetRepository.findPrivateCreateResult(operationId);
          if (existing) {
            return resolvePrivateCreateRetry(existing, ownerId, vocabularySetId, requestFingerprint);
          }
        }
        throwKnownPersistenceError(error);
      }
    },
  };
}

function fingerprintPrivateCreateRequest({ ownerId, vocabularySetId, vocabulary }) {
  // Explicit fixed-key projection makes the fingerprint independent of incoming JSON key order.
  const canonical = {
    owner_id: ownerId,
    vocabulary_set_id: vocabularySetId,
    vocabulary: {
      word: vocabulary.word,
      phonetic: vocabulary.phonetic,
      meanings: vocabulary.meanings.map((meaning) => ({
        part_of_speech: meaning.part_of_speech,
        meaning_vi: meaning.meaning_vi,
        context: meaning.context,
        cefr_level: meaning.cefr_level,
        examples: meaning.examples.map((example) => ({
          example_en: example.example_en,
          example_vi: example.example_vi,
        })),
      })),
    },
  };
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

function resolvePrivateCreateRetry(existing, ownerId, vocabularySetId, requestFingerprint) {
  if (
    existing.owner_id !== ownerId ||
    existing.vocabulary_set_id !== vocabularySetId ||
    existing.request_fingerprint !== requestFingerprint ||
    !existing.membership
  ) {
    throw privateVocabularyOperationConflictError();
  }
  return {
    created: false,
    data: { vocabulary: existing.vocabulary, membership: existing.membership },
  };
}

function normalizeCreateInput(input) {
  if (!Object.hasOwn(input, "topic_id") || !Object.hasOwn(input, "name")
    || !Object.hasOwn(input, "cefr_level") || !Object.hasOwn(input, "items")) {
    throw validationError();
  }
  return {
    topic_id: validateUuid(input.topic_id),
    name: validateName(input.name),
    description: validateDescription(input.description, { optional: true }),
    cefr_level: validateCefrLevel(input.cefr_level),
    cover_image_url: validateCoverImageUrl(input.cover_image_url, { optional: true }),
    vocabularyIds: validateItems(input.items),
  };
}

function normalizeSystemPatchInput(input) {
  if (![...SYSTEM_PATCH_FIELDS].some((field) => Object.hasOwn(input, field))) {
    throw validationError();
  }
  const patch = {};
  if (Object.hasOwn(input, "topic_id")) patch.topic_id = validateUuid(input.topic_id);
  if (Object.hasOwn(input, "name")) patch.name = validateName(input.name);
  if (Object.hasOwn(input, "description")) patch.description = validateDescription(input.description);
  if (Object.hasOwn(input, "cefr_level")) patch.cefr_level = validateCefrLevel(input.cefr_level);
  if (Object.hasOwn(input, "cover_image_url")) {
    patch.cover_image_url = validateCoverImageUrl(input.cover_image_url);
    patch.cover_storage_key = null;
  }
  if (Object.hasOwn(input, "items")) patch.vocabularyIds = validateItems(input.items);
  return patch;
}

function normalizePrivateCreateInput(input) {
  if (!Object.hasOwn(input, "name")) throw validationError();
  return {
    name: validateName(input.name),
    description: validateDescription(input.description, { optional: true }),
    cefr_level: validateCefrLevel(input.cefr_level, { optional: true, nullable: true }),
    cover_image_url: validateCoverImageUrl(input.cover_image_url, { optional: true }),
    vocabularyIds: Object.hasOwn(input, "items") ? validateItems(input.items, { allowEmptyItems: true }) : [],
  };
}

function normalizePrivatePatchInput(input) {
  if (![...PRIVATE_PATCH_FIELDS].some((field) => Object.hasOwn(input, field))) {
    throw validationError();
  }
  const patch = {};
  if (Object.hasOwn(input, "name")) patch.name = validateName(input.name);
  if (Object.hasOwn(input, "description")) patch.description = validateDescription(input.description);
  if (Object.hasOwn(input, "cefr_level")) {
    patch.cefr_level = validateCefrLevel(input.cefr_level, { nullable: true });
  }
  if (Object.hasOwn(input, "cover_image_url")) {
    patch.cover_image_url = validateCoverImageUrl(input.cover_image_url);
    patch.cover_storage_key = null;
  }
  if (Object.hasOwn(input, "items")) {
    patch.vocabularyIds = validateItems(input.items, { allowEmptyItems: true });
  }
  return patch;
}

function validateBody(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw validationError();
}

function rejectUnsupportedFields(input, fields) {
  if (Object.keys(input).some((field) => !fields.has(field))) throw validationError();
}

function validateUuid(value) {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) throw validationError();
  return value;
}

function validateName(value) {
  if (typeof value !== "string") throw validationError();
  const name = value.trim();
  if (name.length === 0 || name.length > 100) throw validationError();
  return name;
}

function validateDescription(value, { optional = false } = {}) {
  if (optional && value === undefined) return null;
  if (value === null) return null;
  if (typeof value !== "string" || value.length > 500) throw validationError();
  return value;
}

function validateCefrLevel(value, { optional = false, nullable = false } = {}) {
  if (optional && value === undefined) return null;
  if (nullable && value === null) return null;
  if (!["A1", "A2", "B1", "B2", "C1"].includes(value)) throw validationError();
  return value;
}

function validateCoverImageUrl(value, { optional = false } = {}) {
  if (optional && value === undefined) return null;
  if (value === null) return null;
  if (typeof value !== "string" || value.length === 0 || value.length > 2048) throw validationError();
  let url;
  try {
    url = new URL(value);
  } catch {
    throw validationError();
  }
  if (url.protocol !== "https:" || url.username !== "" || url.password !== "") throw validationError();
  return url.href;
}

function validateItems(value, { allowEmptyItems = false } = {}) {
  if (!Array.isArray(value) || (!allowEmptyItems && value.length === 0)) throw validationError();
  const seenVocabularyIds = new Set();
  return value.map((item) => {
    validateBody(item);
    rejectUnsupportedFields(item, ITEM_FIELDS);
    if (!Object.hasOwn(item, "vocabulary_id")) throw validationError();
    const vocabularyId = validateUuid(item.vocabulary_id);
    if (seenVocabularyIds.has(vocabularyId)) throw validationError();
    seenVocabularyIds.add(vocabularyId);
    return vocabularyId;
  });
}

function validatePickerQuery(value) {
  if (typeof value !== "string") throw validationError();
  const query = value.trim();
  if (query.length === 0 || query.length > 100) throw validationError();
  return query;
}

function toItemCreates(vocabularyIds) {
  return vocabularyIds.map((vocabularyId, index) => ({ vocabulary_id: vocabularyId, position: index + 1 }));
}

async function replaceManagedCover({ repository, coverStorage, coverImageProcessor, vocabularySetId, file, loadSet }) {
  requireCoverDependencies(coverStorage, coverImageProcessor);
  validateCoverFile(file);
  const current = await loadSet(repository);
  const optimized = await coverImageProcessor.process({ buffer: file.buffer, mimetype: file.mimetype });
  const uploaded = await coverStorage.upload({ setId: vocabularySetId, buffer: optimized.buffer });
  try {
    await repository.updateCoverMetadata(vocabularySetId, {
      cover_image_url: uploaded.url,
      cover_storage_key: uploaded.key,
    });
  } catch (error) {
    try {
      await coverStorage.removeObject({ setId: vocabularySetId, key: uploaded.key });
    } catch {
      throw new VocabularySetServiceError(
        "COVER_STORAGE_CLEANUP_FAILED",
        "Uploaded cover cleanup requires retry.",
        { orphan_set_id: vocabularySetId },
      );
    }
    throw error;
  }
  const updated = await loadSet(repository);
  const storage_cleanup = await cleanupAfterMutation(coverStorage, vocabularySetId, uploaded.key, current.cover_storage_key);
  return { data: toDetail(updated), storage_cleanup };
}

async function removeCover({ repository, coverStorage, vocabularySetId, loadSet }) {
  if (!coverStorage) throw storageUnavailableError();
  const current = await loadSet(repository);
  await repository.updateCoverMetadata(vocabularySetId, {
    cover_image_url: null,
    cover_storage_key: null,
  });
  const updated = await loadSet(repository);
  const storage_cleanup = await cleanupAfterMutation(coverStorage, vocabularySetId, null, current.cover_storage_key);
  return { data: toDetail(updated), storage_cleanup };
}

async function cleanupCover({ repository, coverStorage, vocabularySetId, loadSet }) {
  if (!coverStorage) throw storageUnavailableError();
  const current = await loadSet(repository);
  await coverStorage.removeSetObjects({ setId: vocabularySetId, exceptKey: current.cover_storage_key });
  return { data: toDetail(current), storage_cleanup: "complete" };
}

async function cleanupAfterMutation(coverStorage, setId, currentKey, previousKey) {
  if (!previousKey) return "complete";
  try {
    await coverStorage.removeSetObjects({ setId, exceptKey: currentKey });
    return "complete";
  } catch {
    return "retry_required";
  }
}

function mutationResult(data, storage_cleanup) {
  return { data, storage_cleanup };
}

async function cleanupReplacedExternalCover(coverStorage, setId, patch, previousKey) {
  if (!Object.hasOwn(patch, "cover_image_url") || !previousKey) return "complete";
  return cleanupAfterMutation(coverStorage, setId, null, previousKey);
}

async function removeManagedObjectsBeforeDelete(coverStorage, setId, currentKey) {
  if (!currentKey) return;
  if (!coverStorage) throw storageUnavailableError();
  await coverStorage.removeSetObjects({ setId });
}

function validateCoverFile(file) {
  if (!file || !Buffer.isBuffer(file.buffer) || typeof file.mimetype !== "string") throw validationError();
}

function requireCoverDependencies(coverStorage, coverImageProcessor) {
  if (!coverStorage) throw storageUnavailableError();
  if (!coverImageProcessor) {
    throw new VocabularySetServiceError("COVER_PROCESSING_UNAVAILABLE", "Cover processing is unavailable.");
  }
}

function storageUnavailableError() {
  return new VocabularySetServiceError("COVER_STORAGE_UNAVAILABLE", "Cover storage is unavailable.");
}

async function applyPatch(repository, vocabularySetId, patch) {
  const data = {};
  for (const field of ["topic_id", "name", "description", "cefr_level", "cover_image_url", "cover_storage_key"]) {
    if (patch[field] !== undefined) data[field] = patch[field];
  }
  if (Object.keys(data).length > 0) await repository.updateSystem(vocabularySetId, data);
  if (patch.vocabularyIds !== undefined) await repository.replaceItems(vocabularySetId, patch.vocabularyIds);
}

async function validateSystemReferences(repository, aggregate) {
  await requireTopic(repository, aggregate.topic_id);
  await requireCanonicalVocabularyIds(repository, aggregate.vocabularyIds);
}

async function validatePrivateReferences(repository, ownerId, aggregate) {
  await requireReusableVocabularyIds(repository, ownerId, aggregate.vocabularyIds);
}

async function requireTopic(repository, topicId) {
  if (!await repository.findTopicById(topicId)) throw topicNotFoundError();
}

async function requireCanonicalVocabularyIds(repository, vocabularyIds) {
  const found = await repository.findCanonicalVocabularyIds(vocabularyIds);
  if (found.length !== vocabularyIds.length) throw vocabularyNotFoundError();
}

async function requireReusableVocabularyIds(repository, ownerId, vocabularyIds) {
  const found = await repository.findReusableVocabularyIdsForOwner(ownerId, vocabularyIds);
  if (found.length !== vocabularyIds.length) throw vocabularyNotFoundError();
}

async function requireSystemSet(repository, vocabularySetId) {
  const set = await repository.findPublicSystemById(vocabularySetId);
  if (!set) throw vocabularySetNotFoundError();
  return set;
}

async function requirePrivateSet(repository, vocabularySetId, ownerId) {
  const set = await repository.findPrivateByIdForOwner(vocabularySetId, ownerId);
  if (!set) throw vocabularySetNotFoundError();
  return set;
}

function toSummary(set) {
  const { _count, cover_storage_key: _coverStorageKey, ...summary } = set;
  return { ...summary, item_count: _count.items };
}

function toDetail(set) {
  const { cover_storage_key: _coverStorageKey, ...publicSet } = set;
  return {
    ...publicSet,
    items: set.items.map(({ vocabulary: { owner_id, meanings, ...vocabulary }, ...item }) => {
      const meaning = meanings?.[0] ?? null;
      return {
        ...item,
        ...vocabulary,
        ...(!set.is_public
          ? {
              source: owner_id === null ? "CANONICAL" : "PRIVATE",
              primary_meaning: meaning
                ? {
                    part_of_speech: meaning.part_of_speech,
                    meaning_vi: meaning.meaning_vi,
                    example: meaning.examples[0] ?? null,
                  }
                : null,
            }
          : {}),
      };
    }),
  };
}

function throwKnownPersistenceError(error) {
  if (error?.code === "P2002") throw duplicateItemError();
  if (error?.code === "P2025") throw vocabularySetNotFoundError();
  throw error;
}

function validationError() {
  return new VocabularySetServiceError("VALIDATION_ERROR", "Vocabulary Set request data is invalid.");
}

function vocabularySetNotFoundError() {
  return new VocabularySetServiceError("VOCABULARY_SET_NOT_FOUND", "Vocabulary Set was not found.");
}

function topicNotFoundError() {
  return new VocabularySetServiceError("TOPIC_NOT_FOUND", "Topic was not found.");
}

function vocabularyNotFoundError() {
  return new VocabularySetServiceError("VOCABULARY_NOT_FOUND", "Vocabulary was not found.");
}

function duplicateItemError() {
  return new VocabularySetServiceError("VOCABULARY_ALREADY_IN_SET", "Vocabulary already belongs to this Set.");
}

function privateVocabularyOperationConflictError() {
  return new VocabularySetServiceError(
    "PRIVATE_VOCABULARY_OPERATION_CONFLICT",
    "The operation ID was already used for a different request.",
  );
}
