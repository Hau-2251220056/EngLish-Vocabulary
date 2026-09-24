// @ts-nocheck
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CEFR_LEVELS = new Set(["A1", "A2", "B1", "B2", "C1", "C2"]);
const CREATE_FIELDS = new Set(["word", "phonetic", "pronunciation_url", "meanings"]);
const PATCH_FIELDS = CREATE_FIELDS;
const MEANING_FIELDS = new Set([
  "id",
  "part_of_speech",
  "meaning_vi",
  "context",
  "cefr_level",
  "examples",
]);
const EXAMPLE_FIELDS = new Set(["id", "example_en", "example_vi"]);

export class VocabularyServiceError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "VocabularyServiceError";
    this.code = code;
  }
}

export function createVocabularyService({ vocabularyRepository }) {
  return {
    listVocabulary() {
      return vocabularyRepository.list();
    },

    async getVocabulary(vocabularyId) {
      validateVocabularyId(vocabularyId);
      return requireVocabulary(vocabularyRepository, vocabularyId);
    },

    async createVocabulary(input) {
      validateBody(input);
      rejectUnsupportedFields(input, CREATE_FIELDS);

      const vocabulary = normalizeCreateInput(input);
      await ensureUniqueWord(vocabularyRepository, vocabulary.word);

      try {
        return await vocabularyRepository.withTransaction(async (repository) => {
          await ensureUniqueWord(repository, vocabulary.word);
          return repository.createAggregate({
            word: vocabulary.word,
            phonetic: vocabulary.phonetic,
            pronunciation_url: vocabulary.pronunciation_url,
            meanings: {
              create: vocabulary.meanings.map((meaning) => ({
                part_of_speech: meaning.part_of_speech,
                meaning_vi: meaning.meaning_vi,
                context: meaning.context,
                cefr_level: meaning.cefr_level,
                examples: {
                  create: meaning.examples.map((example) => ({
                    example_en: example.example_en,
                    example_vi: example.example_vi,
                  })),
                },
              })),
            },
          });
        });
      } catch (error) {
        if (error?.code === "P2028" || error?.code === "P2034") {
          const competingVocabulary =
            await vocabularyRepository.findByWordInsensitive(vocabulary.word);
          if (competingVocabulary) {
            throw duplicateWordError();
          }
        }
        throwKnownPersistenceError(error);
      }
    },

    async updateVocabulary(vocabularyId, input) {
      validateVocabularyId(vocabularyId);
      validateBody(input);
      rejectUnsupportedFields(input, PATCH_FIELDS);

      const patch = normalizePatchInput(input);

      try {
        return await vocabularyRepository.withTransaction(async (repository) => {
          const existing = await requireVocabulary(repository, vocabularyId);

          if (patch.word !== undefined) {
            await ensureUniqueWord(repository, patch.word, vocabularyId);
          }

          if (patch.meanings !== undefined) {
            validateReplacementOwnership(existing, patch.meanings);
          }

          const vocabularyData = {};
          for (const field of ["word", "phonetic", "pronunciation_url"]) {
            if (patch[field] !== undefined) {
              vocabularyData[field] = patch[field];
            }
          }
          if (Object.keys(vocabularyData).length > 0) {
            await repository.updateVocabulary(vocabularyId, vocabularyData);
          }

          if (patch.meanings !== undefined) {
            await replaceMeanings(repository, existing, patch.meanings);
          }

          return requireVocabulary(repository, vocabularyId);
        });
      } catch (error) {
        throwKnownPersistenceError(error);
      }
    },

    async deleteVocabulary(vocabularyId) {
      validateVocabularyId(vocabularyId);

      try {
        return await vocabularyRepository.withTransaction(async (repository) => {
          await requireVocabulary(repository, vocabularyId);
          await repository.deleteVocabulary(vocabularyId);
        });
      } catch (error) {
        throwKnownPersistenceError(error);
      }
    },
  };
}

function normalizeCreateInput(input) {
  if (!Object.hasOwn(input, "word") || !Object.hasOwn(input, "meanings")) {
    throw validationError();
  }

  return {
    word: validateWord(input.word),
    phonetic: validateOptionalString(input.phonetic, 100, { optional: true }),
    pronunciation_url: validateOptionalString(input.pronunciation_url, 2048, {
      optional: true,
    }),
    meanings: normalizeMeanings(input.meanings, { allowIds: false }),
  };
}

function normalizePatchInput(input) {
  const hasSupportedField = [...PATCH_FIELDS].some((field) =>
    Object.hasOwn(input, field),
  );
  if (!hasSupportedField) {
    throw validationError();
  }

  const patch = {};
  if (Object.hasOwn(input, "word")) {
    patch.word = validateWord(input.word);
  }
  if (Object.hasOwn(input, "phonetic")) {
    patch.phonetic = validateOptionalString(input.phonetic, 100);
  }
  if (Object.hasOwn(input, "pronunciation_url")) {
    patch.pronunciation_url = validateOptionalString(input.pronunciation_url, 2048);
  }
  if (Object.hasOwn(input, "meanings")) {
    patch.meanings = normalizeMeanings(input.meanings, { allowIds: true });
  }

  return patch;
}

function normalizeMeanings(value, { allowIds }) {
  if (!Array.isArray(value) || value.length === 0) {
    throw validationError();
  }

  const seenMeaningIds = new Set();
  const seenExampleIds = new Set();
  return value.map((meaning) => {
    validateBody(meaning);
    rejectUnsupportedFields(meaning, MEANING_FIELDS);

    const hasId = Object.hasOwn(meaning, "id");
    if (hasId && !allowIds) {
      throw validationError();
    }
    if (
      !Object.hasOwn(meaning, "part_of_speech") ||
      !Object.hasOwn(meaning, "meaning_vi") ||
      !Object.hasOwn(meaning, "examples")
    ) {
      throw validationError();
    }

    const normalized = {
      part_of_speech: validateRequiredString(meaning.part_of_speech, 50),
      meaning_vi: validateRequiredString(meaning.meaning_vi, 500),
      context: validateOptionalString(meaning.context, 500, { optional: true }),
      cefr_level: validateCefrLevel(meaning.cefr_level, { optional: true }),
      examples: normalizeExamples(meaning.examples, {
        allowIds,
        seenExampleIds,
      }),
    };

    if (hasId) {
      validateUuid(meaning.id);
      if (seenMeaningIds.has(meaning.id)) {
        throw validationError();
      }
      seenMeaningIds.add(meaning.id);
      normalized.id = meaning.id;
    }

    return normalized;
  });
}

function normalizeExamples(value, { allowIds, seenExampleIds }) {
  if (!Array.isArray(value)) {
    throw validationError();
  }

  return value.map((example) => {
    validateBody(example);
    rejectUnsupportedFields(example, EXAMPLE_FIELDS);

    const hasId = Object.hasOwn(example, "id");
    if (hasId && !allowIds) {
      throw validationError();
    }
    if (!Object.hasOwn(example, "example_en")) {
      throw validationError();
    }

    const normalized = {
      example_en: validateRequiredString(example.example_en, 1000),
      example_vi: validateOptionalString(example.example_vi, 1000, {
        optional: true,
      }),
    };

    if (hasId) {
      validateUuid(example.id);
      if (seenExampleIds.has(example.id)) {
        throw validationError();
      }
      seenExampleIds.add(example.id);
      normalized.id = example.id;
    }

    return normalized;
  });
}

async function replaceMeanings(repository, existing, submittedMeanings) {
  const existingMeaningsById = new Map(
    existing.meanings.map((meaning) => [meaning.id, meaning]),
  );
  const retainedMeaningIds = new Set();

  for (const submittedMeaning of submittedMeanings) {
    if (!submittedMeaning.id) {
      if (submittedMeaning.examples.some((example) => example.id)) {
        throw validationError();
      }
      await repository.createMeaning(existing.id, {
        part_of_speech: submittedMeaning.part_of_speech,
        meaning_vi: submittedMeaning.meaning_vi,
        context: submittedMeaning.context,
        cefr_level: submittedMeaning.cefr_level,
        examples: {
          create: submittedMeaning.examples.map((example) => ({
            example_en: example.example_en,
            example_vi: example.example_vi,
          })),
        },
      });
      continue;
    }

    const existingMeaning = existingMeaningsById.get(submittedMeaning.id);
    if (!existingMeaning) {
      throw validationError();
    }

    retainedMeaningIds.add(submittedMeaning.id);
    await repository.updateMeaning(submittedMeaning.id, {
      part_of_speech: submittedMeaning.part_of_speech,
      meaning_vi: submittedMeaning.meaning_vi,
      context: submittedMeaning.context,
      cefr_level: submittedMeaning.cefr_level,
    });
    await replaceExamples(repository, existingMeaning, submittedMeaning.examples);
  }

  const removedMeaningIds = existing.meanings
    .filter((meaning) => !retainedMeaningIds.has(meaning.id))
    .map((meaning) => meaning.id);
  await repository.deleteMeanings(removedMeaningIds);
}

function validateReplacementOwnership(existing, submittedMeanings) {
  const existingMeaningsById = new Map(
    existing.meanings.map((meaning) => [meaning.id, meaning]),
  );

  for (const submittedMeaning of submittedMeanings) {
    if (!submittedMeaning.id) {
      if (submittedMeaning.examples.some((example) => example.id)) {
        throw validationError();
      }
      continue;
    }

    const existingMeaning = existingMeaningsById.get(submittedMeaning.id);
    if (!existingMeaning) {
      throw validationError();
    }

    const existingExampleIds = new Set(
      existingMeaning.examples.map((example) => example.id),
    );
    if (
      submittedMeaning.examples.some(
        (example) => example.id && !existingExampleIds.has(example.id),
      )
    ) {
      throw validationError();
    }
  }
}

async function replaceExamples(repository, existingMeaning, submittedExamples) {
  const existingExamplesById = new Map(
    existingMeaning.examples.map((example) => [example.id, example]),
  );
  const retainedExampleIds = new Set();

  for (const submittedExample of submittedExamples) {
    if (!submittedExample.id) {
      await repository.createExample(existingMeaning.id, {
        example_en: submittedExample.example_en,
        example_vi: submittedExample.example_vi,
      });
      continue;
    }

    if (!existingExamplesById.has(submittedExample.id)) {
      throw validationError();
    }

    retainedExampleIds.add(submittedExample.id);
    await repository.updateExample(submittedExample.id, {
      example_en: submittedExample.example_en,
      example_vi: submittedExample.example_vi,
    });
  }

  const removedExampleIds = existingMeaning.examples
    .filter((example) => !retainedExampleIds.has(example.id))
    .map((example) => example.id);
  await repository.deleteExamples(removedExampleIds);
}

function validateVocabularyId(vocabularyId) {
  validateUuid(vocabularyId);
}

function validateUuid(value) {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw validationError();
  }
}

function validateBody(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw validationError();
  }
}

function rejectUnsupportedFields(input, allowedFields) {
  if (Object.keys(input).some((field) => !allowedFields.has(field))) {
    throw validationError();
  }
}

function validateWord(value) {
  return validateRequiredString(value, 100);
}

function validateRequiredString(value, maximumLength) {
  if (typeof value !== "string") {
    throw validationError();
  }

  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > maximumLength) {
    throw validationError();
  }
  return normalized;
}

function validateOptionalString(value, maximumLength, { optional = false } = {}) {
  if (optional && value === undefined) {
    return null;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== "string" || value.length > maximumLength) {
    throw validationError();
  }
  return value;
}

function validateCefrLevel(value, { optional = false } = {}) {
  if (optional && value === undefined) {
    return null;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== "string" || !CEFR_LEVELS.has(value)) {
    throw validationError();
  }
  return value;
}

async function requireVocabulary(repository, vocabularyId) {
  const vocabulary = await repository.findCompleteById(vocabularyId);
  if (!vocabulary) {
    throw vocabularyNotFoundError();
  }
  return vocabulary;
}

async function ensureUniqueWord(repository, word, currentVocabularyId) {
  const vocabulary = await repository.findByWordInsensitive(word);
  if (vocabulary && vocabulary.id !== currentVocabularyId) {
    throw duplicateWordError();
  }
}

function throwKnownPersistenceError(error) {
  if (error?.code === "P2002") {
    throw duplicateWordError();
  }
  if (error?.code === "P2025") {
    throw vocabularyNotFoundError();
  }
  throw error;
}

function validationError() {
  return new VocabularyServiceError(
    "VALIDATION_ERROR",
    "Vocabulary request data is invalid.",
  );
}

function vocabularyNotFoundError() {
  return new VocabularyServiceError(
    "VOCABULARY_NOT_FOUND",
    "Vocabulary was not found.",
  );
}

function duplicateWordError() {
  return new VocabularyServiceError(
    "VOCABULARY_WORD_ALREADY_EXISTS",
    "A Vocabulary with this word already exists.",
  );
}
