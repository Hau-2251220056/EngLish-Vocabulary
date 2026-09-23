// @ts-nocheck
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CREATE_FIELDS = new Set(["topic_id", "name", "description", "items"]);
const PATCH_FIELDS = CREATE_FIELDS;
const ITEM_FIELDS = new Set(["vocabulary_id"]);
const PICKER_RESULT_LIMIT = 20;

export class VocabularySetServiceError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "VocabularySetServiceError";
    this.code = code;
  }
}

export function createVocabularySetService({ vocabularySetRepository }) {
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
      rejectUnsupportedFields(input, CREATE_FIELDS);
      const aggregate = normalizeCreateInput(input);

      try {
        return await vocabularySetRepository.withTransaction(async (repository) => {
          await validateReferences(repository, aggregate);
          const created = await repository.createSystem({
            topic_id: aggregate.topic_id,
            owner_id: ownerId,
            name: aggregate.name,
            description: aggregate.description,
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
      rejectUnsupportedFields(input, PATCH_FIELDS);
      const patch = normalizePatchInput(input);

      try {
        return await vocabularySetRepository.withTransaction(async (repository) => {
          await requireSystemSet(repository, vocabularySetId);
          if (patch.topic_id !== undefined) {
            await requireTopic(repository, patch.topic_id);
          }
          if (patch.vocabularyIds !== undefined) {
            await requireVocabularyIds(repository, patch.vocabularyIds);
          }

          const data = {};
          for (const field of ["topic_id", "name", "description"]) {
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
      } catch (error) {
        throwKnownPersistenceError(error);
      }
    },

    async deleteSystemSet(vocabularySetId) {
      validateUuid(vocabularySetId);
      try {
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
      rejectUnsupportedFields(input, CREATE_FIELDS);
      const aggregate = normalizePrivateCreateInput(input);

      try {
        return await vocabularySetRepository.withTransaction(async (repository) => {
          await validateReferences(repository, aggregate);
          return toDetail(await repository.createPrivate({
            topic_id: aggregate.topic_id,
            owner_id: ownerId,
            name: aggregate.name,
            description: aggregate.description,
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
      rejectUnsupportedFields(input, PATCH_FIELDS);
      const patch = normalizePatchInput(input, { allowEmptyItems: true });

      try {
        return await vocabularySetRepository.withTransaction(async (repository) => {
          await requirePrivateSet(repository, vocabularySetId, ownerId);
          if (patch.topic_id !== undefined) await requireTopic(repository, patch.topic_id);
          if (patch.vocabularyIds !== undefined) await requireVocabularyIds(repository, patch.vocabularyIds);
          await applyPatch(repository, vocabularySetId, patch);
          return toDetail(await requirePrivateSet(repository, vocabularySetId, ownerId));
        });
      } catch (error) {
        throwKnownPersistenceError(error);
      }
    },

    async deletePrivateSet(ownerId, vocabularySetId) {
      validateUuid(ownerId);
      validateUuid(vocabularySetId);
      try {
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
      try {
        return await vocabularySetRepository.withTransaction(async (repository) => {
          const source = await requireSystemSet(repository, vocabularySetId);
          return toDetail(await repository.createPrivate({
            topic_id: source.topic_id,
            owner_id: ownerId,
            name: source.name,
            description: source.description,
            is_public: false,
            items: { create: source.items.map(({ vocabulary_id, position }) => ({ vocabulary_id, position })) },
          }));
        });
      } catch (error) {
        throwKnownPersistenceError(error);
      }
    },

    async searchVocabularyPicker(query) {
      const normalizedQuery = validatePickerQuery(query);
      return vocabularySetRepository.searchVocabularyPicker(normalizedQuery, PICKER_RESULT_LIMIT);
    },
  };
}

function normalizeCreateInput(input) {
  if (!Object.hasOwn(input, "topic_id") || !Object.hasOwn(input, "name") || !Object.hasOwn(input, "items")) {
    throw validationError();
  }
  return {
    topic_id: validateUuid(input.topic_id),
    name: validateName(input.name),
    description: validateDescription(input.description, { optional: true }),
    vocabularyIds: validateItems(input.items),
  };
}

function normalizePatchInput(input, { allowEmptyItems = false } = {}) {
  if (![...PATCH_FIELDS].some((field) => Object.hasOwn(input, field))) {
    throw validationError();
  }
  const patch = {};
  if (Object.hasOwn(input, "topic_id")) patch.topic_id = validateUuid(input.topic_id);
  if (Object.hasOwn(input, "name")) patch.name = validateName(input.name);
  if (Object.hasOwn(input, "description")) patch.description = validateDescription(input.description);
  if (Object.hasOwn(input, "items")) patch.vocabularyIds = validateItems(input.items, { allowEmptyItems });
  return patch;
}

function normalizePrivateCreateInput(input) {
  if (!Object.hasOwn(input, "topic_id") || !Object.hasOwn(input, "name")) throw validationError();
  return {
    topic_id: validateUuid(input.topic_id),
    name: validateName(input.name),
    description: validateDescription(input.description, { optional: true }),
    vocabularyIds: Object.hasOwn(input, "items") ? validateItems(input.items, { allowEmptyItems: true }) : [],
  };
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

async function applyPatch(repository, vocabularySetId, patch) {
  const data = {};
  for (const field of ["topic_id", "name", "description"]) {
    if (patch[field] !== undefined) data[field] = patch[field];
  }
  if (Object.keys(data).length > 0) await repository.updateSystem(vocabularySetId, data);
  if (patch.vocabularyIds !== undefined) await repository.replaceItems(vocabularySetId, patch.vocabularyIds);
}

async function validateReferences(repository, aggregate) {
  await requireTopic(repository, aggregate.topic_id);
  await requireVocabularyIds(repository, aggregate.vocabularyIds);
}

async function requireTopic(repository, topicId) {
  if (!await repository.findTopicById(topicId)) throw topicNotFoundError();
}

async function requireVocabularyIds(repository, vocabularyIds) {
  const found = await repository.findVocabularyIds(vocabularyIds);
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
  const { _count, ...summary } = set;
  return { ...summary, item_count: _count.items };
}

function toDetail(set) {
  return {
    ...set,
    items: set.items.map(({ vocabulary, ...item }) => ({ ...item, ...vocabulary })),
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
